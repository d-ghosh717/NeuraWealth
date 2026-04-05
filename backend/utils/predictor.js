// backend/utils/predictor.js — Advanced stock analyser with regime, VaR, probability, explainability
'use strict';

const {
    calcRSI, calcSMA, calcEMA, calcEMA: _ema, latest, pctChange, detectTrend,
    calcBollinger, calcATR, calcATRArray, calcMACDArray, calcRSIArray,
    calcStochastic, calcWilliamsR, calcCCI, calcOBV,
    calcSupportResistance, estimateBeta, estimateSharpe, calcVWAP, detectBreakout
} = require('./indicators');

// ── Demo data ─────────────────────────────────────────────────────────────
const DEMO_STOCKS = {
    TCS: { name: 'Tata Consultancy Services', basePrice: 3890, sector: 'IT' },
    RELIANCE: { name: 'Reliance Industries', basePrice: 2750, sector: 'Energy' },
    INFY: { name: 'Infosys', basePrice: 1520, sector: 'IT' },
    HDFCBANK: { name: 'HDFC Bank', basePrice: 1680, sector: 'Banking' },
    WIPRO: { name: 'Wipro', basePrice: 480, sector: 'IT' },
    ICICIBANK: { name: 'ICICI Bank', basePrice: 1050, sector: 'Banking' },
    BAJFINANCE: { name: 'Bajaj Finance', basePrice: 6850, sector: 'NBFC' },
    TATAMOTORS: { name: 'Tata Motors', basePrice: 915, sector: 'Auto' },
};

function generateDemoHistory(symbol, days = 300) {
    const info = DEMO_STOCKS[symbol] || { basePrice: 1000 };
    let price = info.basePrice * 0.90;
    let rng = info.basePrice;
    function seededRnd() { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; }

    const rows = [];
    const today = new Date();
    for (let i = days; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        const change = (seededRnd() - 0.48) * 0.022;
        price *= (1 + change);
        const open = price * (0.99 + seededRnd() * 0.015);
        const high = price * (1.005 + seededRnd() * 0.02);
        const low = price * (0.98 - seededRnd() * 0.01);
        rows.push({
            date: date.toISOString().split('T')[0],
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(price.toFixed(2)),
            volume: Math.floor(800000 + seededRnd() * 1500000)
        });
    }
    return rows;
}

function getStockInfo(symbol) {
    const IDX = {
        '^NSEI': { name: 'Nifty 50 Index', sector: 'Index' },
        '^BSESN': { name: 'BSE Sensex', sector: 'Index' },
        '^NSEBANK': { name: 'Nifty Bank Index', sector: 'Index' },
        '^CNXIT': { name: 'Nifty IT Index', sector: 'Index' },
    };
    return IDX[symbol] || DEMO_STOCKS[symbol] || { name: symbol, sector: 'Equity', basePrice: 1000 };
}

