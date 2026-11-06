import { S } from '../state.js';
import { $, fill, show } from '../lib/dom.js';
import { fragment } from '../lib/templates.js';

function setFieldError(node, id, message) {
  const input = $(`#${id}`, node);
  const box = $(`#${id}-e`, node);
  if (!input) return;
  box.classList.toggle('on', !!message);
  input.classList.toggle('err', !!message);
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', `${id}-e`);
    $('span', box).textContent = message;
  }
}

/* Shared by the Log in and Create account pages. */
function authPage(kind) {
  const node = fragment('auth');
  const register = kind === 'register';
  const errors = S.authErr.errors || {};
  const values = S.authVals;

  $('form', node).dataset.form = kind;
  show(node, {
    register,
    login: !register,
    error: !!S.authErr.error,
    busy: S.busy,
    'login-idle': !register && !S.busy,
    'login-busy': !register && S.busy,
    'register-idle': register && !S.busy,
    'register-busy': register && S.busy
  });
  fill(node, { error: S.authErr.error || '' });

  if (register) $('#au-name', node).value = values.name || '';
  $('#au-email', node).value = values.email || '';
  $('#au-password', node).setAttribute('autocomplete', register ? 'new-password' : 'current-password');
  $('[type="submit"]', node).disabled = S.busy;

  setFieldError(node, 'au-name', errors.name);
  setFieldError(node, 'au-email', errors.email);
  setFieldError(node, 'au-password', errors.password);
  return node;
}

export const login = () => authPage('login');
export const register = () => authPage('register');
