Das Raster zeigt 100 € als 10 × 10 Kästchen, gefärbt nach Zweck; es ist das Erkennungszeichen des Systems.

**Verwenden** für „Von 100 € deiner Abgaben …“: einmal groß im Einstieg, höchstens einmal als Zusammenfassung weiter unten.

**Du lieferst** eine Liste von Anteilen in ganzen Euro, die zusammen genau 100 ergeben (größte Reste zuerst aufrunden), und je Anteil die Zweck-Farbe (`cat-*`). Sozialversicherung als Kästchen mit Klasse `rs-hatch`.

**Aufbau:** `<div class="rs-raster" role="img" aria-label="…">` mit 100 `<i>`. Das `aria-label` nennt alle Anteile in Worten.

**Nicht:** als Hintergrundmuster, mit mehr oder weniger als 100 Kästchen, mit Beschriftung in den Kästchen. Die Zahlen stehen daneben (Anteilsliste).
