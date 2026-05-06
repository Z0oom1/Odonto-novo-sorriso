const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

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

app.post('/api/save', (req, res) => {
    const { store, data } = req.body;
    
    try {
        if (store === 'patients') {
            const cols = Object.keys(data).filter(k => k !== 'id');
            if (data.id) {
                const sets = cols.map(c => `${c} = ?`).join(', ');
                const vals = cols.map(c => data[c]);
                db.prepare(`UPDATE patients SET ${sets} WHERE id = ?`).run(...vals, data.id);
            } else {
                const placeholders = cols.map(() => '?').join(', ');
                const info = db.prepare(`INSERT INTO patients (${cols.join(', ')}) VALUES (${placeholders})`).run(...cols.map(c => data[c]));
                data.id = info.lastInsertRowid;
            }
        } else if (store === 'appointments') {
            const cols = Object.keys(data).filter(k => k !== 'id');
            if (data.id) {
                const sets = cols.map(c => `${c} = ?`).join(', ');
                const vals = cols.map(c => data[c]);
                db.prepare(`UPDATE appointments SET ${sets} WHERE id = ?`).run(...vals, data.id);
            } else {
                const placeholders = cols.map(() => '?').join(', ');
                const info = db.prepare(`INSERT INTO appointments (${cols.join(', ')}) VALUES (${placeholders})`).run(...cols.map(c => data[c]));
                data.id = info.lastInsertRowid;
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
        }
        
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/delete', (req, res) => {
    const { store, id } = req.body;
    try {
        db.prepare(`DELETE FROM ${store} WHERE id = ?`).run(id);
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SERVIDOR NOVO SORRISO INICIADO!`);
    console.log(`----------------------------------------`);
    console.log(`Acesse no seu PC: http://localhost:${PORT}`);
    console.log(`----------------------------------------\n`);
});
