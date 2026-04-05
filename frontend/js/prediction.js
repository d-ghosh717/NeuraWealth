// frontend/js/prediction.js — Advanced chart view with candlestick, sub-charts, backtesting, probability

let priceChart = null;
let rsiChart = null;
let macdChart = null;
let backChart = null;
let currentSymbol = null;
let currentPeriod = '1m';
let lastPredicted = null;
let chartMode = 'line';   // 'line' | 'candle'
let lastAnalysis = null;     // full predictor response

// ── Period & chart-mode buttons ──────────────────────────────────────────
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.p;
    if (currentSymbol) loadChart(currentSymbol, currentPeriod, lastPredicted);
  });
});

// Chart mode toggle (Line / Candle)
document.getElementById('chart-line-btn')?.addEventListener('click', () => setChartMode('line'));
document.getElementById('chart-candle-btn')?.addEventListener('click', () => setChartMode('candle'));

function setChartMode(mode) {
  chartMode = mode;
  document.getElementById('chart-line-btn')?.classList.toggle('active', mode === 'line');
  document.getElementById('chart-candle-btn')?.classList.toggle('active', mode === 'candle');
  if (currentSymbol) loadChart(currentSymbol, currentPeriod, lastPredicted);
}

// ── Predict button ────────────────────────────────────────────────────────
document.getElementById('predict-btn').addEventListener('click', () => {
  const sym = document.getElementById('predict-input').value.trim().toUpperCase();
  if (sym) window.runPrediction(sym);
});
document.getElementById('predict-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('predict-btn').click();
});

// ── Backtest button ───────────────────────────────────────────────────────
document.getElementById('backtest-btn')?.addEventListener('click', () => {
  if (currentSymbol) loadBacktest(currentSymbol);
});

