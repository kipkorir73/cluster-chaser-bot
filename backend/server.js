const path = require('path');
const fs = require('fs');
// Load root .env first (single source), then backend/.env if present
const rootEnv = path.resolve(__dirname, '..', '.env');
const backendEnv = path.resolve(__dirname, '.env');
try { require('dotenv').config({ path: rootEnv }); } catch {}
try { require('dotenv').config({ path: backendEnv, override: false }); } catch {}
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3001;

// Ensure data directory exists
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const dbPath = path.resolve(dataDir, 'app.db');
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS trades (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	symbol TEXT NOT NULL,
	contract_type TEXT NOT NULL,
	amount REAL NOT NULL,
	duration INTEGER NOT NULL,
	target_digit INTEGER NOT NULL,
	paper INTEGER NOT NULL,
	timestamp INTEGER NOT NULL
);
`);

// Settings storage (single-source app settings)
db.exec(`
CREATE TABLE IF NOT EXISTS settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);
`);

const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const upsertSettingStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

const insertTradeStmt = db.prepare(`
INSERT INTO trades (symbol, contract_type, amount, duration, target_digit, paper, timestamp)
VALUES (@symbol, @contract_type, @amount, @duration, @target_digit, @paper, @timestamp)
`);

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/api/health', (_req, res) => {
	res.json({ ok: true, db: true });
});

// Single source of truth for token
app.get('/api/token', (_req, res) => {
	const token = process.env.DERIV_API_TOKEN;
	if (!token) {
		return res.status(500).json({ error: 'DERIV_API_TOKEN is not set in .env at project root' });
	}
	res.json({ token });
});

// App settings endpoints
const defaultSettings = {
	connectionSettings: { appId: '1089', alertThreshold: 5, autoTrade: false, selectedVolatility: 'R_25' },
	autoTradeSettings: { enabled: true, tradeAmount: 1, tradeDuration: 1, minClusterSize: 5 },
	soundSettings: { enabled: true },
	paperSettings: { enabled: true }
};

app.get('/api/settings', (_req, res) => {
	try {
		const row = getSettingStmt.get('app');
		if (!row) return res.json(defaultSettings);
		const parsed = JSON.parse(row.value);
		res.json({ ...defaultSettings, ...parsed });
	} catch (e) {
		res.json(defaultSettings);
	}
});

app.put('/api/settings', (req, res) => {
	try {
		const incoming = req.body || {};
		const merged = { ...defaultSettings, ...incoming };
		upsertSettingStmt.run('app', JSON.stringify(merged));
		res.json({ ok: true });
	} catch (e) {
		res.status(500).json({ error: 'Failed to save settings' });
	}
});

// Store trades
app.post('/api/trades', (req, res) => {
	try {
		const { symbol, contract_type, amount, duration, target_digit, paper, timestamp } = req.body || {};
		if (!symbol || !contract_type || typeof amount !== 'number' || typeof duration !== 'number' || typeof target_digit !== 'number') {
			return res.status(400).json({ error: 'Invalid trade payload' });
		}
		const payload = {
			symbol: String(symbol),
			contract_type: String(contract_type),
			amount: Number(amount),
			duration: Number(duration),
			target_digit: Number(target_digit),
			paper: paper ? 1 : 0,
			timestamp: typeof timestamp === 'number' ? timestamp : Date.now()
		};
		insertTradeStmt.run(payload);
		res.status(201).json({ ok: true });
	} catch (err) {
		console.error('Error inserting trade:', err);
		res.status(500).json({ error: 'Failed to store trade' });
	}
});

// Read trades
app.get('/api/trades', (req, res) => {
	const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500);
	const rows = db.prepare('SELECT * FROM trades ORDER BY timestamp DESC LIMIT ?').all(limit);
	res.json({ trades: rows });
});

// Serve built frontend in production
const distDir = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
	app.use(express.static(distDir));
	app.get('*', (_req, res) => {
		res.sendFile(path.join(distDir, 'index.html'));
	});
}

app.listen(PORT, () => {
	console.log(`Backend API listening on http://localhost:${PORT}`);
});

