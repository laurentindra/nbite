import { $, list } from '../lib/dom.js';
import { fragment } from '../lib/templates.js';
import { emptyState, hasEmptyState } from '../components/empty-state.js';

/* #state/<key>: full-page empty or error screens (sold out, payment failed, ...). */
export function statePage(key) {
  if (!hasEmptyState(key)) { location.hash = 'home'; return null; }
  const node = fragment('state');
  list(node, 'empty', [emptyState(key)]);
  return node;
}
