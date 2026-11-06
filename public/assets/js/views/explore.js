import { S } from '../state.js';
import { $, $$, fill, list, setPressed } from '../lib/dom.js';
import { fragment } from '../lib/templates.js';
import { activeFilterCount, filterPanel, results } from '../components/filters.js';
import { markCategories } from './home.js';

export function explore() {
  const node = fragment('explore');
  const count = activeFilterCount();

  $('#xq', node).value = S.q;
  $$('[data-a="view"]', node).forEach(b => setPressed(b, S.view === b.dataset.v));
  fill(node, { filtersLabel: `Filters${count ? ` (${count})` : ''}` });
  markCategories(node);
  list(node, 'filters', [filterPanel()]);
  $('#xres', node).append(results());
  return node;
}