function stdDev(arr) {
    const m = arr.reduce((s, v) => s + v, 0) / arr.length;
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

// ── Regime Detection ──────────────────────────────────────────────────────
function detectRegime(closes, rows) {
    const sma200 = calcSMA(closes, 200);
    const sma50 = calcSMA(closes, 50);
    const cur = closes[closes.length - 1];
    const latSMA200 = latest(sma200);
    const latSMA50 = latest(sma50);

    // Volatility clustering: compare last 10d vol vs last 60d vol
    const rets60 = [];
    for (let i = closes.length - 61; i < closes.length - 1; i++) {
        if (i >= 1) rets60.push((closes[i + 1] - closes[i]) / closes[i]);
    }
    const rets10 = rets60.slice(-10);
    const vol60 = stdDev(rets60);
    const vol10 = stdDev(rets10);
    const highVol = vol10 > vol60 * 1.5;

    let regime, regimeIcon, regimeColor;
    if (highVol && cur < latSMA200) {
        regime = 'Bear + High Volatility'; regimeIcon = '🔴⚡'; regimeColor = 'danger';
    } else if (cur > latSMA200 && latSMA50 > latSMA200) {
        regime = 'Bull Market'; regimeIcon = '🟢'; regimeColor = 'success';
    } else if (cur < latSMA200) {
        regime = 'Bear Market'; regimeIcon = '🔴'; regimeColor = 'danger';
    } else if (highVol) {
        regime = 'High Volatility'; regimeIcon = '⚡'; regimeColor = 'warning';
    } else {
        regime = 'Sideways / Accumulation'; regimeIcon = '🟡'; regimeColor = 'warning';
    }

    const trend10 = detectTrend(closes, 10);
    const trend30 = closes.length > 30
        ? ((closes[closes.length - 1] - closes[closes.length - 30]) / closes[closes.length - 30] * 100)
        : 0;

    return {
        regime, regimeIcon, regimeColor,
        aboveSMA200: latSMA200 ? cur > latSMA200 : null,
        aboveSMA50: latSMA50 ? cur > latSMA50 : null,
        trend10,
        trend30Pct: parseFloat(trend30.toFixed(2)),
        volatilityState: highVol ? 'Elevated' : 'Normal',
        vol10d: parseFloat((vol10 * 100).toFixed(2)),
        vol60d: parseFloat((vol60 * 100).toFixed(2)),
    };
}

// ── Value at Risk & Expected Shortfall ───────────────────────────────────
function calcVaRAndES(closes, confidence95 = 0.95, confidence99 = 0.99) {
    if (closes.length < 30) return { var95: null, var99: null, es95: null };
    const rets = [];
    for (let i = 1; i < closes.length; i++) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    const sorted = [...rets].sort((a, b) => a - b);
    const n = sorted.length;

    const var95daily = -sorted[Math.floor(n * (1 - confidence95))];
    const var99daily = -sorted[Math.floor(n * (1 - confidence99))];
    const es95slice = sorted.slice(0, Math.floor(n * (1 - confidence95)));
    const es95daily = -(es95slice.reduce((s, v) => s + v, 0) / es95slice.length);

    // Annualised (scale: daily * sqrt(252))
    const latestPrice = closes[closes.length - 1];
    return {
        var95: parseFloat((var95daily * 100).toFixed(2)),
        var99: parseFloat((var99daily * 100).toFixed(2)),
        es95: parseFloat((es95daily * 100).toFixed(2)),
        var95Rs: parseFloat((var95daily * latestPrice).toFixed(2)),
        var99Rs: parseFloat((var99daily * latestPrice).toFixed(2)),
        var95Ann: parseFloat((var95daily * Math.sqrt(252) * 100).toFixed(2)),
    };
}

// ── Max Drawdown ─────────────────────────────────────────────────────────
function calcMaxDrawdown(closes) {
    let peak = closes[0], maxDD = 0, peakDate = 0, troughDate = 0, ddStart = 0;
    for (let i = 1; i < closes.length; i++) {
        if (closes[i] > peak) { peak = closes[i]; ddStart = i; }
        const dd = (peak - closes[i]) / peak * 100;
        if (dd > maxDD) { maxDD = dd; peakDate = ddStart; troughDate = i; }
    }
    // Recovery
    let recovered = false;
    for (let i = troughDate; i < closes.length; i++) {
        if (closes[i] >= closes[peakDate]) { recovered = true; break; }
    }
    return {
        maxDrawdown: parseFloat(maxDD.toFixed(2)),
        recovered,
        drawdownDays: troughDate - peakDate,
    };
}

// ── Probabilistic Forecast ───────────────────────────────────────────────
function calcProbability(score, rsi, trend, atrPct, closes) {
    // Base probability from score (max ±9 → 20–80%)
    const baseProbUp = Math.max(20, Math.min(85, 50 + score * 5.5));

    // Adjust for RSI
    const rsiAdj = rsi < 40 ? +5 : rsi > 65 ? -5 : 0;

    // Trend adjustment
    const trendAdj = trend === 'Bullish' ? +4 : trend === 'Bearish' ? -4 : 0;

    const probUp = Math.round(Math.max(15, Math.min(88, baseProbUp + rsiAdj + trendAdj)));

    // Probability of gain > X% (based on ATR)
    // Over 10 days, annual vol / sqrt(252/10) → 10d vol
    const tenDayVol = atrPct * Math.sqrt(10) / 100;
    const prob3pct = probUp > 50
        ? Math.round(Math.max(10, Math.min(75, probUp * 0.7)))
        : Math.round(Math.max(5, Math.min(40, probUp * 0.5)));
    const prob5pct = Math.round(prob3pct * 0.65);

    // Expected return (probability-weighted)
    const atr10 = atrPct * Math.sqrt(10);
    const expReturn = parseFloat(((probUp / 100) * atr10 - (1 - probUp / 100) * atr10 * 0.8).toFixed(2));

    return {
        probUp,
        probDown: 100 - probUp,
        prob3PctGain: prob3pct,
        prob5PctGain: prob5pct,
        expectedReturn10d: expReturn,
        tenDayVol: parseFloat((tenDayVol * 100).toFixed(2)),
        horizon: '10 Days',
    };
}

// ── Feature importance / explainability ──────────────────────────────────
function buildFeatureImportance(factors) {
    // factors: array of { name, contribution, direction, value, threshold }
    const positive = factors.filter(f => f.contribution > 0);
    const negative = factors.filter(f => f.contribution < 0);
    return {
        factors,
        topBullish: positive.sort((a, b) => b.contribution - a.contribution).slice(0, 3),
        topBearish: negative.sort((a, b) => a.contribution - b.contribution).slice(0, 3),
    };
}

// ── Analyst data generator ────────────────────────────────────────────────
function generateAnalystData(latestClose, score, rows) {
    const closes = rows.map(r => r.close);
    const vol20 = stdDev(closes.slice(-20)) / (closes.slice(-20).reduce((s, v) => s + v, 0) / 20);
    const bias = score >= 3 ? 1.10 : score <= -2 ? 0.93 : 1.03;
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    });
    return {
        avgTarget: parseFloat((latestClose * bias).toFixed(2)),
        highTarget: parseFloat((latestClose * (bias + 0.10 + vol20)).toFixed(2)),
        lowTarget: parseFloat((latestClose * (bias - 0.08)).toFixed(2)),
        monthlyRecommendations: months.map(m => {
            let sb, b, h, u, sl;
            if (score >= 3) { sb = 8; b = 10; h = 4; u = 1; sl = 1; }
            else if (score >= 1) { sb = 4; b = 9; h = 7; u = 2; sl = 1; }
            else if (score >= -1) { sb = 2; b = 5; h = 11; u = 3; sl = 1; }
            else if (score >= -2) { sb = 1; b = 3; h = 7; u = 5; sl = 5; }
            else { sb = 1; b = 2; h = 4; u = 5; sl = 9; }
            return { month: m, strongBuy: sb, buy: b, hold: h, underperform: u, sell: sl };
        })
    };
}

