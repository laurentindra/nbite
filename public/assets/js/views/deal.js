import { S, byId } from '../state.js';
import { MAX_QTY } from '../config.js';
import { IDR, pct, status, win, left } from '../lib/format.js';
import { $, fill, show, setArt } from '../lib/dom.js';
import { fragment } from '../lib/templates.js';
import { setFavourite } from '../components/cards.js';

export function deal(id) {
  const l = byId(id);
  if (!l) { location.hash = 'explore'; return null; }

  const node = fragment('deal');
  const st = status(l);
  const active = st === 'active';
  const maxQty = Math.min(Math.max(1, l.q), MAX_QTY);

  setArt(node, l.art, l.photo);
  fill(node, {
    discount: `${pct(l)}% OFF`,
    details: `${l.desc} ${l.inside}`,
    note: l.note,
    address: l.addr,
    allergens: l.allergen,
    merchant: l.m,
    title: l.t,
    place: `${l.d} km · ${l.area}`,
    price: IDR(l.p),
    was: IDR(l.o),
    save: `Save ${IDR(l.o - l.p)}`,
    window: win(l),
    end: l.e,
    minsLeft: left(l),
    stock: l.q,
    unit: l.unit,
    qty: active ? S.qty : 0,
    total: IDR(l.p * S.qty)
  });
  show(node, {
    discounted: l.discounted,
    's-active': active,
    's-inactive': !active,
    's-sold': st === 'sold',
    's-expired': st === 'expired',
    active,
    inactive: !active
  });

  setFavourite($('.favb', node), l);
  const chat = $('[data-a="start-chat"]', node);
  chat.dataset.merchantId = l.merchantId;
  chat.dataset.listingId = l.id;
  $('[data-a="q-"]', node).disabled = S.qty <= 1 || !active;
  $('[data-a="q+"]', node).disabled = S.qty >= maxQty || !active;
  return node;
}
