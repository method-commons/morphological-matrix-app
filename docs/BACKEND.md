# Backend – Konzept

Stand: Oktober 2026 · **Konzept, noch nicht umgesetzt** · zwei Varianten · offene Entscheidungen am Ende.

Ziel: Die App bleibt öffentlich und **ohne Konto in vollem Umfang** nutzbar. Wer sich registriert,
bekommt zusätzlich: Matrizen im Backend gespeichert (auf allen Geräten verfügbar) und versioniert.

Zwei Varianten, die denselben Code für Sync und Versionen nutzen:

- **Betriebenes Backend:** Der Maintainer betreibt ein Backend für alle (Abschnitte bis „Grenzen und Risiken“).
- **Eigenes Backend:** Jede Person bzw. jedes Team bringt ein eigenes Supabase-Projekt mit und trägt
  dessen Adresse in der App ein ([Abschnitt unten](#variante-eigenes-backend)). **Empfehlung: damit beginnen.**

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

## Variante: eigenes Backend

Eine Person oder ein Team legt selbst ein Supabase-Projekt an und trägt es in der App ein. Die App bleibt
rein statisch; Daten fließen direkt vom Browser zum Projekt der Person, über die Infrastruktur des
Maintainers läuft nichts.

### Ablauf

1. Konto und Projekt bei Supabase anlegen (kostenlos möglich) – oder Supabase selbst hosten.
2. In der App unter „Eigenes Backend …“ **Projekt-URL** und **öffentlichen Schlüssel** (anon key)
   eintragen. Beide sind nicht geheim.
3. Einmalig die Tabellen einrichten (siehe unten); die App prüft das Ergebnis.
4. Im eigenen Projekt anmelden; danach Sync und Versionen wie oben beschrieben.

### Einrichtung der Tabellen

Mit dem öffentlichen Schlüssel kann die App **keine Tabellen anlegen** – das darf er absichtlich nicht.

| Weg | Wie | Bewertung |
|---|---|---|
| **a) SQL-Skript zum Kopieren** | Die App zeigt das Einrichtungsskript mit „Kopieren“; die Person führt es im SQL-Editor von Supabase aus. Danach prüft die App Tabellen, Zugriffsregeln und Schema-Version. | **empfohlen** – ein Kopiervorgang, nachvollziehbar, kein Geheimnis in der App |
| b) Service-Schlüssel eingeben | Die App bekommt einmalig den Admin-Schlüssel. | **nicht empfohlen** – umgeht alle Zugriffsregeln; Tabellen anlegen geht damit nicht einmal zuverlässig |
| c) Verwaltungs-API mit persönlichem Token | Die App ruft die Verwaltungs-API von Supabase auf. | **zu prüfen** – unklar, ob aus dem Browser erreichbar; das Token öffnet *alle* Projekte der Person |

Ein kleiner Assistent in der App führt durch die Schritte und prüft am Ende selbst, ob alles passt.

### Vorteile

- **Kein Betrieb und keine fremden Daten beim Maintainer:** Daten und Kosten liegen beim Konto der
  Person. Impressum und Datenschutz der App ändern sich voraussichtlich kaum, weil die App selbst nichts
  speichert (keine Rechtsberatung).
- **Für Teams und Firmen:** Ein Team legt *ein* Projekt an, alle tragen dieselbe URL ein – Teilen im Team
  wird später einfacher. Mit selbst gehostetem Supabase verlassen die Daten nie das eigene Netz.
- **Einladungslink fürs Team:** URL und öffentlicher Schlüssel sind nicht geheim und lassen sich als Link
  weitergeben; anmelden muss sich jede Person selbst.
- **Derselbe Code** wie beim betriebenen Backend (Sync, Versionen, Konfliktdialog) – ein später vom
  Maintainer betriebenes Backend wäre nur ein voreingestellter Eintrag.

### Nachteile und Risiken

- **Hohe Einstiegshürde:** Supabase-Konto, Projekt, Skript – eher für Teams und erfahrene Nutzer.
  Alle anderen behalten die volle App ohne Konto.
- **Updates des Backends:** Ändert eine neue App-Version Tabellen oder Regeln, muss jedes fremde
  Backend nachziehen. Nötig: Schema-Version im Backend, Prüfung beim Verbinden, Hinweis „Update-Skript
  ausführen“, ältere Backends eine Zeit lang weiter unterstützen. **Größter Daueraufwand dieser Variante.**
- **Unterstützung:** Fehler entstehen in Projekten ohne Zugriff des Maintainers – klare Fehlermeldungen
  und eine Prüfseite in der App sind Pflicht.
- **Pausierte Projekte:** Kostenlose Supabase-Projekte pausieren nach 7 Tagen ohne Nutzung. Die App
  erkennt das („Projekt pausiert – in Supabase fortsetzen“) und arbeitet so lange lokal weiter.
- **E-Mail-Versand:** Der eingebaute Versand von Supabase ist stark begrenzt; für Teams eigener
  Mail-Anbieter oder Anmeldung per Passwort.
- **Content Security Policy:** muss Verbindungen zu beliebigen HTTPS-Adressen erlauben (selbst gehostete
  Backends liegen irgendwo) – schwächt sie etwas.
- **Bundle:** Die Supabase-Bibliothek ist nicht klein; nur nachladen, wenn ein Backend eingerichtet ist.

### Stufen dieser Variante

| Stufe | Inhalt | Aufwand |
|---|---|---|
| 1 | Backend eintragen, Einrichtungsassistent mit SQL-Skript und Prüfung, Anmeldung, Sync mit Konfliktdialog | groß |
| 2 | Versionen (automatisch und benannt, Wiederherstellen), Einladungslink fürs Team | mittel |
| 3 | Update-Skripte für neue Schema-Versionen, Versionen vergleichen (Roadmap 8) | mittel |

## Offene Entscheidungen

1. **Anbieter:** Supabase (EU), PocketBase selbst gehostet oder Cloudflare? – Empfehlung: **Supabase (EU)**.
2. **Anmeldung:** Empfehlung: **Anmeldelink per E-Mail**; Passkeys und Google/GitHub später.
3. **Versionen:** Empfehlung: **automatisch (gedrosselt) und benannt**.
4. **Konflikte:** Empfehlung: **Dialog statt automatischem Zusammenführen**; keine Echtzeit-Zusammenarbeit.
5. **Ort des Backends:** Empfehlung: **dasselbe Repo, Ordner `backend/`**.
6. **Rechtliches:** Impressum und Datenschutzerklärung vor dem Freischalten – Sache des Maintainers;
   Entwürfe können vorbereitet werden.

Zur Variante „eigenes Backend“:

7. **Mit dieser Variante beginnen?** – Empfehlung: **ja**; ein betriebenes Backend erst bei Nachfrage.
8. **Einrichtung:** Empfehlung: **SQL-Skript zum Kopieren mit Prüfung durch die App**; kein Admin-Schlüssel in der App.
9. **Anbieter:** Empfehlung: **zunächst nur Supabase** (auch selbst gehostet).
10. **Einladungslink fürs Team** (URL und öffentlicher Schlüssel): Empfehlung: **ja, ab Stufe 2**.
11. **Anmeldung:** Empfehlung: **Anmeldelink per E-Mail und alternativ Passwort**, weil der eingebaute E-Mail-Versand begrenzt ist.

Nächster Schritt nach den Entscheidungen: Mockups in der echten App (Konto im Menü, Statusanzeige,
Versionen-Dialog), umsetzen erst nach „Ja“.
