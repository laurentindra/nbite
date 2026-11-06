import { S, data, defaultFilters } from '../state.js';
import { TIME_FILTER_LABELS } from '../config.js';
import { IDR, mins, pct, status } from '../lib/format.js';
import { $, $$, fill, show, list, setPressed, setChecked } from '../lib/dom.js';
import { element, fragment } from '../lib/templates.js';
import { dealCard, rowCard } from './cards.js';
import { emptyState } from './empty-state.js';

export const resetFilters = () => { S.f = defaultFilters(); S.sort = 'Nearest'; };

export const activeFilterCount = () =>
  (S.f.max ? 1 : 0) + (S.f.dist ? 1 : 0) + (S.f.time ? 1 : 0) + (S.sort !== 'Nearest' ? 1 : 0);

const SORTERS = {
  'Nearest': (a, b) => a.d - b.d,
  'Lowest Price': (a, b) => a.p - b.p,
  'Biggest Discount': (a, b) => pct(b) - pct(a),
  'Pickup Time': (a, b) => mins(a.s) - mins(b.s)
};

/* Returns [available, notAvailable] after search, category, filters and sorting. */
export function filteredListings() {
  const matchesTime = l =>
    !S.f.time ||
    (S.f.time === 'early' && mins(l.s) < 1140) ||
    (S.f.time === 'late' && mins(l.s) >= 1140) ||
    (S.f.time === 'after20' && mins(l.e) > 1200);

  const matchesQuery = l =>
    !S.q || `${l.m} ${l.t} ${l.cat} ${l.area}`.toLowerCase().includes(S.q.toLowerCase());

  const rows = data.listings.filter(l =>
    (S.cat === 'All' || l.cat === S.cat) &&
    matchesQuery(l) &&
    (!S.f.max || l.p <= S.f.max) &&
    (!S.f.dist || l.d <= S.f.dist) &&
    matchesTime(l)
  );
  const sorter = SORTERS[S.sort];
  return [
    rows.filter(l => status(l) === 'active').sort(sorter),
    rows.filter(l => status(l) !== 'active').sort(sorter)
  ];
}

/* Sort options and filter chips (used in the sidebar and in the mobile drawer). */
export function filterPanel() {
  const node = fragment('filter-panel');
  $$('[data-a="sort"]', node).forEach(b => setChecked(b, S.sort === b.dataset.s));
  $$('[data-a="setf"]', node).forEach(b => setPressed(b, String(S.f[b.dataset.k]) === b.dataset.v));
  return node;
}

function filterTags() {
  const tags = [];
  if (S.f.max) tags.push(['max', `Up to ${IDR(S.f.max)}`]);
  if (S.f.dist) tags.push(['dist', `Within ${S.f.dist} km`]);
  if (S.f.time) tags.push(['time', TIME_FILTER_LABELS[S.f.time]]);

  return tags.map(([key, label]) => {
    const tag = element('filter-tag');
    tag.dataset.k = key;
    tag.setAttribute('aria-label', `Remove filter ${label}`);
    fill(tag, { label });
    return tag;
  });
}

function mapView(available) {
  const selected = available.find(l => l.id === S.mapSel) || available[0];
  const node = element('map-view');

  list(node, 'pins', available.map(l => {
    const pin = element('map-pin');
    pin.style.setProperty('--x', l.x);
    pin.style.setProperty('--y', l.y);
    pin.dataset.id = l.id;
    pin.textContent = IDR(l.p);
    pin.setAttribute('aria-label', `${l.m} ${IDR(l.p)}`);
    setPressed(pin, !!selected && selected.id === l.id);
    return pin;
  }));

  show(node, { card: !!selected });
  if (selected) list(node, 'card', [rowCard(selected)]);
  return node;
}

/* Everything inside #xres: result bar, then empty state / map / list. */
export function results() {
  const [available, unavailable] = filteredListings();
  const out = document.createDocumentFragment();

  const bar = fragment('results-bar');
  fill(bar, { count: available.length, sort: S.sort });
  show(bar, { one: available.length === 1, many: available.length !== 1 });
  list(bar, 'tags', filterTags());
  out.append(bar);

  if (!available.length && !unavailable.length) {
    out.append(emptyState(S.q ? 'nosearch' : 'nodeals'));
    return out;
  }

  if (S.view === 'map') {
    out.append(mapView(available));
    return out;
  }

  const body = fragment('results-list');
  list(body, 'available', available.map(rowCard));
  show(body, { unavailable: unavailable.length > 0 });
  if (unavailable.length) list(body, 'unavailable', unavailable.map(rowCard));
  out.append(body);
  return out;
}
