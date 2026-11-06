import { S, data } from '../state.js';
import { IDR } from '../lib/format.js';
import { $, fill, setChecked } from '../lib/dom.js';
import { fragment } from '../lib/templates.js';

export function profile() {
  const node = fragment('profile');
  const user = S.user;
  const completed = data.orders.filter(o => o.st === 'Completed');

  fill(node, {
    initial: user.name.trim()[0].toUpperCase(),
    name: user.name,
    email: user.email,
    rescued: completed.length,
    saved: IDR(completed.reduce((sum, o) => sum + o.saved, 0))
  });
  setChecked($('.sw-tog', node), user.notifications);
  return node;
}
