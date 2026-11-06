/* Keeps customer and Food Partner inboxes current without a manual reload. */
import { api } from './api.js';
import { S } from './state.js';
import { POLL_INTERVAL_MS, PARTNERED, CHAT_ROUTES } from './config.js';
import { route, rerender } from './router.js';

let busy = false;
const changed = (a, b) => JSON.stringify(a) !== JSON.stringify(b);

async function pollPartner(page, param) {
  const { chats } = await api('GET', '/api/partner/chats');
  let dirty = changed(chats, S.partnerChats);
  S.partnerChats = chats;
  if (page === 'partner-chat' && param) {
    const thread = await api('GET', `/api/partner/chats/${Number(param)}`);
    if (changed(thread.messages, S.partnerChatMessages) || changed(thread.chat, S.currentPartnerChat)) {
      S.currentPartnerChat = thread.chat;
      S.partnerChatMessages = thread.messages;
      dirty = true;
    }
  }
  return dirty;
}

async function pollCustomer(page, param) {
  const { chats } = await api('GET', '/api/chats');
  let dirty = changed(chats, S.chats);
  S.chats = chats;
  if (page === 'chat' && param) {
    const thread = await api('GET', `/api/chats/${Number(param)}`);
    if (changed(thread.messages, S.chatMessages) || changed(thread.chat, S.currentChat)) {
      S.currentChat = thread.chat;
      S.chatMessages = thread.messages;
      dirty = true;
    }
  }
  return dirty;
}

async function poll() {
  if (busy || document.hidden) return;
  const [page, param] = route();
  const partnerView = !!S.partner && PARTNERED.includes(page);
  const customerView = !!S.user && CHAT_ROUTES.includes(page);
  if (!partnerView && !customerView) return;

  busy = true;
  try {
    const dirty = partnerView ? await pollPartner(page, param) : await pollCustomer(page, param);
    if (dirty) rerender();
  } catch {
    /* best effort: normal navigation and form submissions still report errors */
  } finally {
    busy = false;
  }
}

export function startPolling() {
  setInterval(poll, POLL_INTERVAL_MS);
  addEventListener('focus', poll);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
}
