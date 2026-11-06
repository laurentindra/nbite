import { IDR } from '../lib/format.js';
import { $, fill, show, put, pick, setArt } from '../lib/dom.js';
import { element, fragment } from '../lib/templates.js';

/* Reserved / Collected / Not collected / Cancelled badge. */
export function orderStatus(o) {
  const variant = o.st === 'Upcoming' ? 'reserved'
    : o.st === 'Completed' ? 'collected'
    : o.missed ? 'missed' : 'cancelled';
  const node = fragment('order-status');
  pick(node, variant);
  return node.firstElementChild;
}

/* Deterministic pseudo-QR drawn from the order reference (demo placeholder). */
function drawQr(svg, ref) {
  let seed = [...ref].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const finder = (x < 7 && y < 7) || (x >= 14 && y < 7) || (x < 7 && y >= 14);
      let on;
      if (finder) {
        const a = x >= 14 ? x - 14 : x;
        const b = y >= 14 ? y - 14 : y;
        on = a === 0 || a === 6 || b === 0 || b === 6 || (a >= 2 && a <= 4 && b >= 2 && b <= 4);
      } else {
        on = random() > 0.52;
      }
      if (!on) continue;
      const cell = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      cell.setAttribute('x', x);
      cell.setAttribute('y', y);
      cell.setAttribute('width', 1.04);
      cell.setAttribute('height', 1.04);
      svg.append(cell);
    }
  }
}

export function ticket(o, withQr) {
  const node = element('ticket');
  put(node, 'status', orderStatus(o));
  fill(node, {
    ref: o.ref,
    code: o.code,
    merchant: o.m,
    address: o.addr,
    when: `${o.day}, ${o.win}`,
    summary: `${o.t}${o.qty > 1 ? ` × ${o.qty}` : ''} · ${IDR(o.total)}`
  });
  show(node, { qr: withQr });
  if (withQr) drawQr($('[data-list="qr"]', node), o.ref);
  return node;
}

export function orderCard(o) {
  const node = element('order-card');
  setArt(node, o.art);
  put(node, 'status', orderStatus(o));
  fill(node, {
    merchant: o.m,
    title: `${o.t}${o.qty > 1 ? ` × ${o.qty}` : ''}`,
    total: IDR(o.total),
    when: `${o.day}, ${o.win}`,
    cta: o.st === 'Upcoming' ? 'Pickup details' : 'Details'
  });
  $('[data-field="cta"]', node).setAttribute('href', `#order/${o.ref}`);
  return node;
}
