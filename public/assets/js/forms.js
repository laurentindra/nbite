/* Form submissions and the other document-level input listeners. */
import { api } from './api.js';
import { S } from './state.js';
import { MESSAGES } from './config.js';
import { $ } from './lib/dom.js';
import { rerender } from './router.js';
import { refresh, handleApiError } from './data.js';
import { toast } from './components/toast.js';
import { results } from './components/filters.js';

const formValues = form => Object.fromEntries(new FormData(form));

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function submitAuth(kind, form) {
  if (S.busy) return;
  const v = formValues(form);
  S.authVals = { name: v.name || '', email: v.email || '' };
  S.busy = true;
  S.authErr = {};
  rerender();

  const body = kind === 'login'
    ? { email: v.email, password: v.password }
    : { name: v.name, email: v.email, password: v.password };

  api('POST', `/api/${kind}`, body)
    .then(r => {
      S.busy = false;
      S.user = r.user;
      S.favs = new Set(r.favs);
      S.authVals = {};
      const target = S.next || '#home';
      S.next = '';
      toast(kind === 'login' ? `Welcome back, ${r.user.name.split(' ')[0]}.` : MESSAGES.accountReady);
      location.hash = target.slice(1);
    })
    .catch(error => {
      S.busy = false;
      S.authErr = { error: error.errors ? '' : error.message, errors: error.errors || {} };
      rerender();
      setTimeout(() => ($('[aria-invalid=true]') || $('#au-email'))?.focus(), 0);
    });
}

function submitPartnerAuth(kind, form) {
  const v = formValues(form);
  S.partnerAuthErr = {};
  const body = kind === 'login'
    ? { email: v.email, password: v.password }
    : { name: v.name, email: v.email, password: v.password, storeName: v.storeName, address: v.address, area: v.area };

  api('POST', `/api/partner/${kind}`, body)
    .then(r => {
      S.partner = r.partner;
      S.partnerAuthErr = {};
      S.partnerListings = [];
      toast(MESSAGES.welcomePartner);
      location.hash = 'partner-dashboard';
    })
    .catch(error => { S.partnerAuthErr[kind] = error.message; rerender(); });
}

function readPhoto(file) {
  if (!file) return Promise.resolve('');
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) return Promise.reject(new Error('Please choose a JPG, PNG, or WEBP image.'));
  if (file.size > 4 * 1024 * 1024) return Promise.reject(new Error('Photo must be 4 MB or smaller.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected photo.'));
    reader.readAsDataURL(file);
  });
}

function addListing(form) {
  const v = formValues(form);
  const photoFile = form.elements.photo?.files?.[0];
  readPhoto(photoFile)
    .then(photo => api('POST', '/api/partner/listings', {
      ...v, photo, price: Number(v.price), quantity: Number(v.quantity)
    }))
    .then(() => { toast(MESSAGES.packageAdded); return refresh('partner-dashboard'); })
    .then(rerender)
    .catch(handleApiError);
}

function updateListing(form) {
  const v = formValues(form);
  const body = {
    originalPrice: Number(v.originalPrice),
    price: Number(v.price),
    quantity: Number(v.quantity),
    discounted: v.discounted === 'on'
  };
  api('PATCH', `/api/partner/listings/${Number(form.dataset.listingId)}`, body)
    .then(() => { toast(MESSAGES.packageUpdated); return refresh('partner-dashboard'); })
    .then(rerender)
    .catch(handleApiError);
}

function sendMessage(form, asPartner) {
  const id = Number(form.dataset.chatId);
  const message = new FormData(form).get('message');
  const url = asPartner ? `/api/partner/chats/${id}/messages` : `/api/chats/${id}/messages`;
  api('POST', url, { message })
    .then(() => refresh(asPartner ? 'partner-chat' : 'chat', String(id)))
    .then(rerender)
    .catch(handleApiError);
}

function sendAiMessage(form) {
  const input = form.querySelector('input[name="message"]');
  const text = input ? input.value.trim() : '';
  if (!text) return;
  input.value = '';

  const msgContainer = document.querySelector('[data-slot="ai-messages"]');
  if (!msgContainer) return;

  // 1. Tampilkan pesan user ke layar
  msgContainer.insertAdjacentHTML('beforeend', `<div class="ai-msg user">${escapeHtml(text)}</div>`);
  msgContainer.scrollTop = msgContainer.scrollHeight;

  // 2. Tampilkan indikator loading sebentar
  const loadingId = 'ai-loading-' + Date.now();
  msgContainer.insertAdjacentHTML('beforeend', `<div class="ai-msg bot" id="${loadingId}">Sedang mengetik...</div>`);
  msgContainer.scrollTop = msgContainer.scrollHeight;

  // 3. Kirim ke Backend API
  api('POST', '/api/ai-chat', { message: text })
    .then(res => {
      document.getElementById(loadingId)?.remove();
      msgContainer.insertAdjacentHTML('beforeend', `<div class="ai-msg bot">${escapeHtml(res.reply)}</div>`);
      msgContainer.scrollTop = msgContainer.scrollHeight;
    })
    .catch(err => {
      document.getElementById(loadingId)?.remove();
      const errorMsg = err && err.message ? err.message : 'Maaf, asisten AI sedang sibuk. Coba beberapa saat lagi ya.';
      msgContainer.insertAdjacentHTML('beforeend', `<div class="ai-msg bot">${escapeHtml(errorMsg)}</div>`);
      msgContainer.scrollTop = msgContainer.scrollHeight;
    });
}

const SUBMIT = {
  hsearch: () => { S.q = ($('#hq').value || '').trim(); location.hash = 'explore'; },
  login: form => submitAuth('login', form),
  register: form => submitAuth('register', form),
  'partner-login': form => submitPartnerAuth('login', form),
  'partner-register': form => submitPartnerAuth('register', form),
  'partner-add-listing': addListing,
  'partner-price': updateListing,
  'customer-message': form => sendMessage(form, false),
  'partner-message': form => sendMessage(form, true),
  'ai-chat-send': form => sendAiMessage(form)
};

export function bindFormEvents() {
  document.addEventListener('submit', event => {
    const handler = SUBMIT[event.target.dataset.form];
    if (!handler) return;
    event.preventDefault();
    handler(event.target);
  });

  /* live search on the Explore page: only the results area is redrawn */
  document.addEventListener('input', event => {
    if (event.target.id !== 'xq') return;
    S.q = event.target.value;
    $('#xres')?.replaceChildren(results());
  });

  /* promo checkbox enables/disables the promo price field */
  document.addEventListener('change', event => {
    if (event.target.matches('input[name="photo"]')) {
      const file = event.target.files?.[0];
      const preview = event.target.closest('form')?.querySelector('[data-photo-preview]');
      if (!preview) return;
      if (!file) { preview.hidden = true; preview.removeAttribute('src'); return; }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
        event.target.value = ''; preview.hidden = true; preview.removeAttribute('src');
        toast('Choose a JPG, PNG, or WEBP photo up to 4 MB.'); return;
      }
      preview.src = URL.createObjectURL(file); preview.hidden = false;
      return;
    }
    if (!event.target.matches('input[name="discounted"]')) return;
    const form = event.target.closest('form');
    const price = form?.querySelector('input[name="price"]');
    if (!price) return;
    price.disabled = !event.target.checked;
    const regular = form.querySelector('input[name="originalPrice"]');
    if (event.target.checked && Number(price.value) >= Number(regular.value)) price.value = '';
  });
}