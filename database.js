const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'odonto.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Inicializar tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    name TEXT,
    pass TEXT,
    role TEXT
  );

  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    cpf TEXT UNIQUE,
    birth TEXT,
    phone TEXT,
    email TEXT,
    gender TEXT,
    cep TEXT,
    address TEXT,
    notes TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patientId INTEGER,
    date TEXT,
    time TEXT,
    procedure TEXT,
    status TEXT,
    notes TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY(patientId) REFERENCES patients(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS availability (
    date TEXT PRIMARY KEY,
    slots TEXT
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT, -- 'patient', 'appointment'
    targetId INTEGER,
    message TEXT,
    date TEXT,
    read INTEGER DEFAULT 0
  );
`);

// Seed admin se não existir
const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!admin) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, name, pass, role) VALUES (?, ?, ?, ?)')
    .run('admin', 'Administrador', hashedPassword, 'ADMIN');
}

module.exports = db;
