// frontend/js/backtest-tab.js — Backtest tab (fixed field names + real equity curve)
'use strict';

(function () {
  const symbolInput = document.getElementById('bt-symbol-input');
  const runBtn = document.getElementById('bt-run-btn');
  const resultsArea = document.getElementById('bt-results-area');
  const emptyState = document.getElementById('bt-empty');
  const cardsEl = document.getElementById('bt-cards');
  const tradesBody = document.getElementById('bt-trades-body');
  const bestLabel = document.getElementById('bt-best-label');
  const eqPeriod = document.getElementById('bt-eq-period');
  let eqChart = null;

  // Pre-fill symbol when switching to Backtest tab from Predict
  document.querySelector('.nav-item[data-tab="backtest"]')?.addEventListener('click', () => {
    if (!symbolInput.value && window.currentSymbol) {
      symbolInput.value = window.currentSymbol;
    }
  });

  runBtn?.addEventListener('click', () => {
    const sym = (symbolInput?.value || '').trim().toUpperCase();
    if (!sym) { window.toast?.('Enter a symbol first'); return; }
    runBacktest(sym);
  });
  symbolInput?.addEventListener('keydown', e => { if (e.key === 'Enter') runBtn?.click(); });

  // ─────────────────────────────────────────────────────────────────────────
  async function runBacktest(symbol) {
    runBtn.disabled = true;
    runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running…';
    resultsArea.style.display = 'none';
    emptyState.style.display = 'none';

    try {
      const res = await fetch(`${API}/backtest/${encodeURIComponent(symbol)}`).then(r => r.json());
      if (!res.success) throw new Error(res.error || 'Backtest failed');
      renderResults(symbol, res.data);
    } catch (err) {
      window.toast?.(`Backtest failed: ${err.message}`);
      emptyState.style.display = 'block';
    } finally {
      runBtn.disabled = false;
      runBtn.innerHTML = '<i class="fas fa-play"></i> Run Backtest';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  function renderResults(symbol, bt) {
    const strats = bt.strategies;

    if (eqPeriod) eqPeriod.textContent = bt.summary?.period || '';
    if (bestLabel) bestLabel.textContent = `Best strategy: ${bt.bestStrategy}`;

    // ── Strategy cards ──────────────────────────────────────────────────
    const stratDefs = [
      { key: 'maCrossover', label: 'SMA Crossover (20/50)', icon: '📈' },
      { key: 'rsiReversion', label: 'RSI Mean Reversion', icon: '🔄' },
      { key: 'macdCrossover', label: 'MACD Crossover', icon: '⚡' },
    ];

    const bhColor = bt.buyHoldReturn >= 0 ? 'var(--success)' : 'var(--danger)';

    cardsEl.innerHTML = `
          <div class="bt-cards">
            ${stratDefs.map(({ key, label, icon }) => {
      const s = strats[key];
      if (!s) return '';
      const isBest = s.strategy === bt.bestStrategy;
      const retCol = s.totalReturn >= 0 ? 'var(--success)' : 'var(--danger)';
      const alphCol = s.alpha >= 0 ? 'var(--success)' : 'var(--danger)';
      return `
                <div class="bt-card ${isBest ? 'bt-best' : ''}">
                  <div class="bt-card-hdr">
                    ${icon} ${label}
                    ${isBest ? '<span class="bt-best-badge">★ Best</span>' : ''}
                  </div>
                  <div class="bt-stats-grid">
                    <div class="bt-stat">
                      <div class="bt-stat-val" style="color:${retCol}">${s.totalReturn >= 0 ? '+' : ''}${s.totalReturn}%</div>
                      <div class="bt-stat-lbl">Total Return</div>
                    </div>
                    <div class="bt-stat">
                      <div class="bt-stat-val">${s.cagr}%</div>
                      <div class="bt-stat-lbl">CAGR</div>
                    </div>
                    <div class="bt-stat">
                      <div class="bt-stat-val">${s.sharpe}</div>
                      <div class="bt-stat-lbl">Sharpe</div>
                    </div>
                    <div class="bt-stat">
                      <div class="bt-stat-val">${s.winRate}%</div>
                      <div class="bt-stat-lbl">Win Rate</div>
                    </div>
                    <div class="bt-stat">
                      <div class="bt-stat-val" style="color:var(--danger)">-${s.maxDrawdown}%</div>
                      <div class="bt-stat-lbl">Max Drawdown</div>
                    </div>
                    <div class="bt-stat">
                      <div class="bt-stat-val">${s.totalTrades}</div>
                      <div class="bt-stat-lbl">Trades</div>
                    </div>
                    <div class="bt-stat">
                      <div class="bt-stat-val">${s.profitFactor}</div>
                      <div class="bt-stat-lbl">Profit Factor</div>
                    </div>
                    <div class="bt-stat">
                      <div class="bt-stat-val" style="color:${alphCol}">${s.alpha >= 0 ? '+' : ''}${s.alpha}%</div>
                      <div class="bt-stat-lbl">Alpha vs B&H</div>
                    </div>
                  </div>
                </div>`;
    }).join('')}
          </div>
          <div class="bt-buyhold-row">
            ${bt.buyHoldReturn >= 0 ? '🟢' : '🔴'}
            <strong>Buy &amp; Hold Baseline:</strong>
            <span style="color:${bhColor}">${bt.buyHoldReturn >= 0 ? '+' : ''}${bt.buyHoldReturn}%</span>
            over ${bt.summary?.totalDays} trading days
            &nbsp;·&nbsp;
            ₹${bt.summary?.startPrice?.toLocaleString('en-IN')} → ₹${bt.summary?.endPrice?.toLocaleString('en-IN')}
          </div>`;

    // ── Recent trades table (best strategy) ─────────────────────────────
    // Backend returns: recentTrades[] with {entry, exit, entryPrice, exitPrice, pnl, pctReturn, holdDays, result}
    const bestStrat = stratDefs.reduce((best, def) => {
      const s = strats[def.key];
      if (!best || (s && s.sharpe > best.sharpe)) return s;
      return best;
    }, null);

    const trades = bestStrat?.recentTrades || [];
    if (tradesBody) {
      tradesBody.innerHTML = trades.length
        ? trades.map(t => `
                  <tr>
                    <td>${t.entry || '--'}</td>
                    <td>${t.exit || '--'}</td>
                    <td>LONG</td>
                    <td>₹${Number(t.entryPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>₹${Number(t.exitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>₹${Number(t.pnl).toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
                    <td class="${t.pctReturn >= 0 ? 'bt-result-win' : 'bt-result-loss'}">${t.pctReturn >= 0 ? '+' : ''}${t.pctReturn}%</td>
                    <td>${t.holdDays}d</td>
                    <td class="${t.result === 'WIN' ? 'bt-result-win' : 'bt-result-loss'}">${t.result || '--'}</td>
                  </tr>`).join('')
        : '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:16px">No completed trades in this period</td></tr>';
    }

    // ── Equity curve chart (all 3 strategies overlaid) ─────────────────
    // Backend equityCurve: [{date, equity}, ...]
    const canvas = document.getElementById('equity-chart');
    if (canvas) {
      if (eqChart) { eqChart.destroy(); eqChart = null; }

      const colors = ['#c5a059', '#10b981', '#f59e0b'];
      const datasets = stratDefs.map(({ key, label }, i) => {
        const s = strats[key];
        if (!s?.equityCurve?.length) return null;
        return {
          label,
          data: s.equityCurve.map(p => p.equity),
          borderColor: colors[i],
          backgroundColor: 'transparent',
          borderWidth: 1.8,
          pointRadius: 0,
          tension: 0.15,
        };
      }).filter(Boolean);

      // x-axis labels from the first strategy's equityCurve dates
      const labels = strats.maCrossover?.equityCurve?.map(p => {
        const d = new Date(p.date);
        return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      }) || [];

      // Buy & Hold reference line
      const startEq = 100000;
      const bh = strats.maCrossover?.equityCurve?.map((_, i, arr) => {
        const frac = i / (arr.length - 1);
        return parseFloat((startEq * (1 + bt.buyHoldReturn / 100 * frac)).toFixed(0));
      }) || [];
      if (bh.length) {
        datasets.push({
          label: 'Buy & Hold',
          data: bh,
          borderColor: 'rgba(148,163,184,0.5)',
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderDash: [6, 4],
          pointRadius: 0,
        });
      }

      eqChart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: {
              display: true,
              labels: { color: '#94a3b8', boxWidth: 14, font: { size: 11 } }
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(5, 5, 5, 0.95)',
              borderColor: 'rgba(197, 160, 89, 0.3)',
              borderWidth: 1,
              titleColor: '#94a3b8',
              bodyColor: '#f1f5f9',
              padding: 10,
              callbacks: {
                label: c => ` ${c.dataset.label}: ₹${Number(c.parsed.y).toLocaleString('en-IN')}`
              }
            }
          },
          scales: {
            x: {
              ticks: { color: '#475569', font: { size: 9 }, maxTicksLimit: 10 },
              grid: { color: 'rgba(255,255,255,0.03)' }
            },
            y: {
              position: 'right',
              ticks: {
                color: '#475569',
                font: { size: 10 },
                callback: v => '₹' + (v / 1000).toFixed(0) + 'k'
              },
              grid: { color: 'rgba(255,255,255,0.04)' }
            }
          },
          interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
      });
    }

    resultsArea.style.display = 'block';
  }

  // Global hook — switch to backtest tab and run for a given symbol
  window.runBacktestForSymbol = function (sym) {
    if (symbolInput) symbolInput.value = sym;
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelector('.nav-item[data-tab="backtest"]')?.classList.add('active');
    document.getElementById('tab-backtest')?.classList.add('active');
    runBacktest(sym);
  };
})();
