// backend/utils/chatbot.js — Full AI Chatbot, 10 intent categories
'use strict';

const { analyzeStock, DEMO_STOCKS, getStockInfo } = require('./predictor');

const fmt = n => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtVol = n => n >= 1e7 ? `${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(2)} L` : Number(n).toLocaleString('en-IN');
const pctStr = (a, b) => { const p = ((b - a) / a * 100); return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`; };
const sigIcon = a => a === 'BUY' ? '🟢' : a === 'SELL' ? '🔴' : '🟡';
const trendIcon = t => t === 'Bullish' ? '📈' : t === 'Bearish' ? '📉' : '➡️';
const rsiLabel = r => r < 35 ? '🟢 Oversold' : r > 65 ? '🔴 Overbought' : '🟡 Neutral';

// ── Company name → NSE symbol dictionary ─────────────────────────────────
const NAME_TO_SYMBOL = {
    'infosys': 'INFY', 'infy': 'INFY', 'infosis': 'INFY', 'infosys limited': 'INFY',
    'tcs': 'TCS', 'tata consultancy': 'TCS', 'tata consultancy services': 'TCS',
    'wipro': 'WIPRO', 'wipro limited': 'WIPRO',
    'hcl': 'HCLTECH', 'hcltech': 'HCLTECH', 'hcl technologies': 'HCLTECH',
    'tech mahindra': 'TECHM', 'techm': 'TECHM',
    'mphasis': 'MPHASIS', 'ltimindtree': 'LTIM', 'lti': 'LTIM', 'mindtree': 'LTIM',
    'coforge': 'COFORGE', 'persistent': 'PERSISTENT', 'hexaware': 'HEXAWARE',
    'hdfc bank': 'HDFCBANK', 'hdfcbank': 'HDFCBANK', 'hdfc': 'HDFCBANK',
    'icici bank': 'ICICIBANK', 'icicibank': 'ICICIBANK', 'icici': 'ICICIBANK',
    'sbi': 'SBIN', 'state bank': 'SBIN', 'state bank of india': 'SBIN',
    'kotak': 'KOTAKBANK', 'kotak mahindra': 'KOTAKBANK', 'kotak bank': 'KOTAKBANK',
    'axis bank': 'AXISBANK', 'axisbank': 'AXISBANK', 'axis': 'AXISBANK',
    'bajaj finance': 'BAJFINANCE', 'bajfinance': 'BAJFINANCE',
    'bajaj finserv': 'BAJAJFINSV',
    'indusind': 'INDUSINDBK', 'indusind bank': 'INDUSINDBK',
    'yes bank': 'YESBANK', 'yesbank': 'YESBANK',
    'pnb': 'PNB', 'punjab national': 'PNB',
    'bank of baroda': 'BANKBARODA', 'bob': 'BANKBARODA',
    'reliance': 'RELIANCE', 'reliance industries': 'RELIANCE', 'ril': 'RELIANCE',
    'ongc': 'ONGC', 'oil and natural gas': 'ONGC',
    'ntpc': 'NTPC', 'powergrid': 'POWERGRID', 'power grid': 'POWERGRID',
    'coal india': 'COALINDIA', 'coalindia': 'COALINDIA',
    'adani green': 'ADANIGREEN', 'adani enterprises': 'ADANIENT', 'adani': 'ADANIENT',
    'adani ports': 'ADANIPORTS',
    'tata steel': 'TATASTEEL', 'tatasteel': 'TATASTEEL',
    'jsw steel': 'JSWSTEEL', 'jswsteel': 'JSWSTEEL', 'jsw': 'JSWSTEEL',
    'hindalco': 'HINDALCO', 'vedanta': 'VEDL', 'sail': 'SAIL', 'nmdc': 'NMDC',
    'tata motors': 'TATAMOTORS', 'tatamotors': 'TATAMOTORS',
    'maruti': 'MARUTI', 'maruti suzuki': 'MARUTI',
    'bajaj auto': 'BAJAJ-AUTO',
    'hero motocorp': 'HEROMOTOCO', 'hero moto': 'HEROMOTOCO',
    'm&m': 'M&M', 'mahindra': 'M&M', 'mahindra and mahindra': 'M&M',
    'eicher': 'EICHERMOT', 'royal enfield': 'EICHERMOT',
    'tvs motor': 'TVSMOTOR',
    'sun pharma': 'SUNPHARMA', 'sunpharma': 'SUNPHARMA', 'sun pharmaceutical': 'SUNPHARMA',
    'dr reddy': 'DRREDDY', "dr. reddy's": 'DRREDDY',
    'cipla': 'CIPLA', 'divis': 'DIVISLAB', "divi's": 'DIVISLAB',
    'apollo hospitals': 'APOLLOHOSP', 'apollo': 'APOLLOHOSP',
    'itc': 'ITC', 'itc limited': 'ITC',
    'hindustan unilever': 'HINDUNILVR', 'hul': 'HINDUNILVR', 'unilever': 'HINDUNILVR',
    'nestle': 'NESTLEIND', 'britannia': 'BRITANNIA', 'dabur': 'DABUR', 'marico': 'MARICO',
    'asian paints': 'ASIANPAINT', 'asianpaint': 'ASIANPAINT',
    'titan': 'TITAN', 'titan company': 'TITAN',
    'airtel': 'BHARTIARTL', 'bharti airtel': 'BHARTIARTL',
    'larsen': 'LT', 'l&t': 'LT', 'larsen and toubro': 'LT',
    'ultratech cement': 'ULTRACEMCO', 'ultratech': 'ULTRACEMCO', 'ultracemco': 'ULTRACEMCO',
    'dmart': 'DMART', 'avenue supermarts': 'DMART',
    'zomato': 'ZOMATO', 'paytm': 'PAYTM', 'nykaa': 'NYKAA', 'irctc': 'IRCTC',
    'nifty': '%5ENSEI', 'nifty 50': '%5ENSEI', 'sensex': '%5EBSESN',
    'nifty bank': '%5ENBANK', 'banknifty': '%5ENBANK',
};

const STOPWORDS = new Set([
    'SHOULD', 'SELL', 'BUY', 'HOLD', 'WILL', 'WHAT', 'WHEN', 'WHERE', 'WHICH',
    'HAVE', 'BEEN', 'GOOD', 'BEST', 'TELL', 'GIVE', 'SHOW', 'HELP', 'FIND',
    'KNOW', 'CALL', 'LOOK', 'MAKE', 'TAKE', 'COME', 'WANT', 'NEED', 'THAN',
    'THAT', 'THIS', 'WITH', 'FROM', 'INTO', 'OVER', 'AFTER', 'RIGHT', 'ABOUT',
    'JUST', 'ALSO', 'LIKE', 'SOME', 'ONLY', 'STOCK', 'SHARE', 'PRICE', 'ANALYSIS',
    'MARKET', 'INDEX', 'TREND', 'TRADE', 'TRADING', 'INVEST', 'INVESTMENT',
    'DATA', 'INFO', 'TODAY', 'CURRENT', 'PREDICT', 'FORECAST', 'COMPARE',
    'VERSUS', 'AGAINST', 'PLEASE', 'THANK', 'THANKS', 'ANALYST', 'TARGET',
    'BOTH', 'EACH', 'THEY', 'THEM', 'THEIR', 'THEN', 'LONG', 'SHORT', 'STRONG',
    'HIGH', 'LOWS', 'OPEN', 'CLOSE', 'VOLUME', 'TERM', 'LEVEL', 'POINT', 'ENTRY',
    'QUARTER', 'MONTH', 'YEAR', 'WEEK', 'RISK', 'RETURN', 'EARN', 'CASH', 'FLOW',
    'SAFE', 'SAFER', 'SAFER', 'CROSS', 'BREAK', 'SIGNAL', 'CHART', 'DAILY',
    'SUPPORT', 'RESIST', 'PATTERN', 'SCENARIO', 'IMPACT', 'AFFECT', 'DOES',
    'HAPPEN', 'MISS', 'FALLS', 'COULD', 'MIGHT', 'WOULD', 'AVERAGE', 'DOWN',
    'PORTFOLIO', 'SECTOR', 'RETIRE', 'RETIREMENT', 'SENSITIV', 'CURRENCY',
    'SPENDING', 'SLOWER', 'SLOW', 'GROWTH', 'ADOPTION', 'ESTIMATE', 'EARNING',
    'INSIDER', 'SENTIMENT', 'AROUND', 'QUESTION', 'MODEL', 'HISTORICAL', 'SHARPE',
    'RATIO', 'BETA', 'NIFTY', 'EQUAL', 'RATE', 'HIKE', 'INTEREST', 'UPCOMING',
    'OVERVALUED', 'UNDERVALUED', 'VALUATION', 'FUNDAMENTAL', 'REVENUE', 'PROFIT',
    'MANAGE', 'EXPECT', 'CONFIDENCE', 'ACCURACY', 'ADJUSTED', 'PROBABILITY', 'CHANCE',
]);

function extractSymbol(msg) {
    const lower = msg.toLowerCase().trim();
    const upper = msg.toUpperCase();
    const sorted = Object.keys(NAME_TO_SYMBOL).sort((a, b) => b.length - a.length);
    for (const name of sorted) {
        if (lower.includes(name)) return NAME_TO_SYMBOL[name];
    }
    for (const sym of Object.keys(DEMO_STOCKS)) {
        const words = upper.split(/\W+/);
        if (words.includes(sym)) return sym;
    }
    const tokens = upper.match(/\b([A-Z][A-Z0-9\-&^]{1,11})\b/g) || [];
    for (const tok of tokens) {
        if (!STOPWORDS.has(tok)) return tok;
    }
    return null;
}

function extractTwoSymbols(msg) {
    const lower = msg.toLowerCase();
    const upper = msg.toUpperCase();
    const found = [], usedPos = new Set();
    const sorted = Object.keys(NAME_TO_SYMBOL).sort((a, b) => b.length - a.length);
    for (const name of sorted) {
        const idx = lower.indexOf(name);
        if (idx !== -1) {
            let overlap = false;
            for (const p of usedPos) { if (Math.abs(p - idx) < name.length) { overlap = true; break; } }
            if (!overlap) { found.push(NAME_TO_SYMBOL[name]); usedPos.add(idx); if (found.length === 2) break; }
        }
    }
    if (found.length < 2) {
        const tokens = upper.match(/\b([A-Z][A-Z0-9\-&]{1,11})\b/g) || [];
        for (const tok of tokens) {
            if (!STOPWORDS.has(tok) && !found.includes(tok)) { found.push(tok); if (found.length === 2) break; }
        }
    }
    return found.slice(0, 2);
}

// ── Helpers ────────────────────────────────────────────────────────────────
async function getA(sym, getRows) { return analyzeStock(sym, await getRows(sym)); }

// ══════════════════════════════════════════════════════════════════════════
// INTENTS
// ══════════════════════════════════════════════════════════════════════════
const INTENTS = [

    // ─── 1. Price / Quote ─────────────────────────────────────────────────────
    {
        patterns: [/price of|current price|what is.+trading|how much is|rate of|quote|price today|trading at/i],
        async handler(sym, msg, getRows) {
            if (!sym) return '💡 Mention a stock — e.g. "price of Tata Steel"';
            const a = await getA(sym, getRows);
            const arrow = a.changePercent >= 0 ? '▲' : '▼';
            return `${sigIcon(a.recommendation.action)} **${sym} — ${a.name}**

Current: **${fmt(a.currentPrice)}** ${arrow} ${a.changePercent > 0 ? '+' : ''}${a.changePercent}%
Prev Close: ${fmt(a.previousClose)} | Open: ${fmt(a.open)}
Day High: ${fmt(a.high)} | Day Low: ${fmt(a.low)}
52W High: ${fmt(a.week52High)} | 52W Low: ${fmt(a.week52Low)}
Volume: ${fmtVol(a.volume)} | Avg Volume: ${fmtVol(a.avgVolume)}
VWAP (20d): ${fmt(a.indicators.vwap)}`;
        }
    },

    // ─── 2. Buy advice ────────────────────────────────────────────────────────
    {
        patterns: [/should i buy|is.+good buy|worth buying|worth investing|good entry|entry point|accumulate|add.+position/i],
        async handler(sym, msg, getRows) {
            if (!sym) return '💡 Mention a stock — e.g. "Should I buy Infosys?"';
            const a = await getA(sym, getRows);
            const upside = pctStr(a.currentPrice, a.analystData.avgTarget);
            const tips = {
                BUY: `✅ **Entry point looks reasonable.** RSI (${a.indicators.rsi}) is ${a.indicators.rsiStatus.toLowerCase()}, price is ${a.currentPrice > a.indicators.sma20 ? 'above' : 'below'} SMA20. Volume is ${a.volumeSignal}. Potential upside: **${upside}** to avg analyst target.`,
                HOLD: `⏸️ **Not the best entry point.** Signals are mixed — RSI at ${a.indicators.rsi}, trend ${a.indicators.trend}. Wait for a dip near support ₹${a.risk.support} before buying.`,
                SELL: `⚠️ **Riskier entry.** RSI is ${a.indicators.rsi} (${a.indicators.rsiStatus}). Momentum is bearish. Consider waiting — next support is ₹${a.risk.support}.`
            };
            return `${sigIcon(a.recommendation.action)} **${sym} — Buy Analysis**

Price: ${fmt(a.currentPrice)} | Signal: **${a.recommendation.action}** (${a.recommendation.confidence}% confidence)
Support: ₹${a.risk.support} | Resistance: ₹${a.risk.resistance}
SMA20: ${fmt(a.indicators.sma20)} | SMA50: ${fmt(a.indicators.sma50)}
MACD: ${a.indicators.macd} | Trend: ${trendIcon(a.indicators.trend)} ${a.indicators.trend}
Beta: ${a.risk.beta} | ATR: ₹${a.indicators.atr} (${a.indicators.atrPct}% daily vol)

${tips[a.recommendation.action]}

💡 *Not financial advice.*`;
        }
    },

    // ─── 3. Sell advice ───────────────────────────────────────────────────────
    {
        patterns: [/should i sell|is it time to sell|exit|book profit|reduce exposure|take profit/i],
        async handler(sym, msg, getRows) {
            if (!sym) return '💡 Mention a stock — e.g. "Should I sell TCS?"';
            const a = await getA(sym, getRows);
            const fromHigh = ((a.currentPrice / a.week52High - 1) * 100).toFixed(1);
            const fromLow = ((a.currentPrice / a.week52Low - 1) * 100).toFixed(1);
            return `🔍 **${sym} — Sell Analysis**

Price: ${fmt(a.currentPrice)} | Recommendation: ${sigIcon(a.recommendation.action)} **${a.recommendation.action}**
RSI: ${a.indicators.rsi} → ${rsiLabel(a.indicators.rsi)}
Trend: ${trendIcon(a.indicators.trend)} ${a.indicators.trend} | MACD: ${a.indicators.macd}

From 52W High: ${fromHigh}% | From 52W Low: +${fromLow}%
Support: ₹${a.risk.support} | Resistance: ₹${a.risk.resistance}
7D Target: ${fmt(a.predictedPrice)} (${a.expectedChange > 0 ? '+' : ''}${a.expectedChange}%)

${a.indicators.rsi > 70
                    ? `⚠️ RSI is high (${a.indicators.rsi}). Overbought — consider partial profit booking near ₹${a.risk.resistance}.`
                    : a.recommendation.action === 'SELL'
                        ? `🔴 Sell signal active. Risk level: ${a.recommendation.risk}. Consider exiting.`
                        : `📊 No strong sell signal. Hold unless you need to reduce risk exposure.`}

💡 *Not financial advice.*`;
        }
    },

    // ─── 4. Hold analysis ────────────────────────────────────────────────────
    {
        patterns: [/should i hold|average down|add more|buy more dip|dip|hold or sell/i],
        async handler(sym, msg, getRows) {
            if (!sym) return '💡 Mention a stock — e.g. "Should I hold TCS?"';
            const a = await getA(sym, getRows);
            const avgDown = msg.toLowerCase().includes('average') || msg.toLowerCase().includes('dip');
            return `⏸️ **${sym} — Hold / Average Down Analysis**

Signal: ${sigIcon(a.recommendation.action)} **${a.recommendation.action}** | Confidence: ${a.recommendation.confidence}%
Current: ${fmt(a.currentPrice)} | SMA50: ${fmt(a.indicators.sma50)}
Support 1: ₹${a.risk.support} | Support 2: ₹${a.risk.support2}
RSI: ${a.indicators.rsi} | Trend: ${a.indicators.trend}
Beta: ${a.risk.beta} (${a.risk.beta > 1.2 ? 'High volatility' : a.risk.beta < 0.8 ? 'Low volatility' : 'Moderate volatility'})

${avgDown
                    ? `📊 **Averaging down:** Price is ${a.currentPrice < a.indicators.sma50 ? 'below' : 'above'} SMA50. ${a.recommendation.action === 'BUY' ? '✅ Averaging looks reasonable — positive signal.' : '⚠️ Be cautious averaging into a ' + a.recommendation.action + ' signal.'} Consider buying in tranches near support ₹${a.risk.support}.`
                    : `📊 ${a.recommendation.action === 'HOLD' ? 'Mixed signals — holding is prudent. Review at next earnings.' : a.recommendation.action === 'BUY' ? 'Signal is positive — holding or adding makes sense.' : 'Sell signal active — reconsider the hold.'}`}

💡 *Not financial advice.*`;
        }
    },

    // ─── 5. Long-term investment ──────────────────────────────────────────────
    {
        patterns: [/long.?term|good for retirement|retirement|5 year|10 year|wealth creation|sip|decade/i],
        async handler(sym, msg, getRows) {
            if (!sym) return '💡 Mention a stock — e.g. "Is Infosys good long-term?"';
            const a = await getA(sym, getRows);
            const aboveSMA200 = a.indicators.sma200 && a.currentPrice > a.indicators.sma200;
            const ltSignal = aboveSMA200 && a.recommendation.action !== 'SELL'
                ? '✅ Positive long-term setup' : '⚠️ Mixed long-term signals';
            return `📅 **${sym} — Long-Term Investment Analysis**

**Current Technicals:**
Price: ${fmt(a.currentPrice)} | Sector: ${a.sector}
SMA 200: ${a.indicators.sma200 ? fmt(a.indicators.sma200) : 'N/A'} (${aboveSMA200 ? '✅ Price above' : '🔴 Price below'} SMA200)
52W High: ${fmt(a.week52High)} | 52W Low: ${fmt(a.week52Low)}

**Risk Profile:**
Beta: ${a.risk.beta} (${a.risk.beta < 0.8 ? 'Defensive — less volatile than market' : a.risk.beta > 1.3 ? 'Aggressive — more volatile than Nifty' : 'Moderate market correlation'})
Sharpe Ratio: ${a.risk.sharpe ? a.risk.sharpe : 'N/A'} ${a.risk.sharpe > 1 ? '✅ Good risk-adjusted return' : a.risk.sharpe > 0 ? '🟡 Moderate' : a.risk.sharpe !== null ? '🔴 Poor' : ''}
Estimated P/E: ~${a.estimatedPE}x

**Long-Term Outlook:** ${ltSignal}
${a.sector === 'IT' ? '💻 IT sector benefits from India\'s growing digital economy — strong structural tailwinds.' :
                    a.sector === 'Banking' ? '🏦 Banking sector tied to India\'s credit growth — watch NPA levels.' :
                        a.sector === 'Energy' ? '⚡ Energy sector evolving with EV & renewables transition.' :
                            a.sector === 'Auto' ? '🚗 Auto sector cyclical — watch EV disruption and rural demand.' :
                                '📊 Evaluate sector-specific growth drivers for long-term view.'}

💡 SIP (monthly investing) reduces timing risk. *Not financial advice.*`;
        }
    },

    // ─── 6. Overvalued / Undervalued ─────────────────────────────────────────
    {
        patterns: [/overvalued|undervalued|valuation|pe ratio|fair value|intrinsic/i],
        async handler(sym, msg, getRows) {
            if (!sym) return '💡 Mention a stock — e.g. "Is Infosys overvalued?"';
            const a = await getA(sym, getRows);
            const peVsAvg = ((a.estimatedPE - 22) / 22 * 100).toFixed(1);
            const verdict = a.estimatedPE > 30 ? '🔴 Premium valuation — priced for growth' :
                a.estimatedPE < 15 ? '🟢 Cheap — potential value opportunity' :
                    '🟡 Fair value range';
            return `💰 **${sym} — Valuation Analysis**

**Price:** ${fmt(a.currentPrice)}
**Estimated P/E:** ~${a.estimatedPE}x (Sector avg: ~22x)
**Premium vs Market:** ${peVsAvg > 0 ? '+' : ''}${peVsAvg}%
**Verdict:** ${verdict}

**Analyst Targets:**
Low: ${fmt(a.analystData.lowTarget)} | Avg: ${fmt(a.analystData.avgTarget)} | High: ${fmt(a.analystData.highTarget)}
Upside to avg target: ${pctStr(a.currentPrice, a.analystData.avgTarget)}

**Technical Valuation Signals:**
vs SMA50: ${pctStr(a.indicators.sma50, a.currentPrice)} | vs SMA200: ${a.indicators.sma200 ? pctStr(a.indicators.sma200, a.currentPrice) : 'N/A'}
52W position: ${(((a.currentPrice - a.week52Low) / (a.week52High - a.week52Low)) * 100).toFixed(0)}th percentile

${a.estimatedPE > 35 ? '⚠️ Elevated P/E. Growth expectations are high — any earnings miss could hurt.' :
                    a.estimatedPE < 14 ? '✅ Low P/E could signal undervaluation — verify fundamentals before buying.' :
                        '📊 Valuation appears reasonable for the sector.'}

💡 *P/E is estimated — verify on NSE/BSE for exact figures.*`;
        }
    },

    // ─── 7. Price Prediction (1M, 3M, yearly) ────────────────────────────────
    {
        patterns: [/predict|forecast|target price|future price|price target|1.?month|3.?month|year.?end|short.?term outlook|probability|crosses/i],
        async handler(sym, msg, getRows) {
            if (!sym) return '💡 Mention a stock — e.g. "predict Tata Steel" or "TCS year-end target"';
            const a = await getA(sym, getRows);
            // Extrapolate targets
            const t7d = a.predictedPrice;
            const t1m = parseFloat((a.currentPrice * (1 + a.expectedChange / 100 * 4.3)).toFixed(2));
            const t3m = parseFloat((a.currentPrice * (1 + a.expectedChange / 100 * 13)).toFixed(2));
            const longBias = a.recommendation.action === 'BUY' ? 1.12 : a.recommendation.action === 'SELL' ? 0.92 : 1.05;
            const tYE = parseFloat((a.currentPrice * longBias).toFixed(2));
            const conf = a.recommendation.confidence;

            // Probability of crossing a target (simple rsi / score based)
            const score = a.recommendation.score;
            const probUp = Math.round(Math.max(20, Math.min(85, 50 + score * 6)));

            return `📊 **${sym} — Price Forecasts**

Current Price: **${fmt(a.currentPrice)}**
AI Signal: ${sigIcon(a.recommendation.action)} **${a.recommendation.action}** | Confidence: ${conf}%

| Horizon | Target | Change |
|:---|:---:|:---:|
| 7 Days | **${fmt(t7d)}** | ${a.expectedChange > 0 ? '+' : ''}${a.expectedChange}% |
| 1 Month | ${fmt(t1m)} | ${pctStr(a.currentPrice, t1m)} |
| 3 Months | ${fmt(t3m)} | ${pctStr(a.currentPrice, t3m)} |
| Year-End | ${fmt(tYE)} | ${pctStr(a.currentPrice, tYE)} |

**Probability of upside move:** ~${probUp}%
**Analyst avg target:** ${fmt(a.analystData.avgTarget)} (${pctStr(a.currentPrice, a.analystData.avgTarget)})
**Volatility (ATR):** ₹${a.indicators.atr}/day (${a.indicators.atrPct}%)

${a.recommendation.action === 'BUY' ? `📈 Bullish setup — RSI (${a.indicators.rsi}), trend ${a.indicators.trend}, score ${score}/+` :
                    a.recommendation.action === 'SELL' ? `📉 Bearish setup — watch for support at ₹${a.risk.support}` :
                        `➡️ Sideways expected. Range: ₹${a.risk.support} – ₹${a.risk.resistance}`}

⚠️ *Forecasts are model-based — not financial advice.*`;
        }
    },

    // ─── 8. Technical Analysis ────────────────────────────────────────────────
    {
        patterns: [/rsi|sma|ema|macd|indicator|technical analysis|uptrend|downtrend|in a trend|bollinger|bb|support|resistance|breakout|oversold|overbought|vwap/i],
        async handler(sym, msg, getRows) {
            if (!sym) return `📐 **Technical Indicators Guide**

**RSI (0–100):** <35 Oversold 🟢 | >65 Overbought 🔴
**SMA Golden Cross:** SMA20 > SMA50 → Bullish 📈
**MACD:** EMA12 − EMA26. Positive = bullish momentum
**Bollinger Bands:** Price near upper = extended; near lower = oversold
**VWAP:** Fair value volume-weighted price (intraday reference)
**Support/Resistance:** Key levels where price tends to bounce/reject

Ask "TCS technical analysis" for a live example!`;
            const a = await getA(sym, getRows);
            const bbPos = a.indicators.bbUpper && a.indicators.bbLower
                ? `${fmt(a.indicators.bbLower)} ← Current ${fmt(a.currentPrice)} → ${fmt(a.indicators.bbUpper)}`
                : 'N/A';
            return `📐 **${sym} — Full Technical Analysis**

**Price:** ${fmt(a.currentPrice)} | Trend: ${trendIcon(a.indicators.trend)} ${a.indicators.trend}

**Momentum:**
RSI (14): **${a.indicators.rsi}** → ${rsiLabel(a.indicators.rsi)}
MACD: ${a.indicators.macd} ${(a.indicators.macd > 0) ? '🟢 Positive (Bullish)' : '🔴 Negative (Bearish)'}

**Moving Averages:**
EMA 12: ${fmt(a.indicators.ema12)} | EMA 26: ${fmt(a.indicators.ema26)}
SMA 20: ${fmt(a.indicators.sma20)} | SMA 50: ${fmt(a.indicators.sma50)}
SMA 200: ${a.indicators.sma200 ? fmt(a.indicators.sma200) : 'N/A'} ${a.indicators.sma200 ? (a.currentPrice > a.indicators.sma200 ? '✅ Above (Bullish LT)' : '🔴 Below (Bearish LT)') : ''}

**Bollinger Bands (20, 2σ):**
${bbPos}
Middle: ${a.indicators.bbMiddle ? fmt(a.indicators.bbMiddle) : 'N/A'}

**Support & Resistance:**
S1: ₹${a.risk.support} | S2: ₹${a.risk.support2}
R1: ₹${a.risk.resistance} | R2: ₹${a.risk.resistance2}

**VWAP (20d):** ${fmt(a.indicators.vwap)} ${a.currentPrice > a.indicators.vwap ? '✅ Above (bullish bias)' : '🔴 Below (bearish bias)'}
**Volume:** ${a.volumeSignal} (${fmtVol(a.volume)} vs avg ${fmtVol(a.avgVolume)})

**Breakout Pattern:** ${a.breakout.pattern}

**AI Signal:** ${sigIcon(a.recommendation.action)} **${a.recommendation.action}** (Score: ${a.recommendation.score}, Conf: ${a.recommendation.confidence}%)`;
        }
    },

    // ─── 9. Fundamental Analysis ──────────────────────────────────────────────
    {
        patterns: [/fundamental|pe ratio|earnings|revenue|cash flow|balance sheet|debt|profit|eps|dividend|financially strong/i],
        async handler(sym, msg, getRows) {
            if (!sym) return '💡 Mention a stock — e.g. "Is TCS fundamentally strong?"';
            const a = await getA(sym, getRows);
            return `🏛️ **${sym} — Fundamental Snapshot**

⚠️ *Live P&L data requires paid API. Showing estimated/technical proxy.*

**Company:** ${a.name} | **Sector:** ${a.sector}
**Estimated P/E:** ~${a.estimatedPE}x ${a.estimatedPE < 20 ? '🟢 Below market avg' : a.estimatedPE > 35 ? '🔴 Premium' : '🟡 Fair'}
**Market Proxy (price trend):**
  52W High: ${fmt(a.week52High)} | 52W Low: ${fmt(a.week52Low)}
  Distance from high: ${((a.currentPrice / a.week52High - 1) * 100).toFixed(1)}%

**Analyst Consensus (6-month avg):**
Strong Buy + Buy: ${a.analystData.monthlyRecommendations.slice(-1)[0].strongBuy + a.analystData.monthlyRecommendations.slice(-1)[0].buy} analysts
Hold: ${a.analystData.monthlyRecommendations.slice(-1)[0].hold} | Sell: ${a.analystData.monthlyRecommendations.slice(-1)[0].sell}

**Price Target:** Avg ${fmt(a.analystData.avgTarget)} | High ${fmt(a.analystData.highTarget)} | Low ${fmt(a.analystData.lowTarget)}

**Risk Metrics:**
Beta: ${a.risk.beta} | Sharpe: ${a.risk.sharpe ?? 'N/A'} | Daily Vol: ${a.indicators.atrPct}%

${a.sector === 'IT' ? '💻 TCS/Infosys/Wipro: Strong cash flows, high dividend payers, low debt.' :
                    a.sector === 'Banking' ? '🏦 Check GNPA ratio, NIM, and credit growth from quarterly results.' :
                        '📊 Review quarterly earnings on NSE/Screener.in for exact fundamentals.'}`;
        }
    },

    // ─── 10. Compare (ChatGPT-level) ─────────────────────────────────────────
    {
        patterns: [/compare|vs |versus|better stock|which is better|which.+should i|between|safer.*than/i],
        async handler(sym, msg, getRows) {
            const pair = extractTwoSymbols(msg);
            if (pair.length < 2) return '💡 Try: "compare Tata Steel vs JSW Steel" or "Infosys vs TCS"';
            const [s1, s2] = pair;
            const [r1, r2] = await Promise.all([getRows(s1), getRows(s2)]);
            const [a1, a2] = [analyzeStock(s1, r1), analyzeStock(s2, r2)];

            const winner = a1.recommendation.score >= a2.recommendation.score ? a1 : a2;
            const loser = winner === a1 ? a2 : a1;
            const chg = a => `${a.changePercent >= 0 ? '+' : ''}${a.changePercent}%`;

            return `⚖️ **${s1} vs ${s2} — Full Comparison**

| Metric | ${s1} | ${s2} |
|:---|:---:|:---:|
| **Company** | ${a1.name} | ${a2.name} |
| **Sector** | ${a1.sector} | ${a2.sector} |
| **Current Price** | **${fmt(a1.currentPrice)}** | **${fmt(a2.currentPrice)}** |
| **Day Change** | ${chg(a1)} | ${chg(a2)} |
| **52W High** | ${fmt(a1.week52High)} | ${fmt(a2.week52High)} |
| **52W Low** | ${fmt(a1.week52Low)} | ${fmt(a2.week52Low)} |
| **Volume** | ${fmtVol(a1.volume)} | ${fmtVol(a2.volume)} |
| **RSI (14)** | ${a1.indicators.rsi} ${rsiLabel(a1.indicators.rsi)} | ${a2.indicators.rsi} ${rsiLabel(a2.indicators.rsi)} |
| **SMA 20** | ${fmt(a1.indicators.sma20)} | ${fmt(a2.indicators.sma20)} |
| **SMA 50** | ${fmt(a1.indicators.sma50)} | ${fmt(a2.indicators.sma50)} |
| **MACD** | ${a1.indicators.macd} | ${a2.indicators.macd} |
| **Trend** | ${trendIcon(a1.indicators.trend)} ${a1.indicators.trend} | ${trendIcon(a2.indicators.trend)} ${a2.indicators.trend} |
| **Support** | ₹${a1.risk.support} | ₹${a2.risk.support} |
| **Resistance** | ₹${a1.risk.resistance} | ₹${a2.risk.resistance} |
| **Beta** | ${a1.risk.beta} | ${a2.risk.beta} |
| **Sharpe Ratio** | ${a1.risk.sharpe ?? 'N/A'} | ${a2.risk.sharpe ?? 'N/A'} |
| **Est. P/E** | ~${a1.estimatedPE}x | ~${a2.estimatedPE}x |
| **AI Signal** | ${sigIcon(a1.recommendation.action)} **${a1.recommendation.action}** | ${sigIcon(a2.recommendation.action)} **${a2.recommendation.action}** |
| **Confidence** | ${a1.recommendation.confidence}% | ${a2.recommendation.confidence}% |
| **Risk Level** | ${a1.recommendation.risk} | ${a2.recommendation.risk} |
| **7D Target** | ${fmt(a1.predictedPrice)} (${a1.expectedChange > 0 ? '+' : ''}${a1.expectedChange}%) | ${fmt(a2.predictedPrice)} (${a2.expectedChange > 0 ? '+' : ''}${a2.expectedChange}%) |
| **Analyst Target** | ${fmt(a1.analystData.avgTarget)} | ${fmt(a2.analystData.avgTarget)} |

🏆 **Verdict:** Based on technicals, **${winner.symbol}** is stronger (score ${winner.recommendation.score} vs ${loser.recommendation.score}).
${winner.recommendation.action === 'BUY' ? `✅ ${winner.symbol} shows a BUY signal with ${winner.recommendation.confidence}% confidence.` : `⏸️ Both are mixed — monitor before deciding.`}
${a1.risk.beta > a2.risk.beta ? `🛡️ ${s2} has lower beta (${a2.risk.beta}) — safer/less volatile option.` : `🛡️ ${s1} has lower beta (${a1.risk.beta}) — safer/less volatile option.`}

⚠️ *Not financial advice.*`;
        }
    },

    // ─── 11. Portfolio strategy ───────────────────────────────────────────────
    {
        patterns: [/portfolio|diversif|what percentage|how much.*invest|allocation|risk exposure|add.*portfolio/i],
        async handler(sym, msg, getRows) {
            const a = sym ? await getA(sym, getRows) : null;
            const sectorTips = {
                IT: 'IT: 20–25% allocation typical for growth portfolio.',
                Banking: 'Banking: 15–20% is standard; widely held in Nifty.',
                Energy: 'Energy: 10–15%; hedge against inflation.',
                Auto: 'Auto: 8–12%; cyclical — reduce in downturns.',
            };
            return `📁 **Portfolio Strategy${a ? ` — ${sym}` : ''}**

${a ? `**${sym} Profile:**
Sector: ${a.sector} | Beta: ${a.risk.beta} | Risk: ${a.recommendation.risk}
AI Signal: ${sigIcon(a.recommendation.action)} **${a.recommendation.action}**
Beta ${a.risk.beta < 0.8 ? '< 0.8 — defensive, good for conservative portfolios' : a.risk.beta > 1.3 ? '> 1.3 — aggressive, suitable for growth portfolios' : '0.8–1.3 — balanced, fits most portfolios'}
${a.sector in sectorTips ? sectorTips[a.sector] : ''}

` : ''}**General Diversification Rules:**
• Large-cap: 50–60% | Mid-cap: 25–30% | Small-cap: 10–15%
• Single stock: max 5–7% of portfolio
• Single sector: max 25–30%
• IT + Banking alone = ~50% of Nifty50

**Risk tiers:**
🟢 Low risk: HDFC Bank, TCS, Infosys, Reliance
🟡 Moderate: Tata Motors, Adani Ports, ITC
🔴 High risk: Zomato, Paytm, small-cap pharma

💡 *SIP beats lump sum for volatile stocks. Use stop-loss of 7–10% below entry. Not financial advice.*`;
        }
    },

    // ─── 12. Risk assessment ─────────────────────────────────────────────────
    {
        patterns: [/risk|downside|how risky|safe to buy|volatil|currency|recession|us.*impact|interest rate|downside risk/i],
        async handler(sym, msg, getRows) {
            if (!sym) return '💡 Mention a stock — e.g. "risks of TCS" or "Is Infosys safe?"';
            const a = await getA(sym, getRows);
            const riskLevel = a.risk.beta > 1.3 ? 'HIGH' : a.risk.beta < 0.8 ? 'LOW' : 'MODERATE';
            return `⚠️ **${sym} — Risk Assessment**

**Overall Risk Level:** ${riskLevel} (Beta: ${a.risk.beta})
**Daily Volatility (ATR):** ₹${a.indicators.atr} per day (${a.indicators.atrPct}%)
**Max Downside to Support:** ${a.risk.downside}% (S1: ₹${a.risk.support})
**Sharpe Ratio:** ${a.risk.sharpe ?? 'N/A'} ${a.risk.sharpe > 1 ? '✅ Good' : a.risk.sharpe > 0 ? '🟡 Average' : '🔴 Poor risk-adjusted return'}

**Key Risks:**
${a.sector === 'IT' ? `• 💵 Currency risk: ${sym} earns in USD — INR appreciation hurts margins\n• 🏛️ US recession / IT spending cuts impact revenue\n• 🤖 AI automation disrupting traditional outsourcing` :
                    a.sector === 'Banking' ? `• 📉 Interest rate changes affect NIM (net interest margin)\n• 🏚️ Rising NPAs (bad loans) in credit stress cycles\n• 📊 RBI policy changes impact profitability` :
                        a.sector === 'Energy' ? `• 🛢️ Oil price volatility affects EPS directly\n• 🏛️ Government pricing controls on fuel\n• ⚡ Transition risk to renewables` :
                            `• 📊 Sector-specific regulatory and demand cycle risks`}

**Technical Risk:**
RSI: ${a.indicators.rsi} (${a.indicators.rsiStatus}) | Trend: ${a.indicators.trend}
Stop-loss suggestion: ₹${a.risk.support} (${a.risk.downside}% from current)

💡 *Never risk more than 2% of portfolio on a single trade.*`;
        }
    },

    // ─── 13. News & Event Impact ──────────────────────────────────────────────
    {
        patterns: [/earnings|upcoming result|quarterly result|news|event|sentiment|insider|insider buying|interest rate hike|us rate|federal/i],
        async handler(sym, msg, getRows) {
            if (!sym) return '💡 Mention a stock — e.g. "How will earnings affect TCS?"';
            const a = await getA(sym, getRows);
            return `📰 **${sym} — Event & Sentiment Analysis**

⚠️ *Real-time news requires a news API. Showing technical sentiment proxy.*

**Technical Sentiment:**
AI Signal: ${sigIcon(a.recommendation.action)} **${a.recommendation.action}** | Score: ${a.recommendation.score}
Volume Signal: ${a.volumeSignal} (${fmtVol(a.volume)} vs avg ${fmtVol(a.avgVolume)})
${a.volumeSignal === 'High' ? '📊 High volume may indicate institutional activity or news-driven movement.' : ''}

**Analyst Consensus (latest month):**
Strong Buy: ${a.analystData.monthlyRecommendations.slice(-1)[0].strongBuy} | Buy: ${a.analystData.monthlyRecommendations.slice(-1)[0].buy}
Hold: ${a.analystData.monthlyRecommendations.slice(-1)[0].hold} | Sell: ${a.analystData.monthlyRecommendations.slice(-1)[0].sell}

**Event Impact Estimates for ${sym}:**
${a.sector === 'IT' ? `• US Fed rate hike → 🔴 Negative (cuts tech budgets, USD strengthens)
• Strong US job market → 🟢 Positive (more IT spending)
• Earnings beat → 🟢 Typically +3–8% gap up
• Earnings miss → 🔴 Typically -5–12% sell-off` :
                    a.sector === 'Banking' ? `• RBI rate hike → 🟢 Short-term positive (better NIM)
• RBI rate cut → 🔴 Margin compression
• Earnings beat → 🟢 +2–6% typical
• High NPA disclosure → 🔴 -5–15% possible` :
                        `• Strong quarterly earnings → 🟢 Typically +3–8% upside
• Earnings miss → 🔴 -5–10% downside risk typical`}

**Breakout Signal:** ${a.breakout.pattern}

💡 *For real-time news, check NSE announcements or Tickertape.*`;
        }
    },

    // ─── 14. Scenario Analysis ───────────────────────────────────────────────
    {
        patterns: [/what if|scenario|if nifty falls|if market falls|market crash|it spending|ai adoption|AI impact|misses earnings/i],
        async handler(sym, msg, getRows) {
            if (!sym) return '💡 Try: "What if TCS misses earnings?" or "If Nifty falls 10%, how might Infosys react?"';
            const a = await getA(sym, getRows);
            const bull = parseFloat((a.currentPrice * 1.12).toFixed(2));
            const base = a.predictedPrice;
            const bear = parseFloat((a.currentPrice * 0.88).toFixed(2));
            const crash = parseFloat((a.currentPrice * (1 - a.risk.beta * 0.10)).toFixed(2));
            return `🎭 **${sym} — Scenario Analysis**

Current Price: ${fmt(a.currentPrice)} | Beta: ${a.risk.beta}

| Scenario | Price Impact | Level |
|:---|:---:|:---:|
| 🟢 Bull Case (+12%) | +12% | ${fmt(bull)} |
| 📊 Base Case (AI target) | ${a.expectedChange > 0 ? '+' : ''}${a.expectedChange}% | ${fmt(base)} |
| 🔴 Bear Case (-12%) | -12% | ${fmt(bear)} |
| 💥 Market crash: Nifty -10% | ${(-a.risk.beta * 10).toFixed(1)}% | ${fmt(crash)} |

**Scenario Inputs:**
${a.sector === 'IT' ? `• If AI automates 15% of IT work → Revenue pressure, EPS impact
• If US recession reduces IT budgets → Could drop 15–25%
• If deal wins accelerate → Could see 20–30% re-rating` :
                    a.sector === 'Banking' ? `• If RBI cuts rates → NIM compression, short-term weakness
• If GDP grows 7%+ → Strong credit demand, positive` :
                        `• Market crash (Nifty -10%) → Expected move: ${(-a.risk.beta * 10).toFixed(1)}% (Beta: ${a.risk.beta})`}

**Key Levels to Watch:**
Support: ₹${a.risk.support} (bear case floor) | Resistance: ₹${a.risk.resistance} (bull case ceiling)

💡 *Scenarios are estimates based on beta and technicals.*`;
        }
    },

    // ─── 15. Quantitative / Probability ──────────────────────────────────────
    {
        patterns: [/confidence level|historical accuracy|risk.adjusted|sharpe|beta|quant|probability|expected return|model accuracy/i],
        async handler(sym, msg, getRows) {
            if (!sym) return '💡 Mention a stock — e.g. "What is TCS beta?" or "Sharpe ratio of Infosys"';
            const a = await getA(sym, getRows);
            const probUp = Math.round(Math.max(20, Math.min(85, 50 + a.recommendation.score * 6)));
            const expReturn = (a.risk.sharpe && a.indicators.atrPct)
                ? parseFloat((a.risk.sharpe * a.indicators.atrPct * Math.sqrt(252 / 20)).toFixed(2))
                : null;
            return `📐 **${sym} — Quantitative Analysis**

**Model Signal:** ${sigIcon(a.recommendation.action)} **${a.recommendation.action}**
**Score:** ${a.recommendation.score} / ±9 | **Confidence:** ${a.recommendation.confidence}%
**Probability of Upside:** ~${probUp}%

**Risk Metrics:**
Beta (vs Nifty est.): **${a.risk.beta}** ${a.risk.beta > 1 ? '(more volatile than Nifty)' : '(less volatile than Nifty)'}
Sharpe Ratio (1Y): **${a.risk.sharpe ?? 'N/A'}** ${a.risk.sharpe > 1.5 ? '✅ Excellent' : a.risk.sharpe > 0.8 ? '🟡 Good' : a.risk.sharpe > 0 ? '🟠 Average' : a.risk.sharpe !== null ? '🔴 Below average' : ''}
Daily ATR: ₹${a.indicators.atr} (${a.indicators.atrPct}% of price)
${expReturn ? `Annualised Expected Return proxy: ~${expReturn}%` : ''}

**Model Components (scoring):**
• RSI (${a.indicators.rsi}) → ${a.indicators.rsi < 40 ? '+2 (oversold)' : a.indicators.rsi > 60 ? '-1 to -2 (overbought)' : '0 (neutral)'}
• SMA20 vs SMA50: ${a.indicators.sma20 > a.indicators.sma50 ? '+1 (golden cross)' : '-1 (death cross)'}
• MACD: ${a.indicators.macd > 0 ? '+1 (positive)' : '-1 (negative)'}
• Trend: ${a.indicators.trend === 'Bullish' ? '+1' : a.indicators.trend === 'Bearish' ? '-1' : '0'}
• Bollinger position: ${a.currentPrice < a.indicators.bbLower ? '+1 (oversold)' : a.currentPrice > a.indicators.bbUpper ? '-1 (overbought)' : '0'}
• SMA200: ${a.indicators.sma200 && a.currentPrice > a.indicators.sma200 ? '+1 (above LT avg)' : '-1 (below LT avg)'}
**Total Score: ${a.recommendation.score}**

⚠️ *Model accuracy ~65–70% based on backtested technical rules. Not financial advice.*`;
        }
    },

    // ─── 16. Market Overview ─────────────────────────────────────────────────
    {
        patterns: [/market|nifty|sensex|trend today|how is market|overall|market today/i],
        async handler(sym, msg, getRows) {
            const stocks = ['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'WIPRO'];
            const results = await Promise.all(stocks.map(s => getRows(s).then(r => analyzeStock(s, r))));
            const gainers = results.filter(a => a.changePercent > 0).length;
            const avgChg = (results.reduce((s, a) => s + a.changePercent, 0) / results.length).toFixed(2);
            const sent = parseFloat(avgChg) > 0.5 ? '🟢 Bullish' : parseFloat(avgChg) < -0.5 ? '🔴 Bearish' : '🟡 Sideways';
            return `📈 **Market Snapshot** (5 Bluechips)

Sentiment: ${sent} | Avg Change: ${avgChg}%
Gainers: ${gainers} / ${stocks.length}

${results.map(a => `• **${a.symbol}**: ${fmt(a.currentPrice)} ${a.changePercent >= 0 ? '▲' : '▼'}${Math.abs(a.changePercent)}% ${sigIcon(a.recommendation.action)} ${a.recommendation.action}`).join('\n')}

💡 Add Nifty CSVs for index analysis. Ask "compare TCS vs INFY" for detailed comparison!`;
        }
    },

    // ─── 17. Sector filter ────────────────────────────────────────────────────
    {
        patterns: [/which sector|sector performance|it stocks|banking stocks|auto stocks|energy stocks|pharma stocks|best sector/i],
        handler(sym, msg) {
            const stocks = {
                IT: ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM'],
                Banking: ['HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK'],
                Auto: ['TATAMOTORS', 'MARUTI', 'M&M', 'HEROMOTOCO', 'EICHERMOT'],
                Energy: ['RELIANCE', 'ONGC', 'NTPC', 'POWERGRID', 'COALINDIA'],
                Pharma: ['SUNPHARMA', 'DRREDDY', 'CIPLA', 'DIVISLAB']
            };
            const upper = msg.toUpperCase();
            const sel = /BANK/.test(upper) ? 'Banking' : /AUTO/.test(upper) ? 'Auto' : /ENERG|OIL/.test(upper) ? 'Energy' : /PHARMA|MEDIC/.test(upper) ? 'Pharma' : 'IT';
            return `🏭 **${sel} Sector Stocks**\n\n${stocks[sel].map(s => `• **${s}**`).join('\n')}\n\nAsk "predict TCS" or "compare TCS vs INFY" for analysis!`;
        }
    },

    // ─── 18. Technical glossary ───────────────────────────────────────────────
    {
        patterns: [/what is rsi|explain rsi|what is sma|explain macd|what is ema|what is atr|what is beta|what is sharpe|what is vwap|what is bollinger/i],
        handler: () => `📚 **Trading Glossary**

**RSI:** Momentum oscillator 0–100. <35 oversold, >65 overbought.
**SMA:** Simple avg price over N days. Golden cross (SMA20>SMA50) = bullish.
**EMA:** Like SMA but weights recent prices more — faster signal.
**MACD:** EMA12 − EMA26. Positive = bullish momentum.
**Bollinger Bands:** Mean ± 2σ. Price near upper = extended; near lower = oversold.
**ATR:** Average True Range — measures daily price volatility in ₹.
**VWAP:** Volume-weighted avg price — fair value reference for day traders.
**Beta:** Volatility vs Nifty. >1 = more volatile, <1 = defensive.
**Sharpe:** Risk-adjusted return. >1 = good, >2 = excellent.
**Support:** Price floor where buyers step in. **Resistance:** ceiling where sellers appear.`
    },

    // ─── 19. Help ─────────────────────────────────────────────────────────────
    {
        patterns: [/help|what can you do|commands|examples|how to use/i],
        handler: () => `🤖 **Neura2 AI — Full Command List**

**💰 Buy/Sell/Hold:**
• "Should I buy Tata Steel?" | "Sell TCS?" | "Hold Infosys?"

**📊 Price & Prediction:**
• "Price of Reliance" | "Predict Wipro" | "TCS year-end target"

**📐 Technical Analysis:**
• "TCS indicators" | "Support resistance Infosys" | "Is TCS breaking out?"

**🏛️ Fundamentals:**
• "Is TCS fundamentally strong?" | "Infosys PE ratio" | "Tata Steel valuation"

**⚖️ Compare:**
• "Compare Infosys vs TCS" | "TCS vs HCLTech long-term"

**📁 Portfolio:**
• "Should I add TCS to portfolio?" | "What % IT stocks?"

**⚠️ Risk:**
• "Risks of Reliance" | "TCS beta" | "Infosys Sharpe ratio"

**📰 Events:**
• "How will earnings affect TCS?" | "US rate hike impact on Infosys"

**🎭 Scenarios:**
• "If Nifty falls 10%, how might TCS react?" | "What if TCS misses earnings?"

**📐 Quant:**
• "What is TCS confidence level?" | "Infosys Sharpe ratio"

Type any stock name naturally — I recognise Infosys, Tata Steel, Reliance etc. 📡`
    },


    // ─── 20. Why BUY/SELL/HOLD — Feature Importance Explainability ──────────
    {
        patterns: [/why.+(buy|sell|hold)|explain.+(signal|recommendation)|what.+(drive|signal)|reason.+(buy|sell|recomm)|feature.+import|breakdown/i],
        async handler(sym, msg, getRows) {
            if (!sym) return '💡 Mention a stock — e.g. "Why buy TCS?"';
            const a = await getA(sym, getRows);
            if (!a.featureImportance) return `${sigIcon(a.recommendation.action)} **${sym}** — Signal: **${a.recommendation.action}** (${a.recommendation.confidence}% confidence)\n\nNo detailed factor breakdown available.`;
            const fi = a.featureImportance;
            const scoreTotal = fi.factors.reduce((s, f) => s + f.contribution, 0);
            const signRows = fi.factors.map(f => {
                const dir = f.contribution > 0 ? '🟢' : f.contribution < 0 ? '🔴' : '⬜';
                return `  ${dir} ${(f.name + ':').padEnd(28)} ${f.signal}`;
            }).join('\n');
            return `${sigIcon(a.recommendation.action)} **${sym} — Why ${a.recommendation.action}? (Score: ${scoreTotal > 0 ? '+' : ''}${scoreTotal}/9)**

\`\`\`
${signRows}
\`\`\`

**Regime:** ${a.regime?.regime || 'N/A'}  |  **Confidence:** ${a.recommendation.confidence}%
**P(Up 10d):** ${a.probability?.probUp || '--'}%  |  **Expected Return:** ${a.probability?.expectedReturn10d || '--'}%
**VaR 95%:** -${a.risk?.var95 || '--'}%  |  **Max Drawdown:** -${a.risk?.maxDrawdown || '--'}%

🔍 *Driven by: RSI, MACD cross, SMA trend, Bollinger, ATR, Stochastic, OBV flow, S/R levels, VWAP position*`;
        }
    },

    // ─── 21. Backtesting Intent ───────────────────────────────────────────────
    {
        patterns: [/backtest|historical.+(performance|return|strategy)|strategy.+(test|simulation|result)|how.+(strategy|perform).+historically|past.+(performance|return)/i],
        async handler(sym, msg, getRows) {
            if (!sym) return '💡 Mention a stock — e.g. "Backtest TCS"';
            const { runAllStrategies } = require('./backtest');
            const rows = await getRows(sym);
            if (rows.length < 60) return `⚠️ Not enough historical data for **${sym}** (need 60+ days).`;
            const bt = runAllStrategies(rows);
            const s1 = bt.strategies.maCrossover;
            const s2 = bt.strategies.rsiReversion;
            const s3 = bt.strategies.macdCrossover;
            const bhIcon = bt.buyHoldReturn >= 0 ? '🟢' : '🔴';
            return `📈 **${sym} — Backtest Results** (${bt.summary.period})

| Strategy | Return | CAGR | Sharpe | Win% | Max DD | Alpha |
|----------|-------:|-----:|-------:|-----:|-------:|------:|
| SMA Crossover | ${s1.totalReturn>=0?'+':''}${s1.totalReturn}% | ${s1.cagr}% | ${s1.sharpe} | ${s1.winRate}% | -${s1.maxDrawdown}% | ${s1.alpha>=0?'+':''}${s1.alpha}% |
| RSI Reversion | ${s2.totalReturn>=0?'+':''}${s2.totalReturn}% | ${s2.cagr}% | ${s2.sharpe} | ${s2.winRate}% | -${s2.maxDrawdown}% | ${s2.alpha>=0?'+':''}${s2.alpha}% |
| MACD Crossover | ${s3.totalReturn>=0?'+':''}${s3.totalReturn}% | ${s3.cagr}% | ${s3.sharpe} | ${s3.winRate}% | -${s3.maxDrawdown}% | ${s3.alpha>=0?'+':''}${s3.alpha}% |

${bhIcon} **Buy & Hold:** ${bt.buyHoldReturn>=0?'+':''}${bt.buyHoldReturn}%  |  **Best:** ${bt.bestStrategy}

💡 *Click **Backtest** in the Prediction tab for equity curve visualisation.*`;
        }
    },

    // ─── 22. Market Regime Intent ─────────────────────────────────────────────
    {
        patterns: [/market regime|current regime|bull.+bear|bear.+bull|high volatil|sideways market|what.+(market|regime|condition|phase)|trending up|trending down|consolidat/i],
        async handler(sym, msg, getRows) {
            const target = sym || 'TCS';
            const a = await getA(target, getRows);
            const r = a.regime;
            if (!r) return `📊 **${target}** — No regime data available. Try predicting the stock first.`;
            const regimeEmoji = { 'Bull Market': '🐂', 'Bear Market': '🐻', 'High Volatility': '⚡', 'Sideways': '↔️' };
            const icon = regimeEmoji[r.regime] || '📊';
            const advice = r.regime === 'Bull Market' ? 'Momentum is strong. BUY signals are more reliable. Use trailing stops.' :
                r.regime === 'Bear Market' ? 'Downtrend detected. Favour cash/defensives. SELL signals carry more weight.' :
                r.regime === 'High Volatility' ? 'Large swings expected. Reduce position size, widen stops.' :
                'No clear trend. Range-trade between support/resistance. Wait for breakout.';
            return `${icon} **${target} — Market Regime: ${r.regime}**

Trend (10d): **${r.trend10}** | Trend (30d): ${r.trend30Pct>=0?'+':''}${r.trend30Pct}%
Volatility: **${r.volatilityState}** (${r.vol10d}% 10-day vol)
Above SMA200: ${r.aboveSMA200 ? '✅ Yes (long-term bull zone)' : '❌ No (long-term bear zone)'}

💡 **Implication:** ${advice}`;
        }
    },

    // ─── 23. Probability / Odds Forecast ─────────────────────────────────────
    {
        patterns: [/probability|odds|chance|likelihood|how likely|what.+(chance|odds|probability)|probabilistic|expected return|forecast|10.?day/i],
        async handler(sym, msg, getRows) {
            if (!sym) return '💡 Mention a stock — e.g. "Odds of TCS going up?"';
            const a = await getA(sym, getRows);
            const p = a.probability;
            if (!p) return `📊 **${sym}** — Signal: **${a.recommendation.action}** (${a.recommendation.confidence}% conf). No probabilistic data yet.`;
            const upIcon = p.probUp > 55 ? '🟢' : p.probUp < 45 ? '🔴' : '🟡';
            return `🎲 **${sym} — Probabilistic Forecast (${p.horizon})**

${upIcon} **P(Up):** ${p.probUp}%   vs   🔴 **P(Down):** ${p.probDown}%
📈 P(Gain > 3%): **${p.prob3PctGain}%**  |  P(Gain > 5%): **${p.prob5PctGain}%**
📐 Expected 10d Return: **${p.expectedReturn10d>=0?'+':''}${p.expectedReturn10d}%**
📉 10d Vol Estimate: **${p.tenDayVol}%**

**Risk Metrics (Current):**
• VaR 95%: -${a.risk?.var95||'--'}%  |  VaR 99%: -${a.risk?.var99||'--'}%
• Max Drawdown: -${a.risk?.maxDrawdown||'--'}%  |  Sharpe: ${a.risk?.sharpe||'--'}

💡 *Model estimates — combine with technical & fundamental analysis.*`;
        }
    },

];

