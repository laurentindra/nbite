import { S, byId } from '../state.js';
import { SERVICE_FEE, MAX_QTY } from '../config.js';
import { IDR, status, win } from '../lib/format.js';
import { $, $$, fill, show, setArt, setChecked } from '../lib/dom.js';
import { fragment } from '../lib/templates.js';

export function checkout() {
  const l = byId(S.sel);
  if (!l || status(l) !== 'active') { location.hash = 'explore'; return null; }

  const node = fragment('checkout');
  const subtotal = l.p * S.qty;
  const total = subtotal + SERVICE_FEE;

  setArt(node, l.art, l.photo);
  fill(node, {
    window: win(l),
    where: `${l.m} · ${l.addr}`,
    merchant: l.m,
    title: l.t,
    qty: S.qty,
    line: `${l.t} × ${S.qty}`,
    subtotal: IDR(subtotal),
    fee: IDR(SERVICE_FEE),
    total: IDR(total),
    savings: l.discounted
      ? `You save ${IDR((l.o - l.p) * S.qty)} versus the regular price.`
      : 'This is the store’s regular selling price.',
    confirmLabel: `Confirm Order · ${IDR(total)}`
  });
  show(node, { busy: S.busy, idle: !S.busy });

  $$('[data-a="pay"]', node).forEach(option => setChecked(option, S.pay === option.dataset.k));
  const terms = $('[data-a="agree"]', node);
  setChecked(terms, S.agree);
  $('.radio svg', terms).toggleAttribute('hidden', !S.agree);

  $('[data-a="q-"]', node).disabled = S.qty <= 1;
  $('[data-a="q+"]', node).disabled = S.qty >= Math.min(l.q, MAX_QTY);
  $('[data-a="confirm"]', node).disabled = !(S.agree && !S.busy);
  return node;
}