// ── MAIN ANALYSER ─────────────────────────────────────────────────────────
function analyzeStock(symbol, rows) {
    const closes = rows.map(r => r.close);
    const volumes = rows.map(r => r.volume);
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2] || last;

    // Core indicators
    const rsi = calcRSI(closes, 14);
    const rsiArr = calcRSIArray(closes, 14);
    const sma20 = calcSMA(closes, 20);
    const sma50 = calcSMA(closes, 50);
    const sma200 = calcSMA(closes, 200);
    const ema12 = calcEMA(closes, 12);
    const ema26 = calcEMA(closes, 26);
    const bb = calcBollinger(closes, 20, 2);
    const atr = calcATR(rows, 14);
    const atrArr = calcATRArray(rows, 14);
    const macdData = calcMACDArray(closes);
    const stoch = calcStochastic(rows, 14, 3);
    const willR = calcWilliamsR(rows, 14);
    const cci = calcCCI(rows, 20);
    const obv = calcOBV(rows);

    const latestClose = closes[closes.length - 1];
    const prevClose = closes[closes.length - 2] || latestClose;
    const latSMA20 = latest(sma20);
    const latSMA50 = latest(sma50);
    const latSMA200 = latest(sma200);
    const latEMA12 = latest(ema12);
    const latEMA26 = latest(ema26);
    const latBBU = latest(bb.upper);
    const latBBL = latest(bb.lower);
    const latBBM = latest(bb.middle);
    const latStochK = latest(stoch.k);
    const latStochD = latest(stoch.d);
    const latWilliamsR = latest(willR);
    const latCCI = latest(cci);
    const macd = latEMA12 && latEMA26 ? parseFloat((latEMA12 - latEMA26).toFixed(2)) : null;
    const trend = detectTrend(closes, 10);

    const volArr = volumes.slice(-20).filter(v => v > 0);
    const volAvg = volArr.length ? volArr.reduce((s, v) => s + v, 0) / volArr.length : 1;
    const latVol = volumes[volumes.length - 1];
    const volSignal = latVol > volAvg * 1.3 ? 'High' : latVol < volAvg * 0.7 ? 'Low' : 'Normal';

    const yr52 = rows.slice(-252);
    const high52 = Math.max(...yr52.map(r => r.high));
    const low52 = Math.min(...yr52.map(r => r.low));
    const vwap = calcVWAP(rows, 20);
    const sr = calcSupportResistance(rows, 60);
    const beta = estimateBeta(closes);
    const sharpe = estimateSharpe(closes);
    const bo = detectBreakout(rows, bb);

    // ── 9-factor deterministic scoring ──────────────────────────────────
    const factors = [];

    // 1. RSI
    let rsiScore = 0;
    if (rsi < 30) rsiScore = 3;
    else if (rsi < 40) rsiScore = 2;
    else if (rsi < 50) rsiScore = 1;
    else if (rsi > 75) rsiScore = -3;
    else if (rsi > 65) rsiScore = -2;
    else if (rsi > 55) rsiScore = -1;
    factors.push({ name: 'RSI', value: rsi, contribution: rsiScore, direction: rsiScore > 0 ? 'Bullish' : rsiScore < 0 ? 'Bearish' : 'Neutral', signal: rsi < 40 ? '✅ Oversold' : rsi > 65 ? '❌ Overbought' : '⚖️ Neutral' });

    // 2. SMA Golden/Death Cross
    let smaCrossScore = 0;
    if (latSMA20 && latSMA50) smaCrossScore = latSMA20 > latSMA50 ? 1 : -1;
    factors.push({ name: 'SMA Cross (20/50)', value: latSMA20 && latSMA50 ? parseFloat((latSMA20 - latSMA50).toFixed(2)) : 0, contribution: smaCrossScore, direction: smaCrossScore > 0 ? 'Bullish' : 'Bearish', signal: smaCrossScore > 0 ? '✅ Golden Cross' : '❌ Death Cross' });

    // 3. MACD
    let macdScore = 0;
    if (latEMA12 && latEMA26) macdScore = latEMA12 > latEMA26 ? 1 : -1;
    factors.push({ name: 'MACD', value: macd, contribution: macdScore, direction: macdScore > 0 ? 'Bullish' : 'Bearish', signal: macdScore > 0 ? '✅ Positive' : '❌ Negative' });

    // 4. Trend
    let trendScore = trend === 'Bullish' ? 1 : trend === 'Bearish' ? -1 : 0;
    factors.push({ name: 'Trend (10d)', value: trend, contribution: trendScore, direction: trend, signal: trend === 'Bullish' ? '✅ Uptrend' : trend === 'Bearish' ? '❌ Downtrend' : '⚖️ Sideways' });

    // 5. Price vs SMA20
    let priceSMAScore = latSMA20 ? (latestClose > latSMA20 ? 1 : -1) : 0;
    factors.push({ name: 'Price vs SMA20', value: latSMA20 ? parseFloat(((latestClose / latSMA20 - 1) * 100).toFixed(2)) : 0, contribution: priceSMAScore, direction: priceSMAScore > 0 ? 'Bullish' : 'Bearish', signal: priceSMAScore > 0 ? '✅ Above SMA20' : '❌ Below SMA20' });

    // 6. Bollinger position
    let bbScore = 0;
    if (latBBU && latBBL) {
        if (latestClose < latBBL) bbScore = 1;
        else if (latestClose > latBBU) bbScore = -1;
    }
    factors.push({ name: 'Bollinger Bands', value: latBBU && latBBL ? parseFloat((latestClose - (latBBU + latBBL) / 2).toFixed(2)) : 0, contribution: bbScore, direction: bbScore > 0 ? 'Bullish' : bbScore < 0 ? 'Bearish' : 'Neutral', signal: bbScore > 0 ? '✅ Near lower band (oversold)' : bbScore < 0 ? '❌ Above upper band' : '⚖️ In mid-range' });

    // 7. Volume confirmation
    let volScore = 0;
    if (volSignal === 'High' && trend === 'Bullish') volScore = 1;
    if (volSignal === 'High' && trend === 'Bearish') volScore = -1;
    factors.push({ name: 'Volume Signal', value: volSignal, contribution: volScore, direction: volScore > 0 ? 'Bullish' : volScore < 0 ? 'Bearish' : 'Neutral', signal: volScore > 0 ? '✅ Vol + uptrend' : volScore < 0 ? '❌ Vol + downtrend' : '⚖️ Normal volume' });

    // 8. SMA200 long-term
    let sma200Score = latSMA200 ? (latestClose > latSMA200 ? 1 : -1) : 0;
    factors.push({ name: 'SMA200 (LT Trend)', value: latSMA200 ? parseFloat(latSMA200.toFixed(2)) : 0, contribution: sma200Score, direction: sma200Score > 0 ? 'Bullish' : 'Bearish', signal: sma200Score > 0 ? '✅ Above SMA200' : '❌ Below SMA200' });

    // 9. Stochastic
    let stochScore = 0;
    if (latStochK !== null && latStochD !== null) {
        if (latStochK < 25 && latStochK > latStochD) stochScore = 1;
        else if (latStochK > 75 && latStochK < latStochD) stochScore = -1;
    }
    factors.push({ name: 'Stochastic %K/%D', value: latStochK !== null ? parseFloat(latStochK.toFixed(2)) : 0, contribution: stochScore, direction: stochScore > 0 ? 'Bullish' : stochScore < 0 ? 'Bearish' : 'Neutral', signal: stochScore > 0 ? '✅ Oversold cross-up' : stochScore < 0 ? '❌ Overbought cross-down' : '⚖️ Neutral' });

    const score = factors.reduce((s, f) => s + f.contribution, 0);
    const featureImportance = buildFeatureImportance(factors);

    // ── Action + deterministic target ───────────────────────────────────
    let action, risk;
    let targetMultiplier;
    if (score >= 4) {
        action = 'BUY'; risk = 'LOW';
        targetMultiplier = 1 + Math.min(0.12, 0.04 + score * 0.008);
    } else if (score <= -3) {
        action = 'SELL'; risk = 'HIGH';
        targetMultiplier = 1 - Math.min(0.10, 0.03 + Math.abs(score) * 0.007);
    } else {
        action = 'HOLD'; risk = 'MODERATE';
        targetMultiplier = 1 + score * 0.005 + 0.01;
    }
    const confidence = Math.round(Math.min(92, 52 + Math.abs(score) * 3.5));

    const predictedPrice = parseFloat((latestClose * targetMultiplier).toFixed(2));
    const expectedChange = pctChange(latestClose, predictedPrice);
    const changeFromPrev = pctChange(prevClose, latestClose);
    const analyst = generateAnalystData(latestClose, score, rows);

    const atrPct = latestClose > 0 ? parseFloat((atr / latestClose * 100).toFixed(2)) : 0;

    // Risk suite
    const var_ = calcVaRAndES(closes);
    const dd = calcMaxDrawdown(closes);
    const regime = detectRegime(closes, rows);
    const prob = calcProbability(score, rsi, trend, atrPct, closes);

    // Sector PE simulation
    const sectorPE = { IT: 28, Banking: 18, Energy: 15, Auto: 22, NBFC: 35, Index: 22, Equity: 20 };
    const sector = getStockInfo(symbol).sector || 'Equity';
    const estimatedPE = parseFloat((sectorPE[sector] || 20) + score * 1.2).toFixed(1);

    // Chart data for sub-panels (last 60 rows sampled)
    const n60 = Math.min(60, rows.length);
    const slice = rows.slice(-n60);
    const sliceCloses = slice.map(r => r.close);
    const sliceRSI = calcRSIArray(sliceCloses, 14);
    const sliceMACDData = calcMACDArray(sliceCloses);
    const sliceBB = calcBollinger(sliceCloses, Math.min(20, n60 - 1), 2);
    const sliceStoch = calcStochastic(slice, Math.min(14, n60 - 1), 3);
    const sliceOBV = calcOBV(slice);

    return {
        symbol,
        name: getStockInfo(symbol).name,
        sector,
        currentPrice: parseFloat(latestClose.toFixed(2)),
        previousClose: parseFloat(prevClose.toFixed(2)),
        change: parseFloat((latestClose - prevClose).toFixed(2)),
        changePercent: changeFromPrev,
        open: parseFloat((last.open || latestClose).toFixed(2)),
        high: parseFloat((last.high || latestClose).toFixed(2)),
        low: parseFloat((last.low || latestClose).toFixed(2)),
        volume: latVol,
        avgVolume: Math.round(volAvg),
        volumeSignal: volSignal,
        week52High: parseFloat(high52.toFixed(2)),
        week52Low: parseFloat(low52.toFixed(2)),
        predictedPrice,
        expectedChange,
        recommendation: { action, risk, confidence, timeframe: '7 Days', score },

        indicators: {
            rsi: parseFloat(rsi.toFixed(2)),
            rsiStatus: rsi < 35 ? 'Oversold' : rsi > 65 ? 'Overbought' : 'Neutral',
            sma20: latSMA20 ? parseFloat(latSMA20.toFixed(2)) : null,
            sma50: latSMA50 ? parseFloat(latSMA50.toFixed(2)) : null,
            sma200: latSMA200 ? parseFloat(latSMA200.toFixed(2)) : null,
            ema12: latEMA12 ? parseFloat(latEMA12.toFixed(2)) : null,
            ema26: latEMA26 ? parseFloat(latEMA26.toFixed(2)) : null,
            macd, trend, vwap,
            bbUpper: latBBU ? parseFloat(latBBU.toFixed(2)) : null,
            bbLower: latBBL ? parseFloat(latBBL.toFixed(2)) : null,
            bbMiddle: latBBM ? parseFloat(latBBM.toFixed(2)) : null,
            atr, atrPct,
            stochK: latStochK !== null ? parseFloat(latStochK.toFixed(2)) : null,
            stochD: latStochD !== null ? parseFloat(latStochD.toFixed(2)) : null,
            williamsR: latWilliamsR !== null ? parseFloat(latWilliamsR.toFixed(2)) : null,
            cci: latCCI !== null ? parseFloat(latCCI.toFixed(2)) : null,
            obvTrend: obv.length > 1 ? (obv[obv.length - 1] > obv[obv.length - 20] ? 'Rising' : 'Falling') : 'N/A',
        },

        risk: {
            beta, sharpe,
            atr, atrPct,
            support: sr.support,
            resistance: sr.resistance,
            support2: sr.support2,
            resistance2: sr.resistance2,
            downside: parseFloat(((sr.support - latestClose) / latestClose * 100).toFixed(2)),
            var95: var_.var95,
            var99: var_.var99,
            es95: var_.es95,
            var95Rs: var_.var95Rs,
            maxDrawdown: dd.maxDrawdown,
            drawdownRecovered: dd.recovered,
        },

        probability: prob,
        regime,
        featureImportance,
        breakout: bo,
        estimatedPE,

        // Sub-chart data arrays (for frontend visualisation)
        chartData: {
            dates: slice.map(r => r.date),
            closes: sliceCloses,
            opens: slice.map(r => r.open),
            highs: slice.map(r => r.high),
            lows: slice.map(r => r.low),
            volumes: slice.map(r => r.volume),
            rsi: sliceRSI,
            macd: sliceMACDData.macdLine,
            macdSignal: sliceMACDData.signalLine,
            macdHisto: sliceMACDData.histogram,
            bbUpper: sliceBB.upper,
            bbLower: sliceBB.lower,
            bbMiddle: sliceBB.middle,
            stochK: sliceStoch.k,
            stochD: sliceStoch.d,
            obv: sliceOBV,
        },

        analystData: {
            currentTarget: parseFloat(latestClose.toFixed(2)),
            avgTarget: analyst.avgTarget,
            highTarget: analyst.highTarget,
            lowTarget: analyst.lowTarget,
            monthlyRecommendations: analyst.monthlyRecommendations
        }
    };
}

module.exports = { analyzeStock, generateDemoHistory, getStockInfo, DEMO_STOCKS };