// ── Main prediction runner ─────────────────────────────────────────────────
window.runPrediction = async function (symbol, displayName) {
  document.getElementById('predict-error').style.display = 'none';
  document.getElementById('predict-empty').style.display = 'none';
  showLoading();
  const loadHint = document.getElementById('load-hint');
  if (loadHint) loadHint.textContent = 'Fetching live data from Yahoo Finance…';

  try {
    const predRes = await fetch(`${API}/stocks/predict/${encodeURIComponent(symbol)}`).then(r => r.json());
    if (!predRes.success) throw new Error('Not found');
    const d = predRes.data;
    lastAnalysis = d;
    currentSymbol = symbol;
    lastPredicted = d.predictedPrice;

    // Show panels
    ['predict-grid', 'detail-strip', 'ind-grid', 'analyst-section'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = id === 'ind-grid' ? 'grid' : id === 'detail-strip' ? 'grid' : 'block';
    });
    document.getElementById('predict-grid').style.display = 'grid';
    document.getElementById('predict-empty').style.display = 'none';

    // Show consolidated analytics card
    const analyticsCard = document.getElementById('analytics-card');
    if (analyticsCard) analyticsCard.style.display = 'block';

    // ── Price hero ─────────────────────────────────────────────────────
    document.getElementById('a-symbol').textContent = `${d.symbol} · ${d.name}`;
    document.getElementById('a-price').textContent = fmtPrice(d.currentPrice);
    const up = d.changePercent >= 0;
    const chEl = document.getElementById('a-change');
    chEl.textContent = `${up ? '+' : ''}${d.change.toFixed(2)} (${up ? '+' : ''}${d.changePercent.toFixed(2)}%)`;
    chEl.style.color = up ? 'var(--success)' : 'var(--danger)';

    // ── Action ring ────────────────────────────────────────────────────
    const ring = document.getElementById('action-ring');
    ring.className = 'action-ring ' + d.recommendation.action.toLowerCase();
    document.getElementById('action-text').textContent = d.recommendation.action;
    document.getElementById('action-conf').textContent = d.recommendation.confidence + '%';

    // ── Stats ──────────────────────────────────────────────────────────
    document.getElementById('a-predicted').textContent = fmtPrice(d.predictedPrice);
    const expEl = document.getElementById('a-exp-change');
    const expUp = d.expectedChange >= 0;
    expEl.textContent = `${expUp ? '+' : ''}${d.expectedChange}%`;
    expEl.style.color = expUp ? 'var(--success)' : 'var(--danger)';
    const riskEl = document.getElementById('a-risk');
    riskEl.textContent = d.recommendation.risk;
    riskEl.className = 'badge ' + d.recommendation.risk.toLowerCase();
    document.getElementById('a-timeframe').textContent = d.recommendation.timeframe;

    // ── Detail strip ───────────────────────────────────────────────────
    document.getElementById('d-prev').textContent = fmtPrice(d.previousClose);
    document.getElementById('d-open').textContent = fmtPrice(d.open);
    document.getElementById('d-high').textContent = fmtPrice(d.high);
    document.getElementById('d-low').textContent = fmtPrice(d.low);
    document.getElementById('d-vol').textContent = fmtVol(d.volume);
    document.getElementById('d-avgvol').textContent = fmtVol(d.avgVolume);
    document.getElementById('d-52h').textContent = fmtPrice(d.week52High);
    document.getElementById('d-52l').textContent = fmtPrice(d.week52Low);

    // ── Indicators ────────────────────────────────────────────────────
    const ind = d.indicators;
    const rsi = ind.rsi;
    document.getElementById('i-rsi').textContent = rsi.toFixed(1);
    const rsiStatusEl = document.getElementById('i-rsi-status');
    rsiStatusEl.textContent = ind.rsiStatus;
    rsiStatusEl.style.color = rsi < 35 ? 'var(--success)' : rsi > 65 ? 'var(--danger)' : 'var(--warning)';
    const rsiBar = document.getElementById('i-rsi-bar');
    rsiBar.style.width = Math.min(rsi, 100) + '%';
    rsiBar.style.background = rsi < 35 ? 'var(--success)' : rsi > 65 ? 'var(--danger)' : 'var(--warning)';
    const trend = ind.trend;
    document.getElementById('i-trend').textContent = trend;
    document.getElementById('i-trend').style.color = trend === 'Bullish' ? 'var(--success)' : trend === 'Bearish' ? 'var(--danger)' : 'var(--warning)';
    document.getElementById('i-trend-sub').textContent = trend === 'Bullish' ? '↑ Upward momentum' : trend === 'Bearish' ? '↓ Downward momentum' : '→ Sideways';
    document.getElementById('i-sma20').textContent = ind.sma20 ? fmtPrice(ind.sma20) : '--';
    document.getElementById('i-sma50').textContent = ind.sma50 ? fmtPrice(ind.sma50) : '--';
    document.getElementById('i-macd').textContent = ind.macd != null ? ind.macd.toFixed(2) : '--';
    document.getElementById('i-macd').style.color = ind.macd > 0 ? 'var(--success)' : 'var(--danger)';

    // ── Regime panel ──────────────────────────────────────────────────
    if (d.regime) renderRegimePanel(d.regime, d.sector);

    // ── Probability panel ─────────────────────────────────────────────
    if (d.probability) renderProbPanel(d.probability);

    // ── Risk panel (VaR, drawdown) ────────────────────────────────────
    if (d.risk) renderRiskPanel(d.risk);

    // ── Feature importance (SHAP-style) ───────────────────────────────
    if (d.featureImportance) renderFeaturePanel(d.featureImportance);

    // ── Analyst section ───────────────────────────────────────────────
    renderAnalystSection(d.analystData, d.currentPrice);

    // ── Chart ─────────────────────────────────────────────────────────
    await loadChart(symbol, currentPeriod, d.predictedPrice, d.chartData);

    // ── Sub-charts ────────────────────────────────────────────────────
    renderRSIChart(d.chartData);
    renderMACDChart(d.chartData);

  } catch (e) {
    document.getElementById('predict-error').style.display = 'block';
    console.error(e);
  } finally {
    hideLoading();
  }
};

