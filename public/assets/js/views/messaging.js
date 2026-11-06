import { S } from '../state.js';
import { $, fill, show, list, put } from '../lib/dom.js';
import { fragment } from '../lib/templates.js';
import { chatThread, chatListItem } from '../components/chat.js';

/* ---- customer ---- */
export function messages() {
  const node = fragment('messages');
  show(node, { 'has-chats': S.chats.length > 0, 'no-chats': !S.chats.length });
  list(node, 'chats', S.chats.map(c => chatListItem({
    href: `#chat/${c.id}`,
    name: c.merchant,
    preview: c.lastMessage || c.listing || 'Start your conversation',
    icon: 'store'
  })));
  return node;
}

export function chat(id) {
  const c = S.currentChat;
  const node = fragment('chat');
  const ready = !!c && Number(c.id) === Number(id);
  show(node, { loading: !ready, ready });
  if (!ready) return node;

  fill(node, {
    merchant: c.merchant,
    meta: `${c.area}${c.listing ? ` · About ${c.listing}` : ''} · Message goes to this store`
  });
  put(node, 'thread', chatThread(S.chatMessages, 'customer'));
  $('form', node).dataset.chatId = c.id;
  return node;
}

/* ---- Food Partner ---- */
export function partnerChats() {
  if (!S.partner) { location.hash = 'partner'; return null; }
  const node = fragment('partner-chats');
  fill(node, { merchant: S.partner.merchant });
  show(node, { 'has-chats': S.partnerChats.length > 0, 'no-chats': !S.partnerChats.length });
  list(node, 'chats', S.partnerChats.map(c => chatListItem({
    href: `#partner-chat/${c.id}`,
    name: c.customer,
    preview: c.lastMessage || c.listing || 'New conversation',
    icon: 'user'
  })));
  return node;
}

export function partnerChat(id) {
  if (!S.partner) { location.hash = 'partner'; return null; }
  const c = S.currentPartnerChat;
  const node = fragment('partner-chat');
  const ready = !!c && Number(c.id) === Number(id);
  show(node, { loading: !ready, ready });
  if (!ready) return node;

  fill(node, { customer: c.customer, meta: c.listing || 'Customer enquiry' });
  put(node, 'thread', chatThread(S.partnerChatMessages, 'partner'));
  $('form', node).dataset.chatId = c.id;
  return node;
}
