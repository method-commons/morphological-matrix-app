# CLAUDE.md – Hinweise für Claude Code

Morphologische Matrix (Zwicky-Box) als Web-App ohne Server: Vite 8, Preact 10 + @preact/signals,
Daten nur im Browser (localStorage), veröffentlicht über GitHub Pages. Aufbau, Funktionen und die
Tabelle aller Module stehen in der [README](README.md), das Datenformat in
[docs/DATENFORMAT.md](docs/DATENFORMAT.md), Stand und offene Ideen in [docs/ROADMAP.md](docs/ROADMAP.md).

## Zusammenarbeit (Vereinbarungen mit dem Maintainer)

- **Sprache:** Antworten, Code-Kommentare, Commit-Nachrichten und PR-Texte auf **Deutsch**; knapp und ehrlich (auch über Grenzen und Risiken).
- **Erst zeigen, dann bauen:** Bei neuen Funktionen auf Wunsch zuerst Mockups (Screenshots der echten App mit eingeblendetem Entwurf, Zahlen aus einem Beispiel), umsetzen erst nach „Ja“. Offene Entscheidungen als kurze nummerierte Liste mit Empfehlung.
- **Pull Requests nur auf Nachfrage** („Soll ich einen Pull Request erstellen?“ → „Ja“). Gemergt wird vom Maintainer selbst. Danach den Arbeitsbranch auf `origin/main` zurücksetzen (`git checkout -B <branch> origin/main`, Push mit `--force-with-lease`); nie auf bereits gemergter Historie weiterbauen.
- **Fertig heißt:** `npm test` grün (Lint, Typprüfung, Unit, Build, E2E), README/DATENFORMAT aktualisiert, Commit und Push, Bericht mit Screenshots.
- Keine Modellbezeichnungen in Commits, PRs oder Code.

## Befehle

```sh
npm test                       # alles: Lint, Typprüfung, Unit, Build, E2E (ca. 2 min)
npx eslint js tests            # Lint
npx tsc --noEmit -p jsconfig.json && node scripts/typecheck-logic.js   # Typprüfung (js/*.js zusätzlich mit noImplicitAny)
npx vitest run [datei]         # Unit-Tests (tests/unit/)
npx vite build && npx playwright test [datei]   # E2E gegen den Build (vite preview, Port 4173)
```

E2E-Tests laufen gegen `dist/` – nach Codeänderungen vorher bauen. Ist Port 4173 nicht erreichbar: `npx vite preview &`.
Chromium ist vorinstalliert; kein `playwright install`.

## Architektur in Kürze

- **Logik ohne DOM** in `js/*.js` (Namensräume `Model`, `Ops`, `Evaluation`, `Consistency`, `Attributes`, `Solutions`, `IO`, `Report` …), Oberfläche in `js/ui/*.jsx`.
- **Zustand:** `state` in `js/ui/core.js` ist ein normales Objekt; neu gezeichnet wird über das Signal `revision` (`render()`), Komponenten lesen es mit `useMatrix()`. Das Neuzeichnen ist synchron (`options.debounceRendering = cb => cb()` in `main.js`).
- **Änderungen:** strukturell mit `mutate(fn)` (Verlaufseintrag, Speichern, Neuzeichnen); Eingabefelder mit `{...fieldProps(apply)}` (Verlaufseintrag beim Verlassen).
- **Web Worker:** `count-worker.js` (Zählung, Restzahlen) und `solutions-worker.js` (Lösungsraum) importieren nur texte-freie Module (`counting.js`, `solutions.js`, `limits.js`), damit sie klein bleiben.
- **Texte** nur in `js/i18n/de.js` (maßgeblich) und `en.js` (gleiche Struktur, wird geprüft). Statische Texte in `index.html` über `data-i18n`.
- **CSS** in `css/*.css`, eingebunden in `styles.css` mit Kaskaden-Ebenen; die Import-Reihenfolge ist die Reihenfolge innerhalb einer Ebene.

## Datenformat

- Aktuell **Version 7** (`Model.SCHEMA_VERSION`). Bei inkompatiblen Erweiterungen Version erhöhen, in `MIGRATIONS[n]` (Rohdaten → Rohdaten) umwandeln, `Model.normalize` ergänzen, `docs/DATENFORMAT.md` (Beispiel, Regeln, Versionstabelle) und alle `examples/*.json` (Feld `version`) anpassen.
- Beispiele müssen exakt der Ausgabe von `normalize` entsprechen (Test `examples.test.js`); optionale Felder dürfen fehlen, der Test ergänzt sie (`withEmptyNotes`).
- Beispiel-JSON **textuell** bearbeiten (z. B. per Regex), nicht mit `json.dumps` neu formatieren – das kompakte Layout geht sonst verloren.

## Bekannte Fallstricke

- **Auswahlfelder und `mutate`:** `mutate` erhöht `revision` *vor* der Änderung; das synchrone Neuzeichnen setzt ein kontrolliertes `<select>` zurück. Den Wert daher **vor** `mutate` lesen: `const v = e.currentTarget.value; mutate(() => { … v … })`.
- **Globale SVG-Regel** (`svg { width: 18px; height: 18px }`): Diagramme brauchen `width`/`height` zusätzlich als Inline-Style.
- **CSS-Spezifität zwischen Dateien:** Eine spätere Datei in derselben Ebene überschreibt; breite Dialoge daher mit `.dialog.xyz` selektieren.
- **Zahlen in Tests:** `Intl` setzt ein geschütztes Leerzeichen vor `€` bzw. „Mio.“ – in regulären Ausdrücken `\s` oder ` ` verwenden.
- **Programmatisch fokussierte Felder** mit `select()` markieren (`selectField` in `js/ui/fields.jsx`), sonst hängt Tippen an statt zu ersetzen.
- **Popover und Bildlauf:** Popover schließen bei Bildlauf; beim eigenen `scrollIntoView` eine kurze Schonfrist (`keepOpenUntil`) setzen.
- **Neue Beispiel-Inhalte** (z. B. Merkmale im Beispiel „Kaffeemaschine“) verändern CSV-Spalten, Sortieroptionen und Vergleichszeilen – bestehende E2E-Tests entsprechend prüfen.

## Veröffentlichung

CI (`.github/workflows/ci.yml`) führt dieselben Schritte wie `npm test` aus und veröffentlicht auf `main`
danach – nur wenn alles grün ist – auf GitHub Pages. Dependabot schlägt wöchentlich Updates vor; Playwright
bleibt auf der Version des vorinstallierten Chromium (1.56.1) und wird nur von Hand angehoben. Die öffentliche URL steht in der README und im Skill „morphologische-matrix“
des Maintainers (Teilen-Links `…/#m=…`); die App selbst nutzt nur relative Pfade (`base: './'`).
Bei einem Umzug des Repos ändert sich die Pages-URL ohne Weiterleitung – README und Skill anpassen;
gespeicherte Matrizen hängen am Browser-Ursprung und lassen sich nur per Backup übertragen.
