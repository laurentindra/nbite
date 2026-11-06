import { S, data } from '../state.js';
import { pct, status, left } from '../lib/format.js';
import { $$, fill, show, list, setPressed } from '../lib/dom.js';
import { fragment } from '../lib/templates.js';
import { dealCard, rowCard } from '../components/cards.js';
import { emptyState } from '../components/empty-state.js';

export const markCategories = root =>
  $$('[data-c]', root).forEach(chip => setPressed(chip, S.cat === chip.dataset.c));

export function home() {
  const node = fragment('home');

  const all = data.listings.filter(l => S.cat === 'All' || l.cat === S.cat);
  const active = all.filter(l => status(l) === 'active');
  const best = [...active].sort((a, b) => pct(b) - pct(a)).slice(0, 4);
  const soon = active.filter(l => left(l) <= 100).sort((a, b) => left(a) - left(b)).slice(0, 4);
  const nearest = [...all].sort((a, b) => a.d - b.d);

  fill(node, { name: S.user ? S.user.name.split(' ')[0] : 'guest' });
  show(node, { guest: !S.user, best: !!best.length, soon: !!soon.length, all: !!all.length, none: !all.length });
  markCategories(node);

  list(node, 'best', best.map(l => dealCard(l)));
  list(node, 'soon', soon.map(l => dealCard(l, true)));
  list(node, 'all', nearest.map(rowCard));
  list(node, 'empty', all.length ? [] : [emptyState('nodeals')]);
  return node;
}
