// backend/utils/backtest.js — Historical Strategy Backtesting Engine
'use strict';

const { calcSMA, calcEMA, calcRSIArray, calcMACDArray, calcATR } = require('./indicators');

/**
 * Core trade simulator — takes rows and a signal array (1=BUY, -1=SELL, 0=HOLD)
 * Returns full performance metrics.
 */
function runStrategy(rows, signals, strategyName) {
    const closes = rows.map(r => r.close);
    const capital0 = 100000; // ₹1 lakh starting capital
    let capital = capital0;
    let position = 0;      // shares held
    let entryPrice = 0;
    let entryIdx = -1;

    const trades = [];
    const equity = [capital]; // equity curve, one per row

    for (let i = 1; i < rows.length; i++) {
        const sig = signals[i];
        const price = closes[i];

        if (sig === 1 && position === 0) {
            // BUY
            position = Math.floor(capital / price);
            entryPrice = price;
            entryIdx = i;
            capital -= position * price;
        } else if (sig === -1 && position > 0) {
            // SELL
            const proceeds = position * price;
            const pnl = proceeds - position * entryPrice;
            const pct = (price - entryPrice) / entryPrice * 100;
            trades.push({
                entry: rows[entryIdx].date,
                exit: rows[i].date,
                entryPrice: parseFloat(entryPrice.toFixed(2)),
                exitPrice: parseFloat(price.toFixed(2)),
                pnl: parseFloat(pnl.toFixed(2)),
                pctReturn: parseFloat(pct.toFixed(2)),
                holdDays: i - entryIdx,
                result: pnl >= 0 ? 'WIN' : 'LOSS',
            });
            capital += proceeds;
            position = 0;
        }

        // Mark-to-market equity
        equity.push(parseFloat((capital + position * price).toFixed(2)));
    }

    // Close any open position at last price
    if (position > 0) {
        const lastPrice = closes[closes.length - 1];
        const proceeds = position * lastPrice;
        const pnl = proceeds - position * entryPrice;
        trades.push({
            entry: rows[entryIdx].date,
            exit: rows[rows.length - 1].date,
            entryPrice: parseFloat(entryPrice.toFixed(2)),
            exitPrice: parseFloat(lastPrice.toFixed(2)),
            pnl: parseFloat(pnl.toFixed(2)),
            pctReturn: parseFloat(((lastPrice - entryPrice) / entryPrice * 100).toFixed(2)),
            holdDays: rows.length - 1 - entryIdx,
            result: pnl >= 0 ? 'WIN' : 'LOSS',
            open: true,
        });
        capital += proceeds;
        position = 0;
    }

    const finalCapital = equity[equity.length - 1];

    // ── Performance Metrics ──────────────────────────────────────────────
    const totalReturn = parseFloat(((finalCapital - capital0) / capital0 * 100).toFixed(2));
    const winners = trades.filter(t => t.result === 'WIN');
    const losers = trades.filter(t => t.result === 'LOSS');
    const winRate = trades.length ? parseFloat((winners.length / trades.length * 100).toFixed(1)) : 0;
    const avgWin = winners.length ? parseFloat((winners.reduce((s, t) => s + t.pctReturn, 0) / winners.length).toFixed(2)) : 0;
    const avgLoss = losers.length ? parseFloat((losers.reduce((s, t) => s + t.pctReturn, 0) / losers.length).toFixed(2)) : 0;
    const profitFactor = (losers.length && avgLoss !== 0)
        ? parseFloat((Math.abs(avgWin * winners.length) / Math.abs(avgLoss * losers.length)).toFixed(2)) : 9.99;

    // Max Drawdown
    let peak = equity[0], maxDD = 0;
    const drawdown = equity.map(e => {
        if (e > peak) peak = e;
        const dd = (peak - e) / peak * 100;
        if (dd > maxDD) maxDD = dd;
        return parseFloat(dd.toFixed(2));
    });
    maxDD = parseFloat(maxDD.toFixed(2));

    // CAGR
    const years = rows.length / 252;
    const cagr = years > 0
        ? parseFloat(((Math.pow(finalCapital / capital0, 1 / years) - 1) * 100).toFixed(2))
        : 0;

    // Sharpe (using daily equity returns)
    const eqReturns = equity.slice(1).map((e, i) => (e - equity[i]) / equity[i]);
    const avgER = eqReturns.reduce((s, v) => s + v, 0) / eqReturns.length;
    const volER = Math.sqrt(eqReturns.reduce((s, v) => s + (v - avgER) ** 2, 0) / eqReturns.length);
    const sharpe = volER > 0
        ? parseFloat(((avgER - 0.065 / 252) / volER * Math.sqrt(252)).toFixed(2)) : 0;

    // Buy-hold comparison
    const buyHoldReturn = parseFloat(((closes[closes.length - 1] - closes[0]) / closes[0] * 100).toFixed(2));

    // Equity curve — sample to ~100 points for charting
    const step = Math.max(1, Math.floor(equity.length / 100));
    const equityCurve = equity
        .filter((_, i) => i % step === 0 || i === equity.length - 1)
        .map((e, i) => ({ date: rows[Math.min(i * step, rows.length - 1)].date, equity: e }));

    const drawdownSeries = drawdown
        .filter((_, i) => i % step === 0 || i === drawdown.length - 1)
        .map((d, i) => ({ date: rows[Math.min(i * step, rows.length - 1)].date, drawdown: d }));

    return {
        strategy: strategyName,
        totalTrades: trades.length,
        winRate,
        avgWin,
        avgLoss,
        profitFactor,
        totalReturn,
        cagr,
        sharpe,
        maxDrawdown: maxDD,
        finalCapital: parseFloat(finalCapital.toFixed(2)),
        buyHoldReturn,
        alpha: parseFloat((totalReturn - buyHoldReturn).toFixed(2)),
        recentTrades: trades.slice(-10).reverse(),
        equityCurve,
        drawdownSeries,
    };
}

