// backend/server.js — Neura2 Main Express Server
require('dotenv').config(); // Load .env into process.env
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const { readStockCSV, getAvailableStocks, filterByPeriod } = require('./utils/csvReader');
const { analyzeStock, generateDemoHistory, getStockInfo, DEMO_STOCKS } = require('./utils/predictor');
const { chat } = require('./utils/chatbot');
const { runAllStrategies } = require('./utils/backtest');

const app = express();
const PORT = 5600;

const DATA_DIR = path.join(__dirname, '../data/stocks');
const DOWNLOADER_PY = path.join(__dirname, 'downloader.py');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Per-symbol cooldown so we don't hammer Yahoo on every keystroke ─────────
const downloadCache = new Map();
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes between fresh downloads

// ── Download stock data from yfinance via Python ───────────────────────────
function downloadFromYahoo(symbol) {
    return new Promise((resolve, reject) => {
        const py = spawn('python', [DOWNLOADER_PY, symbol, DATA_DIR]);
        let stdout = '', stderr = '';
        py.stdout.on('data', d => stdout += d.toString());
        py.stderr.on('data', d => stderr += d.toString());
        py.on('close', code => {
            try {
                const result = JSON.parse(stdout.trim());
                if (result.success) resolve(result);
                else reject(new Error(result.error || 'Download failed'));
            } catch {
                reject(new Error(stderr || 'Python parse error'));
            }
        });
    });
}

// ── Get rows: always try fresh download first (10-min cooldown per symbol) ──
async function getRows(symbol) {
    const cached = downloadCache.get(symbol);
    const now = Date.now();

    // Attempt fresh download unless within cooldown window
    if (!cached || now - cached.ts >= COOLDOWN_MS) {
        try {
            console.log(`📡 Refreshing ${symbol}…`);
            await downloadFromYahoo(symbol); // overwrites old CSV on disk
            const fresh = readStockCSV(symbol);
            if (fresh && fresh.length > 10) {
                downloadCache.set(symbol, { rows: fresh, ts: now });
                console.log(`✅ ${symbol}: ${fresh.length} rows (latest: ${fresh[fresh.length - 1].date})`);
                return fresh;
            }
        } catch (e) {
            console.warn(`⚠️  Download failed for ${symbol}: ${e.message}`);
        }
    }

    // Cooldown active — return already-cached rows
    if (cached?.rows?.length > 10) return cached.rows;

    // No cache — try reading existing CSV from disk
    const csv = readStockCSV(symbol);
    if (csv && csv.length > 10) {
        downloadCache.set(symbol, { rows: csv, ts: now });
        return csv;
    }

    // Last resort: synthetic demo data
    console.log(`📊 Using demo data for ${symbol}`);
    return generateDemoHistory(symbol);
}

// ── Health check ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Neura2 server running', port: PORT });
});

// ── List available stocks ─────────────────────────────────────────────────
app.get('/api/stocks/list', (req, res) => {
    const csvStocks = getAvailableStocks();
    const demoList = Object.entries(DEMO_STOCKS).map(([sym, info]) => ({
        symbol: sym, name: info.name, sector: info.sector, source: 'demo'
    }));
    const csvSet = new Set(csvStocks);
    const merged = [
        ...csvStocks.map(sym => ({
            symbol: sym,
            name: getStockInfo(sym).name,
            sector: getStockInfo(sym).sector,
            source: 'csv'
        })),
        ...demoList.filter(d => !csvSet.has(d.symbol))
    ];
    res.json({ success: true, data: merged });
});

