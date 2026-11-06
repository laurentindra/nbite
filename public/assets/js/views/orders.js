import { S, data } from '../state.js';
import { $, $$, put, list, fill, show } from '../lib/dom.js';
import { fragment } from '../lib/templates.js';
import { ticket, orderCard } from '../components/ticket.js';
import { emptyState } from '../components/empty-state.js';

export function success() {
  const o = S.ord;
  if (!o) { location.hash = 'orders'; return null; }

  const node = fragment('success');
  put(node, 'ticket', ticket(o, true));
  $('[data-ref="view-order"]', node).setAttribute('href', `#order/${o.ref}`);
  return node;
}

export function orders() {
  const node = fragment('orders');
  const mine = data.orders.filter(o => o.st === S.tab);

  $$('[data-a="otab"]', node).forEach(tab => {
    const count = data.orders.filter(o => o.st === tab.dataset.t).length;
    tab.setAttribute('aria-selected', String(S.tab === tab.dataset.t));
    tab.append(` ${count}`);
  });

  if (mine.length) {
    list(node, 'orders', mine.map(orderCard));
    $('[data-slot="empty"]', node).remove();
  } else {
    $('[data-list="orders"]', node).remove();
    const empty = emptyState('noorders');
    fill(empty, { title: `No ${S.tab.toLowerCase()} orders` });
    put(node, 'empty', empty);
  }
  return node;
}

export function order(ref) {
  const o = data.orders.find(x => x.ref === ref);
  if (!o) { location.hash = 'orders'; return null; }
  S.viewOrder = o;

  const node = fragment('order');
  const upcoming = o.st === 'Upcoming';
  put(node, 'ticket', ticket(o, upcoming));
  fill(node, { cancelNote: o.cancelNote });
  show(node, {
    'h-upcoming': upcoming,
    'h-completed': o.st === 'Completed',
    'h-missed': o.st === 'Cancelled' && !!o.missed,
    'h-cancelled': o.st === 'Cancelled' && !o.missed,
    cancellable: upcoming && o.canCancel,
    locked: upcoming && !o.canCancel
  });
  return node;
}
