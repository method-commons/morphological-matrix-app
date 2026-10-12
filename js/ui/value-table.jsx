/*
 * Werte aller Ausprägungen: ein Dialog mit den Tabellen „Nutzwert“ (Bewertung je Kriterium,
 * criteria.jsx) und „Eigene Merkmale“ (attributes.jsx). Reiter nur, wenn beide vorhanden sind;
 * sonst trägt der Dialog den Titel der einen Tabelle.
 */
import { signal } from '@preact/signals';
import { render as mount } from 'preact';
import { useLayoutEffect } from 'preact/hooks';
import { Texts } from '../texts.js';
import { AttributeTable } from './attributes.jsx';
import { useMatrix } from './core.js';
import { ScoreTable } from './criteria.jsx';
import { $, closeDialog, openDialog } from './dom.jsx';
import { selectField } from './fields.jsx';

/** @typedef {'score' | 'attr'} ValueTab */

/** Gewählter Reiter; `null` = Dialog geschlossen (dann wird nichts gezeichnet). */
const tab = signal(/** @type {ValueTab | null} */ (null));

/** Reiter, die es gibt: Nutzwert bei aktiver Bewertung, Merkmale, sobald eines definiert ist. @param {Matrix} m */
const tabsOf = m => /** @type {ValueTab[]} */ ([...(m.settings.utility ? ['score'] : []), ...(m.settings.attributes.length ? ['attr'] : [])]);

/** Erstes Feld der sichtbaren Tabelle fokussieren und markieren. */
const focusFirst = () => selectField(/** @type {HTMLElement | null} */ ($('#valueDialog').querySelector('[data-r="0"][data-c="0"]')));

/** Dialog mit dem gewünschten Reiter öffnen. @param {ValueTab} which */
export function openValueTable(which) {
  tab.value = which;
  openDialog($('#valueDialog'));
  focusFirst();
}

/** @param {ValueTab} which */
function selectTab(which) {
  tab.value = which;
  focusFirst();
}

function ValueTable() {
  const m = useMatrix();
  const tabs = tabsOf(m);
  const shown = tab.value && (tabs.includes(tab.value) ? tab.value : tabs[0]);
  const heading = tabs.length > 1 ? Texts.valueTable.heading
    : shown === 'score' ? Texts.criteria.tableHeading : Texts.attributes.tableHeading;
  useLayoutEffect(() => { $('#valueHeading').textContent = heading; }, [heading]);
  if (!tab.value) return null;
  // Beide Tabellen weggefallen (Bewertung aus, letztes Merkmal gelöscht): Dialog schließen
  if (!shown) {
    queueMicrotask(() => closeDialog($('#valueDialog')));
    return null;
  }
  /** @type {Record<ValueTab, string>} */
  const counts = { score: Texts.valueTable.criteria(m.settings.criteria.length), attr: String(m.settings.attributes.length) };
  return (
    <>
      {tabs.length > 1 ? (
        <div class="segmented value-tabs" role="tablist" aria-label={Texts.valueTable.heading}>
          {tabs.map(t => (
            <button
              key={t} type="button" role="tab" id={`valueTab-${t}`} aria-selected={t === shown} aria-pressed={t === shown}
              aria-controls="valuePanel" onClick={() => selectTab(t)}
            >
              {t === 'score' ? Texts.valueTable.score : Texts.valueTable.attr}<small>{counts[t]}</small>
            </button>
          ))}
        </div>
      ) : null}
      <div id="valuePanel" role={tabs.length > 1 ? 'tabpanel' : undefined} aria-labelledby={tabs.length > 1 ? `valueTab-${shown}` : undefined}>
        {shown === 'score' ? <ScoreTable /> : <AttributeTable />}
      </div>
    </>
  );
}

export function initValueTable() {
  mount(<ValueTable />, $('#valueBody'));
  const dialog = $('#valueDialog');
  dialog.addEventListener('close', () => { tab.value = null; });
  $('#valueClose').addEventListener('click', () => closeDialog(dialog));
  $('#valueDone').addEventListener('click', () => closeDialog(dialog));
}
