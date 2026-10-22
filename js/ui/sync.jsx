/*
 * Ablage (method-commons/sync): Bindeglied zwischen App und gemeinsamem Sync-Kern.
 * Der Kern samt Oberfläche wird erst geladen, wenn eine Ablage eingerichtet ist oder jemand
 * „Ablage …“ wählt – ohne Ablage bleibt die App wie bisher (nur der Menüeintrag ist neu).
 */
import { CONFIG_KEY, hasConfig } from '@method-commons/sync/config';
import { render as mount } from 'preact';
import { Examples } from '../examples.js';
import { Model } from '../model.js';
import { Store } from '../storage.js';
import { Texts } from '../texts.js';
import { Util } from '../util.js';
import { docId, endPreview, hasUnsavedChanges, isPreview, setPreviewEndListener, setSaveListener, showPreview } from './core.js';
import { $, closeDialog, toast } from './dom.jsx';
import { openInTab, onExternalDocChange } from './tabs.jsx';

/** Kennung der App in der Ablage = Name des Repos (zugleich Ordner). */
export const SYNC_APP = 'morphological-matrix-app';

/** @type {any} Oberfläche aus `@method-commons/sync/ui`, sobald geladen */
let ui = null;
/** @type {any} SyncController */
let controller = null;
/** @type {Promise<any> | null} */
let loading = null;
/** Nach jedem Neuzeichnen der Liste „Meine Matrizen“ aufgerufen (aus dialogs.jsx gesetzt). */
let onLibraryChange = () => {};

/** Matrix für die Ablage: Speicherschicht der App, Prüfung mit `Model.normalize`. */
const adapter = {
  app: SYNC_APP,
  schemaVersion: Model.SCHEMA_VERSION,
  list: () => Store.listDocs(),
  /** @param {string} id */
  read: id => Store.readDoc(id),
  /**
   * Stand aus der Ablage übernehmen. Abgelehnt, solange die aktive Matrix ungespeicherte Änderungen
   * hat – nach dem Speichern meldet der Kern dann einen Konflikt, statt sie zu überschreiben.
   * Sonst sofort anzeigen (geöffnete Tabs wie bei einer Änderung aus einem anderen Browser-Tab).
   * @param {string} id @param {any} data @param {number} savedAt
   */
  write: (id, data, savedAt) => {
    if (id === docId && (hasUnsavedChanges() || isPreview())) return false;
    if (!Store.writeDoc(id, data, savedAt)) return false;
    onExternalDocChange(id);
    return true;
  },
  /** @param {unknown} raw */
  normalize: raw => Model.normalize(/** @type {any} */ (raw)),
  /** @param {any} data */
  title: data => data.title || Texts.fallback.unnamedMatrix,
  /** @param {any} data */
  summary: data => Texts.sync.summary(data.parameters.length, data.concepts.length),
  /** @param {any} data @param {string} label */
  duplicate: (data, label) => ({ id: Util.uid(), data: { ...structuredClone(data), title: `${data.title || Texts.fallback.unnamedMatrix} (${label || Texts.sync.storage})` } }),
};

/** Oberfläche der Ablage (oder `null`, solange nicht geladen). */
export const syncUI = () => ui;

/** @param {() => void} fn */
export function setLibraryListener(fn) { onLibraryChange = fn; }

/** Kern und Oberfläche laden und die Ablage starten (einmalig). */
export function loadSync() {
  loading ??= (async () => {
    const [core, syncUi] = await Promise.all([import('@method-commons/sync'), import('@method-commons/sync/ui'), import('@method-commons/sync/ui/styles.css')]);
    const lang = Texts.meta.lang;
    controller = new core.SyncController({ adapter, engine: { messages: syncUi.textsFor(lang).commit } });
    ui = syncUi.createSyncUI({
      controller,
      lang,
      nouns: Texts.sync.nouns,
      currentId: () => docId,
      onOpenDoc: openDoc,
      toast,
      preselect: await pristineExamples(),
      // früherer oder geteilter Stand: nur lesend über der aktiven Matrix, ohne zu speichern
      onPreview: (/** @type {any} */ p) => { if (p) showPreview(p.data); else endPreview(); },
    });
    setPreviewEndListener(() => ui.endPreview());
    controller.onRemoteChange(() => onLibraryChange());
    controller.subscribe(() => { updateMenuHint(); onLibraryChange(); });
    mount(<ui.StatusChip />, $('#syncSlot'));
    mount(<ui.PreviewBar />, $('#previewSlot'));
    controller.start();
    return ui;
  })();
  return loading;
}

/**
 * Unveränderte Beispiele beim Einrichten nicht zum Hochladen vorauswählen.
 * @returns {Promise<(doc: { data: unknown }) => boolean>}
 */
async function pristineExamples() {
  try {
    const examples = new Set((await Examples.all()).map(def => JSON.stringify(Examples.toMatrix(def))));
    return doc => !examples.has(JSON.stringify(doc.data));
  } catch (e) {
    return () => true;
  }
}

/** Matrix öffnen (aus „Nur in der Ablage“ oder als Kopie bei „Beide behalten“). @param {string} id */
function openDoc(id) {
  const doc = Store.readDoc(id);
  if (!doc) return;
  closeDialog($('#libraryDialog'));
  openInTab(doc.id, doc.data, Texts.toast.opened(doc.data.title || Texts.fallback.unnamedMatrix));
}

/** Hinweis am Menüeintrag „Ablage …“. */
export function updateMenuHint() {
  const el = $('#storageHint');
  if (el) el.textContent = ui ? ui.menuHint() : Texts.sync.notSet;
}

/** Menü „Ablage …“: einrichten bzw. Übersicht. */
export async function openStorage() {
  (await loadSync()).openStorage();
}

/** Menü „Teilen …“: Link zum Ansehen (ohne Ablage: Hinweis zum Einrichten). */
export async function openShare() {
  (await loadSync()).openShare(docId);
}

/**
 * Link `#g=…` eines geteilten Dokuments: nur lesend zeigen – es wird nichts gespeichert, weder im Browser noch in
 * einer eingerichteten Ablage (erst „Als Kopie speichern“). Gibt `true` zurück, wenn die Adresse ein solcher Link war.
 */
export function openSharedFromHash() {
  const gist = /^#g=([0-9a-f]{8,64})$/i.exec(location.hash)?.[1];
  if (!gist) return false;
  history.replaceState(null, '', location.pathname + location.search);
  loadSync().then(ui => ui.openShared(gist));
  return true;
}

/** Menü „Versionen …“ (ohne Ablage: Hinweis zum Einrichten). */
export async function openVersions() {
  (await loadSync()).openVersions(docId);
}

/** Gespeichert (aus core.js). @param {string} id */
export function syncChanged(id) { controller?.changed(id); }

/** Gelöscht (aus „Meine Matrizen“). @param {string} id */
export function syncRemoved(id) { controller?.removed(id); }

/** Beim Start: eingerichtete Ablage laden; in einem anderen Tab eingerichtet → ebenfalls laden. */
export function initSync() {
  setSaveListener(syncChanged);
  updateMenuHint();
  if (hasConfig()) loadSync();
  window.addEventListener('storage', e => { if (e.key === CONFIG_KEY && !loading && hasConfig()) loadSync(); });
}
