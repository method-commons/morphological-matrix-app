/*
 * Scores – Nutzwert einer Ausprägung nach Kriterien, ohne Texte: gemeinsam genutzt von
 * js/evaluation.js und js/solutions.js (Lösungsraum im Web Worker). Exportiert `Scores`.
 */
export const Scores = (() => {
  /**
   * Anteil je Kriterium am Nutzwert (Summe 1); sind alle Gewichte 0, zählen alle gleich.
   * @param {{ settings: MatrixSettings }} m @returns {Array<{ c: MatrixCriterion, share: number }>}
   */
  function criterionShares(m) {
    const list = m.settings.criteria;
    const sum = list.reduce((s, c) => s + c.weight, 0);
    return list.map(c => ({ c, share: sum > 0 ? c.weight / sum : 1 / list.length }));
  }

  /** Nutzwert auf die Skala der Matrix begrenzen. @param {{ settings: MatrixSettings }} m @param {number} s */
  const clampScore = (m, s) => Math.min(m.settings.utilityMax, Math.max(0, s));

  /**
   * Nutzwert einer Ausprägung: gewichtetes Mittel ihrer Werte je Kriterium; unbewertete
   * Kriterien zählen mit 0. `value` ist `null`, solange kein Kriterium bewertet ist; `complete`,
   * wenn alle Kriterien mit Gewicht bewertet sind.
   * @param {{ settings: MatrixSettings }} m @param {{ scores: Record<string, number> }} o
   * @returns {{ value: number | null, rated: number, total: number, complete: boolean }}
   */
  function optionScore(m, o) {
    let value = 0;
    let rated = 0;
    let complete = true;
    for (const { c, share } of criterionShares(m)) {
      const s = o.scores[c.id];
      if (s == null) {
        if (share > 0) complete = false;
        continue;
      }
      rated++;
      value += share * clampScore(m, s);
    }
    return { value: rated ? value : null, rated, total: m.settings.criteria.length, complete: rated > 0 && complete };
  }

  return { criterionShares, clampScore, optionScore };
})();
