/*
 * Kennzahlen über der Matrix (Kacheln Parameter, Ausprägungen, Kombinationen, Konzepte) und die
 * Zählungen dafür: widerspruchsfreie Kombinationen und Restzahl beim Kombinieren (Web Worker, count.js).
 */
import { Texts } from '../texts.js';
import { activeConcept, prefs, state, useMatrix } from './core.js';
import { consistentCount, restCounts } from './count.js';
import { openSolutions } from './solutions.jsx';
import { Util } from '../util.js';

/**
 * Anzahl für die Kennzahl-Kachel: bis unter eine Billion exakt, darüber gerundet in Worten
 * (bzw. als Zehnerpotenz), damit die Zahl in die Kachel passt. Die exakte Zahl steht im Tooltip.
 * @param {bigint} n @returns {{ text: string, title: string | null }}
 */
export function formatCount(n) {
  const exact = Util.formatInteger(n);
  if (n < 10n ** 12n) return { text: exact, title: null };
  const { value, power } = Util.scaleBigInt(n);
  const unit = Texts.stats.bigUnits[power];
  if (unit) {
    return { text: Texts.stats.approx(Util.formatNumber(Math.round(value * 10) / 10), unit), title: Texts.stats.exact(exact) };
  }
  const digits = n.toString();
  const mantissa = Number(`${digits[0]}.${digits.slice(1, 3)}`);
  return { text: Texts.stats.approxPower(Util.formatNumber(mantissa), digits.length - 1), title: Texts.stats.exact(exact) };
}

// ---------- Kennzahlen ----------

/**
 * Kachel mit fester Form: Bezeichnung (oben, rechts daneben ggf. ein Link), Zahl, eine Detailzeile.
 * Im DOM steht die Zahl vorn („6 Parameter“), die Anordnung übernimmt das CSS-Raster.
 * @param {{ value: string, label: string, title?: string | null, link?: any, children?: any }} props
 */
function Stat({ value, label, title = null, link = null, children }) {
  return (
    <div class="stat" title={title ?? undefined}>
      <strong>{value}</strong>{' '}<span class="stat-label">{label}</span>
      {link}
      {' '}{children ?? <span class="stat-detail" />}
    </div>
  );
}

export function Stats() {
  useMatrix();
  const P = state.parameters.length;
  const O = state.parameters.reduce((n, p) => n + p.options.length, 0);
  const combos = P ? state.parameters.reduce((n, p) => n * BigInt(p.options.length), 1n) : 0n;
  const C = state.concepts.length;
  const count = formatCount(combos);
  /** @type {Array<Exclude<ConceptStatus, 'draft'>>} */
  const shown = ['chosen', 'favorite', 'dropped'];
  const parts = shown.map(s => [s, state.concepts.filter(c => c.status === s).length])
    .filter(([, n]) => n).map(([s, n]) => Texts.status.count(/** @type {number} */ (n), /** @type {any} */ (s)));
  const statusSummary = parts.length ? Texts.status.summary(parts) : C ? Texts.status.drafts(C) : '';
  const paramDetail = !P ? '' : state.categories.length
    ? Texts.stats.inCategories(state.categories.length) : Texts.stats.noCategories;
  const optionDetail = P ? Texts.stats.avgOptions(Util.formatNumber(Math.round(O / P * 10) / 10)) : '';
  const link = P ? (
    <button type="button" class="stat-link" id="solutionsLink" title={Texts.solutions.openTitle} aria-label={Texts.solutions.open} onClick={openSolutions}>
      <span class="stat-link-text">{Texts.solutions.open}</span><span aria-hidden="true">›</span>
    </button>
  ) : null;
  return (
    <>
      <Stat value={Util.formatInteger(P)} label={Texts.stats.parameters}>
        <span class="stat-detail">{paramDetail}</span>
      </Stat>
      <Stat value={Util.formatInteger(O)} label={Texts.stats.options(O)}>
        <span class="stat-detail">{optionDetail}</span>
      </Stat>
      <Stat value={count.text} label={Texts.stats.combinations(combos === 1n)} title={count.title} link={link}>
        {!P ? null : state.constraints.some(x => x.type === 'excluded') ? <ConsistentCount />
          : <span class="stat-detail">{Texts.stats.noExclusions}</span>}
      </Stat>
      <Stat value={Util.formatInteger(C)} label={Texts.stats.concepts(C)}>
        <span class="stat-detail stat-note">{statusSummary}</span>
      </Stat>
    </>
  );
}

/**
 * Anteil der widerspruchsfreien Kombinationen (gezählt im Web Worker; bis dahin der letzte Wert).
 * Beim Kombinieren mit teilweise gefülltem Konzept: „noch 584 von 1.888“; der volle Text steht im Tooltip.
 */
function ConsistentCount() {
  useMatrix();
  const { value: ok, pending } = consistentCount(state);
  const okText = ok === undefined ? '…' : ok == null ? Texts.cons.notCountable : formatCount(ok).text;
  const left = conceptRest(activeConcept());
  const leftText = left == null ? '' : formatCount(left).text;
  const exact = ok == null ? null : formatCount(ok).title;
  const full = [Texts.cons.consistentCount(okText), leftText ? Texts.cons.restStat(leftText) : '', exact ?? '']
    .filter(Boolean).join(' · ');
  return (
    <span class="stat-detail" title={full} aria-busy={pending || undefined}>
      {left == null
        ? <span class="stat-sub">{Texts.cons.consistentShort(okText)}</span>
        : <>
          <span class="stat-rest">{Texts.cons.restShort(leftText)}</span>
          {ok === null ? null : <>{' '}<span class="stat-sub">{Texts.cons.restOf(okText)}</span></>}
        </>}
    </span>
  );
}

/**
 * Wie viele widerspruchsfreie Lösungen die Auswahl eines teilweise ausgefüllten Konzepts
 * noch zulässt (nur beim Kombinieren; sonst `null`). @param {MatrixConcept | null} c
 */
export function conceptRest(c) {
  if (!c || prefs.mode !== 'select') return null;
  const filled = state.parameters.filter(p => c.selections[p.id]).length;
  if (!filled || filled === state.parameters.length || c.id !== state.activeConceptId) return null;
  const rest = restCounts(state, c);
  return rest ? rest.total : null;
}
