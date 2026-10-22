# Mockups – Teilen aus einem öffentlichen Repo

Entwürfe für das Teilen **ohne Gist**, wenn das Repo der Ablage öffentlich ist – etwa bei Organisationen, die
ihre Ergebnisse ohnehin offen ablegen. Grundlage:
[method-commons/sync – KONZEPT.md, „Entwurf: Teilen aus einem öffentlichen Repo“](https://github.com/method-commons/sync/blob/main/docs/KONZEPT.md).
Ergänzt das umgesetzte [Teilen zum Ansehen über geheime Gists](../teilen/README.md); für private Repos bleibt es dabei.

Die Bilder sind **Screenshots der echten App mit eingerichteter Ablage** (GitHub-API nachgebildet) und
eingeblendetem Entwurf (gekennzeichnet mit „Entwurf“ bzw. gelb gestrichelt). Matrix: Beispiel „Kaffeemaschine“;
Namen, Zeiten und Links sind erfunden. Freigegeben mit den Entscheidungen wie empfohlen (unten); umgesetzt mit kleinen Abweichungen
(Empfänger-Leiste ohne Namen des festen Stands, Hinweis „Teilen beenden“ kürzer).

| # | Ansicht | Datei |
|---|---------|-------|
| 1 | **Teilen, öffentliches Repo**: Link sofort da (kein „Link erstellen“, kein Gist), Wahl „aktueller“ oder „fester Stand“, Hinweis, dass es kein „Teilen beenden“ gibt. | `o1-teilen.png` |
| 2 | **Festen Stand teilen**: benannten Stand wählen; der Link enthält den Commit und ändert sich nicht. | `o2-fester-stand.png` |
| 3 | **Versionen**: „Link kopieren“ an jedem benannten Stand. | `o3-versionen.png` |
| 4 | **Empfänger, aktueller Stand**: wie beim Gist, zusätzlich Herkunft (Repo mit Link auf GitHub). | `o4-empfaenger.png` |
| 5 | **Empfänger, fester Stand**: kein „Aktualisieren“, dafür „Aktuellen Stand öffnen“. | `o5-empfaenger-fest.png` |
| 6 | **Privates Repo einer Organisation**: Hinweis vorab, dass ein Token der Organisation keine Gists kann. | `o6-organisation-privat.png` |
| 7 | **Teilen auf dem Telefon**. | `o7-telefon.png` |

Bilder neu erzeugen: `npx vite build && npx vite preview &`, dann `node docs/mockups/teilen-oeffentlich/aufnehmen.mjs`.

## Verhalten (Vorschlag)

- **Erkennen:** „Teilen …“ fragt GitHub nach dem Repo (`GET /repos/{owner}/{repo}`: `private`, `owner.type`). Öffentlich →
  dieser Dialog; privat → Gist wie bisher (bei einer Organisation mit Hinweis vorab, Bild 6).
- **Link:** `…/#p=<besitzer>/<repo>/<id>` (aktueller Stand) bzw. `…/#p=<besitzer>/<repo>/<id>@<commit>` (fester Stand).
  Die App ergänzt den Pfad `<app>/<id>.json` selbst; ein Link aus einer anderen App wird wie beim Gist abgelehnt.
- **Empfänger:** liest die Datei **ohne Anmeldung** und zeigt sie nur lesend – dieselbe Ansicht wie beim Gist.
  **Nichts wird gespeichert**, auch nicht in einer eingerichteten Ablage; erst „Als Kopie speichern“ legt ein Dokument an.
- **Kein „Teilen beenden“:** Im öffentlichen Repo ist ohnehin alles lesbar. Der Link endet, wenn das Dokument gelöscht
  oder das Repo privat geschaltet wird. Kein Eintrag `share` im Repo, kein Kennzeichen „geteilt“ (es gibt nichts zu verwalten).

## Technik (GitHub)

| Aufgabe | Adresse | Anmeldung | Grenzen |
|---|---|---|---|
| Sichtbarkeit prüfen | `GET api.github.com/repos/{owner}/{repo}` | Token der Ablage | – |
| Lesen, aktueller Stand | `GET raw.githubusercontent.com/{owner}/{repo}/HEAD/<app>/<id>.json` | keine | bis zu 5 Min. zwischengespeichert (`max-age=300`), CORS offen |
| Lesen, fester Stand | `GET raw.githubusercontent.com/{owner}/{repo}/<commit>/<app>/<id>.json` | keine | unveränderlich |
| Ersatz, falls `raw` scheitert | `GET api.github.com/repos/{owner}/{repo}/contents/<app>/<id>.json?ref=…` | keine | 60 Abrufe je Stunde und Netzwerk |

Geprüft: `raw.githubusercontent.com` antwortet mit `access-control-allow-origin: *` und `cache-control: max-age=300`.

## Entscheidungen (getroffen wie empfohlen)

1. **Öffentliches Repo: Link direkt, ohne Gist?** – Empfehlung: **ja** (kein zusätzliches Recht, kein zweiter Speicherort).
2. **Fester Stand** (benannte Version) zusätzlich zum aktuellen? – Empfehlung: **ja**, im Teilen-Dialog und als „Link kopieren“ in „Versionen …“.
3. **Lesen über `raw`** (bis 5 Min. verzögert), API nur als Ersatz? – Empfehlung: **ja** (keine Abruf-Grenze für viele Betrachtende).
4. **Private Repos einer Organisation:** nur Hinweis vorab (Bild 6), kein zweites Token? – Empfehlung: **nur Hinweis**; ein zweites Token später, falls gebraucht.
5. **Gist trotz öffentlichem Repo** anbieten (z. B. damit „Teilen beenden“ möglich ist)? – Empfehlung: **nein** – im öffentlichen Repo schützt das Beenden nichts.
6. **Wechsel der Sichtbarkeit:** Ein vorhandenes Gist bleibt, wenn das Repo öffentlich wird (beenden über „Teilen …“); wird ein Repo privat, enden `#p=`-Links – Empfehlung: **so lassen**, im Dialog erklären.

Umgesetzt im Kern `0.5.0` (`fetchPublic`, `sharedLink`, Weiche im Teilen-Dialog, „Link kopieren“ in „Versionen …“) und in allen fünf Apps (`#p=` neben `#g=`, E2E `share-public.spec.js`).
