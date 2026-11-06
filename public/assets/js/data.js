/* Loads data from the API for the current route and handles API errors. */
import { api } from './api.js';
import { S, data } from './state.js';
import { PARTNERED, ORDER_ROUTES, CHAT_ROUTES, MESSAGES } from './config.js';
import { toastError } from './components/toast.js';

export function handleApiError(error) {
  if (error.status === 401 && S.partner && !S.user) {
    S.partner = null;
    S.partnerListings = [];
    S.partnerChats = [];
    S.currentPartnerChat = null;
    toastError(MESSAGES.partnerSessionExpired);
    location.hash = 'partner';
    return;
  }
  if (error.status === 401 && S.user) {
    S.user = null;
    S.favs = new Set();
    data.orders = [];
    S.next = location.hash;
    toastError(MESSAGES.sessionExpired);
    location.hash = 'login';
    return;
  }
  toastError(error.message);
}

export async function loadSession() {
  try {
    const { user, favs } = await api('GET', '/api/me');
    S.user = user;
    S.favs = new Set(favs);
  } catch (error) { toastError(error.message); }

  try {
    S.partner = (await api('GET', '/api/partner/me')).partner;
  } catch (error) { if (error.status !== 401) toastError(error.message); }
}

/* Fetches whatever the given page needs (listings are always refreshed). */
export async function refresh(page, param = '') {
  const jobs = [api('GET', '/api/listings').then(r => { data.listings = r.listings; })];

  if (S.user && ORDER_ROUTES.includes(page)) {
    jobs.push(api('GET', '/api/orders').then(r => { data.orders = r.orders; }));
  }
  if (S.user && CHAT_ROUTES.includes(page)) {
    jobs.push(api('GET', '/api/chats').then(r => { S.chats = r.chats; }));
    if (page === 'chat' && param) {
      jobs.push(api('GET', `/api/chats/${Number(param)}`).then(r => { S.currentChat = r.chat; S.chatMessages = r.messages; }));
    }
  }
  if (S.partner && PARTNERED.includes(page)) {
    if (page === 'partner-dashboard') {
      jobs.push(api('GET', '/api/partner/listings').then(r => { S.partnerListings = r.listings; }));
    }
    jobs.push(api('GET', '/api/partner/chats').then(r => { S.partnerChats = r.chats; }));
    if (page === 'partner-chat' && param) {
      jobs.push(api('GET', `/api/partner/chats/${Number(param)}`).then(r => { S.currentPartnerChat = r.chat; S.partnerChatMessages = r.messages; }));
    }
  }

  try {
    await Promise.all(jobs);
  } catch (error) {
    if (error.status === 401 && PARTNERED.includes(page)) {
      S.partner = null;
      S.partnerListings = [];
      S.partnerChats = [];
      location.hash = 'partner';
      toastError(MESSAGES.partnerSessionExpiredShort);
      return;
    }
    if (error.status === 401) handleApiError(error);
    else toastError(error.message);
  }
}
