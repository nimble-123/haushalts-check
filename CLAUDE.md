# Haushalts-Check

Statische Astro-Website (TypeScript, D3): Wohin fließt die Lohnsteuer einer Person – Bund, Land, Stadt – für alle 106 kreisfreien Städte. Live: https://haushalts-check.vercel.app. Befehle stehen in `package.json`, Aufbau und Arbeitsablauf in `CONTRIBUTING.md`.

## Quellen der Wahrheit

- **Daten** in `src/data/` erzeugt nur die Pipeline (`pipeline/*.ts`); Änderungen gehen über das Skript, nie über das JSON. Jedes Skript gleicht Summen gegen die Quelle ab und bricht sonst ab.
- **Gestaltung**: alle Farben, Schriften, Maße in `design-system/tokens.json`, danach `npm run tokens`. Regeln, Komponenten und geprüfte Farbwerte: `design-system/README.md` – vor jeder sichtbaren Änderung lesen.
- **Rechenlogik** liegt DOM-frei in `src/lib/` mit Unit-Tests; `src/scripts/` verbindet sie nur mit der Seite.

## Fallstricke

- `.env.local` enthält Zugangsdaten zur Regionaldatenbank: nur prüfen, ob Variablen gesetzt sind (`grep -c`), Inhalte nie lesen oder ausgeben.
- Node 24 führt `.ts` direkt aus (Type Stripping): nur löschbare TS-Syntax in `pipeline/` und `design-system/build-tokens.ts`, Importe mit `.ts`-Endung.
- Biome sieht in `.astro` nur den Kopfbereich; Variablen aus dem Template gelten ihm als unbenutzt – deshalb dort keine Unused-Fixes.
- `astro preview` läuft als Einzelinstanz je Projekt; ein zweiter Server braucht `--ignore-lock`.
- Diagrammfarben sind paarweise auf Farbfehlsichtigkeit geprüft (dataviz-Validator, `--pairs all`, hell und dunkel). Neue oder geänderte Farben erneut prüfen, statt nach Gefühl zu wählen.
- Stadtstaaten (Berlin, Hamburg, Bremen, Bremerhaven) stehen in der Finanzstatistik nur gemeinsam mit ihrem Land und haben keine Ausgabearten-Daten (Berlin und Hamburg: ein Haushalt; Bremen und Bremerhaven: eigene Haushalte); die Zweck-Aufteilung aller übrigen Städte ist eine gekennzeichnete Schätzung (≈).
- Ein erstes Vercel-Deployment eines neuen Projekts geht direkt in Produktion.

## Texte

Deutsch, Du-Form, kurze Sätze, normale Schreibung in Beschriftungen, Beträge deutsch formatiert (`85.000 €`). Schätzungen und vorläufige Zahlen immer als solche kennzeichnen; jede Zahl auf der Seite hat eine Quelle auf „So ist gerechnet“.

## Fertig heißt

`npm run check` und `npm run test:e2e` grün, sichtbare Änderungen hell, dunkel und in Handybreite angesehen.
