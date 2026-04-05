// backend/utils/csvReader.js
// Reads Yahoo Finance CSV files from data/stocks/
// Supports the new yfinance multi-header format:
//   Row 0: Price, Close, High, Low, Open, Volume
//   Row 1: Ticker, WIPRO.NS, ...
//   Row 2: Date, , , , ,
//   Row 3+: 1996-05-14, 0.471..., 0.471..., 0.471..., 0.471..., 79999

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/stocks');

/**
 * Get list of available stock symbols from CSV files
 */
function getAvailableStocks() {
    if (!fs.existsSync(DATA_DIR)) return [];
    return fs.readdirSync(DATA_DIR)
        .filter(f => f.endsWith('.csv'))
        .map(f => {
            const base = f.replace(/\.csv$/i, '');
            // wipro.NS → WIPRO, TCS → TCS
            return base.split('.')[0].toUpperCase();
        });
}

/**
 * Detect CSV format:
 *  'yfinance_new' — 3 metadata header rows (row0=Price, row1=Ticker, row2=Date)
 *  'downloader'   — single header: Date,Close,High,Low,Open,Volume  (our Python downloader)
 *  'standard'     — single header: Date,Open,High,Low,Close[,Adj Close],Volume
 */
function detectFormat(lines) {
    const r0 = lines[0] ? lines[0].toLowerCase() : '';
    const r1 = lines[1] ? lines[1].toLowerCase() : '';
    if (r0.startsWith('price') && r1.startsWith('ticker')) return 'yfinance_new';
    // Downloader produces: Date,Close,High,Low,Open,Volume
    if (r0.startsWith('date') && r0.includes('close') && r0.includes('high')) {
        const cols = r0.split(',').map(c => c.trim());
        // If Close comes before Open it's our downloader format
        if (cols.indexOf('close') < cols.indexOf('open')) return 'downloader';
    }
    return 'standard'; // Date,Open,High,Low,Close[,Adj Close],Volume
}

/**
 * Parse a Yahoo Finance CSV file for a given symbol.
 * Returns array of { date, open, high, low, close, volume } sorted oldest→newest
 */
function readStockCSV(symbol) {
    const upper = symbol.toUpperCase();
    const lower = symbol.toLowerCase();
    // Strip leading ^ for file lookups (^NSEI → NSEI / nsei)
    const upperNoHat = upper.replace(/^\^/, '');
    const lowerNoHat = lower.replace(/^\^/, '');
    const candidates = [
        `${upper}.NS.csv`,
        `${upper}.BO.csv`,
        `${upper}.csv`,
        `${lower}.NS.csv`,
        `${lower}.BO.csv`,
        `${lower}.csv`,
        // Index variants: ^NSEI → ^nsei.csv, nsei.csv, nifty50.csv …
        `^${upperNoHat}.csv`,
        `^${lowerNoHat}.csv`,
        `${upperNoHat}.csv`,
        `${lowerNoHat}.csv`,
        `${upperNoHat}.NS.csv`,
        `${lowerNoHat}.NS.csv`,
        // Common aliases
        `nifty50.csv`, `sensex.csv`, `niftybank.csv`, `niftyit.csv`,
    ];

    let filePath = null;
    for (const name of candidates) {
        const candidate = path.join(DATA_DIR, name);
        if (fs.existsSync(candidate)) { filePath = candidate; break; }
    }
    if (!filePath) return null;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split(/\r?\n/);
    const format = detectFormat(lines);

    const rows = [];

    if (format === 'yfinance_new') {
        // Header rows: Price/Ticker/Date. Skip first 3 rows.
        // Column order after date: Close, High, Low, Open, Volume  (per row[0])
        for (let i = 3; i < lines.length; i++) {
            const cols = lines[i].split(',');
            if (cols.length < 6) continue;
            const date = cols[0].trim();
            const close = parseFloat(cols[1]);
            const high = parseFloat(cols[2]);
            const low = parseFloat(cols[3]);
            const open = parseFloat(cols[4]);
            const volume = parseInt(cols[5]) || 0;
            if (!date || isNaN(close) || close <= 0) continue;
            rows.push({ date, open, high, low, close, volume });
        }
    } else if (format === 'downloader') {
        // Our Python downloader: Date,Close,High,Low,Open,Volume
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',');
            if (cols.length < 5) continue;
            const date = cols[0].trim();
            const close = parseFloat(cols[1]);
            const high = parseFloat(cols[2]);
            const low = parseFloat(cols[3]);
            const open = parseFloat(cols[4]);
            const volume = parseInt(cols[5]) || 0;
            if (!date || isNaN(close) || close <= 0) continue;
            rows.push({ date, open, high, low, close, volume });
        }
    } else {
        // Standard Yahoo Finance: Date,Open,High,Low,Close[,Adj Close],Volume
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',');
            if (cols.length < 5) continue;
            const date = cols[0].trim();
            const open = parseFloat(cols[1]);
            const high = parseFloat(cols[2]);
            const low = parseFloat(cols[3]);
            const close = parseFloat(cols[4]);
            const volume = parseInt(cols[6]) || parseInt(cols[5]) || 0;
            if (!date || isNaN(close) || close <= 0) continue;
            rows.push({ date, open, high, low, close, volume });
        }
    }

    rows.sort((a, b) => new Date(a.date) - new Date(b.date));
    return rows;
}


/**
 * Filter rows by period string: '1w', '1m', '3m', '6m', '1y', '5y', 'all'
 * Falls back to last N trading-day-equivalent rows if data is older than period.
 */
function filterByPeriod(rows, period) {
    if (!rows || rows.length === 0) return [];
    if (period === 'all') return rows;

    const now = new Date();
    const cutoffs = { '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365, '2y': 730, '5y': 1825 };
    const days = cutoffs[period] || 30;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const filtered = rows.filter(r => new Date(r.date) >= cutoff);

    if (filtered.length === 0) {
        // Dataset is older (e.g. historical data ending 2024) — return last N rows
        const n = Math.min(rows.length, Math.ceil(days * 5 / 7));
        return rows.slice(-n);
    }
    return filtered;
}

module.exports = { readStockCSV, getAvailableStocks, filterByPeriod };
