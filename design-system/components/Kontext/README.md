Der Kontext ordnet eine Grafik mit einem Befund aus einer Studie ein, mit Fundstelle.

**Verwenden** unter einer Grafik oder einem Absatz, wenn eine Studie eine Zahl der Seite einordnet (ifo, DIW, Bundesbank). Ein Satz, höchstens zwei; der Vorbehalt steht im selben Absatz.

**Du lieferst** `<p class="rs-kontext">Satz. Vorbehalt. <cite><a href="…">Quelle</a></cite></p>`; in Astro über `<Kontext studie={STUDIEN.…} />` aus `src/data/studien.ts`.

**Nicht** für eigene Berechnungen (dafür Unterzeile oder „So ist gerechnet“) und nicht als Warnung.
