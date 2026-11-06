/* Loads the HTML partials in /components and /pages once, then hands out fresh clones. */

const COMPONENTS = [
  'deal-card', 'row-card', 'empty-states', 'order-status', 'ticket', 'order-card',
  'filter-panel', 'filter-tag', 'results-bar', 'results-list', 'map-view', 'map-pin',
  'chat-thread', 'chat-line', 'chat-list-item', 'modal-shell', 'modal-cancel',
  'modal-location', 'modal-favorites', 'favorite-item', 'drawer', 'toast', 'partner-listing'
];

const PAGES = [
  'home', 'explore', 'deal', 'checkout', 'success', 'orders', 'order', 'profile',
  'auth', 'partner', 'partner-dashboard', 'messages', 'chat', 'partner-chats',
  'partner-chat', 'state'
];

const registry = new Map();

async function load(folder, name) {
  const response = await fetch(`${folder}/${name}.html`);
  if (!response.ok) throw new Error(`Could not load ${folder}/${name}.html`);
  const template = document.createElement('template');
  template.innerHTML = await response.text();
  registry.set(name, template);
}

export async function loadTemplates() {
  await Promise.all([
    ...COMPONENTS.map(name => load('components', name)),
    ...PAGES.map(name => load('pages', name))
  ]);
}

/* A fresh DocumentFragment of the whole partial. */
export const fragment = name => registry.get(name).content.cloneNode(true);

/* A fresh copy of the partial's single root element. */
export const element = name => fragment(name).firstElementChild;

/* The raw <template> (used for partials that hold several variants). */
export const template = name => registry.get(name);
