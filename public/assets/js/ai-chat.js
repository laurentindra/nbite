/* Chatbox AI Night Bite. Berdiri sendiri, tidak bergantung pada actions.js / forms.js. */
const win = document.getElementById('aiChatWindow');
const box = document.getElementById('aiChatBody');
const form = document.getElementById('aiChatForm');
const openBtn = document.getElementById('aiChatOpen');
const closeBtn = document.getElementById('aiChatClose');

if (win && box && form && openBtn && closeBtn) {
  const history = [];   // { role: 'user' | 'bot', text }
  let busy = false;

  const scrollDown = () => { box.scrollTop = box.scrollHeight; };

  function addMsg(role, text) {
    const el = document.createElement('div');
    el.className = 'ai-msg ' + role;
    el.style.whiteSpace = 'pre-wrap';
    el.textContent = text;           // textContent = aman dari XSS
    box.appendChild(el);
    scrollDown();
    return el;
  }

  const clean = text => text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^\s*[*]\s+/gm, '• ');

  function toggle(forceOpen) {
    const open = forceOpen ?? win.classList.contains('hidden');
    win.classList.toggle('hidden', !open);
    if (open) { form.elements.message.focus(); scrollDown(); }
  }

  openBtn.addEventListener('click', () => toggle());
  closeBtn.addEventListener('click', () => toggle(false));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;

    const input = form.elements.message;
    const text = input.value.trim();
    if (!text) return;

    busy = true;
    input.value = '';
    addMsg('user', text);
    const typing = addMsg('bot', 'Sedang mengetik…');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: history.slice(-6) }),
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan. Coba lagi ya.');

      const reply = clean(String(data.reply || ''));
      typing.textContent = reply;
      history.push({ role: 'user', text }, { role: 'bot', text: reply });
    } catch (err) {
      typing.textContent = err.name === 'AbortError'
        ? 'AI terlalu lama merespons. Coba lagi ya.'
        : (err.message || 'Maaf, terjadi kesalahan koneksi.');
    } finally {
      clearTimeout(timer);
      busy = false;
      scrollDown();
      input.focus();
    }
  });
}