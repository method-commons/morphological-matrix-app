/*
 * Seitenleiste: Konzeptliste und Zusammenfassung des aktiven Konzepts; hängt außerdem die
 * Kennzahlen (stats.jsx) ein. Konzeptvergleich in compare.jsx.
 */
import { Fragment, render as mount } from 'preact';
import { Attributes } from '../attributes.js';
import { Evaluation } from '../evaluation.js';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { deleteConcept, duplicateConcept, setActiveConcept } from './actions.js';
import { IconButton } from './components.jsx';
import { ConflictBox, ConflictPill } from './constraints.jsx';
import { activeConcept, fieldProps, money, render, state, useMatrix } from './core.js';
import { $, shownColor } from './dom.jsx';
import { hoverConcept } from './lines.js';
import { categoryColor } from './render-matrix.jsx';
import { StatusChip } from './status.jsx';
import { Util } from '../util.js';
import { conceptRest, formatCount, Stats } from './stats.jsx';

// ---------- Konzepte ----------

function ConceptList() {
  useMatrix();
  if (!state.concepts.length) return <li class="summary-empty">{Texts.concept.none}</li>;
  return <>{state.concepts.map((c, ci) => <ConceptItem key={c.id} c={c} ci={ci} />)}</>;
}

/** @param {{ c: MatrixConcept, ci: number }} props */
function ConceptItem({ c, ci }) {
  const total = state.parameters.length;
  const filled = state.parameters.filter(p => c.selections[p.id]).length;
  const name = fieldProps(v => { c.name = v.replace(/[\r\n]+/g, ' '); });
  const left = conceptRest(c);
  return (
    <li
      class={`concept${c.id === state.activeConceptId ? ' is-active' : ''}${c.status === 'dropped' ? ' is-dropped' : ''}`}
      style={{ '--c': shownColor(c.color) }} data-cid={c.id}
      onMouseEnter={() => hoverConcept(c.id)} onMouseLeave={() => hoverConcept(null)}
      onClick={e => { if (!/** @type {HTMLElement} */ (e.target).closest('button, input, textarea')) setActiveConcept(c.id); }}
    >
      <input
        type="color" class="swatch" value={c.color} aria-label={Texts.concept.color(c.name)} title={Texts.concept.changeColor}
        {...fieldProps(v => { c.color = v; }, render)}
      />
      {/* Mehrzeilig, damit lange Namen vollständig lesbar bleiben; Zeilenumbrüche gehören nicht zum Namen. */}
      <textarea
        class="concept-name autosize" rows={1} value={c.name}
        placeholder={Texts.fallback.concept(ci + 1)} aria-label={Texts.concept.nameLabel(ci + 1)}
        {...name}
        onFocus={e => { setActiveConcept(c.id); name.onFocus(e); }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); /** @type {HTMLElement} */ (e.currentTarget).blur(); } }}
      />
      <span class="concept-meta">
        <ConflictPill c={c} />
        <span class="concept-progress" data-progress={c.id} title={Texts.concept.progressTitle(filled, total)}>{`${filled}/${total}`}</span>
      </span>
      <span class="concept-tools">
        <IconButton icon="copy" label={Texts.concept.duplicate} onClick={() => duplicateConcept(c.id)} />
        <IconButton icon="trash" label={Texts.concept.delete} onClick={() => deleteConcept(c.id)} danger />
      </span>
      <span class="concept-status">
        <StatusChip c={c} />
        {c.statusNote.trim() ? <span class="status-why">{c.statusNote}</span> : null}
      </span>
      {left != null ? <span class="concept-rest">{Texts.cons.restConcept(formatCount(left).text, left === 1n)}</span> : null}
    </li>
  );
}

/** „2 Werte fehlen“ bzw. leer. @param {number} missing */
export function missingNote(missing) {
  return missing ? Texts.summary.missing(missing) : '';
}

// ---------- Zusammenfassung ----------

