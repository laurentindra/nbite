import { S, data } from '../state.js';
import { $, list, fill, show, setArt } from '../lib/dom.js';
import { element, fragment } from '../lib/templates.js';
import { filterPanel, filteredListings } from './filters.js';

function favouritesModal() {
  const node = fragment('modal-favorites');
  const favourites = data.listings.filter(l => S.favs.has(l.id));
  show(node, { empty: !favourites.length });
  list(node, 'items', favourites.map(l => {
    const item = element('favorite-item');
    item.setAttribute('href', `#deal/${l.id}`);
    setArt(item, l.art);
    fill(item, { merchant: l.m, area: l.area });
    return item;
  }));
  return node;
}

function cancelModal() {
  const order = S.viewOrder || S.ord;
  const node = fragment('modal-cancel');
  fill(node, { summary: `${order.t} from ${order.m} will be released to other customers. Free cancellation applies (simulated).` });
  return node;
}

const MODALS = {
  cancel: cancelModal,
  locs: () => fragment('modal-location'),
  favs: favouritesModal
};

function modal() {
  const shell = element('modal-shell');
  list(shell, 'body', [MODALS[S.modal]()]);
  return shell;
}

function drawer() {
  const node = element('drawer');
  list(node, 'filters', [filterPanel()]);
  fill(node, { apply: `Show ${filteredListings()[0].length} deals` });
  return node;
}

/* Modal and filter drawer are rendered into #overlay-root. */
export function renderOverlays() {
  const root = $('#overlay-root');
  root.replaceChildren();
  if (S.modal) root.append(modal());
  if (S.drawer) root.append(drawer());
  document.body.classList.toggle('lock', !!(S.modal || S.drawer));
}
