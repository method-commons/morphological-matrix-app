/*
 * Ansicht „Stabilität“ im Konzeptvergleich: oben die Kipppunkte je Kriterium (wer liegt bei
 * welchem Gewicht vorn), darunter Gewichte zum Ausprobieren mit Live-Rangfolge. Probegewichte
 * ändern die Matrix erst mit „Gewichte übernehmen“. Solange Voraussetzungen fehlen, stehen hier
 * eine kurze Erklärung und eine Checkliste mit Knöpfen zum jeweiligen Schritt. Rechnung in
 * js/sensitivity.js.
 */
import { useState } from 'preact/hooks';
import { Model } from '../model.js';
import { Sensitivity } from '../sensitivity.js';
import { Texts } from '../texts.js';
import { Util } from '../util.js';
import { mutate, prefs, useMatrix } from './core.js';
import { addCriterion } from './criteria.jsx';
import { $, openDialog } from './dom.jsx';
import { openValueTable } from './value-table.jsx';

const openSettings = () => openDialog($('#settingsDialog'));

/** Kipppunkte je Kriterium mit Zusammenfassung. @param {{ m: Matrix }} props */
function TipPoints({ m }) {
  const { rows } = Sensitivity.analyze(m);
  const shown = [...new Map(rows.flatMap(r => r.bands.map(b => [b.concept.id, b.concept]))).values()];
  return (
    <div class="stab-tips">
      <p class="stab-sum" id="stabilitySummary">{Sensitivity.summary(m)}</p>
      {rows.map(r => {
        const name = Model.criterionLabel(r.criterion);
        const text = Sensitivity.rowText(r);
        return (
          <div class="stab-row" key={r.criterion.id}>
            <div class="stab-name"><b>{name}</b><small>{Texts.stability.now(Util.formatPercent(r.share))}</small></div>
            <div class="stab-band" role="img" aria-label={Texts.stability.bandLabel(name, text)}>
              {r.bands.map(b => (
                <span key={`${b.concept.id}-${b.from}`} class="stab-seg" style={{ width: `${(b.to - b.from) * 100}%`, background: b.concept.color }} title={Model.nameOrUnnamed(b.concept)} />
              ))}
              <span class="stab-now" style={{ left: `${r.share * 100}%` }} />
              {r.bands.slice(1).map(b => <span key={`t${b.from}`} class="stab-tip" style={{ left: `${b.from * 100}%` }}>{Util.formatPercent(b.from)}</span>)}
            </div>
            <div class="stab-text">{r.distance < Sensitivity.CLOSE ? <b class="stab-close">{Texts.stability.close} </b> : null}{text}</div>
          </div>
        );
      })}
      <div class="stab-axis"><span>{Util.formatPercent(0)}</span><span>{Util.formatPercent(0.5)}</span><span>{Util.formatPercent(1)}</span></div>
      <p class="stab-legend">
        {Texts.stability.legend}
        {shown.map(c => <span key={c.id} class="stab-key"><span class="pc-swatch" style={{ '--c': c.color }} />{Model.nameOrUnnamed(c)}</span>)}
      </p>
    </div>
  );
}