// ── Regime Panel ──────────────────────────────────────────────────────────
function renderRegimePanel(r, sector) {
  const el = document.getElementById('regime-panel');
  if (!el) return;
  el.innerHTML = `
      <div class="panel-hdr"><h4>📊 Market Regime</h4></div>
      <div class="regime-body">
        <div class="regime-badge ${r.regimeColor}">
          <span class="regime-icon">${r.regimeIcon}</span>
          <span class="regime-label">${r.regime}</span>
        </div>
        <div class="regime-stats">
          <div class="rsrow"><span class="rsl">10d Trend</span><span class="rsv" style="color:${r.trend10 === 'Bullish' ? 'var(--success)' : r.trend10 === 'Bearish' ? 'var(--danger)' : 'var(--warning)'}">${r.trend10}</span></div>
          <div class="rsrow"><span class="rsl">30d Change</span><span class="rsv" style="color:${r.trend30Pct >= 0 ? 'var(--success)' : 'var(--danger)'}">${r.trend30Pct >= 0 ? '+' : ''}${r.trend30Pct}%</span></div>
          <div class="rsrow"><span class="rsl">Volatility</span><span class="rsv" style="color:${r.volatilityState === 'Elevated' ? 'var(--warning)' : 'var(--success)'}">${r.volatilityState}</span></div>
          <div class="rsrow"><span class="rsl">10d Vol</span><span class="rsv">${r.vol10d}%</span></div>
          <div class="rsrow"><span class="rsl">vs SMA200</span><span class="rsv" style="color:${r.aboveSMA200 ? 'var(--success)' : 'var(--danger)'}">${r.aboveSMA200 ? 'Above ✅' : 'Below ❌'}</span></div>
        </div>
      </div>`;
}

// ── Probability Panel ──────────────────────────────────────────────────────
function renderProbPanel(p) {
  const el = document.getElementById('prob-panel');
  if (!el) return;
  const upColor = p.probUp > 55 ? 'var(--success)' : p.probUp < 45 ? 'var(--danger)' : 'var(--warning)';
  const downColor = p.probDown > 55 ? 'var(--danger)' : 'var(--warning)';
  el.innerHTML = `
      <div class="panel-hdr"><h4>🎲 Probability Forecast <span class="panel-sub">(${p.horizon})</span></h4></div>
      <div class="prob-body">
        <div class="prob-gauge-row">
          <div class="prob-item">
            <div class="prob-circle" style="--p:${p.probUp};--c:var(--success)">
              <span class="prob-val" style="color:${upColor}">${p.probUp}%</span>
              <span class="prob-lbl">Up</span>
            </div>
          </div>
          <div class="prob-divider">vs</div>
          <div class="prob-item">
            <div class="prob-circle" style="--p:${p.probDown};--c:var(--danger)">
              <span class="prob-val" style="color:${downColor}">${p.probDown}%</span>
              <span class="prob-lbl">Down</span>
            </div>
          </div>
        </div>
        <div class="prob-bar-wrap">
          <div class="prob-bar-fill" style="width:${p.probUp}%;background:${upColor}"></div>
        </div>
        <div class="prob-details">
          <div class="rsrow"><span class="rsl">P(gain &gt; 3%)</span><span class="rsv" style="color:var(--success)">${p.prob3PctGain}%</span></div>
          <div class="rsrow"><span class="rsl">P(gain &gt; 5%)</span><span class="rsv" style="color:var(--success)">${p.prob5PctGain}%</span></div>
          <div class="rsrow"><span class="rsl">Expected 10d Return</span><span class="rsv" style="color:${p.expectedReturn10d >= 0 ? 'var(--success)' : 'var(--danger)'}">${p.expectedReturn10d >= 0 ? '+' : ''}${p.expectedReturn10d}%</span></div>
          <div class="rsrow"><span class="rsl">10d Vol Estimate</span><span class="rsv">${p.tenDayVol}%</span></div>
        </div>
      </div>`;
}

