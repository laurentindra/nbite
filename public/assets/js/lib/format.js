/* Pure formatting and listing helpers (no DOM). */

export const IDR = n => 'Rp' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const mins = time => {
  const [hours, minutes] = time.split(':');
  return +hours * 60 + +minutes;
};

export const pct = l => Math.round((1 - l.p / l.o) * 100);
export const status = l => l.status;
export const win = l => `${l.s}–${l.e}`;
export const left = l => l.minsLeft;

export const stockLabel = l => {
  const st = status(l);
  return st === 'active' ? `${l.q} left` : st === 'sold' ? 'Sold out' : 'Pickup ended';
};
