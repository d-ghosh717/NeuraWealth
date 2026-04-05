// frontend/js/news.js — News & Sentiment tab (GNews)
'use strict';

(function () {
    const symbolInput = document.getElementById('news-symbol-input');
    const searchBtn = document.getElementById('news-search-btn');
    const summaryCard = document.getElementById('sent-summary-card');

    // News vs Twitter sub-tabs
    document.querySelectorAll('.ntab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ntab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.ntab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`ntab-${btn.dataset.ntab}`)?.classList.add('active');
        });
    });

    // Settings button → toast
    document.getElementById('news-settings-btn')?.addEventListener('click', () => {
        window.toast?.('Add GNEWS_API_KEY to backend/.env — get a free key at gnews.io');
    });

    // Search
    searchBtn?.addEventListener('click', () => {
        const sym = (symbolInput?.value || '').trim().toUpperCase();
        if (!sym) { window.toast?.('Please enter a stock symbol'); return; }
        searchNews(sym);
    });
    symbolInput?.addEventListener('keydown', e => { if (e.key === 'Enter') searchBtn?.click(); });

    async function searchNews(symbol) {
        searchBtn.disabled = true;
        searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching…';

        try {
            const res = await fetch(`${API}/news/${encodeURIComponent(symbol)}`).then(r => r.json());
            if (res.success && res.articles?.length) {
                renderArticles(symbol, res.articles, res.sentiment);
            } else {
                showApiNotConfigured(symbol, res.error);
            }
        } catch {
            showApiNotConfigured(symbol);
        } finally {
            searchBtn.disabled = false;
            searchBtn.innerHTML = '<i class="fas fa-search"></i> Search';
        }
    }

    function showApiNotConfigured(symbol, errMsg) {
        if (summaryCard) summaryCard.style.display = 'none';
        document.getElementById('news-articles-list').innerHTML = `
          <div class="news-api-notset">
            <i class="fas fa-key" style="font-size:2rem;color:var(--text-muted)"></i>
            <h4>GNews API not configured</h4>
            <p>Add <code>GNEWS_API_KEY=your_key</code> to <code>backend/.env</code> to fetch live news for <strong>${symbol}</strong>.</p>
            <p style="font-size:0.8rem;color:var(--text-muted);margin-top:6px">
              Get a free key at <a href="https://gnews.io" target="_blank" style="color:var(--primary)">gnews.io</a> (100 req/day free tier).
              ${errMsg ? `<br><em>${errMsg}</em>` : ''}
            </p>
          </div>`;
    }

    function renderArticles(symbol, articles, sentiment) {
        // Sentiment summary bar
        if (summaryCard && sentiment) {
            summaryCard.style.display = 'block';
            document.getElementById('sent-symbol-label').textContent = `${symbol} Sentiment`;
            const total = (sentiment.positive + sentiment.neutral + sentiment.negative) || 1;
            const label = sentiment.label || '--';
            document.getElementById('sent-score').textContent = label;
            document.getElementById('sent-score').style.color =
                label === 'Bullish' ? 'var(--success)' : label === 'Bearish' ? 'var(--danger)' : 'var(--warning)';
            document.getElementById('sent-pos-count').textContent = `${sentiment.positive} Positive`;
            document.getElementById('sent-neg-count').textContent = `${sentiment.negative} Negative`;
            document.getElementById('sent-bar-pos').style.width = `${(sentiment.positive / total * 100).toFixed(1)}%`;
            document.getElementById('sent-bar-neu').style.width = `${(sentiment.neutral / total * 100).toFixed(1)}%`;
            document.getElementById('sent-bar-neg').style.width = `${(sentiment.negative / total * 100).toFixed(1)}%`;
        }

        // Article cards — GNews provides image, description, source, publishedAt
        document.getElementById('news-articles-list').innerHTML = articles.map(a => `
          <a class="news-article" href="${a.url || '#'}" target="_blank" rel="noopener">
            ${a.image ? `<img class="news-art-img" src="${a.image}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
            <div class="news-badge ${(a.sentiment || 'neutral').toLowerCase()}">${a.sentiment || 'Neutral'}</div>
            <div class="news-art-content">
              <div class="news-art-headline">${a.title || 'Untitled'}</div>
              ${a.description ? `<div class="news-art-desc">${a.description.slice(0, 120)}…</div>` : ''}
              <div class="news-art-meta">
                <span>${a.source || '--'}</span>
                <span>${a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '--'}</span>
                ${a.score != null ? `<span class="news-score">Sentiment: ${Math.round(a.score * 100)}%</span>` : ''}
              </div>
            </div>
            <i class="fas fa-external-link-alt news-link-icon"></i>
          </a>`).join('');
    }
})();