// ── Risk Panel (VaR, Drawdown) ─────────────────────────────────────────────
function renderRiskPanel(r) {
  const el = document.getElementById('risk-panel');
  if (!el) return;
  el.innerHTML = `
      <div class="panel-hdr"><h4>⚠️ Risk Metrics</h4></div>
      <div class="risk-grid-adv">
        ${riskRow('Beta', r.beta, r.beta > 1.2 ? 'danger' : r.beta < 0.8 ? 'success' : 'warning')}
        ${riskRow('Sharpe Ratio', r.sharpe != null ? r.sharpe : 'N/A', r.sharpe > 1 ? 'success' : r.sharpe > 0 ? 'warning' : 'danger')}
        ${riskRow('ATR', `₹${r.atr} (${r.atrPct}%)`, 'warning')}
        ${riskRow('VaR 95%', r.var95 != null ? `-${r.var95}%` : 'N/A', 'danger')}
        ${riskRow('VaR 99%', r.var99 != null ? `-${r.var99}%` : 'N/A', 'danger')}
        ${riskRow('Max Drawdown', r.maxDrawdown != null ? `-${r.maxDrawdown}%` : 'N/A', 'danger')}
        ${riskRow('Support', fmtPrice(r.support), 'success')}
        ${riskRow('Resistance', fmtPrice(r.resistance), 'danger')}
        ${riskRow('Support 2', fmtPrice(r.support2), 'success')}
        ${riskRow('Resistance 2', fmtPrice(r.resistance2), 'danger')}
      </div>`;
}
function riskRow(label, value, cls) {
  const c = cls === 'success' ? 'var(--success)' : cls === 'danger' ? 'var(--danger)' : 'var(--warning)';
  return `<div class="rsrow"><span class="rsl">${label}</span><span class="rsv" style="color:${c}">${value}</span></div>`;
}

// ── Feature Importance Panel ───────────────────────────────────────────────
function renderFeaturePanel(fi) {
  const el = document.getElementById('feature-panel');
  if (!el) return;
  const rows = fi.factors.map(f => {
    const w = Math.min(100, Math.abs(f.contribution) / 3 * 100);
    const col = f.contribution > 0 ? 'var(--success)' : f.contribution < 0 ? 'var(--danger)' : 'var(--text-secondary)';
    return `
          <div class="feat-row">
            <div class="feat-name">${f.name}</div>
            <div class="feat-bar-wrap">
              <div class="feat-bar" style="width:${w}%;background:${col}"></div>
            </div>
            <div class="feat-signal">${f.signal}</div>
          </div>`;
  }).join('');
  const scoreTotal = fi.factors.reduce((s, f) => s + f.contribution, 0);
  const scoreColor = scoreTotal > 0 ? 'var(--success)' : scoreTotal < 0 ? 'var(--danger)' : 'var(--warning)';
  el.innerHTML = `
      <div class="panel-hdr">
        <h4>🔍 Why This Signal? <span class="panel-sub">Score: <span style="color:${scoreColor}">${scoreTotal > 0 ? '+' : ''}${scoreTotal}</span>/9</span></h4>
      </div>
      <div class="feat-list">${rows}</div>`;
}

// ── Backtest loader ────────────────────────────────────────────────────────
async function loadBacktest(symbol) {
  const panel = document.getElementById('backtest-panel');
  if (!panel) return;
  panel.innerHTML = `<div class="panel-hdr"><h4>📈 Backtesting Results</h4></div><div class="bt-loading">⏳ Running 3 strategies on ${symbol} history…</div>`;
  try {
    const res = await fetch(`${API}/backtest/${encodeURIComponent(symbol)}`).then(r => r.json());
    if (!res.success) { panel.innerHTML += `<p style="color:var(--danger)">Error: ${res.error}</p>`; return; }
    const bt = res.data;
    renderBacktestPanel(panel, bt, symbol);
  } catch (e) {
    panel.innerHTML += `<p style="color:var(--danger)">Backtest failed: ${e.message}</p>`;
  }
}

