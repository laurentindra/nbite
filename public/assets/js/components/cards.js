import { S } from '../state.js';
import { IDR, pct, status, win, left, stockLabel } from '../lib/format.js';
import { $, fill, show, setArt, setPressed } from '../lib/dom.js';
import { element } from '../lib/templates.js';

/* Heart button state shared by both card types and the deal page. */
export function setFavourite(button, listing) {
  button.dataset.id = listing.id;
  setPressed(button, S.favs.has(listing.id));
  button.setAttribute('aria-label', `Save ${listing.m}`);
}

/* Large card (grid). `withTimer` adds the "N min left" badge. */
export function dealCard(l, withTimer = false) {
  const node = element('deal-card');
  const off = status(l) !== 'active';

  const link = $('.fc', node);
  link.setAttribute('href', `#deal/${l.id}`);
  link.setAttribute('aria-label', `${l.m}, ${l.t}, ${IDR(l.p)}`);

  setArt(node, l.art, l.photo);
  fill(node, {
    discount: `${pct(l)}% OFF`,
    left: stockLabel(l),
    timeLeft: `${left(l)} min left`,
    merchant: l.m,
    distance: `${l.d} km`,
    title: l.t,
    price: IDR(l.p),
    was: IDR(l.o),
    pickup: `Pickup ${win(l)}`
  });
  show(node, { discounted: l.discounted, timer: withTimer && !off });
  setFavourite($('.favb', node), l);
  return node;
}

/* Compact row card (lists, map card). */
export function rowCard(l) {
  const node = element('row-card');
  const link = $('.rowc', node);
  link.setAttribute('href', `#deal/${l.id}`);
  link.setAttribute('aria-label', `${l.m}, ${l.t}, ${IDR(l.p)}`);
  link.classList.toggle('off', status(l) !== 'active');

  setArt(node, l.art, l.photo);
  fill(node, {
    merchant: l.m,
    title: l.t,
    price: IDR(l.p),
    was: IDR(l.o),
    percent: `${pct(l)}%`,
    window: win(l),
    stock: `${stockLabel(l)} · ${l.d} km`
  });
  show(node, { discounted: l.discounted });
  setFavourite($('.favb', node), l);
  return node;
}
