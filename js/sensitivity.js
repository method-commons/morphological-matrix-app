/*
 * Sensitivity – Stabilität der Rangfolge bei geänderten Kriteriengewichten (Ansicht „Stabilität“
 * im Konzeptvergleich, Satz im Bericht). Der Nutzwert eines Konzepts ist linear in den Anteilen
 * der Kriterien: U = Σ Anteil × Wert je Kriterium. Verschiebt man den Anteil eines Kriteriums und
 * lässt die übrigen im gleichen Verhältnis, ist jeder Nutzwert eine Gerade – die Kipppunkte sind
 * die Schnittpunkte. Verworfene Konzepte zählen für die Kipppunkte nicht. Solange Voraussetzungen
 * fehlen, zeigt die Ansicht eine Checkliste (`checklist`). Exportiert `Sensitivity`.
 */
import { Evaluation } from './evaluation.js';
import { Model } from './model.js';
import { Texts } from './texts.js';
import { Util } from './util.js';

export const Sensitivity = (() => {
  /** @typedef {Record<string, number>} Weights Gewicht je Kriterium (ID → Gewicht, beliebige Skala) */
  /** @typedef {{ concept: MatrixConcept, from: number, to: number }} Band Abschnitt (Anteil 0–1), in dem `concept` vorn liegt */
  /**
   * @typedef {object} CriterionRow
   * @property {MatrixCriterion} criterion
   * @property {number} share aktueller Anteil (0–1)
   * @property {Band[]} bands wer bei welchem Anteil vorn liegt
   * @property {{ concept: MatrixConcept, at: number } | null} below darunter liegt ein anderes Konzept vorn
   * @property {{ concept: MatrixConcept, at: number } | null} above ab hier liegt ein anderes Konzept vorn
   * @property {number} distance Abstand zum nächsten Kipppunkt (Anteil; Infinity ohne Kipppunkt)
   */

  /** Abstand unter dem ein Kipppunkt als „knapp“ gilt (10 Prozentpunkte). */
  const CLOSE = 0.1;
  const EPS = 1e-9;

  /** Konzepte, die für die Kipppunkte zählen (nicht verworfen). @param {Matrix} m */
  const candidates = m => m.concepts.filter(c => c.status !== 'dropped');

  /**
   * Bewertungsstand je Kriterium mit Gewicht: wie viele der gewählten Ausprägungen der nicht
   * verworfenen Konzepte einen Wert haben (je Konzept und Parameter gezählt).
   * @param {Matrix} m @returns {Array<{ criterion: MatrixCriterion, rated: number, total: number }>}
   */
  function ratingProgress(m) {
    const picks = candidates(m).flatMap(c => m.parameters.map(p => Model.selectedOption(p, c)).filter(o => o != null));
    return Evaluation.criterionShares(m).filter(({ share }) => share > 0).map(({ c }) => ({
      criterion: c,
      rated: picks.filter(o => /** @type {MatrixOption} */ (o).scores[c.id] != null).length,
      total: picks.length,
    }));
  }

  /**
   * Voraussetzungen der Ansicht als Checkliste (automatisch geprüft).
   * @param {Matrix} m
   * @returns {{ utility: boolean, criteria: boolean, rated: boolean, concepts: boolean, progress: ReturnType<typeof ratingProgress>, open: number }}
   */
  function checklist(m) {
    const progress = ratingProgress(m);
    const items = {
      utility: m.settings.utility,
      criteria: m.settings.criteria.length > 1,
      rated: progress.length > 0 && progress.every(x => x.total > 0 && x.rated === x.total),
      concepts: candidates(m).length > 1,
    };
    return { ...items, progress, open: Object.values(items).filter(done => !done).length };
  }

  /** Ob die Ansicht rechnet: alle Punkte der Checkliste erledigt. @param {Matrix} m */
  const available = m => checklist(m).open === 0;

  /** Gespeicherte Gewichte der Kriterien. @param {Matrix} m @returns {Weights} */
  const savedWeights = m => Object.fromEntries(m.settings.criteria.map(c => [c.id, c.weight]));

  /** Anteile aus Gewichten; sind alle 0, zählen alle gleich. @param {Matrix} m @param {Weights} w */
  function sharesOf(m, w) {
    const list = m.settings.criteria;
    const sum = list.reduce((s, c) => s + (w[c.id] ?? 0), 0);
    return Object.fromEntries(list.map(c => [c.id, sum > 0 ? (w[c.id] ?? 0) / sum : 1 / list.length]));
  }

  /**
   * Nutzwert eines Konzepts je Kriterium (so, als zählte nur dieses Kriterium); unbewertete
   * Werte und nicht gewählte Parameter zählen mit 0 – wie in Evaluation.conceptUtility.
   * @param {Matrix} m @param {MatrixConcept} c @returns {Record<string, number>}
   */
  function profile(m, c) {
    const sumW = Evaluation.totalWeight(m);
    return Object.fromEntries(m.settings.criteria.map(k => {
      if (sumW <= 0) return [k.id, 0];
      const sum = m.parameters.reduce((s, p) => {
        const o = Model.selectedOption(p, c);
        const v = o ? o.scores[k.id] : null;
        return s + (v == null ? 0 : Evaluation.weightOf(p) * Evaluation.clampScore(m, v));
      }, 0);
      return [k.id, sum / sumW];
    }));
  }

  /** @param {Record<string, number>} a @param {Record<string, number>} shares */
  const combine = (a, shares) => Object.keys(shares).reduce((s, id) => s + shares[id] * a[id], 0);

  /**
   * Rangfolge aller Konzepte bei den angegebenen Gewichten (höchster Nutzwert zuerst; bei
   * Gleichstand die Reihenfolge der Liste).
   * @param {Matrix} m @param {Weights} w @returns {Array<{ concept: MatrixConcept, value: number }>}
   */
  function ranking(m, w) {
    const shares = sharesOf(m, w);
    return m.concepts
      .map((concept, i) => ({ concept, value: combine(profile(m, concept), shares), i }))
      .sort((x, y) => y.value - x.value || x.i - y.i)
      .map(({ concept, value }) => ({ concept, value }));
  }

  /**
   * Wer bei welchem Anteil des Kriteriums `cid` vorn liegt (übrige Kriterien im gleichen
   * Verhältnis wie gespeichert). Exakt über die Schnittpunkte der Geraden.
   * @param {Matrix} m @param {string} cid @returns {Band[]}
   */
  function bands(m, cid) {
    const others = m.settings.criteria.filter(k => k.id !== cid);
    const ow = others.reduce((s, k) => s + k.weight, 0);
    const lines = candidates(m).map(concept => {
      const a = profile(m, concept);
      const b = others.reduce((s, k) => s + (ow > 0 ? k.weight / ow : 1 / others.length) * a[k.id], 0);
      return { concept, b, slope: a[cid] - b };
    });
    const at = (/** @type {typeof lines[number]} */ l, /** @type {number} */ s) => l.b + s * l.slope;
    const cuts = [0, 1];
    lines.forEach((x, i) => lines.slice(i + 1).forEach(y => {
      const d = x.slope - y.slope;
      if (Math.abs(d) < EPS) return;
      const s = (y.b - x.b) / d;
      if (s > EPS && s < 1 - EPS) cuts.push(s);
    }));
    cuts.sort((x, y) => x - y);
    /** @type {Band[]} */
    const out = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      if (cuts[i + 1] - cuts[i] < EPS) continue;
      const mid = (cuts[i] + cuts[i + 1]) / 2;
      const top = lines.reduce((best, l) => (at(l, mid) > at(best, mid) + EPS ? l : best)).concept;
      const last = out[out.length - 1];
      if (last && last.concept === top) last.to = cuts[i + 1];
      else out.push({ concept: top, from: cuts[i], to: cuts[i + 1] });
    }
    return out;
  }

  /**
   * Kipppunkte je Kriterium und das empfindlichste Kriterium.
   * @param {Matrix} m
   * @returns {{ leader: { concept: MatrixConcept, value: number }, runnerUp: { concept: MatrixConcept, value: number }, rows: CriterionRow[], sensitive: CriterionRow | null }}
   */
  function analyze(m) {
    const shares = sharesOf(m, savedWeights(m));
    const ids = new Set(candidates(m).map(c => c.id));
    const [leader, runnerUp] = ranking(m, savedWeights(m)).filter(r => ids.has(r.concept.id));
    const rows = m.settings.criteria.map(criterion => {
      const share = shares[criterion.id];
      const list = bands(m, criterion.id);
      const idx = Math.max(0, list.findIndex(b => share >= b.from - EPS && share <= b.to + EPS));
      const prev = idx > 0 ? list[idx - 1] : null;
      const next = list[idx + 1] || null;
      const below = prev ? { concept: prev.concept, at: list[idx].from } : null;
      const above = next ? { concept: next.concept, at: next.from } : null;
      const distance = Math.min(below ? share - below.at : Infinity, above ? above.at - share : Infinity);
      return { criterion, share, bands: list, below, above, distance };
    });
    const sensitive = rows.reduce((/** @type {CriterionRow | null} */ best, r) => (r.distance < (best ? best.distance : Infinity) ? r : best), null);
    return { leader, runnerUp, rows, sensitive };
  }

  /** Kipppunkte eines Kriteriums in Worten („unter 17 % liegt … vorn; ab 63 % …“). @param {CriterionRow} r */
  function rowText(r) {
    const parts = [];
    if (r.below) parts.push(Texts.stability.below(Util.formatPercent(r.below.at), Model.nameOrUnnamed(r.below.concept)));
    if (r.above) parts.push(Texts.stability.above(Util.formatPercent(r.above.at), Model.nameOrUnnamed(r.above.concept)));
    return parts.length ? parts.join('; ') : Texts.stability.rowStable;
  }

  /** Zusammenfassung in einem Satz (Ansicht und Bericht). @param {Matrix} m */
  function summary(m) {
    const { leader, runnerUp, sensitive } = analyze(m);
    const lead = Texts.stability.lead(Model.nameOrUnnamed(leader.concept), Util.formatNumber(leader.value), Util.formatNumber(runnerUp.value), Model.nameOrUnnamed(runnerUp.concept));
    if (!sensitive) return `${lead} ${Texts.stability.stable}`;
    const name = Model.criterionLabel(sensitive.criterion);
    const now = Util.formatPercent(sensitive.share);
    const tip = sensitive.below && (!sensitive.above || sensitive.share - sensitive.below.at <= sensitive.above.at - sensitive.share)
      ? Texts.stability.sensitiveBelow(name, Util.formatPercent(sensitive.below.at), now, Model.nameOrUnnamed(sensitive.below.concept))
      : Texts.stability.sensitiveAbove(name, Util.formatPercent(/** @type {NonNullable<CriterionRow['above']>} */ (sensitive.above).at), now, Model.nameOrUnnamed(/** @type {NonNullable<CriterionRow['above']>} */ (sensitive.above).concept));
    return `${lead} ${tip}`;
  }

  return { CLOSE, candidates, ratingProgress, checklist, available, savedWeights, sharesOf, profile, ranking, bands, analyze, rowText, summary };
})();
