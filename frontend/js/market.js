// frontend/js/market.js — Market overview + Index cards

// ── Index configuration ────────────────────────────────────────────────────
// These map to CSV filenames in data/stocks/
// The user should place these Yahoo Finance CSVs in data/stocks/:
//   ^NSEI.csv or nsei.csv       → Nifty 50
//   ^BSESN.csv or bsesn.csv     → Sensex
//   ^NSEBANK.csv or nsebank.csv → Nifty Bank
//   ^CNXIT.csv or cnxit.csv     → Nifty IT
const INDICES_CONFIG = [
    { symbol: '^NSEI', displayName: 'NIFTY 50', fallbackPrice: 22845.75, fallbackChange: 125.50, fallbackPct: 0.55 },
    { symbol: '^BSESN', displayName: 'SENSEX', fallbackPrice: 75234.80, fallbackChange: 320.10, fallbackPct: 0.43 },
    { symbol: '^NSEBANK', displayName: 'NIFTY BANK', fallbackPrice: 48320.40, fallbackChange: -180.25, fallbackPct: -0.37 },
    { symbol: '^CNXIT', displayName: 'NIFTY IT', fallbackPrice: 34892.60, fallbackChange: 412.35, fallbackPct: 1.20 },
];

// ── Render index cards ─────────────────────────────────────────────────────
async function renderIndices() {
    const wrap = document.getElementById('indices-row');

    // Show loading placeholders immediately
    wrap.innerHTML = INDICES_CONFIG.map(idx => `
      <div class="index-card loading" id="idx-${idx.symbol.replace(/\^/g, '')}">
        <div class="index-name">${idx.displayName}</div>
        <div class="index-price" style="font-size:1.1rem;opacity:0.5">Loading…</div>
        <div class="index-change">—</div>
      </div>`).join('');

    // Try to get real data from each index CSV via /api/stocks/predict
    await Promise.all(INDICES_CONFIG.map(async idx => {
        const cardId = idx.symbol.replace(/\^/g, '');
        const card = document.getElementById(`idx-${cardId}`);
        try {
            const r = await fetch(`${API}/stocks/predict/${encodeURIComponent(idx.symbol)}`);
            const json = await r.json();
            if (json.success && json.data) {
                const d = json.data;
                const up = d.changePercent >= 0;
                const action = d.recommendation.action;
                card.className = `index-card ${up ? 'up' : 'down'}`;
                card.onclick = () => goPredict(idx.symbol, idx.displayName);
                card.style.cursor = 'pointer';
                card.innerHTML = `
                  <div class="index-name">${idx.displayName}</div>
                  <div class="index-badge-row">
                    <span class="action-tag ${action.toLowerCase()}">${action}</span>
                    <span class="index-src-badge">CSV</span>
                  </div>
                  <div class="index-price">${d.currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  <div class="index-change ${up ? 'up' : 'down'}">
                    ${up ? '▲' : '▼'} ${Math.abs(d.change).toFixed(2)} (${up ? '+' : ''}${d.changePercent.toFixed(2)}%)
                  </div>
                  <div class="index-meta">RSI ${d.indicators.rsi.toFixed(0)} · ${d.indicators.trend}</div>`;
                return;
            }
        } catch (_) { }

        // Fallback to demo data
        const up = idx.fallbackChange >= 0;
        card.className = `index-card ${up ? 'up' : 'down'}`;
        card.innerHTML = `
          <div class="index-name">${idx.displayName}</div>
          <div class="index-badge-row"><span class="index-src-badge demo">DEMO</span></div>
          <div class="index-price">${idx.fallbackPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div class="index-change ${up ? 'up' : 'down'}">
            ${up ? '▲' : '▼'} ${Math.abs(idx.fallbackChange).toFixed(2)} (${up ? '+' : ''}${idx.fallbackPct.toFixed(2)}%)
          </div>
          <div class="index-meta" style="color:var(--text-muted);font-size:0.68rem">Add CSV for AI analysis ↓</div>`;
    }));
}

// ── Fetch & render stock table ─────────────────────────────────────────────
async function loadMarket() {
    try {
        const r = await fetch(`${API}/stocks/list`);
        const { data } = await r.json();

        // Fetch quotes for first 10 stocks
        const stocks = data.slice(0, 10);
        const quotes = await Promise.all(
            stocks.map(s =>
                fetch(`${API}/stocks/quote/${s.symbol}`)
                    .then(r => r.json()).then(j => j.data)
                    .catch(() => null)
            )
        );

        // Fetch quick prediction for signal
        const preds = await Promise.all(
            stocks.map(s =>
                fetch(`${API}/stocks/predict/${s.symbol}`)
                    .then(r => r.json()).then(j => j.data?.recommendation?.action || 'HOLD')
                    .catch(() => 'HOLD')
            )
        );

        const tbody = document.getElementById('stocks-body');
        tbody.innerHTML = quotes.map((q, i) => {
            if (!q) return '';
            const up = q.changePercent >= 0;
            const action = preds[i];
            return `
            <tr onclick="goPredict('${q.symbol}')">
              <td><span class="sym-badge">${q.symbol}</span></td>
              <td><span class="company-name">${q.name}</span></td>
              <td class="price-cell">${fmtPrice(q.price)}</td>
              <td class="${up ? 'up-val' : 'down-val'}">${up ? '+' : ''}${fmtPrice(q.change)}</td>
              <td class="${up ? 'up-val' : 'down-val'}">${up ? '+' : ''}${q.changePercent.toFixed(2)}%</td>
              <td><span class="action-tag ${action.toLowerCase()}">${action}</span></td>
              <td><button class="btn-sm" onclick="event.stopPropagation();goPredict('${q.symbol}')"><i class="fas fa-chart-line"></i></button></td>
            </tr>`;
        }).join('');

    } catch (e) {
        document.getElementById('stocks-body').innerHTML =
            `<tr><td colspan="7"><div class="empty"><i class="fas fa-circle-exclamation"></i><p>Could not load data. Is the server running?</p></div></td></tr>`;
    }
}

function goPredict(symbol, displayName) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelector('.nav-item[data-tab="prediction"]').classList.add('active');
    document.getElementById('tab-prediction').classList.add('active');
    document.getElementById('predict-input').value = symbol;
    window.runPrediction(symbol, displayName);
}

// Init
renderIndices();
loadMarket();
setInterval(loadMarket, 60000);
