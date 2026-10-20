/*
 * Werte aller Ausprägungen: ein Dialog mit den Tabellen „Bewertung“ (Kosten und Bewertung je
 * Kriterium, criteria.jsx) und „Eigene Merkmale“ (attributes.jsx). Reiter nur, wenn beide vorhanden sind;
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

/** Reiter, die es gibt: Bewertung bei aktiven Kosten oder Nutzwert, Merkmale, sobald eines definiert ist. @param {Matrix} m */
const tabsOf = m => /** @type {ValueTab[]} */ ([...(m.settings.utility || m.settings.costs ? ['score'] : []), ...(m.settings.attributes.length ? ['attr'] : [])]);

/** Name und Überschrift des Reiters „Bewertung“ je nach aktiven Spalten. @param {Matrix} m */
function scoreNames(m) {
  const { costs, utility } = m.settings;
  if (costs && utility) return { tab: Texts.valueTable.rating, heading: Texts.valueTable.ratingHeading };
  return utility ? { tab: Texts.valueTable.score, heading: Texts.criteria.tableHeading } : { tab: Texts.valueTable.costs, heading: Texts.valueTable.costsHeading };
}

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
  const names = scoreNames(m);
  const heading = tabs.length > 1 ? Texts.valueTable.heading
    : shown === 'score' ? names.heading : Texts.attributes.tableHeading;
  useLayoutEffect(() => { $('#valueHeading').textContent = heading; }, [heading]);
  if (!tab.value) return null;
  // Beide Tabellen weggefallen (Bewertung aus, letztes Merkmal gelöscht): Dialog schließen
  if (!shown) {
    queueMicrotask(() => closeDialog($('#valueDialog')));
    return null;
  }
  /** @type {Record<ValueTab, string>} */
  const counts = { score: m.settings.utility ? Texts.valueTable.criteria(m.settings.criteria.length) : '', attr: String(m.settings.attributes.length) };
  return (
    <>
      {tabs.length > 1 ? (
        <div class="segmented value-tabs" role="tablist" aria-label={Texts.valueTable.heading}>
          {tabs.map(t => (
            <button
              key={t} type="button" role="tab" id={`valueTab-${t}`} aria-selected={t === shown} aria-pressed={t === shown}
              aria-controls="valuePanel" onClick={() => selectTab(t)}
            >
              {t === 'score' ? names.tab : Texts.valueTable.attr}{counts[t] ? <small>{counts[t]}</small> : null}
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
