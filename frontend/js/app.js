// frontend/js/app.js — Bootstrap, tab routing, clock, health check

const API = 'http://localhost:5600/api';

// ── Tab routing ────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', () => {
        const tab = item.dataset.tab;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        item.classList.add('active');
        document.getElementById(`tab-${tab}`)?.classList.add('active');
    });
});

// ── Analytics sub-tabs (Regime / Probability / Risk / Factors) ─────────────
document.querySelectorAll('.atab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.atab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.atab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`atab-${btn.dataset.atab}`)?.classList.add('active');
    });
});

// ── Global search → prediction tab ────────────────────────────────────────
document.getElementById('global-search-btn').addEventListener('click', () => {
    const val = document.getElementById('global-search').value.trim().toUpperCase();
    if (!val) return;
    // Switch to prediction tab
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelector('.nav-item[data-tab="prediction"]').classList.add('active');
    document.getElementById('tab-prediction').classList.add('active');
    // Trigger prediction
    document.getElementById('predict-input').value = val;
    window.runPrediction(val);
});
document.getElementById('global-search').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('global-search-btn').click();
});

// ── IST Clock ─────────────────────────────────────────────────────────────
function updateClock() {
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const h = String(ist.getHours()).padStart(2, '0');
    const m = String(ist.getMinutes()).padStart(2, '0');
    const s = String(ist.getSeconds()).padStart(2, '0');
    document.getElementById('clock').textContent = `${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();

// ── Health check ──────────────────────────────────────────────────────────
async function checkHealth() {
    const dot = document.getElementById('server-dot');
    const status = document.getElementById('server-status');
    try {
        const r = await fetch(`${API}/health`);
        if (r.ok) {
            dot.style.background = 'var(--success)';
            dot.style.boxShadow = '0 0 6px var(--success)';
            status.textContent = 'Server Live';
        } else {
            throw new Error();
        }
    } catch {
        dot.style.background = 'var(--danger)';
        dot.style.boxShadow = '0 0 6px var(--danger)';
        status.textContent = 'Server Offline';
    }
}
checkHealth();

// ── Loading helpers ────────────────────────────────────────────────────────
window.showLoading = () => document.getElementById('loading').classList.add('show');
window.hideLoading = () => document.getElementById('loading').classList.remove('show');

// ── Toast helper ──────────────────────────────────────────────────────────
window.toast = (msg, dur = 2500) => {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), dur);
};

// ── Number formatters ─────────────────────────────────────────────────────
window.fmtPrice = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
window.fmtVol = n => {
    if (n >= 1e7) return (n / 1e7).toFixed(2) + ' Cr';
    if (n >= 1e5) return (n / 1e5).toFixed(2) + ' L';
    return Number(n).toLocaleString('en-IN');
};