/** Gewichte ausprobieren: Schieberegler je Kriterium, Rangfolge mit Platzwechseln. @param {{ m: Matrix }} props */
function TrialWeights({ m }) {
  const [trial, setTrial] = useState(/** @type {Record<string, number> | null} */ (null));
  const saved = Sensitivity.savedWeights(m);
  const weights = { ...saved, ...(trial || {}) };
  const shares = Sensitivity.sharesOf(m, weights);
  const savedShares = Sensitivity.sharesOf(m, saved);
  const changed = m.settings.criteria.some(c => weights[c.id] !== c.weight);
  const before = Sensitivity.ranking(m, saved).map(r => r.concept.id);
  const rows = Sensitivity.ranking(m, weights).filter(r => !(prefs.compareHideDropped && r.concept.status === 'dropped'));
  const max = m.settings.utilityMax;
  const apply = () => {
    const w = weights;
    mutate(() => m.settings.criteria.forEach(c => { c.weight = w[c.id]; }));
    setTrial(null);
  };
  return (
    <div class="stab-trial">
      <div>
        <h3>{Texts.stability.trialHeading}</h3>
        <p class="stab-hint">{Texts.stability.trialHint}</p>
        {m.settings.criteria.map(c => {
          const name = Model.criterionLabel(c);
          const diff = Math.abs(shares[c.id] - savedShares[c.id]) > 1e-9;
          return (
            <label class="stab-weight" key={c.id}>
              <span>{name}</span>
              <b>{Util.formatPercent(shares[c.id])}{diff ? <small> {Texts.stability.saved(Util.formatPercent(savedShares[c.id]))}</small> : null}</b>
              <input
                type="range" class="criteria-weight" min="0" max="100" step="1" value={weights[c.id]} aria-label={Texts.stability.trialLabel(name)}
                onInput={e => { const v = Number(/** @type {HTMLInputElement} */ (e.currentTarget).value); setTrial({ ...(trial || {}), [c.id]: v }); }}
              />
            </label>
          );
        })}
        <div class="stab-actions">
          <button type="button" class="btn btn-small" id="stabilityReset" disabled={!changed} onClick={() => setTrial(null)}>{Texts.stability.reset}</button>
          <button type="button" class="btn btn-small" id="stabilityApply" disabled={!changed} onClick={apply}>{Texts.stability.apply}</button>
        </div>
      </div>
      <div>
        <h3>{Texts.stability.rankingHeading}</h3>
        <p class="stab-hint">{Texts.stability.rankingHint}</p>
        <ol class="stab-rank" id="stabilityRanking">
          {rows.map((r, i) => {
            // Platzwechsel innerhalb der angezeigten Konzepte
            const delta = before.filter(id => rows.some(x => x.concept.id === id)).indexOf(r.concept.id) - i;
            const dropped = r.concept.status === 'dropped';
            return (
              <li key={r.concept.id} class={dropped ? 'is-dropped' : undefined}>
                <span class="stab-pos">{i + 1}.</span>
                <span class="stab-concept"><span class="pc-swatch" style={{ '--c': r.concept.color }} />{Model.nameOrUnnamed(r.concept)}{dropped ? <small> {Texts.stability.dropped}</small> : null}</span>
                <span class="stab-bar"><i style={{ width: `${Math.min(100, (r.value / max) * 100)}%`, background: r.concept.color }} /></span>
                <span class="stab-value">{Util.formatNumber(r.value)}</span>
                {delta > 0 ? <span class="stab-move up" title={Texts.stability.moveLabel(delta, true)}>{Texts.stability.up(delta)}</span>
                  : delta < 0 ? <span class="stab-move down" title={Texts.stability.moveLabel(-delta, false)}>{Texts.stability.down(-delta)}</span>
                    : <span class="stab-move">–</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** Feste Vorschau (ohne echte Zahlen): Bänder in zwei Farben. */
const PREVIEW = [[0.63, 0.37], [0.54, 0.46], [0.16, 0.84]];

/** Ein Schritt der Checkliste. @param {{ done: boolean, title: string, detail: string, action?: { label: string, run: () => void } | null }} props */
function Step({ done, title, detail, action }) {
  return (
    <li class={done ? 'is-done' : undefined}>
      <span class="stab-check" aria-hidden="true">{done ? '✓' : ''}</span>
      <span>{title}<small>{detail}</small></span>
      {!done && action ? <button type="button" class="btn btn-small" onClick={action.run}>{action.label}</button> : null}
    </li>
  );
}

/** Erklärung und Checkliste, solange die Analyse noch nicht rechnen kann. @param {{ m: Matrix }} props */
function Checklist({ m }) {
  const list = Sensitivity.checklist(m);
  const t = Texts.stability.check;
  const missing = list.progress.filter(x => x.rated < x.total);
  const rated = list.progress.length && list.progress[0].total;
  const ratedDetail = !rated ? t.ratedNone
    : missing.length ? missing.map(x => t.ratedMissing(Model.criterionLabel(x.criterion), x.rated, x.total)).join(' · ')
      : t.ratedAll(rated);
  const total = m.concepts.length;
  return (
    <div class="stab-intro">
      <div>
        <h3>{Texts.stability.introHeading}</h3>
        <p>{Texts.stability.intro}</p>
        <p class="stab-hint">{Texts.stability.introHint}</p>
        <div class="stab-preview" aria-hidden="true">
          <span class="stab-preview-tag">{Texts.stability.preview}</span>
          {PREVIEW.map((parts, i) => (
            <span key={i} class="stab-preview-band">{parts.map((w, j) => <span key={j} style={{ width: `${w * 100}%` }} />)}</span>
          ))}
        </div>
      </div>
      <div>
        <p class="stab-steps">{Texts.stability.steps(list.open, 4)}</p>
        <ul class="stab-checklist" id="stabilityChecklist">
          <Step
            done={list.utility} title={t.utility} detail={list.utility ? t.utilityOn(m.settings.utilityMax) : t.utilityOff}
            action={{ label: t.openSettings, run: openSettings }}
          />
          <Step
            done={list.criteria} title={t.criteria} detail={t.criteriaNow(m.settings.criteria.length)}
            action={m.settings.utility ? { label: t.addCriterion, run: () => { openSettings(); addCriterion(); } } : null}
          />
          <Step
            done={list.rated} title={t.rated} detail={ratedDetail}
            action={m.settings.utility && rated ? { label: t.openTable, run: () => openValueTable('score') } : null}
          />
          <Step done={list.concepts} title={t.concepts} detail={t.conceptsNow(Sensitivity.candidates(m).length, total)} />
        </ul>
      </div>
    </div>
  );
}

export function Stability() {
  const m = useMatrix();
  if (!Sensitivity.available(m)) return <Checklist m={m} />;
  return (
    <div class="stab">
      <TipPoints m={m} />
      <TrialWeights m={m} />
    </div>
  );
}
