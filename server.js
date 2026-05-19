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

// Middleware de Autenticação JWT Opcional (para o portal do cliente)
const authenticateTokenOptional = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

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

// Public API Data Route for Customer Portal
app.get('/api/data', (req, res) => {
    try {
        const users = db.prepare('SELECT username, name, role FROM users').all();
        const patients = db.prepare('SELECT * FROM patients').all();
        const appointments = db.prepare('SELECT * FROM appointments').all();
        const settings = db.prepare('SELECT * FROM settings').all();
        const availability = db.prepare('SELECT * FROM availability').all();
        const notifications = db.prepare('SELECT * FROM notifications').all();

        res.json({
            users,
            patients,
            appointments,
            settings: settings.reduce((acc, curr) => {
                try {
                    acc[curr.key] = JSON.parse(curr.value);
                } catch(e) {
                    acc[curr.key] = curr.value;
                }
                return acc;
            }, {}),
            availability: availability.reduce((acc, curr) => {
                try {
                    acc[curr.date] = JSON.parse(curr.slots);
                } catch(e) {
                    acc[curr.date] = [];
                }
                return acc;
            }, {}),
            notifications
        });
    } catch(err) {
        console.error("Public API data fetch error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

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
    try {
        const settings = db.prepare('SELECT * FROM settings').all();
        const notifications = db.prepare('SELECT * FROM notifications ORDER BY date DESC LIMIT 100').all();
        const availability = db.prepare('SELECT * FROM availability').all();
        const users = db.prepare('SELECT username, name, role FROM users').all();
        const appointments = db.prepare('SELECT * FROM appointments').all();
        const patients = db.prepare('SELECT id, name, cpf, phone, gender FROM patients').all();
        
        res.json({
            settings: settings.reduce((acc, curr) => {
                try {
                    acc[curr.key] = JSON.parse(curr.value);
                } catch(e) {
                    acc[curr.key] = curr.value;
                }
                return acc;
            }, {}),
            notifications,
            availability: availability.reduce((acc, curr) => {
                try {
                    acc[curr.date] = JSON.parse(curr.slots);
                } catch(e) {
                    acc[curr.date] = [];
                }
                return acc;
            }, {}),
            users,
            appointments,
            patients
        });
    } catch(err) {
        console.error("Error fetching initial data:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/save', authenticateTokenOptional, (req, res) => {
    let { store, data } = req.body;
    
    // Controles de Acesso Públicos do Portal do Cliente
    if (!req.user) {
        if (store !== 'patients' && store !== 'appointments') {
            return res.status(401).json({ success: false, error: 'Acesso não autorizado' });
        }
    }
    
    try {
        if (store === 'patients') {
            const allowed = ['name','cpf','birth','phone','email','gender','cep','address','notes','createdAt','updatedAt'];
            const cols = allowed.filter(k => data[k] !== undefined);
            if (data.id) {
                // Modificação de paciente requer autenticação
                if (!req.user) return res.status(401).json({ success: false, error: 'Requer autenticação' });
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
            const allowed = ['patientId','date','time','procedure','status','notes','createdAt','updatedAt','rescheduleRequest'];
            // Permite salvar rescheduleRequest
            const cols = allowed.filter(k => data[k] !== undefined);
            const vals = cols.map(c => c === 'rescheduleRequest' ? JSON.stringify(data[c]) : data[c]);
            
            if (data.id) {
                // Permitido para o portal atualizar reagendamento/cancelamento
                const sets = cols.map(c => `${c} = ?`).join(', ');
                db.prepare(`UPDATE appointments SET ${sets} WHERE id = ?`).run(...vals, data.id);
            } else {
                const placeholders = cols.map(() => '?').join(', ');
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

app.post('/api/delete', authenticateTokenOptional, (req, res) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Acesso não autorizado' });
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

app.post('/api/notifications/read-all', authenticateToken, (req, res) => {
    try {
        db.prepare('UPDATE notifications SET read = 1').run();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/backup', authenticateToken, (req, res) => {
    try {
        const users = db.prepare('SELECT * FROM users').all();
        const patients = db.prepare('SELECT * FROM patients').all();
        const appointments = db.prepare('SELECT * FROM appointments').all();
        const settings = db.prepare('SELECT * FROM settings').all();
        const availability = db.prepare('SELECT * FROM availability').all();
        const notifications = db.prepare('SELECT * FROM notifications').all();
        res.json({ users, patients, appointments, settings, availability, notifications, exportedAt: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/restore', authenticateToken, (req, res) => {
    const { patients, appointments, settings, availability } = req.body;
    try {
        db.transaction(() => {
            if (patients) {
                db.prepare('DELETE FROM patients').run();
                patients.forEach(p => {
                    db.prepare('INSERT OR REPLACE INTO patients (id, name, cpf, birth, phone, email, gender, cep, address, notes, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
                        .run(p.id, p.name, p.cpf, p.birth, p.phone, p.email, p.gender, p.cep, p.address, p.notes, p.createdAt, p.updatedAt);
                });
            }
            if (appointments) {
                db.prepare('DELETE FROM appointments').run();
                appointments.forEach(a => {
                    db.prepare('INSERT OR REPLACE INTO appointments (id, patientId, date, time, procedure, status, notes, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
                        .run(a.id, a.patientId, a.date, a.time, a.procedure, a.status, a.notes, a.createdAt, a.updatedAt);
                });
            }
            if (settings) {
                db.prepare('DELETE FROM settings').run();
                settings.forEach(s => {
                    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(s.key, s.value);
                });
            }
            if (availability) {
                db.prepare('DELETE FROM availability').run();
                availability.forEach(a => {
                    db.prepare('INSERT OR REPLACE INTO availability (date, slots) VALUES (?, ?)').run(a.date, a.slots);
                });
            }
        })();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/reset', authenticateToken, (req, res) => {
    try {
        db.transaction(() => {
            db.prepare('DELETE FROM patients').run();
            db.prepare('DELETE FROM appointments').run();
            db.prepare('DELETE FROM settings').run();
            db.prepare('DELETE FROM availability').run();
            db.prepare('DELETE FROM notifications').run();
            db.prepare('DELETE FROM users WHERE username != ?').run('admin');
        })();
        res.json({ success: true, message: 'Sistema zerado com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SERVIDOR NOVO SORRISO REATORADO INICIADO!`);
    console.log(`Porta: ${PORT}`);
});