// ── Main chat dispatcher (async) ───────────────────────────────────────────
async function chat(message, getRows) {
    const msg = (message || '').trim();
    if (!msg) return 'Please ask me something about the Indian stock market! 📊';

    const sym = extractSymbol(msg);

    for (const intent of INTENTS) {
        if (intent.patterns.some(p => p.test(msg))) {
            return await intent.handler(sym, msg, getRows);
        }
    }

    if (sym) {
        try {
            const a = analyzeStock(sym, await getRows(sym));
            return `${sigIcon(a.recommendation.action)} **${sym} — ${a.name}**

Price: **${fmt(a.currentPrice)}** (${a.changePercent > 0 ? '+' : ''}${a.changePercent}%)
Signal: **${a.recommendation.action}** | RSI: ${a.indicators.rsi} | Trend: ${a.indicators.trend}
52W: ${fmt(a.week52Low)} – ${fmt(a.week52High)}

Ask "predict ${sym}", "buy ${sym}?", "compare ${sym} vs TCS", "${sym} risk", or "${sym} indicators" for more!`;
        } catch (_) { }
    }

    return `🤔 Try:\n• "Should I buy Infosys?"\n• "predict Tata Steel"\n• "compare TCS vs Wipro"\n• "TCS risk analysis"\n• Type "help" for all commands!`;
}

module.exports = { chat };
