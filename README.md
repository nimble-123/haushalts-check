<div align="center">

# Haushalts-Check

**Wohin geht deine Lohnsteuer?** Trag dein Brutto ein, wähl deine Stadt, und sieh, wie viel bei Bund, Land und Stadt ankommt und wofür sie es ausgeben.

[![CI](https://github.com/nimble-123/haushalts-check/actions/workflows/ci.yml/badge.svg)](https://github.com/nimble-123/haushalts-check/actions/workflows/ci.yml)
[![Live](https://img.shields.io/badge/live-haushalts--check.vercel.app-14161f?logo=vercel&logoColor=white)](https://haushalts-check.vercel.app)
[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-0072b2)](LICENSE)
[![Daten: DL-DE-BY 2.0](https://img.shields.io/badge/Daten-DL--DE%E2%80%93BY%202.0-009e73)](https://www.govdata.de/dl-de/by-2-0)

[![Node](https://img.shields.io/badge/Node-%E2%89%A524-5fa04e?logo=nodedotjs&logoColor=white)](.nvmrc)
[![Astro](https://img.shields.io/badge/Astro-7-bc52ee?logo=astro&logoColor=white)](https://astro.build)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](tsconfig.json)
[![Biome](https://img.shields.io/badge/Lint%20%26%20Format-Biome-60a5fa?logo=biome&logoColor=white)](biome.json)
[![Vitest](https://img.shields.io/badge/Tests-Vitest-6e9f18?logo=vitest&logoColor=white)](vitest.config.ts)
[![Playwright](https://img.shields.io/badge/E2E-Playwright-2ead33?logo=playwright&logoColor=white)](playwright.config.ts)
[![WCAG 2 AA](https://img.shields.io/badge/WCAG%202-AA%20gepr%C3%BCft%20(axe)-14161f)](tests/e2e/rente-und-mehr.spec.ts)

<img src="public/og.png" alt="Vorschau: Wohin geht dein Geld? Von 85.000 € Brutto gehen 7.260 € an den Bund, 7.260 € an dein Land und 2.562 € an deine Stadt. Daneben ein Raster aus 100 Kästchen, gefärbt nach Zweck." width="720">

</div>

## Was die Seite kann

- **Persönliche Aufteilung**: Lohnsteuer und Soli (Tarif 2026, Steuerklasse I) und Sozialabgaben, verteilt auf Bund, Land und Stadt, und dort auf die Ausgabenbereiche. Auf Wunsch mit geschätzten Konsumsteuern (Mehrwert-, Energie-, Strom- und Versicherungsteuer).
- **Alle 106 kreisfreien Städte** mit eigener Seite (`/stadt/oldenburg/`), dazu alle 16 Länder.
- **Echte Ausgaben je Stadt**: Auszahlungen nach Art je Einwohner im Vergleich zum Schnitt aller kreisfreien Städte.
- **Bundeshaushalt 2026** als Fluss oder Fläche, Entwurf 2027, Entwicklung bis 2030.
- **Rente oder ETF**: Was der Rentenbeitrag kostet und bringt, verglichen mit einem ETF-Sparplan aus demselben Geld.
- **Für Menschen gemacht**: vorbelegt mit dem Median-Bruttolohn, nächste Stadt per Standort, Eingaben bleiben im Browser, hell und dunkel, barrierearm.

## Daten und Quellen

| Ebene         | Quelle                                                                           | Stand           |
| ------------- | -------------------------------------------------------------------------------- | --------------- |
| Bund          | Haushaltsgesetz 2026, Einzelpläne (Soll)                                         | 2026            |
| Länder        | Destatis, Rechnungsergebnisse des Öffentlichen Gesamthaushalts, Tabelle 71711-12 | 2022            |
| Städte, Zweck | Durchschnitt der Gemeinden und Kreise je Land (gekennzeichnete Schätzung)        | 2022            |
| Städte, Art   | Regionaldatenbank, Rechnungsergebnisse der kommunalen Kernhaushalte, 71717-Z-05  | 2025, vorläufig |
| Städte, Lage  | Destatis, Gemeindeverzeichnis                                                    | 31.12.2025      |
| Konsumsteuern | Destatis, EVS 2018 (Alleinlebende) und Wirtschaftsrechnungen 2024; Steuersätze   | 2026, Schätzung |
| Vorbelegung   | Destatis, Median Bruttojahresverdienst Vollzeit; Durchschnittsalter              | 2025            |

Wie genau gerechnet wird, steht auf der Seite [So ist gerechnet](https://haushalts-check.vercel.app/methodik/). Für einzelne Städte gibt es amtlich keine Aufteilung nach Zweck; die Seite kennzeichnet diese Werte mit ≈.

## Schnellstart

```sh
nvm use      # Node 24
npm ci
npm run dev  # http://localhost:4321
```

| Befehl             | Zweck                                                                |
| ------------------ | -------------------------------------------------------------------- |
| `npm run check`    | Lint, Typen, Unit- und Integrationstests                             |
| `npm run test:e2e` | Playwright gegen den Produktions-Build, Desktop und Handy, inkl. axe |
| `npm run format`   | Formatieren und Importe sortieren (Biome)                            |
| `npm run build`    | Statischer Build nach `dist/`                                        |
| `npm run tokens`   | `src/styles/tokens.css` aus dem Design-System erzeugen               |
| `npm run daten:*`  | Daten neu laden: `laender`, `staedte`, `ausgabearten`, `konsum`      |

## Technik

- **[Astro](https://astro.build)** erzeugt 112 statische Seiten; die Diagramme zeichnet **D3** im Browser.
- **TypeScript** durchgängig, auch Daten-Pipeline und Konfiguration (Node 24 führt `.ts` direkt aus).
- **Design-System „Raster“** in [`design-system/`](design-system/README.md): Tokens als einzige Quelle, Komponenten mit Dokumentation, Diagrammfarben auf Farbfehlsichtigkeit geprüft.
- **Tests**: Vitest (Rechenlogik, Datenkonsistenz aller Länder und Städte, Tokens, Speicher) und Playwright mit axe.
- **Keine Drittanbieter im Browser**: Schriften und Bibliotheken werden mitgebaut, keine Cookies; Reichweite misst Vercel Web Analytics datensparsam über die eigene Domain.

Aufbau, Arbeitsablauf und Konventionen: [CONTRIBUTING.md](CONTRIBUTING.md).

## Datenschutz

Alle Berechnungen laufen im Browser; die Reichweitenmessung (Vercel Web Analytics) kommt ohne Cookies aus und erfasst keine Eingaben. Eingaben, Stadt und Theme speichert nur der Browser selbst (localStorage); „Eingaben vergessen“ löscht sie. Der Standort wird nur auf Wunsch abgefragt und nur im Browser in die nächste Stadt umgerechnet. Details in der [Datenschutzerklärung](https://haushalts-check.vercel.app/datenschutz/).

## Lizenz

Code unter [MIT](LICENSE). Die Daten stammen aus amtlichen Quellen und stehen unter deren Lizenzen, überwiegend [Datenlizenz Deutschland – Namensnennung – 2.0](https://www.govdata.de/dl-de/by-2-0). Rechenbeispiel, keine Steuer- oder Anlageberatung.