function Summary() {
  useMatrix();
  const c = activeConcept();
  if (!c) return <p class="summary-empty">{Texts.summary.noConcept}</p>;
  const showCats = state.categories.length > 0;
  const groups = Model.categoryGroups(state);
  const fig = state.parameters.length ? Evaluation.conceptReport(state).find(r => r.concept === c) : null;
  /** @param {string} label @param {string} value @param {number} missing */
  const metric = (label, value, missing) => (
    <div class="metric"><span>{label}</span><strong>{value}</strong>{missing ? <small>{`(${missingNote(missing)})`}</small> : null}</div>
  );
  const metrics = fig ? [
    fig.cost ? metric(Texts.summary.totalCost, money(fig.cost.total), fig.cost.missing) : null,
    fig.utility
      ? metric(Texts.summary.utility,
        fig.utility.value == null ? '–' : Texts.summary.utilityValue(Util.formatNumber(fig.utility.value), state.settings.utilityMax),
        fig.utility.missing)
      : null,
    ...state.settings.attributes.map((a, i) => {
      const sum = Attributes.summarize(state, a, c);
      if (!sum.text) return null;
      const star = Attributes.marksMissing(a, sum);
      return (
        <div key={a.id} class={`metric metric-attr${sum.warn ? ' is-warn' : ''}`}>
          <span>{Attributes.label(a, i)}</span>
          <strong>{sum.text}</strong>
          {star ? <small>{`(${missingNote(sum.missing)})`}</small> : null}
          {sum.warn ? <small class="attr-warn">{`⚠ ${Attributes.limitText(a)}`}</small> : null}
        </div>
      );
    }),
  ].filter(Boolean) : [];
  return (
    <>
      <h3 style={{ '--c': shownColor(c.color) }}>{c.name || Texts.fallback.unnamedConcept}</h3>
      <ConflictBox c={c} />
      <div class="concept-note" data-cid={c.id} key={c.id}>
        <label for="conceptNote">{Texts.notes.conceptLabel}</label>
        <textarea
          id="conceptNote" class="autosize" rows={2} value={c.note} placeholder={Texts.notes.conceptPlaceholder}
          {...fieldProps(v => { c.note = v; })}
        />
      </div>
      {metrics.length ? <div class="metrics">{metrics}</div> : null}
      {fig && fig.priority ? <PriorityProfile counts={fig.priority} all /> : null}
      {state.parameters.length ? (
        <dl>
          {groups.map(g => (
            <Fragment key={g.cat ? g.cat.id : ''}>
              {showCats && g.items.length
                ? <div class="summary-cat" style={{ '--k': categoryColor(g.cat) }}>{Model.categoryLabel(g.cat)}</div>
                : null}
              {g.items.map(({ p, pi }) => {
                const text = Model.optionText(p, c.selections[p.id]);
                const o = Model.selectedOption(p, c);
                return (
                  <Fragment key={p.id}>
                    <dt>{Model.parameterLabel(p, pi)}</dt>
                    <dd class={text ? undefined : 'none'}>
                      {text || Texts.summary.notSelected}
                      {o && o.note ? <span class="dd-note">{o.note}</span> : null}
                    </dd>
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
        </dl>
      ) : <p class="summary-empty">{Texts.summary.noParameters}</p>}
    </>
  );
}

/**
 * Prioritäten der gewählten Ausprägungen als Kürzel („2 × M“ …).
 * @param {{ counts: Record<MatrixPriority | 'none', number>, all?: boolean }} props `all`: auch Nullwerte zeigen
 */
export function PriorityProfile({ counts, all = false }) {
  return (
    <div class="prio-profile" title={Texts.moscow.profileTitle}>
      {Model.PRIORITIES.filter(level => all || counts[level]).map(level => (
        <span key={level} class={`prio prio-${level}`} title={Texts.moscow.levels[level].label}>
          {`${counts[level]} × ${Texts.moscow.levels[level].short}`}
        </span>
      ))}
      {counts.none ? <span class="prio prio-none">{`${counts.none} × ${Texts.moscow.none}`}</span> : null}
    </div>
  );
}

/** Komponenten in ihre Container in index.html einhängen. */
export function initPanels() {
  mount(<Stats />, $('#stats'));
  mount(<ConceptList />, $('#conceptList'));
  mount(<Summary />, $('#conceptSummary'));
}
