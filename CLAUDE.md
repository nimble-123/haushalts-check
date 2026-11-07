# Bundeshaushalt & mein Anteil – Projektnotizen

Export aus einem Claude-Chat (Stand 07.11.2026). Die Online-Fassungen liegen als Artefakte in Nils' Claude-Konto:

- Interaktive Seite „Bundeshaushalt 2026 – mein Anteil“: https://claude.ai/artifact/4T9qgJgw12V7SB8hq967Zv
- Design-Canvas (Infografik, Poster A0/XXL, Rente vs. ETF): https://claude.ai/artifact/MRvoazN8trvmo9GazN7XVR

Die Dateien hier sind Kopien. Änderungen landen erst online, wenn die geänderte Datei wieder in einem Claude-Chat mit dem Artefakt-Link veröffentlicht wird.

## Struktur

- `haushalt/index.html` – eigenständige Seite (HTML, CSS, JS in einer Datei). D3 v7 und d3-sankey kommen per CDN (jsdelivr). Ansehen: Datei im Browser öffnen oder `npx serve haushalt`.
  - Abschnitt 11 = Rente vs. ETF mit Lebensverlaufs-Modus (`rvModel()`, Eingaben `c_a0`, `c_s0`, `c_s1`, `c_ap`, `c_g` …; Presets `aka`/`med`).
- `design/` – Boards des Design-Canvas: `canvas.json` (Board-Positionen) und je Board eine `*.dc.html`-Datei (Design Components: `x-dc`, `helmet`, `sc-for`, `data-props`). Diese Dateien rendert nur der Design-Canvas von Claude; lokal sind sie Quelltext zum Bearbeiten, keine fertige Vorschau.
- `modelle/` – Rechenmodelle:
  - `m.js`, `m2.js`, `life.js` – Rente vs. ETF (7 % nominal, TER 0,2 %, Inflation 2 %, Abgeltungsteuer mit 30 % Teilfreistellung, Vorabpauschale; Rentenwert 42,52 €, BBG RV 101.400 €).
  - `career.py` – Karriere- und Gehaltspfade 2026–2053 (Tarif K/L, Fachkarriere, Führung) für das Dokument „Karriere- und Gehaltsplan“.

## Steuer- und SV-Werte 2026 (für Rechnungen)

ESt-Tarif § 32a (Grundfreibetrag 12.348 €), Soli-Freigrenze 20.350 €; RV 18,6 %, ALV 2,6 %, KV 14,6 % + Ø 2,9 %, PV 3,6 % (+0,6 kinderlos); BBG RV/ALV 101.400 €, KV/PV 69.750 €; Durchschnittsentgelt 51.944 €.
