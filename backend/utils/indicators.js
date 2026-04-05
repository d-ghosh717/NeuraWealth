// backend/utils/indicators.js — Full Technical Indicator Library (15 functions)
'use strict';

// ── SMA ──────────────────────────────────────────────────────────────────
function calcSMA(closes, period) {
    return closes.map((_, i) => {
        if (i < period - 1) return NaN;
        const s = closes.slice(i - period + 1, i + 1);
        return parseFloat((s.reduce((a, v) => a + v, 0) / period).toFixed(4));
    });
}

// ── EMA ──────────────────────────────────────────────────────────────────
function calcEMA(closes, period) {
    const k = 2 / (period + 1);
    let ema = null;
    return closes.map(c => {
        ema = ema === null ? c : c * k + ema * (1 - k);
        return parseFloat(ema.toFixed(4));
    });
}

// ── RSI (Wilder's smoothing) ──────────────────────────────────────────────
function calcRSI(closes, period = 14) {
    if (closes.length < period + 1) return 50;
    let ag = 0, al = 0;
    for (let i = 1; i <= period; i++) {
        const d = closes[i] - closes[i - 1];
        if (d > 0) ag += d; else al += Math.abs(d);
    }
    ag /= period; al /= period;
    for (let i = period + 1; i < closes.length; i++) {
        const d = closes[i] - closes[i - 1];
        ag = (ag * (period - 1) + Math.max(d, 0)) / period;
        al = (al * (period - 1) + Math.max(-d, 0)) / period;
    }
    if (al === 0) return 100;
    return parseFloat((100 - 100 / (1 + ag / al)).toFixed(2));
}

// ── RSI array (all values) ────────────────────────────────────────────────
function calcRSIArray(closes, period = 14) {
    const result = new Array(closes.length).fill(NaN);
    if (closes.length < period + 1) return result;
    let ag = 0, al = 0;
    for (let i = 1; i <= period; i++) {
        const d = closes[i] - closes[i - 1];
        if (d > 0) ag += d; else al += Math.abs(d);
    }
    ag /= period; al /= period;
    result[period] = al === 0 ? 100 : parseFloat((100 - 100 / (1 + ag / al)).toFixed(2));
    for (let i = period + 1; i < closes.length; i++) {
        const d = closes[i] - closes[i - 1];
        ag = (ag * (period - 1) + Math.max(d, 0)) / period;
        al = (al * (period - 1) + Math.max(-d, 0)) / period;
        result[i] = al === 0 ? 100 : parseFloat((100 - 100 / (1 + ag / al)).toFixed(2));
    }
    return result;
}

// ── Bollinger Bands ───────────────────────────────────────────────────────
function calcBollinger(closes, period = 20, mult = 2) {
    const sma = calcSMA(closes, period);
    return {
        middle: sma,
        upper: sma.map((m, i) => {
            if (isNaN(m)) return NaN;
            const sl = closes.slice(i - period + 1, i + 1);
            const sd = Math.sqrt(sl.reduce((s, v) => s + (v - m) ** 2, 0) / period);
            return parseFloat((m + mult * sd).toFixed(4));
        }),
        lower: sma.map((m, i) => {
            if (isNaN(m)) return NaN;
            const sl = closes.slice(i - period + 1, i + 1);
            const sd = Math.sqrt(sl.reduce((s, v) => s + (v - m) ** 2, 0) / period);
            return parseFloat((m - mult * sd).toFixed(4));
        })
    };
}

// ── ATR ───────────────────────────────────────────────────────────────────
function calcATR(rows, period = 14) {
    if (rows.length < 2) return 0;
    const trs = rows.slice(1).map((r, i) => {
        const p = rows[i].close;
        return Math.max(r.high - r.low, Math.abs(r.high - p), Math.abs(r.low - p));
    });
    let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
    for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
    return parseFloat(atr.toFixed(4));
}

// ── ATR Array (per row) ───────────────────────────────────────────────────
function calcATRArray(rows, period = 14) {
    const result = new Array(rows.length).fill(NaN);
    if (rows.length < period + 1) return result;
    const trs = rows.slice(1).map((r, i) => {
        const p = rows[i].close;
        return Math.max(r.high - r.low, Math.abs(r.high - p), Math.abs(r.low - p));
    });
    let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
    result[period] = parseFloat(atr.toFixed(4));
    for (let i = period; i < trs.length; i++) {
        atr = (atr * (period - 1) + trs[i]) / period;
        result[i + 1] = parseFloat(atr.toFixed(4));
    }
    return result;
}

