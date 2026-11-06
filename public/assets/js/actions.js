/* Click actions. Any element with data-a="name" runs the matching case below. */
import { api } from './api.js';
import { S, data, byId, defaultFilters } from './state.js';
import { MAX_QTY, MESSAGES } from './config.js';
import { $ } from './lib/dom.js';
import { rerender } from './router.js';
import { refresh, handleApiError } from './data.js';
import { toast, toastError } from './components/toast.js';

function requireLogin(message) {
  S.next = location.hash;
  toastError(message);
  location.hash = 'login';
}

function clearPartnerSession() {
  S.partner = null;
  S.partnerListings = [];
  S.partnerChats = [];
  S.currentPartnerChat = null;
}

function useLocation() {
  const status = $('#location-status');
  const say = text => { if (status) status.textContent = text; };
  if (!navigator.geolocation) { say(MESSAGES.notSupported); return; }

  say(MESSAGES.locating);
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const { latitude, longitude } = coords;
      sessionStorage.setItem('nb-location', JSON.stringify({ latitude, longitude }));
      say(`Location enabled (${latitude.toFixed(4)}, ${longitude.toFixed(4)}).`);
      toast(MESSAGES.locationReady);
    },
    error => say(error.code === 1 ? MESSAGES.locationDenied : MESSAGES.locationFailed),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function confirmOrder() {
  if (S.busy) return;
  S.busy = true;
  rerender();
  api('POST', '/api/orders', { listingId: S.sel, qty: S.qty, payment: S.pay })
    .then(({ order }) => {
      S.busy = false;
      S.ord = order;
      S.tab = 'Upcoming';
      S.qty = 1;
      location.hash = 'success';
    })
    .catch(error => {
      S.busy = false;
      if (error.status === 401) { handleApiError(error); return; }
      S.failMsg = error.message;
      location.hash = 'state/failed';
      rerender();
    });
}

function cancelOrder() {
  const order = S.viewOrder || S.ord;
  api('POST', `/api/orders/${order.ref}/cancel`)
    .then(() => { S.modal = null; location.hash = 'state/cancelled'; })
    .catch(error => {
      S.modal = null;
      handleApiError(error);
      refresh('order').then(rerender);
    });
}

function togglePassword() {
  const input = $('#au-password');
  if (!input) return;
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  const button = $('.pwt');
  button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
  button.setAttribute('aria-pressed', reveal);
}

export function act(action, d) {
  switch (action) {
    /* catalogue */
    case 'cat': S.cat = d.c; rerender(); break;
    case 'view': S.view = d.v; rerender(); break;
    case 'pinsel': S.mapSel = +d.id; rerender(); break;
    case 'sort': S.sort = d.s; rerender(); break;
    case 'setf': S.f[d.k] = d.k === 'time' ? d.v : +d.v; rerender(); break;
    case 'clr': S.f[d.k] = d.k === 'time' ? '' : 0; rerender(); break;
    case 'reset': S.f = defaultFilters(); S.sort = 'Nearest'; rerender(); break;
    case 'clrq':
      S.q = ''; S.f = defaultFilters(); S.sort = 'Nearest'; S.cat = 'All';
      rerender();
      break;
    case 'widen':
      S.f = defaultFilters(); S.sort = 'Nearest'; S.cat = 'All';
      location.hash = 'explore';
      rerender();
      break;
    case 'drawer': S.drawer = true; rerender(); break;
    case 'drawer-close': S.drawer = false; rerender(); break;

    case 'fav':
      if (!S.user) { requireLogin(MESSAGES.loginRequiredSave); break; }
      api('POST', `/api/favorites/${+d.id}`)
        .then(r => { S.favs = new Set(r.favs); rerender(); })
        .catch(handleApiError);
      break;

    /* deal and checkout */
    case 'q+': if (S.qty < Math.min(byId(S.sel).q, MAX_QTY)) S.qty++; rerender(); break;
    case 'q-': if (S.qty > 1) S.qty--; rerender(); break;
    case 'pay': S.pay = d.k; rerender(); break;
    case 'agree': S.agree = !S.agree; rerender(); break;
    case 'confirm': confirmOrder(); break;

    /* orders */
    case 'otab': S.tab = d.t; rerender(); break;
    case 'cancelyes': cancelOrder(); break;

    /* overlays and navigation */
    case 'modal': S.modal = d.k || null; rerender(); break;
    case 'use-location': useLocation(); break;
    case 'back': history.length > 1 ? history.back() : (location.hash = 'explore'); break;
    case 'nav': location.hash = d.to; break;
    case 'toast': toastError(d.m || MESSAGES.comingSoon); break;
    case 'partner': location.hash = 'partner'; break;

    /* AI Chat Toggle */
    case 'toggle-ai-chat':
      const win = document.getElementById('aiChatWindow');
      if (win) win.classList.toggle('hidden');
      break;

    /* account */
    case 'notif':
      api('PATCH', '/api/me', { notifications: !S.user.notifications })
        .then(r => { S.user = r.user; rerender(); })
        .catch(handleApiError);
      break;
    case 'togpw': togglePassword(); break;
    case 'logout':
      api('POST', '/api/logout').catch(() => {}).then(() => {
        S.user = null;
        S.favs = new Set();
        data.orders = [];
        S.ord = null;
        S.viewOrder = null;
        S.next = '';
        location.hash = 'home';
        toastError(MESSAGES.loggedOut);
        rerender();
      });
      break;

    /* messaging */
    case 'start-chat':
      if (!S.user) { requireLogin(MESSAGES.loginRequiredChat); break; }
      api('POST', '/api/chats', { merchantId: +d.merchantId, listingId: +d.listingId })
        .then(r => { S.currentChat = null; location.hash = `chat/${r.chatId}`; })
        .catch(handleApiError);
      break;

    /* Food Partner */
    case 'partner-logout':
      api('POST', '/api/partner/logout').catch(() => {}).then(() => {
        clearPartnerSession();
        location.hash = 'partner';
        toastError(MESSAGES.partnerLoggedOut);
      });
      break;
  }
}