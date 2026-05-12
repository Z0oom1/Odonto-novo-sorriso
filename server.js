const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Servir arquivos estáticos da web e desktop
app.use(express.static(path.join(__dirname, 'web')));
app.use('/desktop', express.static(path.join(__dirname, 'desktop')));
app.use('/img', express.static(path.join(__dirname, 'img')));

// API Routes
app.get('/api/data', (req, res) => {
    const users = db.prepare('SELECT * FROM users').all();
    const patients = db.prepare('SELECT * FROM patients').all();
    const appointments = db.prepare('SELECT * FROM appointments').all();
    const settings = db.prepare('SELECT * FROM settings').all();
    const availability = db.prepare('SELECT * FROM availability').all();
    const notifications = db.prepare('SELECT * FROM notifications').all();

    res.json({
        users,
        patients,
        appointments,
        settings: settings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}),
        availability: availability.reduce((acc, curr) => ({ ...acc, [curr.date]: JSON.parse(curr.slots) }), {}),
        notifications
    });
});

app.post('/api/reset', (req, res) => {
    console.log('RESET REQUEST RECEIVED');
    try {
        db.exec(`
            DELETE FROM appointments;
            DELETE FROM availability;
            DELETE FROM notifications;
            DELETE FROM patients;
            DELETE FROM settings;
            DELETE FROM sqlite_sequence WHERE name IN ('appointments', 'patients', 'notifications');
        `);
        console.log('Tables cleared');

        // Seed fictional patients
        const patientsNames = ['Heloize', 'Fernando', 'Pedro', 'Regiane'];
        const stmt = db.prepare('INSERT INTO patients (name, cpf, createdAt) VALUES (?, ?, ?)');
        patientsNames.forEach((name, idx) => {
            stmt.run(name, `000.000.000-0${idx + 1}`, new Date().toISOString());
        });
        console.log('Patients seeded');

        res.json({ success: true, message: 'Sistema zerado e pacientes fictícios adicionados.' });
    } catch (err) {
        console.error('RESET ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/save', (req, res) => {
    const { store, data } = req.body;
    
    try {
        if (store === 'patients') {
            const allowed = ['name','cpf','birth','phone','email','gender','cep','address','notes','createdAt','updatedAt'];
            const cols = allowed.filter(k => data[k] !== undefined);
            if (data.id) {
                const sets = cols.map(c => `${c} = ?`).join(', ');
                const vals = cols.map(c => typeof data[c] === 'object' ? JSON.stringify(data[c]) : data[c]);
                db.prepare(`UPDATE patients SET ${sets} WHERE id = ?`).run(...vals, data.id);
            } else {
                const placeholders = cols.map(() => '?').join(', ');
                const vals = cols.map(c => typeof data[c] === 'object' ? JSON.stringify(data[c]) : data[c]);
                const info = db.prepare(`INSERT INTO patients (${cols.join(', ')}) VALUES (${placeholders})`).run(...vals);
                data.id = info.lastInsertRowid;
                
                // New Patient Notification
                const notifMsg = `Novo paciente cadastrado: ${data.name}`;
                const notifRes = db.prepare('INSERT INTO notifications (type, targetId, message, date, read) VALUES (?, ?, ?, ?, ?)')
                  .run('patient', data.id, notifMsg, new Date().toISOString(), 0);
                
                io.emit('notification', { 
                    id: notifRes.lastInsertRowid, 
                    type: 'patient', 
                    targetId: data.id, 
                    message: notifMsg,
                    date: new Date().toISOString(),
                    read: 0
                });
            }
        } else if (store === 'appointments') {
            const allowed = ['patientId','date','time','procedure','status','notes','createdAt','updatedAt'];
            const cols = allowed.filter(k => data[k] !== undefined);
            if (data.id) {
                const sets = cols.map(c => `${c} = ?`).join(', ');
                const vals = cols.map(c => typeof data[c] === 'object' ? JSON.stringify(data[c]) : data[c]);
                db.prepare(`UPDATE appointments SET ${sets} WHERE id = ?`).run(...vals, data.id);
            } else {
                const placeholders = cols.map(() => '?').join(', ');
                const vals = cols.map(c => typeof data[c] === 'object' ? JSON.stringify(data[c]) : data[c]);
                const info = db.prepare(`INSERT INTO appointments (${cols.join(', ')}) VALUES (${placeholders})`).run(...vals);
                data.id = info.lastInsertRowid;

                // New Appointment Notification
                const patient = db.prepare('SELECT name FROM patients WHERE id = ?').get(data.patientId);
                const pName = patient ? patient.name : 'Paciente';
                const notifMsg = `Novo agendamento: ${pName} para dia ${data.date} às ${data.time}`;
                const notifRes = db.prepare('INSERT INTO notifications (type, targetId, message, date, read) VALUES (?, ?, ?, ?, ?)')
                  .run('appointment', data.id, notifMsg, new Date().toISOString(), 0);
                
                io.emit('notification', {
                    id: notifRes.lastInsertRowid,
                    type: 'appointment',
                    targetId: data.id,
                    message: notifMsg,
                    date: new Date().toISOString(),
                    read: 0
                });
            }
        } else if (store === 'users') {
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
            const targetId = data.id !== undefined ? data.id : null;
            if (targetId !== null) {
                db.prepare('UPDATE notifications SET read = ? WHERE id = ?').run(data.read, targetId);
                const updated = db.prepare('SELECT * FROM notifications WHERE id = ?').get(targetId);
                data = updated;
            } else if (data.message && String(data.message) !== 'null') {
                const info = db.prepare('INSERT INTO notifications (type, targetId, message, date, read) VALUES (?, ?, ?, ?, ?)')
                  .run(data.type || null, data.targetId || null, data.message, data.date || new Date().toISOString(), data.read || 0);
                const inserted = db.prepare('SELECT * FROM notifications WHERE id = ?').get(info.lastInsertRowid);
                data = inserted;
            }
        }
        
        res.json({ success: true, data, debugVersion: 'v2' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/delete', (req, res) => {
    const { store, id } = req.body;
    try {
        if (store === 'users') {
            db.prepare('DELETE FROM users WHERE username = ?').run(id);
        } else {
            db.prepare(`DELETE FROM ${store} WHERE id = ?`).run(id);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/notifications/read-all', (req, res) => {
    try {
        db.prepare('UPDATE notifications SET read = 1').run();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    const found = db.prepare('SELECT * FROM users WHERE username = ? AND pass = ?').get(user, pass);
    if (found) res.json({ success: true, user: found });
    else res.status(401).json({ success: false });
});

// Backup endpoints
app.get('/api/backup', (req, res) => {
    const users = db.prepare('SELECT * FROM users').all();
    const patients = db.prepare('SELECT * FROM patients').all();
    const appointments = db.prepare('SELECT * FROM appointments').all();
    const settings = db.prepare('SELECT * FROM settings').all();
    const availability = db.prepare('SELECT * FROM availability').all();
    const notifications = db.prepare('SELECT * FROM notifications').all();
    res.json({ users, patients, appointments, settings, availability, notifications, exportedAt: new Date().toISOString() });
});

app.post('/api/restore', (req, res) => {
    const { patients, appointments, settings, availability } = req.body;
    try {
        if (patients) {
            patients.forEach(p => {
                db.prepare('INSERT OR REPLACE INTO patients (id, name, cpf, birth, phone, email, gender, cep, address, notes, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
                    .run(p.id, p.name, p.cpf, p.birth, p.phone, p.email, p.gender, p.cep, p.address, p.notes, p.createdAt, p.updatedAt);
            });
        }
        if (appointments) {
            appointments.forEach(a => {
                db.prepare('INSERT OR REPLACE INTO appointments (id, patientId, date, time, procedure, status, notes, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
                    .run(a.id, a.patientId, a.date, a.time, a.procedure, a.status, a.notes, a.createdAt, a.updatedAt);
            });
        }
        if (settings) {
            settings.forEach(s => {
                db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(s.key, s.value);
            });
        }
        if (availability) {
            availability.forEach(a => {
                db.prepare('INSERT OR REPLACE INTO availability (date, slots) VALUES (?, ?)').run(a.date, a.slots);
            });
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SERVIDOR NOVO SORRISO INICIADO!`);
    console.log(`----------------------------------------`);
    console.log(`Acesse no seu PC: http://localhost:${PORT}`);
    console.log(`----------------------------------------\n`);
});
