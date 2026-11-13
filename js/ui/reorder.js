/*
 * Reihenfolge der Parameter per Ziehen am Griff ⠿ (Modus „Bearbeiten“, Desktop) – wie in der
 * RACI-App. Das Ziel ergibt sich aus der Zeigerhöhe über den Parameterzellen (`data-dnd-param`,
 * `data-dnd-cat`: obere Hälfte davor, untere danach) und den Kategoriebändern (`data-dnd-head`:
 * an den Anfang der Kategorie, bei eingeklappter Kategorie ans Ende). Eine Linie zeigt die
 * Einfügestelle, ein Hinweis am Zeiger die neue Position; abgelegt über `Ops.moveParameterTo`,
 * auch in eine andere Kategorie. Escape bricht ab. Auf dem Griff verschieben ↑/↓ wie die Knöpfe.
 */
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { mutate, state } from './core.js';

/** @typedef {{ cid: string | null, before: string | null, el: HTMLElement, after: boolean }} DropTarget */

/** Abstand zum Fensterrand, ab dem beim Ziehen gescrollt wird (px). */
const EDGE = 56;

/** Kategorie aus einem Datenattribut ('' = ohne Kategorie). @param {string | undefined} v */
const catOf = v => v || null;

/**
 * Ziel an der Höhe `y`.
 * @param {HTMLElement} root @param {number} y @returns {DropTarget | null}
 */
function targetAt(root, y) {
  const list = /** @type {HTMLElement[]} */ ([...root.querySelectorAll('[data-dnd-param], [data-dnd-head]')])
    .filter(el => el.getBoundingClientRect().height > 0);
  if (!list.length) return null;
  let i = 0;
  list.forEach((el, k) => { if (el.getBoundingClientRect().top <= y) i = k; });
  const el = list[i];
  const ds = el.dataset;
  const next = list[i + 1];
  /** Nächster Parameter, falls er in Kategorie `cid` liegt. @param {string | null} cid */
  const nextIn = cid => (next && next.dataset.dndParam != null && catOf(next.dataset.dndCat) === cid ? next.dataset.dndParam || null : null);
  if (ds.dndHead != null) {
    const cid = catOf(ds.dndHead);
    return { cid, before: ds.dndCollapsed ? null : nextIn(cid), el, after: true };
  }
  const cid = catOf(ds.dndCat);
  const r = el.getBoundingClientRect();
  if (y < r.top + r.height / 2) return { cid, before: ds.dndParam || null, el, after: false };
  return { cid, before: nextIn(cid), el, after: true };
}

/**
 * Hinweis beim Ziehen: neue Position in der Kategorie, bei anderer Kategorie auch deren Name.
 * @param {string} pid @param {DropTarget} t
 */
function tipText(pid, t) {
  const copy = { ...state, parameters: state.parameters.map(p => ({ ...p })) };
  Ops.moveParameterTo(copy, pid, t.cid, t.before);
  const same = copy.parameters.filter(p => (p.categoryId || null) === t.cid);
  const no = same.findIndex(p => p.id === pid) + 1;
  const from = state.parameters.find(p => p.id === pid);
  if (state.categories.length && from && (from.categoryId || null) !== t.cid) {
    return Texts.matrix.dragToCategory(Model.categoryLabel(Model.categoryById(state, t.cid)), no);
  }
  return Texts.matrix.dragTo(no);
}

/** Zellen einer Parameterzeile (Kopf bis vor die nächste Zeile). @param {HTMLElement} head */
function rowCells(head) {
  const out = [head];
  for (let n = head.nextElementSibling; n && !n.matches('[data-dnd-param], [data-dnd-head]'); n = n.nextElementSibling) {
    out.push(/** @type {HTMLElement} */ (n));
  }
  return out;
}

/**
 * Ziehen am Griff beginnen (pointerdown). Erst ab ein paar Pixeln Bewegung wird gezogen.
 * @param {PointerEvent} e @param {string} pid
 */
export function startParameterDrag(e, pid) {
  if (e.button !== 0) return;
  const handle = /** @type {HTMLElement} */ (e.currentTarget);
  const root = /** @type {HTMLElement | null} */ (handle.closest('.matrix'));
  const src = /** @type {HTMLElement | null} */ (handle.closest('[data-dnd-param]'));
  const wrap = root && /** @type {HTMLElement | null} */ (root.parentElement);
  if (!root || !src || !wrap) return;
  e.preventDefault();
  handle.setPointerCapture(e.pointerId);
  const startY = e.clientY;
  let y = e.clientY;
  let x = e.clientX;
  let dragging = false;
  /** @type {DropTarget | null} */
  let target = null;
  /** @type {HTMLElement | null} */
  let tip = null;
  /** @type {HTMLElement | null} */
  let line = null;
  /** @type {HTMLElement[]} */
  let row = [];
  let frame = 0;

  const update = () => {
    target = targetAt(root, y);
    if (line && target) {
      const r = target.el.getBoundingClientRect();
      const w = wrap.getBoundingClientRect();
      const m = root.getBoundingClientRect();
      line.style.top = `${(target.after ? r.bottom + 3 : r.top - 3) - w.top}px`;
      line.style.left = `${m.left - w.left}px`;
      line.style.width = `${m.width}px`;
    }
    if (tip && target) {
      tip.textContent = tipText(pid, target);
      tip.style.left = `${x + 14}px`;
      tip.style.top = `${y + 14}px`;
    }
  };
  // am Fensterrand weiterscrollen
  const tick = () => {
    const dy = y < EDGE ? -12 : y > innerHeight - EDGE ? 12 : 0;
    if (dy) { scrollBy(0, dy); update(); }
    frame = requestAnimationFrame(tick);
  };
  /** @param {PointerEvent} ev */
  const onMove = ev => {
    y = ev.clientY;
    x = ev.clientX;
    if (!dragging && Math.abs(y - startY) < 4) return;
    if (!dragging) {
      dragging = true;
      row = rowCells(src);
      row.forEach(el => el.classList.add('dragging'));
      line = document.createElement('div');
      line.className = 'drop-line';
      wrap.append(line);
      tip = document.createElement('div');
      tip.className = 'drag-tip';
      document.body.append(tip);
      frame = requestAnimationFrame(tick);
    }
    update();
  };
  /** @param {boolean} drop */
  const end = drop => {
    cancelAnimationFrame(frame);
    row.forEach(el => el.classList.remove('dragging'));
    if (tip) tip.remove();
    if (line) line.remove();
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    handle.removeEventListener('pointercancel', onCancel);
    removeEventListener('keydown', onKey, true);
    const t = target;
    if (drop && dragging && t) {
      const copy = { ...state, parameters: state.parameters.map(p => ({ ...p })) };
      // Nur einen Verlaufseintrag anlegen, wenn sich wirklich etwas ändert
      if (Ops.moveParameterTo(copy, pid, t.cid, t.before)) mutate(m => Ops.moveParameterTo(m, pid, t.cid, t.before));
    }
  };
  const onUp = () => end(true);
  const onCancel = () => end(false);
  /** @param {KeyboardEvent} ev */
  const onKey = ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); end(false); } };
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onCancel);
  addEventListener('keydown', onKey, true);
}
