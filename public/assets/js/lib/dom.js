/* Small DOM helpers used by every view and component. */
import { FOOD_ART } from '../config.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/* data-field="name"  -> sets the text of the element(s) */
export function fill(root, values) {
  for (const [key, value] of Object.entries(values)) {
    $$(`[data-field="${key}"]`, root).forEach(el => { el.textContent = value; });
  }
}

/* data-if="name"  -> shows or hides the element(s) */
export function show(root, flags) {
  for (const [key, visible] of Object.entries(flags)) {
    $$(`[data-if="${key}"]`, root).forEach(el => el.toggleAttribute('hidden', !visible));
  }
}

/* data-slot="name" -> the placeholder element is replaced by the node */
export function put(root, name, node) {
  $(`[data-slot="${name}"]`, root).replaceWith(node);
}

/* data-list="name" -> nodes are appended into the container */
export function list(root, name, nodes) {
  const container = $(`[data-list="${name}"]`, root);
  container.append(...nodes);
  return container;
}

/* data-variant="x" -> keeps only the matching variant */
export function pick(root, variant) {
  $$('[data-variant]', root).forEach(el => {
    if (el.dataset.variant !== variant) el.remove();
  });
}

/* data-art -> food illustration (an image file, ready to be swapped for real photos) */
export function setArt(root, key, photo) {
  const art = FOOD_ART.includes(key) ? key : 'bakery';
  $$('[data-art]', root).forEach(box => {
    box.classList.add(`art-${art}`);
    const image = $('img', box);
    image.src = photo || `assets/img/food/${art}.svg`;
    image.classList.toggle('uploaded-food-photo', !!photo);
  });
}

/* Text with line breaks, without using innerHTML. */
export function setMultiline(el, text) {
  el.replaceChildren();
  String(text).split('\n').forEach((line, index) => {
    if (index) el.append(document.createElement('br'));
    el.append(line);
  });
}

export const setPressed = (el, on) => el.setAttribute('aria-pressed', String(!!on));
export const setChecked = (el, on) => el.setAttribute('aria-checked', String(!!on));
