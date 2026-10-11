/*
 * Limits – Regeln der Grenzen eigener Merkmale, ohne Texte: gemeinsam genutzt von
 * js/attributes.js (Warnung in Vergleich, Zusammenfassung, Bericht) und js/solutions.js
 * (Filter im Lösungsraum, läuft im Web Worker). Exportiert den Namensraum `Limits`.
 */
export const Limits = (() => {
  /**
   * Grenze an einer Stufe („ab Stufe“ bzw. „unter Stufe“)?
   * @param {AttributeLimit | null | undefined} l @returns {l is LevelLimit}
   */
  const isLevel = l => !!l && (l.op === 'level' || l.op === 'levelBelow');

  /**
   * Liegt die Stufe mit Index `k` jenseits der Grenzstufe mit Index `at`?
   * @param {LevelLimit} l @param {number} k @param {number} at
   */
  const levelBeyond = (l, k, at) => at >= 0 && (l.op === 'levelBelow' ? k < at : k >= at);

  /** Liegt ein Zahlenwert jenseits der Grenze („über“ bzw. „unter“)? @param {AttributeLimit} l @param {number} v */
  const numberBeyond = (l, v) => (l.op === 'above' ? v > l.value : l.op === 'below' ? v < l.value : false);

  return { isLevel, levelBeyond, numberBeyond };
})();