function renderBacktestPanel(panel, bt, symbol) {
  const strategies = bt.strategies;
  const strats = [
    { key: 'maCrossover', label: 'SMA Crossover (20/50)', icon: '📊' },
    { key: 'rsiReversion', label: 'RSI Mean Reversion', icon: '📐' },
    { key: 'macdCrossover', label: 'MACD Crossover', icon: '📉' },
  ];
  const stratCards = strats.map(s => {
    const st = strategies[s.key];
    if (!st) return '';
    const retColor = st.totalReturn >= 0 ? 'var(--success)' : 'var(--danger)';
    const bh = bt.buyHoldReturn;
    const alphaColor = st.alpha >= 0 ? 'var(--success)' : 'var(--danger)';
    return `
          <div class="bt-card ${bt.bestStrategy === st.strategy ? 'bt-best' : ''}">
            <div class="bt-card-hdr">${s.icon} ${s.label} ${bt.bestStrategy === st.strategy ? '<span class="bt-best-badge">Best</span>' : ''}</div>
            <div class="bt-stats-grid">
              <div class="bt-stat"><div class="bt-stat-val" style="color:${retColor}">${st.totalReturn >= 0 ? '+' : ''}${st.totalReturn}%</div><div class="bt-stat-lbl">Total Return</div></div>
              <div class="bt-stat"><div class="bt-stat-val">${st.cagr >= 0 ? '+' : ''}${st.cagr}%</div><div class="bt-stat-lbl">CAGR</div></div>
              <div class="bt-stat"><div class="bt-stat-val" style="color:${st.sharpe > 1 ? 'var(--success)' : st.sharpe > 0 ? 'var(--warning)' : 'var(--danger)'}">${st.sharpe}</div><div class="bt-stat-lbl">Sharpe</div></div>
              <div class="bt-stat"><div class="bt-stat-val" style="color:var(--danger)">-${st.maxDrawdown}%</div><div class="bt-stat-lbl">Max DD</div></div>
              <div class="bt-stat"><div class="bt-stat-val" style="color:${st.winRate > 50 ? 'var(--success)' : 'var(--danger)'}">${st.winRate}%</div><div class="bt-stat-lbl">Win Rate</div></div>
              <div class="bt-stat"><div class="bt-stat-val">${st.totalTrades}</div><div class="bt-stat-lbl">Trades</div></div>
              <div class="bt-stat"><div class="bt-stat-val" style="color:${alphaColor}">${st.alpha >= 0 ? '+' : ''}${st.alpha}%</div><div class="bt-stat-lbl">Alpha vs B&H</div></div>
              <div class="bt-stat"><div class="bt-stat-val">${st.profitFactor}x</div><div class="bt-stat-lbl">Profit Factor</div></div>
            </div>
          </div>`;
  }).join('');

  // Recent trades table for best strategy
  const best = strategies[strats.find(s => bt.bestStrategy === strategies[s.key]?.strategy)?.key || 'maCrossover'];
  const tRows = (best?.recentTrades || []).map(t => `
      <tr>
        <td>${t.entry}</td><td>${t.exit}</td>
        <td>₹${t.entryPrice}</td><td>₹${t.exitPrice}</td>
        <td style="color:${t.pnl >= 0 ? 'var(--success)' : 'var(--danger)'}">${t.pnl >= 0 ? '+' : ''}₹${t.pnl.toFixed(0)}</td>
        <td style="color:${t.pctReturn >= 0 ? 'var(--success)' : 'var(--danger)'}">${t.pctReturn >= 0 ? '+' : ''}${t.pctReturn}%</td>
        <td>${t.holdDays}d</td>
        <td class="bt-result-${t.result.toLowerCase()}">${t.result}</td>
      </tr>`).join('');

  panel.innerHTML = `
      <div class="panel-hdr"><h4>📈 Backtesting Results — ${symbol} <span class="panel-sub">${bt.summary.period} · ${bt.summary.totalDays}d</span></h4>
        <div class="bt-baseline">Buy &amp; Hold: <span style="color:${bt.buyHoldReturn >= 0 ? 'var(--success)' : 'var(--danger)'}">${bt.buyHoldReturn >= 0 ? '+' : ''}${bt.buyHoldReturn}%</span></div>
      </div>
      <div class="bt-cards">${stratCards}</div>
      ${tRows ? `
      <div class="bt-trades-section">
        <h5>Recent Trades (${best?.strategy || ''})</h5>
        <div class="bt-tbl-wrap">
          <table class="bt-tbl">
            <thead><tr><th>Entry</th><th>Exit</th><th>Buy</th><th>Sell</th><th>P&amp;L</th><th>Return</th><th>Days</th><th>Result</th></tr></thead>
            <tbody>${tRows}</tbody>
          </table>
        </div>
      </div>` : ''}
      <div class="bt-equity-section">
        <div class="bt-equity-label">Equity Curve</div>
        <canvas id="equity-chart" height="120"></canvas>
      </div>`;

  // Render equity chart
  setTimeout(() => renderEquityChart(best?.equityCurve || []), 50);
}

