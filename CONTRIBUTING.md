# Mitmachen

Danke, dass du den Haushalts-Check verbessern willst. Diese Seite erklärt, wie du das Projekt lokal startest, wie es aufgebaut ist und was ein Pull Request mitbringen sollte.

## Einrichten

Voraussetzung ist Node.js 24 (siehe `.nvmrc`). Die Daten-Pipeline nutzt das in Node 24 eingebaute TypeScript, deshalb reicht eine ältere Version nicht.

```sh
nvm use            # oder Node 24 auf anderem Weg
npm ci
npm run dev        # http://localhost:4321
```

Für die E2E-Tests einmalig den Browser installieren:

```sh
npx playwright install chromium
```

## Aufbau

| Pfad                         | Inhalt                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/`                 | Seiten: Startseite, eine Seite je Stadt (`stadt/[slug].astro`), Rente, Städte, Methodik, Impressum, Datenschutz                     |
| `src/components/Check.astro` | Einstieg und die drei Kapitel der Hauptseite                                                                                        |
| `src/scripts/`               | Browser-Code: Diagramme (`check.ts`, `rente-seite.ts`, `viz.ts`), Übergänge (`bewegung.ts`), Speichern der Eingaben (`speicher.ts`) |
| `src/lib/`                   | Reine Rechenlogik ohne DOM: Lohnsteuer und Sozialabgaben, Rente vs. ETF, nächste Stadt                                              |
| `src/data/`                  | Haushaltsdaten als JSON und TypeScript; **erzeugt** von der Pipeline, nicht von Hand ändern                                         |
| `design-system/`             | Design-System „Raster“: `tokens.json` (einzige Quelle aller Farben und Maße), Komponenten-CSS, Doku je Komponente                   |
| `pipeline/`                  | Skripte, die die amtlichen Daten laden und nach `src/data/` schreiben                                                               |
| `tests/`                     | Integrationstests (`integration/`) und E2E-Tests (`e2e/`); Unit-Tests liegen neben dem Code                                         |

## Arbeitsablauf

1. Branch von `main` anlegen.
2. Ändern, dabei `npm run dev` offen lassen.
3. Vor dem Commit:

   ```sh
   npm run format     # Biome formatiert und sortiert Importe
   npm run check      # Lint, Typen, Unit- und Integrationstests
   npm run test:e2e   # Playwright gegen den Produktions-Build (Desktop und Handy)
   ```
4. Pull Request mit ausgefüllter Vorlage. Die CI führt dieselben Prüfungen aus.

Commit-Nachrichten folgen [Conventional Commits](https://www.conventionalcommits.org/de/v1.0.0/): Typ auf Englisch, optional ein Bereich, Beschreibung auf Deutsch, darunter bei Bedarf eine Liste der Änderungen.

```text
feat(stadt): Ausgabearten je Einwohner im Vergleich
fix(sankey): besserer Kontrast für Grautöne
docs: Datenquellen in der README ergänzt
```

Typen: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `build`, `ci`, `chore`, `revert`. `npm install` richtet über [lefthook](https://lefthook.dev) zwei Git-Hooks ein: `commit-msg` prüft die Nachricht mit commitlint, `pre-commit` formatiert die gestagten Dateien mit Biome. Die CI prüft die Commits eines Pull Requests noch einmal. Gemergt wird per Squash oder Rebase, der PR-Titel folgt daher demselben Format.

## Daten aktualisieren

Die Daten in `src/data/` entstehen ausschließlich über die Pipeline. Rohdateien landen in `pipeline/quellen/` (nicht im Repository).

```sh
npm run daten:laender        # Länder und Gemeinde-Schätzbasis (Destatis 71711-12)
npm run daten:staedte        # Stammliste und Koordinaten der kreisfreien Städte (Gemeindeverzeichnis)
npm run daten:ausgabearten   # Ausgabearten je Stadt (Regionaldatenbank 71717-Z-05)
npm run daten:konsum         # Konsumsteuer-Schätzung (EVS 2018, Wirtschaftsrechnungen 2024, Steuersätze)
```

`daten:ausgabearten` braucht ein kostenloses Konto bei [regionalstatistik.de](https://www.regionalstatistik.de). Kopiere `.env.example` nach `.env.local` und trage die Zugangsdaten ein; die Datei ist von Git ausgeschlossen. Der Abruf läuft als Hintergrund-Auftrag und dauert einige Minuten.

Jedes Skript prüft seine Summen gegen die Quelle und bricht bei Abweichungen ab. Nach einem Datenlauf: Tests laufen lassen, Jahr und Quelle auf der Methodik-Seite kontrollieren, im PR die Änderung der Daten kurz begründen.

## Design-System

Farben, Schriften, Abstände und Radien stehen nur in `design-system/tokens.json`. Nach einer Änderung:

```sh
npm run tokens   # erzeugt src/styles/tokens.css
```

Ein Test schlägt fehl, wenn `tokens.css` nicht zur JSON passt. Diagrammfarben müssen paarweise für Farbfehlsichtigkeit unterscheidbar bleiben; Regeln und geprüfte Werte stehen in `design-system/README.md`. Neue Bausteine bekommen einen Ordner unter `design-system/components/` mit `README.md` und `preview.html` und ihr CSS in `bundle.css`.

## Konventionen

- **TypeScript überall**, auch in Pipeline und Konfiguration. `tsc --noEmit` muss ohne Fehler durchlaufen.
- **Biome** formatiert (2 Leerzeichen, einfache Anführungszeichen, Zeilenbreite 120) und lintet nach dem empfohlenen Regelsatz. Bewusste Ausnahmen in `biome.json`:
  - `noNonNullAssertion` aus: `!` steht bei uns nur nach einer expliziten Prüfung.
  - `noDescendingSpecificity` aus: Komponenten-CSS mit `rs-`-Präfix trifft nie dieselben Elemente; die Regel meldet dort nur Rauschen.
  - In `.astro`-Dateien keine Prüfung auf unbenutzte Variablen und Importe, weil Biome die Nutzung im Template nicht sieht.
- **Rechnen ohne DOM**: Logik gehört nach `src/lib/` und bekommt Unit-Tests; `src/scripts/` verbindet sie nur mit der Seite.
- **Texte auf Deutsch**, Du-Form, keine Versalien in Beschriftungen, Beträge deutsch formatiert (`85.000 €`).
- **Barrierefreiheit**: Jedes Diagramm hat ein `aria-label` und eine Tabelle oder Liste mit denselben Werten; Bedienelemente sind mindestens 44px hoch; die E2E-Tests prüfen WCAG 2 AA mit axe.
- **Keine Drittanbieter** im Browser: Schriften und Bibliotheken werden mitgebaut. Einzige Messung ist Vercel Web Analytics (cookielos, nur im Build auf Vercel aktiv, siehe `Base.astro`); weitere Dienste nur mit Eintrag in der Datenschutzerklärung.

## Fehler melden

Über die Issue-Vorlagen „Fehler melden“ oder „Idee oder Wunsch“. Sicherheitsprobleme bitte nicht öffentlich melden, sondern per E-Mail an die Adresse im Impressum.
