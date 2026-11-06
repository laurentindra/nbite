/* Night Bite customer + Food Partner front end. Entry point. */
import { S } from './state.js';
import { $ } from './lib/dom.js';
import { loadTemplates } from './lib/templates.js';
import { route, render, rerender } from './router.js';
import { loadSession, refresh } from './data.js';
import { act } from './actions.js';
import { bindFormEvents } from './forms.js';
import { startPolling } from './polling.js';

function bindGlobalEvents() {
  /* every [data-a] element is a button wired to actions.js */
  document.addEventListener('click', event => {
    const el = event.target.closest('[data-a]');
    if (!el) return;
    if (el.classList.contains('scrim') && event.target !== el) return; /* click inside a dialog */
    if (el.tagName === 'A' && el.dataset.a === 'modal') { S.modal = null; return; }
    act(el.dataset.a, el.dataset);
  });

  addEventListener('keydown', event => {
    if (event.key === 'Escape' && (S.modal || S.drawer)) {
      S.modal = null;
      S.drawer = false;
      rerender();
    }
  });

  addEventListener('hashchange', async () => {
    S.modal = null;
    S.drawer = false;
    S.authErr = {};
    S.partnerAuthErr = {};
    scrollTo(0, 0);
    const [page, param] = route();
    await refresh(page, param);
    render();
  });
}

async function boot() {
  await loadTemplates();
  await loadSession();
  const [page, param] = route();
  await refresh(page, param);
  S.ready = true;
  render();
}

bindGlobalEvents();
bindFormEvents();
startPolling();
boot();