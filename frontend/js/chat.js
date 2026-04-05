// frontend/js/chat.js — Chatbot UI with Markdown Table rendering + Fullscreen Popup

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const expandBtn = document.getElementById('chat-expand-btn');

// Modal elements
const modalOverlay = document.getElementById('chat-modal-overlay');
const modalMessages = document.getElementById('chat-modal-messages');
const modalInput = document.getElementById('chat-modal-input');
const modalSend = document.getElementById('chat-modal-send');
const modalClose = document.getElementById('chat-modal-close');

// Track which container is "active" for scroll etc.
let activeMessages = chatMessages;

// ── Open / Close popup ────────────────────────────────────────────────────
expandBtn.addEventListener('click', () => openModal());
modalClose.addEventListener('click', () => closeModal());
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function openModal() {
    modalOverlay.classList.add('open');
    activeMessages = modalMessages;
    // Mirror conversation history into modal (clone HTML)
    modalMessages.innerHTML = chatMessages.innerHTML;
    modalMessages.scrollTop = modalMessages.scrollHeight;
    modalInput.focus();
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modalOverlay.classList.remove('open');
    activeMessages = chatMessages;
    document.body.style.overflow = '';
}

// ── Seed welcome message ──────────────────────────────────────────────────
appendBot(`👋 **Hello! I'm Neura2 AI.**

Ask me anything about Indian stocks:
• **Predict** — "predict Tata Steel"
• **Buy/Sell/Hold** — "Should I buy TCS?"
• **Compare** — "Infosys vs TCS"
• **Technical** — "TCS technical analysis"
• **Risk & Fundamentals** — "TCS risk" | "Is Infosys overvalued?"
• **Scenarios** — "What if Nifty falls 10%?"

Type **help** for the full command list!`);

// ── Quick buttons (sidebar) ───────────────────────────────────────────────
document.querySelectorAll('#quick-btns .quick-btn').forEach(btn => {
    btn.addEventListener('click', () => sendMessage(btn.dataset.q, chatMessages));
});

// ── Quick buttons (modal) ─────────────────────────────────────────────────
document.querySelectorAll('#modal-quick-btns .quick-btn').forEach(btn => {
    btn.addEventListener('click', () => sendMessage(btn.dataset.q, modalMessages));
});

// ── Send handlers — sidebar ───────────────────────────────────────────────
sendBtn.addEventListener('click', () => {
    const msg = chatInput.value.trim();
    if (msg) { chatInput.value = ''; sendMessage(msg, chatMessages); }
});
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendBtn.click(); });

// ── Send handlers — modal ─────────────────────────────────────────────────
modalSend.addEventListener('click', () => {
    const msg = modalInput.value.trim();
    if (msg) { modalInput.value = ''; sendMessage(msg, modalMessages); }
});
modalInput.addEventListener('keydown', e => { if (e.key === 'Enter') modalSend.click(); });

// ── Core send/receive ─────────────────────────────────────────────────────
async function sendMessage(text, targetContainer) {
    const container = targetContainer || activeMessages;
    appendUser(text, container);
    const typing = showTyping(container);

    try {
        const r = await fetch(`${API}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        const { response } = await r.json();
        typing.remove();
        appendBot(response, container);
        // Mirror into sidebar too if message came from modal (keep sync)
        if (container === modalMessages) mirrorToChatPanel(text, response);
    } catch {
        typing.remove();
        appendBot('⚠️ Could not connect to the server. Make sure the backend is running.', container);
    }
}

function mirrorToChatPanel(userText, botText) {
    appendUser(userText, chatMessages);
    appendBot(botText, chatMessages);
}

// ── DOM helpers ───────────────────────────────────────────────────────────
function appendUser(text, container) {
    container = container || chatMessages;
    const el = document.createElement('div');
    el.className = 'msg user';
    el.innerHTML = `
      <div class="msg-avatar"><i class="fas fa-user"></i></div>
      <div class="msg-bubble">${escHtml(text)}</div>`;
    container.appendChild(el);
    scrollBottom(container);
}

function appendBot(text, container) {
    container = container || chatMessages;
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.innerHTML = `
      <div class="msg-avatar"><i class="fas fa-robot"></i></div>
      <div class="msg-bubble">${formatMsg(text)}</div>`;
    container.appendChild(el);
    scrollBottom(container);
}

function showTyping(container) {
    container = container || chatMessages;
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.innerHTML = `
      <div class="msg-avatar"><i class="fas fa-robot"></i></div>
      <div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
    container.appendChild(el);
    scrollBottom(container);
    return el;
}

function scrollBottom(container) {
    (container || chatMessages).scrollTop = (container || chatMessages).scrollHeight;
}

// ── Full markdown renderer (supports tables, bold, italic, code, bullets) ─
function formatMsg(text) {
    // Escape HTML first to prevent XSS — but we need to handle | in tables
    let html = text;

    // ── Tables: detect lines starting with |
    html = renderMarkdownTables(html);

    // ── Code blocks
    html = html.replace(/```[\s\S]*?```/g, m => {
        const code = m.replace(/```\w*\n?/, '').replace(/```$/, '');
        return `<pre class="msg-code"><code>${escHtml(code.trim())}</code></pre>`;
    });

    // ── Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="msg-inline-code">$1</code>');

    // ── Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // ── Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // ── Bullet lists (lines starting with •, -, *)
    html = html.replace(/^[•\-\*] (.+)$/gm, '<span class="msg-bullet">•</span> $1');

    // ── Newlines → br (but not inside table blocks — those use tr/td)
    html = html.replace(/\n/g, '<br>');

    // Fix double <br> after table rows
    html = html.replace(/<\/tr><br>/g, '</tr>');
    html = html.replace(/<\/table><br>/g, '</table>');

    return html;
}

function renderMarkdownTables(text) {
    // Match markdown table blocks (lines with | at start)
    // A table is 2+ consecutive lines containing |
    const lines = text.split('\n');
    const result = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        if (line.includes('|') && line.trim().startsWith('|')) {
            // Collect table lines
            const tableLines = [];
            while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i]);
                i++;
            }
            // Build HTML table
            result.push(buildHtmlTable(tableLines));
        } else {
            result.push(escHtmlPreserveFormatting(line));
            i++;
        }
    }
    return result.join('\n');
}

function buildHtmlTable(lines) {
    // Filter out separator rows (---|---|---)
    const rows = lines.filter(l => !l.match(/^\|[\s|\-:]+\|$/));
    if (rows.length === 0) return '';

    let html = '<div class="msg-table-wrap"><table class="msg-table">';
    rows.forEach((row, idx) => {
        const cells = row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1);
        const tag = idx === 0 ? 'th' : 'td';
        html += `<tr>${cells.map(c => `<${tag}>${applyInlineMarkdown(c.trim())}</${tag}>`).join('')}</tr>`;
    });
    html += '</table></div>';
    return html;
}

function applyInlineMarkdown(text) {
    return escHtml(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function escHtmlPreserveFormatting(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