function renderEquityChart(equityCurve) {
  const canvas = document.getElementById('equity-chart');
  if (!canvas || !equityCurve.length) return;
  if (backChart) backChart.destroy();
  const labels = equityCurve.map(p => p.date);
  const data = equityCurve.map(p => p.equity);
  const startVal = data[0] || 100000;
  const retColor = data[data.length - 1] >= startVal ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)';
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 120);
  grad.addColorStop(0, retColor.replace('0.8)', '0.3)'));
  grad.addColorStop(1, retColor.replace('0.8)', '0)'));
  backChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Equity', data, borderColor: retColor, backgroundColor: grad, borderWidth: 1.5, fill: true, tension: 0.3, pointRadius: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ₹${Number(c.parsed.y).toLocaleString('en-IN')}` } } }, scales: { x: { display: false }, y: { position: 'right', grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#475569', font: { size: 10 }, callback: v => `₹${(v / 1000).toFixed(0)}k` } } } }
  });
}

// ── RSI Sub-chart ─────────────────────────────────────────────────────────
function renderRSIChart(chartData) {
  const canvas = document.getElementById('rsi-chart');
  if (!canvas || !chartData) return;
  if (rsiChart) rsiChart.destroy();
  const labels = chartData.dates || [];
  const rsiVals = chartData.rsi || [];
  rsiChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'RSI', data: rsiVals, borderColor: '#a78bfa', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false },
        { label: 'OB', data: labels.map(() => 70), borderColor: 'rgba(239,68,68,0.4)', borderWidth: 1, borderDash: [4, 4], pointRadius: 0, fill: false },
        { label: 'OS', data: labels.map(() => 30), borderColor: 'rgba(16,185,129,0.4)', borderWidth: 1, borderDash: [4, 4], pointRadius: 0, fill: false },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` RSI: ${c.parsed.y?.toFixed(1)}` } } },
      scales: {
        x: { display: false },
        y: { position: 'right', min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#475569', font: { size: 10 } } }
      }
    }
  });
}

// ── MACD Sub-chart ────────────────────────────────────────────────────────
function renderMACDChart(chartData) {
  const canvas = document.getElementById('macd-chart');
  if (!canvas || !chartData) return;
  if (macdChart) macdChart.destroy();
  const labels = chartData.dates || [];
  const macdLine = chartData.macd || [];
  const signal = chartData.macdSignal || [];
  const histo = chartData.macdHisto || [];
  macdChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { type: 'bar', label: 'Histogram', data: histo, backgroundColor: histo.map(v => v >= 0 ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'), borderWidth: 0 },
        { type: 'line', label: 'MACD', data: macdLine, borderColor: '#60a5fa', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false },
        { type: 'line', label: 'Signal', data: signal, borderColor: '#f87171', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { position: 'right', grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#475569', font: { size: 10 } } }
      }
    }
  });
}