// ── MACD values array ─────────────────────────────────────────────────────
function calcMACDArray(closes, fast = 12, slow = 26, signal = 9) {
    const emaFast = calcEMA(closes, fast);
    const emaSlow = calcEMA(closes, slow);
    const macdLine = emaFast.map((v, i) => parseFloat((v - emaSlow[i]).toFixed(4)));
    const signalLine = calcEMA(macdLine.slice(slow - 1), signal);
    const fullSignal = [...new Array(slow - 1).fill(NaN), ...signalLine];
    const histogram = macdLine.map((v, i) => parseFloat((v - (fullSignal[i] || 0)).toFixed(4)));
    return { macdLine, signalLine: fullSignal, histogram };
}

// ── Stochastic Oscillator ─────────────────────────────────────────────────
function calcStochastic(rows, kPeriod = 14, dPeriod = 3) {
    const kRaw = rows.map((_, i) => {
        if (i < kPeriod - 1) return NaN;
        const window = rows.slice(i - kPeriod + 1, i + 1);
        const hh = Math.max(...window.map(r => r.high));
        const ll = Math.min(...window.map(r => r.low));
        if (hh === ll) return 50;
        return parseFloat(((rows[i].close - ll) / (hh - ll) * 100).toFixed(2));
    });
    // %D = SMA of %K
    const kClean = kRaw.map(v => isNaN(v) ? 0 : v);
    const dLine = calcSMA(kClean, dPeriod);
    const finalD = dLine.map((v, i) => isNaN(kRaw[i]) ? NaN : parseFloat(v.toFixed(2)));
    return { k: kRaw, d: finalD };
}

// ── Stochastic RSI ────────────────────────────────────────────────────────
function calcStochRSI(closes, rsiPeriod = 14, stochPeriod = 14) {
    const rsiArr = calcRSIArray(closes, rsiPeriod);
    return rsiArr.map((_, i) => {
        if (i < rsiPeriod + stochPeriod - 2) return NaN;
        const window = rsiArr.slice(i - stochPeriod + 1, i + 1).filter(v => !isNaN(v));
        if (window.length === 0) return NaN;
        const hh = Math.max(...window);
        const ll = Math.min(...window);
        if (hh === ll) return 50;
        return parseFloat(((rsiArr[i] - ll) / (hh - ll) * 100).toFixed(2));
    });
}

// ── Williams %R ───────────────────────────────────────────────────────────
function calcWilliamsR(rows, period = 14) {
    return rows.map((_, i) => {
        if (i < period - 1) return NaN;
        const window = rows.slice(i - period + 1, i + 1);
        const hh = Math.max(...window.map(r => r.high));
        const ll = Math.min(...window.map(r => r.low));
        if (hh === ll) return -50;
        return parseFloat(((hh - rows[i].close) / (hh - ll) * -100).toFixed(2));
    });
}

// ── CCI (Commodity Channel Index) ────────────────────────────────────────
function calcCCI(rows, period = 20) {
    return rows.map((_, i) => {
        if (i < period - 1) return NaN;
        const window = rows.slice(i - period + 1, i + 1);
        const tp = window.map(r => (r.high + r.low + r.close) / 3);
        const avgTP = tp.reduce((s, v) => s + v, 0) / period;
        const md = tp.reduce((s, v) => s + Math.abs(v - avgTP), 0) / period;
        if (md === 0) return 0;
        return parseFloat(((tp[tp.length - 1] - avgTP) / (0.015 * md)).toFixed(2));
    });
}

// ── OBV (On-Balance Volume) ───────────────────────────────────────────────
function calcOBV(rows) {
    const result = [0];
    for (let i = 1; i < rows.length; i++) {
        const prev = result[i - 1];
        if (rows[i].close > rows[i - 1].close) result.push(prev + rows[i].volume);
        else if (rows[i].close < rows[i - 1].close) result.push(prev - rows[i].volume);
        else result.push(prev);
    }
    return result;
}

// ── VWAP ─────────────────────────────────────────────────────────────────
function calcVWAP(rows, days = 20) {
    const s = rows.slice(-days);
    const tv = s.reduce((acc, r) => acc + r.volume, 0);
    if (tv === 0) return s[s.length - 1].close;
    return parseFloat((s.reduce((acc, r) => acc + ((r.high + r.low + r.close) / 3) * r.volume, 0) / tv).toFixed(4));
}