// ── Manual download endpoint ───────────────────────────────────────────────
app.post('/api/stocks/download', async (req, res) => {
    const symbol = (req.body.symbol || '').toString().trim().toUpperCase();
    if (!symbol) return res.status(400).json({ success: false, error: 'No symbol provided' });
    try {
        downloadCache.delete(symbol);
        const result = await downloadFromYahoo(symbol);
        const rows = readStockCSV(symbol);
        if (rows && rows.length > 10) downloadCache.set(symbol, { rows, ts: Date.now() });
        res.json({ success: true, symbol, rows: result.rows, latestDate: result.latestDate, latestClose: result.latestClose });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── Stock quote (latest price data) ───────────────────────────────────────
app.get('/api/stocks/quote/:symbol', async (req, res) => {
    const symbol = decodeURIComponent(req.params.symbol).toUpperCase();
    const rows = await getRows(symbol);
    const result = analyzeStock(symbol, rows);
    res.json({ success: true, data: { symbol: result.symbol, name: result.name, sector: result.sector, price: result.currentPrice, previousClose: result.previousClose, change: result.change, changePercent: result.changePercent, open: result.open, high: result.high, low: result.low, volume: result.volume, week52High: result.week52High, week52Low: result.week52Low, avgVolume: result.avgVolume } });
});

// ── Historical price data ─────────────────────────────────────────────────
app.get('/api/stocks/history/:symbol', async (req, res) => {
    const symbol = decodeURIComponent(req.params.symbol).toUpperCase();
    const period = req.query.period || '1m';
    const rows = await getRows(symbol);
    const sliced = filterByPeriod(rows, period);
    res.json({ success: true, symbol, period, data: sliced });
});

// ── Predict / AI Analysis ─────────────────────────────────────────────────
app.get('/api/stocks/predict/:symbol', async (req, res) => {
    const symbol = decodeURIComponent(req.params.symbol).toUpperCase();
    const rows = await getRows(symbol);
    const result = analyzeStock(symbol, rows);
    res.json({ success: true, data: result });
});

// ── Backtesting Engine ────────────────────────────────────────────────────
app.get('/api/backtest/:symbol', async (req, res) => {
    const symbol = decodeURIComponent(req.params.symbol).toUpperCase();
    console.log(`📈 Backtesting ${symbol}…`);
    try {
        const rows = await getRows(symbol);
        if (rows.length < 60) return res.status(400).json({ success: false, error: 'Need 60+ days of data' });
        const results = runAllStrategies(rows);
        res.json({ success: true, symbol, data: results });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── Market Regime ─────────────────────────────────────────────────────────
app.get('/api/regime/:symbol', async (req, res) => {
    const symbol = decodeURIComponent(req.params.symbol).toUpperCase();
    try {
        const rows = await getRows(symbol);
        const result = analyzeStock(symbol, rows);
        res.json({ success: true, symbol, data: { regime: result.regime, probability: result.probability, risk: result.risk } });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── Correlation Matrix ────────────────────────────────────────────────────
app.get('/api/correlation', async (req, res) => {
    const rawSymbols = (req.query.symbols || 'TCS,INFY,WIPRO,RELIANCE,HDFCBANK').toUpperCase();
    const syms = rawSymbols.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);
    console.log(`📊 Correlation matrix for: ${syms.join(', ')}`);
    try {
        const allRows = await Promise.all(syms.map(s => getRows(s)));
        const allCloses = allRows.map(rows => rows.slice(-252).map(r => r.close));
        const allReturns = allCloses.map(closes => {
            const rets = [];
            for (let i = 1; i < closes.length; i++) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
            return rets;
        });
        function pearson(a, b) {
            const n = Math.min(a.length, b.length);
            if (n < 5) return 0;
            const ax = a.slice(-n), bx = b.slice(-n);
            const ma = ax.reduce((s, v) => s + v, 0) / n;
            const mb = bx.reduce((s, v) => s + v, 0) / n;
            let cov = 0, va = 0, vb = 0;
            for (let i = 0; i < n; i++) { cov += (ax[i] - ma) * (bx[i] - mb); va += (ax[i] - ma) ** 2; vb += (bx[i] - mb) ** 2; }
            const d = Math.sqrt(va * vb);
            return d === 0 ? 0 : parseFloat((cov / d).toFixed(3));
        }
        const matrix = syms.map((s1, i) => syms.map((s2, j) => ({
            symbol1: s1, symbol2: s2,
            correlation: i === j ? 1.0 : pearson(allReturns[i], allReturns[j])
        })));
        const stats = syms.map((s, i) => {
            const rets = allReturns[i];
            const closes = allCloses[i];
            const mean = rets.reduce((a, v) => a + v, 0) / rets.length;
            const vol = Math.sqrt(rets.reduce((a, v) => a + (v - mean) ** 2, 0) / rets.length);
            return {
                symbol: s,
                annualReturn: parseFloat((mean * 252 * 100).toFixed(2)),
                annualVol: parseFloat((vol * Math.sqrt(252) * 100).toFixed(2)),
                totalReturn1Y: closes.length > 1 ? parseFloat(((closes[closes.length - 1] - closes[0]) / closes[0] * 100).toFixed(2)) : 0,
            };
        });
        res.json({ success: true, symbols: syms, matrix, stats });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── News / Sentiment via GNews ─────────────────────────────────────────────
app.get('/api/news/:symbol', async (req, res) => {
    const symbol = decodeURIComponent(req.params.symbol).toUpperCase();
    const apiKey = process.env.GNEWS_API_KEY;
    if (!apiKey) {
        return res.json({
            success: false,
            configured: false,
            error: 'GNEWS_API_KEY not set in backend/.env. Get a free key at gnews.io and restart the server.',
            symbol,
        });
    }
    try {
        // GNews API — https://gnews.io/docs/
        const query = encodeURIComponent(`${symbol} stock NSE India`);
        const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&max=20&sortby=publishedAt&token=${apiKey}`;
        const fetch = require('node-fetch');
        const data = await fetch(url).then(r => r.json());
        if (data.errors) throw new Error(Array.isArray(data.errors) ? data.errors.join(', ') : 'GNews error');

        // Keyword-based sentiment scoring (FinBERT-ready hook)
        const POS_WORDS = ['rise', 'gain', 'surge', 'growth', 'profit', 'bullish', 'beat', 'positive', 'strong', 'buy', 'rally', 'jump', 'upgrade'];
        const NEG_WORDS = ['fall', 'drop', 'loss', 'crash', 'bearish', 'miss', 'weak', 'sell', 'decline', 'risk', 'plunge', 'downgrade', 'slump'];

        const articles = (data.articles || []).map(a => {
            const text = (a.title + ' ' + (a.description || '')).toLowerCase();
            const pos = POS_WORDS.filter(w => text.includes(w)).length;
            const neg = NEG_WORDS.filter(w => text.includes(w)).length;
            const sentiment = pos > neg ? 'Positive' : neg > pos ? 'Negative' : 'Neutral';
            return {
                title: a.title,
                url: a.url,
                image: a.image || null,
                source: a.source?.name || 'Unknown',
                publishedAt: a.publishedAt,
                description: a.description || '',
                sentiment,
                score: parseFloat((pos / Math.max(pos + neg, 1)).toFixed(2)),
            };
        });

        const positive = articles.filter(a => a.sentiment === 'Positive').length;
        const negative = articles.filter(a => a.sentiment === 'Negative').length;
        const neutral = articles.filter(a => a.sentiment === 'Neutral').length;
        const label = positive > negative ? 'Bullish' : negative > positive ? 'Bearish' : 'Neutral';

        res.json({ success: true, symbol, articles, sentiment: { positive, negative, neutral, label } });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── Chatbot ───────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'No message provided' });
    console.log(`💬 Chat: "${message}"`);
    try {
        const response = await chat(message, getRows);
        res.json({ success: true, response });
    } catch (e) {
        res.json({ success: true, response: `⚠️ Error: ${e.message}` });
    }
});

// ── SPA fallback ──────────────────────────────────────────────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Start server ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
    const csvCount = getAvailableStocks().length;
    console.log(`\n✅ Neura2 running on http://localhost:${PORT}`);
    console.log(`📁 CSV stocks loaded: ${csvCount || 'None'}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET  /api/stocks/predict/:symbol`);
    console.log(`  GET  /api/backtest/:symbol`);
    console.log(`  GET  /api/regime/:symbol`);
    console.log(`  GET  /api/correlation?symbols=TCS,INFY,WIPRO`);
    console.log(`  POST /api/chat  { message }`);
});
