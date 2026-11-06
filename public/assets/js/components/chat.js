import { $, fill, show, setMultiline } from '../lib/dom.js';
import { element } from '../lib/templates.js';

/* One conversation bubble list. `ownType` is 'customer' or 'partner'. */
export function chatThread(messages, ownType) {
  const node = element('chat-thread');
  show(node, { empty: !messages.length });
  node.append(...messages.map(m => {
    const line = element('chat-line');
    line.classList.add(m.senderType === ownType ? 'mine' : 'theirs');
    setMultiline($('[data-field="body"]', line), m.body);
    fill(line, { meta: `${m.senderType === 'partner' ? 'Store' : 'Customer'} · ${m.createdAt}` });
    return line;
  }));
  return node;
}

/* One row in the conversation list. */
export function chatListItem({ href, name, preview, icon }) {
  const node = element('chat-list-item');
  node.setAttribute('href', href);
  $('[data-icon]', node).setAttribute('href', `assets/img/icons.svg#${icon}`);
  fill(node, { name, preview });
  return node;
}