// ── Support & Resistance (pivot swing) ───────────────────────────────────
function calcSupportResistance(rows, lookback = 60) {
    const r = rows.slice(-lookback);
    const cur = r[r.length - 1].close;
    const swL = [], swH = [];
    for (let i = 2; i < r.length - 2; i++) {
        if (r[i].low < r[i - 1].low && r[i].low < r[i - 2].low && r[i].low < r[i + 1].low && r[i].low < r[i + 2].low) swL.push(r[i].low);
        if (r[i].high > r[i - 1].high && r[i].high > r[i - 2].high && r[i].high > r[i + 1].high && r[i].high > r[i + 2].high) swH.push(r[i].high);
    }
    const supports = swL.filter(v => v < cur).sort((a, b) => b - a);
    const resistances = swH.filter(v => v > cur).sort((a, b) => a - b);
    return {
        support: parseFloat((supports[0] || cur * 0.95).toFixed(2)),
        support2: parseFloat((supports[1] || cur * 0.90).toFixed(2)),
        resistance: parseFloat((resistances[0] || cur * 1.05).toFixed(2)),
        resistance2: parseFloat((resistances[1] || cur * 1.10).toFixed(2)),
    };
}

// ── Beta estimation ───────────────────────────────────────────────────────
function estimateBeta(closes) {
    if (closes.length < 30) return 1.0;
    const rets = [];
    for (let i = 1; i < closes.length; i++) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    const r60 = rets.slice(-60);
    const mean = r60.reduce((s, v) => s + v, 0) / r60.length;
    const vol = Math.sqrt(r60.reduce((s, v) => s + (v - mean) ** 2, 0) / r60.length);
    return parseFloat(Math.max(0.2, Math.min(3.0, vol / 0.008)).toFixed(2));
}

// ── Sharpe Ratio ─────────────────────────────────────────────────────────
function estimateSharpe(closes) {
    if (closes.length < 30) return null;
    const rets = [];
    for (let i = 1; i < closes.length; i++) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    const r60 = rets.slice(-60);
    const mean = r60.reduce((s, v) => s + v, 0) / r60.length;
    const vol = Math.sqrt(r60.reduce((s, v) => s + (v - mean) ** 2, 0) / r60.length);
    const rfDaily = 0.065 / 252;
    if (vol === 0) return null;
    return parseFloat(((mean - rfDaily) / vol * Math.sqrt(252)).toFixed(2));
}

// ── Breakout detection ────────────────────────────────────────────────────
function detectBreakout(rows, bb) {
    const closes = rows.map(r => r.close);
    const volumes = rows.map(r => r.volume);
    const cur = closes[closes.length - 1];
    const h52 = Math.max(...rows.slice(-252).map(r => r.high));
    const bbU = latest(bb.upper), bbL = latest(bb.lower), bbM = latest(bb.middle);
    const volAvg = volumes.slice(-20).reduce((s, v) => s + v, 0) / 20;
    const latVol = volumes[volumes.length - 1];
    const near52H = h52 > 0 && cur / h52 > 0.98;
    const volBrk = latVol > volAvg * 1.5;
    const bbW = bbU && bbL ? (bbU - bbL) / bbM : 0;
    const bbSqueeze = bbW < 0.04;
    const aboveBBU = bbU && cur > bbU;
    let pattern = 'No breakout pattern';
    if (near52H && volBrk) pattern = '🚀 52W High Breakout with volume confirmation';
    else if (aboveBBU) pattern = '📈 Bollinger upper band breakout';
    else if (bbSqueeze && volBrk) pattern = '⚡ Bollinger Squeeze + volume surge — breakout imminent';
    else if (near52H) pattern = '📊 Near 52W High — watching for breakout';
    else if (volBrk) pattern = '📊 Volume surge — monitor for direction';
    return { pattern, near52High: near52H, volBreakout: volBrk, bbSqueeze, aboveBBUpper: aboveBBU, bbWidth: parseFloat((bbW * 100).toFixed(2)) };
}

// ── Trend detection ───────────────────────────────────────────────────────
function detectTrend(closes, n = 10) {
    if (closes.length < n) return 'Neutral';
    const recent = closes.slice(-n);
    const pct = (recent[recent.length - 1] - recent[0]) / recent[0] * 100;
    return pct > 1.5 ? 'Bullish' : pct < -1.5 ? 'Bearish' : 'Neutral';
}

// ── Helpers ───────────────────────────────────────────────────────────────
function latest(arr) {
    for (let i = arr.length - 1; i >= 0; i--) if (!isNaN(arr[i]) && arr[i] !== null) return arr[i];
    return null;
}
function pctChange(a, b) {
    if (!a) return 0;
    return parseFloat(((b - a) / a * 100).toFixed(2));
}

module.exports = {
    calcSMA, calcEMA, calcRSI, calcRSIArray,
    calcBollinger, calcATR, calcATRArray, calcMACDArray,
    calcStochastic, calcStochRSI, calcWilliamsR, calcCCI, calcOBV,
    calcVWAP, calcSupportResistance,
    estimateBeta, estimateSharpe,
    detectBreakout, detectTrend,
    latest, pctChange,
};
