import { TOAST_MS } from '../config.js';
import { $, fill } from '../lib/dom.js';
import { element } from '../lib/templates.js';

/* Short feedback message at the bottom of the screen. */
export function toast(message, ok = true) {
  $('.toast')?.remove();
  const node = element('toast');
  $('[data-icon]', node).setAttribute('href', `assets/img/icons.svg#${ok ? 'check' : 'info'}`);
  fill(node, { message });
  document.body.append(node);
  setTimeout(() => node.remove(), TOAST_MS);
}

export const toastError = message => toast(message, false);