// ── Main Chart (Line or Candlestick) ──────────────────────────────────────
async function loadChart(symbol, period, predictedPrice, existingChartData) {
  try {
    const r = await fetch(`${API}/stocks/history/${encodeURIComponent(symbol)}?period=${period}`);
    const res = await r.json();
    if (!res.success || !res.data.length) return;

    const rows = res.data;
    const canvas = document.getElementById('price-chart');
    const ctx = canvas.getContext('2d');
    if (priceChart) { priceChart.destroy(); priceChart = null; }

    document.getElementById('chart-title').textContent = `${symbol} — ${period.toUpperCase()} Price History`;

    if (chartMode === 'candle') {
      // ── Candlestick chart ──────────────────────────────────────────
      // Use chartjs-chart-financial (loaded via CDN)
      const candleData = rows.map(row => ({
        x: new Date(row.date).getTime(),
        o: row.open,
        h: row.high,
        l: row.low,
        c: row.close,
      }));

      priceChart = new Chart(ctx, {
        type: 'candlestick',
        data: {
          datasets: [{
            label: symbol,
            data: candleData,
            color: {
              up: 'rgba(16,185,129,1)',
              down: 'rgba(239,68,68,1)',
              unchanged: 'rgba(148,163,184,1)',
            },
            borderColor: {
              up: 'rgba(16,185,129,1)',
              down: 'rgba(239,68,68,1)',
              unchanged: 'rgba(148,163,184,1)',
            },
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(13,21,40,0.95)',
              borderColor: 'rgba(124,58,237,0.3)', borderWidth: 1,
              titleColor: '#94a3b8', bodyColor: '#f1f5f9', padding: 10,
              callbacks: {
                label: c => {
                  const d = c.raw;
                  return [`O: ₹${d.o.toFixed(2)}`, `H: ₹${d.h.toFixed(2)}`, `L: ₹${d.l.toFixed(2)}`, `C: ₹${d.c.toFixed(2)}`];
                }
              }
            }
          },
          scales: {
            x: {
              type: 'time',
              time: { unit: rows.length > 60 ? 'month' : 'day', displayFormats: { day: 'dd MMM', month: 'MMM yy' } },
              grid: { color: 'rgba(255,255,255,0.03)' },
              ticks: { color: '#475569', maxTicksLimit: 10, font: { size: 10 } }
            },
            y: {
              position: 'right',
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: { color: '#475569', font: { size: 11 }, callback: v => '₹' + Number(v).toLocaleString('en-IN') }
            }
          }
        }
      });

    } else {
      // ── Line chart with prediction band ─────────────────────────────
      const longPeriod = rows.length > 60;
      const labels = rows.map(row => {
        const d = new Date(row.date);
        return longPeriod
          ? d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
          : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      });
      const closes = rows.map(r => r.close);
      const pred = predictedPrice || closes[closes.length - 1];
      const allLabels = [...labels, '+7d'];
      const allData = [...closes, pred];
      const predUp = pred >= closes[closes.length - 1];

      const atrPct = lastAnalysis?.indicators?.atrPct || 1.5;
      const bandUpper = allData.map(v => v ? v * (1 + atrPct / 100) : null);
      const bandLower = allData.map(v => v ? v * (1 - atrPct / 100) : null);

      const gradFill = ctx.createLinearGradient(0, 0, 0, 300);
      gradFill.addColorStop(0, 'rgba(124,58,237,0.22)');
      gradFill.addColorStop(1, 'rgba(124,58,237,0)');

      priceChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: allLabels,
          datasets: [
            { label: 'Band Upper', data: bandUpper, borderColor: 'transparent', backgroundColor: 'rgba(124,58,237,0.06)', fill: '+1', pointRadius: 0, tension: 0.35 },
            { label: 'Band Lower', data: bandLower, borderColor: 'transparent', backgroundColor: 'transparent', fill: false, pointRadius: 0, tension: 0.35 },
            {
              label: symbol, data: allData,
              borderColor: 'rgba(124,58,237,0.9)',
              backgroundColor: gradFill,
              borderWidth: 2.5, fill: true, tension: 0.35,
              pointRadius: allData.map((_, i) => i === allData.length - 1 ? 8 : 0),
              pointHoverRadius: 4,
              pointBackgroundColor: allData.map((_, i) => i === allData.length - 1 ? (predUp ? '#10b981' : '#ef4444') : 'transparent'),
              pointBorderColor: 'white', pointBorderWidth: 2,
              segment: {
                borderColor: c => c.p1DataIndex === allData.length - 1 ? (predUp ? '#10b981' : '#ef4444') : 'rgba(124,58,237,0.9)',
                borderDash: c => c.p1DataIndex === allData.length - 1 ? [6, 4] : [],
              }
            },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 400, easing: 'easeOutQuart' },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            decimation: { enabled: longPeriod, algorithm: 'lttb', samples: 80 },
            tooltip: {
              backgroundColor: 'rgba(13,21,40,0.95)',
              borderColor: 'rgba(124,58,237,0.3)', borderWidth: 1,
              titleColor: '#94a3b8', bodyColor: '#f1f5f9', padding: 10,
              filter: item => item.datasetIndex === 2,
              callbacks: { label: c => ` ₹${Number(c.parsed.y).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }
            }
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#475569', maxTicksLimit: longPeriod ? 10 : 8, font: { size: 11 } } },
            y: { position: 'right', grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#475569', font: { size: 11 }, callback: v => '₹' + Number(v).toLocaleString('en-IN') } }
          }
        }
      });
    }
  } catch (e) { console.error('Chart error:', e); }
}

// ── Analyst Section ───────────────────────────────────────────────────────

function renderAnalystSection(a, current) {
  document.getElementById('at-current').textContent = fmtPrice(current);
  document.getElementById('at-low').textContent = fmtPrice(a.lowTarget);
  document.getElementById('at-avg').textContent = fmtPrice(a.avgTarget);
  document.getElementById('at-high').textContent = fmtPrice(a.highTarget);
  const range = a.highTarget - a.lowTarget;
  const pct = range > 0 ? Math.min(100, Math.max(0, ((a.avgTarget - a.lowTarget) / range) * 100)) : 50;
  document.getElementById('at-bar-fill').style.width = pct + '%';
  renderMonthlyRecs(a.monthlyRecommendations);
}

function renderMonthlyRecs(recs) {
  const latest = recs[recs.length - 1];
  const totalAnalysts = latest.strongBuy + latest.buy + latest.hold + latest.underperform + latest.sell;
  const bullish = latest.strongBuy + latest.buy;
  const bearish = latest.underperform + latest.sell;
  let verdictLabel, verdictColor;
  if (bullish > bearish + latest.hold * 0.5) { verdictLabel = 'Bullish'; verdictColor = '#10b981'; }
  else if (bearish > bullish + latest.hold * 0.5) { verdictLabel = 'Bearish'; verdictColor = '#ef4444'; }
  else { verdictLabel = 'Neutral'; verdictColor = '#f59e0b'; }

  const CATS = [
    { key: 'strongBuy', label: 'Strong Buy', shortLabel: 'S.Buy', color: '#10b981' },
    { key: 'buy', label: 'Buy', shortLabel: 'Buy', color: '#34d399' },
    { key: 'hold', label: 'Hold', shortLabel: 'Hold', color: '#f59e0b' },
    { key: 'underperform', label: 'Underperform', shortLabel: 'U.Perf', color: '#f97316' },
    { key: 'sell', label: 'Sell', shortLabel: 'Sell', color: '#ef4444' },
  ];
  const catBoxes = CATS.map(c => {
    const count = latest[c.key];
    const pct = totalAnalysts > 0 ? Math.round(count / totalAnalysts * 100) : 0;
    return `<div class="rec-cat-box"><div class="rec-cat-bar-wrap"><div class="rec-cat-bar" style="height:${pct}%;background:${c.color}"></div></div><div class="rec-cat-count" style="color:${c.color}">${count}</div><div class="rec-cat-label">${c.shortLabel}</div></div>`;
  }).join('');

  const tableRows = recs.map(r => {
    const tot = r.strongBuy + r.buy + r.hold + r.underperform + r.sell;
    const bull = r.strongBuy + r.buy;
    const bear = r.underperform + r.sell;
    const signal = bull > bear ? '▲ Buy' : bear > bull ? '▼ Sell' : '→ Hold';
    const sigCol = bull > bear ? '#10b981' : bear > bull ? '#ef4444' : '#f59e0b';
    return `<tr><td class="rec-tbl-month">${r.month}</td><td style="color:#10b981">${r.strongBuy}</td><td style="color:#34d399">${r.buy}</td><td style="color:#f59e0b">${r.hold}</td><td style="color:#f97316">${r.underperform}</td><td style="color:#ef4444">${r.sell}</td><td>${tot}</td><td style="color:${sigCol};font-weight:700">${signal}</td></tr>`;
  }).join('');

  document.getElementById('monthly-recs').innerHTML = `
      <div class="rec-summary-row">
        <div class="rec-verdict-badge" style="border-color:${verdictColor};color:${verdictColor}">${verdictLabel}<span class="rec-verdict-sub">${totalAnalysts} analysts · ${latest.month}</span></div>
        <div class="rec-cat-boxes">${catBoxes}</div>
      </div>
      <div class="rec-tbl-wrap"><table class="rec-tbl"><thead><tr><th>Month</th><th style="color:#10b981">S.Buy</th><th style="color:#34d399">Buy</th><th style="color:#f59e0b">Hold</th><th style="color:#f97316">U.Perf</th><th style="color:#ef4444">Sell</th><th>Total</th><th>Signal</th></tr></thead><tbody>${tableRows}</tbody></table></div>`;
}
