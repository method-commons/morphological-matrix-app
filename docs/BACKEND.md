# Backend – Konzept

Stand: Oktober 2026 · **Konzept, noch nicht umgesetzt** · offene Entscheidungen am Ende.

Ziel: Die App bleibt öffentlich und **ohne Konto in vollem Umfang** nutzbar. Wer sich registriert,
bekommt zusätzlich: Matrizen im Backend gespeichert (auf allen Geräten verfügbar) und versioniert.

## Grundprinzip: lokal zuerst

- Die App bleibt statisch auf GitHub Pages. Ohne Konto ändert sich nichts: Speichern im Browser,
  Teilen-Links, Backup.
- Mit Konto ist die lokale Kopie weiterhin die **Arbeitskopie** (schnell, offline nutzbar); eine
  Sync-Schicht gleicht im Hintergrund mit dem Backend ab.
- Anknüpfungspunkt ist `js/storage.js`: Jede Matrix ist dort schon ein eigenes Dokument mit `savedAt`
  (`readDoc`, `writeDoc`, `listDocs`). Die Sync-Schicht setzt bei `writeDoc` an; die übrige App merkt
  davon nichts.
- Teilen-Links (`#m=…`) bleiben serverlos: Der Teil hinter `#` wird nie an einen Server gesendet.

## Backend-Optionen

| | **A: Supabase (EU, Frankfurt)** | **B: PocketBase, selbst gehostet** | **C: Cloudflare Workers + D1** |
|---|---|---|---|
| Was | Postgres, Anmeldung und Zugriffsregeln als Dienst | ein Programm (SQLite) auf eigenem Server, z. B. Hetzner | Serverfunktionen und Datenbank als Dienst |
| Eigener Servercode | fast keiner (SQL, Zugriffsregeln) | keiner | Anmeldung und API selbst schreiben |
| Betrieb | kaum | Updates, Backups, TLS selbst | kaum |
| Datenschutz | EU-Rechenzentrum, Vertrag zur Auftragsverarbeitung; US-Anbieter | volle Kontrolle | US-Anbieter, EU-Speicherort nur begrenzt wählbar |
| Kosten | kostenlos zum Start (pausiert nach 7 Tagen ohne Nutzung), sonst ca. 25 $/Monat | ca. 5 €/Monat (Server) | meist kostenlos |

**Empfehlung: A** – am wenigsten Betrieb für einen einzelnen Maintainer. Ist Datenhoheit wichtiger
als Bequemlichkeit: B. Ein späterer Wechsel bleibt machbar, weil die App nur über eine dünne
Schicht mit dem Backend spricht und das Datenformat selbst prüft.

## Datenmodell

- `documents`: `id`, Besitzer, Titel, aktuelle Versionsnummer (`head`), `updated_at`, `deleted_at`
- `versions`: `document_id`, laufende Nummer, `created_at`, Schema-Version, die Matrix als JSON,
  optional ein Name („vor Workshop“), Gerät

Der Server **versteht das Datenformat nicht**: Er speichert das JSON und prüft nur Größe und
Gültigkeit. Die Prüfung mit `Model.normalize` bleibt im Browser – die Logik gibt es nicht doppelt.

## Versionierung

- **Vollständige Kopien statt Unterschieden:** Eine Matrix ist klein (Beispiele 7–15 kB, gezippt
  etwa 3 kB). Unterschiede zwischen zwei Ständen berechnet bei Bedarf der Browser.
- **Wann eine Version entsteht** (nicht bei jedem Speichern, sonst bei jedem Tastendruck):
  - automatisch: höchstens alle paar Minuten bei Aktivität, außerdem vor Import oder Zurücksetzen,
  - benannt: über „Stand speichern“ – zugleich Roadmap-Punkt 8 („Stände festhalten“).
- **Ausdünnen:** automatische Versionen z. B. die letzten 50, danach eine je Tag; benannte bleiben immer.
- **Wiederherstellen** legt eine neue Version an – nichts geht verloren.

## Synchronisierung und Konflikte

- Nach dem Speichern schiebt die App die Änderung nach wenigen Sekunden (gebündelt) an den Server,
  mit der Versionsnummer, auf der sie beruht (optimistische Sperre).
- Hat ein anderes Gerät inzwischen eine neuere Version gespeichert, ist das ein **Konflikt**: Die App
  fragt nach – „Meine behalten“, „Server übernehmen“, „Beide behalten“. Kein automatisches
  Zusammenführen.
- Erstes Anmelden: Die App bietet an, vorhandene lokale Matrizen hochzuladen (je Matrix wählbar).
- Neues Gerät: Liste der Matrizen im Konto, Herunterladen beim Öffnen.
- **Nicht enthalten:** gleichzeitiges Bearbeiten durch mehrere Personen in Echtzeit. Das bräuchte
  ein eigenes Verfahren (CRDT, z. B. Yjs) und wäre ein eigenes Großprojekt.
