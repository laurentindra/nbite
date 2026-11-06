import { S } from '../state.js';
import { PARTNERED } from '../config.js';
import { $, $$, fill } from '../lib/dom.js';

/* Header, main navigation and mobile tab bar are static HTML; only their state changes. */
export function updateShell(page) {
  const current = page === 'order' ? 'orders' : page;
  $$('[data-nav]').forEach(link => {
    if (link.dataset.nav === current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const partnerOnly = !!S.partner && !S.user;
  const visible = {
    'partner': !!S.partner,
    'no-partner': !S.partner,
    'partner-only': partnerOnly,
    'user': !partnerOnly && !!S.user,
    'guest': !partnerOnly && !S.user
  };
  $$('[data-show]').forEach(el => el.toggleAttribute('hidden', !visible[el.dataset.show]));

  if (S.user) {
    const avatar = $('[data-field="avatar"]');
    avatar.setAttribute('aria-label', `Your profile, ${S.user.name}`);
    fill(document, { avatar: S.user.name.trim()[0].toUpperCase() });
  }

  const hideTabbar = PARTNERED.includes(page) || page === 'partner';
  $('.tabbar').toggleAttribute('hidden', hideTabbar);
}
