/* Hash router and the single render pipeline. */
import { S } from './state.js';
import { AUTHED, PARTNERED, TITLES } from './config.js';
import { $ } from './lib/dom.js';
import { VIEWS } from './views/index.js';
import { updateShell } from './components/shell.js';
import { renderOverlays } from './components/overlays.js';

/* "#deal/3" -> ['deal', '3'].  Each HTML entry page has its own default route. */
export function route() {
  const fallback = document.body.dataset.app === 'partner' ? '#partner' : '#home';
  const parts = (location.hash || fallback).slice(1).split('/');
  return [parts[0] || 'home', parts.slice(1).join('/')];
}

export function render() {
  const [name, param] = route();

  /* access rules */
  if (AUTHED.includes(name) && !S.user) { S.next = location.hash; location.hash = 'login'; return; }
  if (PARTNERED.includes(name) && !S.partner) { location.hash = 'partner'; return; }
  if ((name === 'login' || name === 'register') && S.user) {
    const target = S.next || '#home';
    S.next = '';
    location.hash = target.slice(1);
    return;
  }
  if (name === 'deal' && S.sel !== +param) { S.sel = +param; S.qty = 1; }

  const scrollY = window.scrollY;
  const view = (VIEWS[name] || VIEWS.home)(decodeURIComponent(param));
  if (view === null) return; /* the view redirected */

  $('#main').replaceChildren(view);
  updateShell(name);
  renderOverlays();
  document.title = TITLES[name] || 'Night Bite';
  if (S.keepScroll) scrollTo(0, scrollY);
}

/* Re-render after a state change without jumping to the top. */
export function rerender() {
  S.keepScroll = true;
  render();
  S.keepScroll = false;
}
