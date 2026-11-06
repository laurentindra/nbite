import { S } from '../state.js';
import { IDR, pct } from '../lib/format.js';
import { $, fill, list, pick, show, setArt } from '../lib/dom.js';
import { fragment } from '../lib/templates.js';

/* Food Partner log in / register page. */
export function partner() {
  if (S.partner) { location.hash = 'partner-dashboard'; return null; }
  const node = fragment('partner');
  fill(node, {
    loginError: S.partnerAuthErr.login || '',
    registerError: S.partnerAuthErr.register || ''
  });
  return node;
}

function listingForm(l) {
  const node = fragment('partner-listing');
  setArt(node, l.art, l.photo);
  fill(node, {
    meta: `${l.cat} · ${l.q} remaining`,
    title: l.t,
    pickup: `Pickup ${l.s}–${l.e}`,
    price: IDR(l.p),
    promo: `Promo active · ${pct(l)}% off`
  });
  pick(node, l.discounted ? 'promo' : 'regular');

  const form = $('form', node);
  form.dataset.listingId = l.id;
  form.elements.originalPrice.value = l.o;
  form.elements.price.value = l.discounted ? l.p : l.o;
  form.elements.price.disabled = !l.discounted;
  form.elements.quantity.value = l.initialQty;
  form.elements.discounted.checked = l.discounted;
  return node;
}

export function partnerDashboard() {
  if (!S.partner) { location.hash = 'partner'; return null; }
  const node = fragment('partner-dashboard');
  const items = S.partnerListings;

  fill(node, {
    title: `${S.partner.merchant} dashboard`,
    subtitle: `${S.partner.address} · Manage what customers see in your store.`,
    messagesLabel: `Customer messages${S.partnerChats.length ? ` (${S.partnerChats.length})` : ''}`,
    packages: items.length,
    promos: items.filter(l => l.discounted).length,
    stock: items.reduce((sum, l) => sum + l.q, 0)
  });
  show(node, { 'has-listings': items.length > 0, 'no-listings': !items.length });
  list(node, 'listings', items.map(listingForm));
  return node;
}