- Besonders zu testen: offline, mehrere Tabs desselben Browsers (die App arbeitet heute mit
  unabhängigen Tabs), Abmelden mit ungesendeten Änderungen.

## Anmeldung

- **Anmeldelink per E-Mail** statt Passwort – nichts, was vergessen oder wiederverwendet werden kann.
- Später ergänzbar: Passkeys, Anmeldung über Google oder GitHub.
- Für den E-Mail-Versand braucht es einen Anbieter (SMTP).

## Oberfläche

- Menü „Datei“: „Anmelden“ bzw. „Konto“ (Abmelden, Konto löschen, alle Daten exportieren) und
  „Versionen …“.
- Statusanzeige: „in der Cloud gespeichert ✓“, „offline“, „Konflikt“.
- Dialog **Versionen**: Liste mit Namen und Zeitpunkt, „Stand speichern“, „Wiederherstellen“,
  später „Vergleichen“.
- Ohne Konto bleiben alle Menüpunkte wie heute; „Anmelden“ ist der einzige neue Eintrag.

## Sicherheit

- **Zugriffsregeln in der Datenbank** (bei Supabase: Row Level Security): Jede Person sieht nur ihre
  eigenen Dokumente und Versionen.
- **Grenzen gegen Missbrauch:** z. B. 1 MB je Matrix, 200 Matrizen je Konto, Begrenzung der Anfragen.
- **Zugriff aus dem Browser** nur von der Pages-Adresse und `localhost` (CORS); Content Security
  Policy um die Backend-Adresse ergänzen.
- Der öffentliche Schlüssel des Backends darf im Build stehen – die Zugriffsregeln schützen die Daten.

## Recht (keine Rechtsberatung)

Bisher speichert die App keine Daten auf einem Server; mit Konten ändert sich das grundlegend.
Voraussichtlich nötig, **bevor** Konten freigeschaltet werden:

- Impressum und Datenschutzerklärung,
- Vertrag zur Auftragsverarbeitung mit dem Anbieter,
- Konto löschen samt aller Daten,
- Export aller Daten (das vorhandene Backup lässt sich dafür nutzen).

Das Anmelde-Token im Browser ist technisch notwendig; ein Cookie-Banner sollte dafür nicht nötig sein.

## Repo, Konfiguration und Tests

- Datenbank-Migrationen und Zugriffsregeln im selben Repo unter `backend/`.
- Adresse und öffentlicher Schlüssel des Backends als Build-Konfiguration (Vite-Umgebungsvariablen);
  ohne Konfiguration baut die App wie heute, ganz ohne Konto-Funktionen.
- Die Sync-Logik bekommt einen austauschbaren Speicher, damit Unit-Tests ohne Server laufen.
- E2E-Tests gegen ein lokales Backend (Supabase lässt sich lokal in Docker starten) oder einen
  Test-Server; in der CI ebenso.

## Stufen

| Stufe | Inhalt | Aufwand |
|---|---|---|
| 1 | Konto, Matrizen speichern und laden, Sync mit Konfliktdialog, Konto löschen | groß |
| 2 | Versionen: automatisch und benannt, Liste, Wiederherstellen | mittel |
| 3 | Versionen vergleichen (Roadmap 8) | mittel |
| 4 | optional: Matrizen mit anderen Konten teilen, Abstimmen im Team (Roadmap 10) | groß |

## Grenzen und Risiken

- **Größte Änderung seit Projektbeginn:** Aus „ohne Server, keine Daten bei uns“ wird ein Dienst mit
  personenbezogenen Daten und dauerhafter Verantwortung für Betrieb, Sicherheit und Datenschutz.
- **Komplexität durch Sync und Konflikte**, besonders offline und mit mehreren Tabs.
- **Abhängigkeit vom Anbieter** – gemildert durch die dünne Schicht und das unverstandene JSON.
- „Geräteübergreifendes Arbeiten / Synchronisation“ war zuvor zurückgestellt; dieses Konzept nimmt
  das Thema wieder auf (siehe [ROADMAP.md](ROADMAP.md)).

## Offene Entscheidungen

1. **Anbieter:** Supabase (EU), PocketBase selbst gehostet oder Cloudflare? – Empfehlung: **Supabase (EU)**.
2. **Anmeldung:** Empfehlung: **Anmeldelink per E-Mail**; Passkeys und Google/GitHub später.
3. **Versionen:** Empfehlung: **automatisch (gedrosselt) und benannt**.
4. **Konflikte:** Empfehlung: **Dialog statt automatischem Zusammenführen**; keine Echtzeit-Zusammenarbeit.
5. **Ort des Backends:** Empfehlung: **dasselbe Repo, Ordner `backend/`**.
6. **Rechtliches:** Impressum und Datenschutzerklärung vor dem Freischalten – Sache des Maintainers;
   Entwürfe können vorbereitet werden.

Nächster Schritt nach den Entscheidungen: Mockups in der echten App (Konto im Menü, Statusanzeige,
Versionen-Dialog), umsetzen erst nach „Ja“.