// ── Strategy 1: SMA Crossover (20/50) ────────────────────────────────────
function strategyMACrossover(rows) {
    const closes = rows.map(r => r.close);
    const sma20 = calcSMA(closes, 20);
    const sma50 = calcSMA(closes, 50);

    const signals = rows.map((_, i) => {
        if (isNaN(sma20[i]) || isNaN(sma50[i])) return 0;
        if (i === 0) return 0;
        const crossUp = sma20[i] > sma50[i] && sma20[i - 1] <= sma50[i - 1];
        const crossDown = sma20[i] < sma50[i] && sma20[i - 1] >= sma50[i - 1];
        return crossUp ? 1 : crossDown ? -1 : 0;
    });

    return runStrategy(rows, signals, 'SMA Crossover (20/50)');
}

// ── Strategy 2: RSI Mean Reversion (oversold/overbought) ─────────────────
function strategyRSI(rows, oversold = 35, overbought = 65) {
    const closes = rows.map(r => r.close);
    const rsi = calcRSIArray(closes, 14);

    let inPosition = false;
    const signals = rows.map((_, i) => {
        if (isNaN(rsi[i]) || i === 0) return 0;
        if (!inPosition && rsi[i] < oversold && rsi[i - 1] >= oversold) {
            inPosition = true; return 1;
        }
        if (inPosition && rsi[i] > overbought) {
            inPosition = false; return -1;
        }
        return 0;
    });

    return runStrategy(rows, signals, `RSI Mean Reversion (${oversold}/${overbought})`);
}

// ── Strategy 3: MACD Crossover ───────────────────────────────────────────
function strategyMACD(rows) {
    const closes = rows.map(r => r.close);
    const { macdLine, signalLine } = calcMACDArray(closes);

    const signals = rows.map((_, i) => {
        if (isNaN(macdLine[i]) || isNaN(signalLine[i]) || i === 0) return 0;
        if (isNaN(macdLine[i - 1]) || isNaN(signalLine[i - 1])) return 0;
        const crossUp = macdLine[i] > signalLine[i] && macdLine[i - 1] <= signalLine[i - 1];
        const crossDown = macdLine[i] < signalLine[i] && macdLine[i - 1] >= signalLine[i - 1];
        return crossUp ? 1 : crossDown ? -1 : 0;
    });

    return runStrategy(rows, signals, 'MACD Crossover');
}

/**
 * Run all 3 strategies on the given rows.
 * Returns an object with results for each strategy + summary comparison.
 */
function runAllStrategies(rows) {
    if (!rows || rows.length < 60) {
        return { error: 'Insufficient data — need at least 60 trading days.' };
    }

    const ma = strategyMACrossover(rows);
    const rsi = strategyRSI(rows);
    const macd = strategyMACD(rows);

    // Buy & hold baseline
    const closes = rows.map(r => r.close);
    const buyHoldReturn = parseFloat(((closes[closes.length - 1] - closes[0]) / closes[0] * 100).toFixed(2));

    // Best strategy by Sharpe
    const all = [ma, rsi, macd];
    const best = all.reduce((b, s) => s.sharpe > b.sharpe ? s : b, all[0]);

    return {
        strategies: { maCrossover: ma, rsiReversion: rsi, macdCrossover: macd },
        buyHoldReturn,
        bestStrategy: best.strategy,
        bestSharpe: best.sharpe,
        summary: {
            period: `${rows[0].date} → ${rows[rows.length - 1].date}`,
            totalDays: rows.length,
            startPrice: parseFloat(closes[0].toFixed(2)),
            endPrice: parseFloat(closes[closes.length - 1].toFixed(2)),
        }
    };
}

module.exports = { runAllStrategies, strategyMACrossover, strategyRSI, strategyMACD };
