import { S } from '../state.js';
import { $, fill } from '../lib/dom.js';
import { template } from '../lib/templates.js';

/* All empty/error screens live in components/empty-states.html, one block per key. */
export const hasEmptyState = key => !!$(`[data-state="${key}"]`, template('empty-states').content);

export function emptyState(key) {
  const node = $(`[data-state="${key}"]`, template('empty-states').content).cloneNode(true);
  if (key === 'failed' && S.failMsg) fill(node, { message: S.failMsg });
  return node;
}
