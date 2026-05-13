const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Middleware de Autenticação JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token não fornecido' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido ou expirado' });
        req.user = user;
        next();
    });
};

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'web')));
app.use('/desktop', express.static(path.join(__dirname, 'desktop')));
app.use('/img', express.static(path.join(__dirname, 'img')));

// Auth Routes
app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    const found = db.prepare('SELECT * FROM users WHERE username = ?').get(user);
    
    if (found && bcrypt.compareSync(pass, found.pass)) {
        const token = jwt.sign({ username: found.username, role: found.role }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ success: true, user: { username: found.username, name: found.name, role: found.role }, token });
    } else {
        res.status(401).json({ success: false, message: 'Usuário ou senha inválidos' });
    }
});

// Paginated API Routes
app.get('/api/patients', authenticateToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : '%';

    const count = db.prepare('SELECT COUNT(*) as total FROM patients WHERE name LIKE ?').get(search).total;
    const patients = db.prepare('SELECT * FROM patients WHERE name LIKE ? LIMIT ? OFFSET ?').all(search, limit, offset);

    res.json({
        data: patients,
        pagination: {
            total: count,
            page,
            limit,
            pages: Math.ceil(count / limit)
        }
    });
});

app.get('/api/appointments', authenticateToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const date = req.query.date;

    let query = 'SELECT a.*, p.name as patientName FROM appointments a JOIN patients p ON a.patientId = p.id';
    let params = [];

    if (date) {
        query += ' WHERE a.date = ?';
        params.push(date);
    }

    const countQuery = date ? 'SELECT COUNT(*) as total FROM appointments WHERE date = ?' : 'SELECT COUNT(*) as total FROM appointments';
    const count = db.prepare(countQuery).get(...params).total;

    query += ' ORDER BY a.date DESC, a.time ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const appointments = db.prepare(query).all(...params);

    res.json({
        data: appointments,
        pagination: {
            total: count,
            page,
            limit,
            pages: Math.ceil(count / limit)
        }
    });
});

// Outros dados (Settings, Availability, etc.)
app.get('/api/initial-data', authenticateToken, (req, res) => {
    const settings = db.prepare('SELECT * FROM settings').all();
    const notifications = db.prepare('SELECT * FROM notifications WHERE read = 0 ORDER BY date DESC LIMIT 50').all();
    
    res.json({
        settings: settings.reduce((acc, curr) => ({ ...acc, [curr.key]: JSON.parse(curr.value) }), {}),
        notifications
    });
});

app.post('/api/save', authenticateToken, (req, res) => {
    let { store, data } = req.body;
    
    try {
        if (store === 'patients') {
            const allowed = ['name','cpf','birth','phone','email','gender','cep','address','notes','createdAt','updatedAt'];
            const cols = allowed.filter(k => data[k] !== undefined);
            if (data.id) {
                const sets = cols.map(c => `${c} = ?`).join(', ');
                const vals = cols.map(c => data[c]);
                db.prepare(`UPDATE patients SET ${sets} WHERE id = ?`).run(...vals, data.id);
            } else {
                const placeholders = cols.map(() => '?').join(', ');
                const vals = cols.map(c => data[c]);
                const info = db.prepare(`INSERT INTO patients (${cols.join(', ')}) VALUES (${placeholders})`).run(...vals);
                data.id = info.lastInsertRowid;
                
                const notifMsg = `Novo paciente cadastrado: ${data.name}`;
                const notifRes = db.prepare('INSERT INTO notifications (type, targetId, message, date, read) VALUES (?, ?, ?, ?, ?)')
                  .run('patient', data.id, notifMsg, new Date().toISOString(), 0);
                
                io.emit('notification', { id: notifRes.lastInsertRowid, type: 'patient', targetId: data.id, message: notifMsg, date: new Date().toISOString(), read: 0 });
            }
        } else if (store === 'appointments') {
            const allowed = ['patientId','date','time','procedure','status','notes','createdAt','updatedAt'];
            const cols = allowed.filter(k => data[k] !== undefined);
            if (data.id) {
                const sets = cols.map(c => `${c} = ?`).join(', ');
                const vals = cols.map(c => data[c]);
                db.prepare(`UPDATE appointments SET ${sets} WHERE id = ?`).run(...vals, data.id);
            } else {
                const placeholders = cols.map(() => '?').join(', ');
                const vals = cols.map(c => data[c]);
                const info = db.prepare(`INSERT INTO appointments (${cols.join(', ')}) VALUES (${placeholders})`).run(...vals);
                data.id = info.lastInsertRowid;

                const patient = db.prepare('SELECT name FROM patients WHERE id = ?').get(data.patientId);
                const pName = patient ? patient.name : 'Paciente';
                const notifMsg = `Novo agendamento: ${pName} para dia ${data.date} às ${data.time}`;
                const notifRes = db.prepare('INSERT INTO notifications (type, targetId, message, date, read) VALUES (?, ?, ?, ?, ?)')
                  .run('appointment', data.id, notifMsg, new Date().toISOString(), 0);
                
                io.emit('notification', { id: notifRes.lastInsertRowid, type: 'appointment', targetId: data.id, message: notifMsg, date: new Date().toISOString(), read: 0 });
            }
        } else if (store === 'users') {
            if (data.pass) {
                data.pass = bcrypt.hashSync(data.pass, 10);
            }
            db.prepare('INSERT OR REPLACE INTO users (username, name, pass, role) VALUES (?, ?, ?, ?)').run(data.username, data.name, data.pass, data.role);
        } else if (store === 'settings') {
            Object.keys(data).forEach(key => {
                db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(data[key]));
            });
        } else if (store === 'availability') {
            Object.keys(data).forEach(date => {
                db.prepare('INSERT OR REPLACE INTO availability (date, slots) VALUES (?, ?)').run(date, JSON.stringify(data[date]));
            });
        } else if (store === 'notifications') {
            if (data.id) {
                db.prepare('UPDATE notifications SET read = ? WHERE id = ?').run(data.read, data.id);
            }
        }
        
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/delete', authenticateToken, (req, res) => {
    const { store, id } = req.body;
    try {
        if (store === 'users') {
            db.prepare('DELETE FROM users WHERE username = ?').run(id);
        } else {
            // Garante que o ID seja um número se for para tabelas com ID numérico
            const targetId = (store === 'patients' || store === 'appointments' || store === 'notifications') ? parseInt(id) : id;
            db.prepare(`DELETE FROM ${store} WHERE id = ?`).run(targetId);
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SERVIDOR NOVO SORRISO REATORADO INICIADO!`);
    console.log(`Porta: ${PORT}`);
});
