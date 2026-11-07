Raster ist das Design-System des Haushalts-Checks: einer Seite, die zeigt, wohin Lohnsteuer und Sozialabgaben einer Person fließen, an Bund, Land und Stadt. Die Grundeinheit ist das Kästchen für 1 €. Alles, was gezeigt wird, ist ein Anteil.

## Grundsätze

- **Ein Kästchen ist ein Euro.** Das Raster (10 × 10 = 100 €) ist das Erkennungszeichen. Es steht groß im Einstieg und als Zusammenfassung „Von 100 € deiner Abgaben“. Es wird nicht als Dekoration verwendet.
- **Deine Beträge sind markiert.** Was für die Person gerechnet wird (ihre Abgaben, ihr Netto, ihr Anteil pro Stadt), steht auf `marker` in `on-marker` (Komponente Markierung). Amtliche Zahlen (Haushaltsvolumen, Einzelpläne) bleiben in `ink`. So sieht man auf einen Blick, was persönlich ist.
- **Laut ist nur zweierlei:** das Raster und der Textmarker. Alles andere ist ruhig: `paper`, `ink`, Flächen in `surface`, kaum Linien.
- **Ehrlich bei Schätzungen.** Werte, die nicht aus stadteigenen Zahlen stammen, tragen den Chip Schätzung oder ein ≈ vor dem Namen.

## Sprache

- Du-Form, kurze Sätze, Alltagswörter: „Wohin geht dein Geld?“, „Von 85.000 € Brutto gehen 7.260 € an den Bund.“
- Beträge immer deutsch formatiert, mit geschütztem Leerzeichen vor dem Euro: `85.000 €`, `524,5 Mrd €`, `42,5 %`.
- Normale Groß- und Kleinschreibung, auch in Beschriftungen. Keine Versalien, keine Emojis.
- Amtliche Begriffe dort, wo sie Orientierung geben (Einzelplan, Rechnungsergebnis, Gemeindeanteil), beim ersten Auftreten kurz erklärt.

## Farbe

- Seite auf `paper`; Diagramme und Eingabefelder auf `surface`. Text in `ink`, Unterzeilen in `ink-2`, Quellen und Hinweise in `ink-3`. Alle drei halten auf `paper` und `surface` in beiden Themes mindestens 5:1.
- `marker` nur für persönliche Beträge und das Netto. Nie für Überschriften, Flächen oder Links.
- Zweck-Farben nur in Diagrammen und ihren Legenden, immer in dieser Zuordnung:
  `cat-soz` Soziales, Jugend und Gesundheit · `cat-sich` Sicherheit und Außen · `cat-for` Bildung, Forschung und Kultur · `cat-inf` Infrastruktur und Wirtschaft · `cat-zins` Zinsen · `cat-verw` Verwaltung, Pensionen und Übriges.
  Die sechs sind für alle Paare auf Farbfehlsichtigkeit geprüft (hell: ΔE ≥ 8,0 bzw. 15,2 normal; dunkel: ≥ 10,6 bzw. 15,5). Drei sind Farbtöne, drei sind Graustufen, die sich in der Helligkeit klar unterscheiden.
- `cat-verw` hat nur wenig Abstand zur Fläche (1,4:1 hell, 2:1 dunkel): Diagramme zeichnen solche Flächen mit 1px-Kontur in `line`. Flussbänder im Sankey sind 45 % (hell) bzw. 55 % (dunkel) deckend, beim Überfahren 75 %.
- Sozialversicherung ist keine Haushaltsebene: Sie erscheint als 45°-Schraffur in `cat-sv` (Klasse `rs-hatch`), nie als Vollfläche.
- Geschätzte Konsumsteuern sind Steuern, aber geschätzt: Gegenschraffur (−45°) in `ink` (Klasse `rs-hatch-konsum`, im SVG `hatch(svg, key, '--ink', -45)`), Beschriftung immer mit „≈“. Farbe und Richtung trennen sie von der Sozialversicherung.
- Kirchensteuer als hohles Kästchen (`rs-farbe rs-hohl`), weil sie keinem Staatszweck dient.
- Jedes Diagramm beschriftet seine Elemente direkt und hat eine Legende; Farbe ist nie das einzige Merkmal.

## Schrift

- `display` (Bricolage Grotesque) für Seitentitel (`title`), Kapitel (`heading`), Kennzahlen (`figure`) und den großen Einstiegsbetrag (`figure-xl`). Sparsam: höchstens ein `figure-xl` pro Seite.
- `text` (Hanken Grotesk) für alles andere: `lead` für den Eingabesatz und Ergebnissätze, `subheading` für Grafiktitel, `body` für Fließtext (höchstens `measure` breit), `small` für Unterzeilen, `label` für Feldbeschriftungen und Legenden, `data` in Diagrammen.
- Ziffern sind in beiden Schriften gleich breit (Bricolage über `tnum`, Hanken von Haus aus); setze `font-variant-numeric: tabular-nums` überall, wo sich Zahlen ändern.
- Überschriften mit `text-wrap: balance`, Fließtext mit `text-wrap: pretty`.

## Raum und Form

- Abstände nur aus der Skala `space-1` … `space-20`. Zwischen Grafiken `space-12`, zwischen Kapiteln `space-20`, Innenabstand von Panels `space-6`.
- Radien: `radius-cell` (2px) für alles, was einen Betrag darstellt (Kästchen, Balken, Farbfelder); `radius-control` für Bedienelemente; `radius-panel` für Panels (16 = 8 + 8, konzentrisch zu den Feldern darin); `radius-pill` nur für den Schätzungs-Chip.
- Panels sind Flächen ohne Rahmen und ohne Schatten. Schatten (`shadow-pop`) nur für Schwebendes: Tooltips.
- Kapitel beginnen mit einer 3px-Linie in `ink` über der Überschrift. Die Kapitel sind nummeriert, weil sie dem Weg des Geldes folgen (Brutto → wohin es fließt → Haushalt im Ganzen).

## Bewegung

- Ein orchestrierter Moment: Beim ersten Zeichnen erscheint das Raster als diagonale Welle (je Kästchen 30 ms später, 0,55 s, `cubic-bezier(0.2, 0, 0, 1)`).
- Bei jeder Eingabe färben sich die Kästchen mit derselben Diagonale um (12 ms je Schritt, 0,35 s `ease-out`), damit sichtbar wird, was sich ändert.
- Leben, aber leise: Etwa alle 9 s läuft ein Schimmer diagonal durch das Raster (Deckkraft kurz auf 68 %), nur wenn das Raster im Bild, der Tab sichtbar und kein Zweck im Fokus ist.
- Überfahren eines Zwecks in der Liste stellt dessen Kästchen frei, die übrigen gehen auf 18 % Deckkraft.
- Sonst nur Rückmeldung auf Handlungen: Hover-Flächen (0,12 s), Druck auf Knöpfe (`scale 0.96`), das Aufklappen, der Themenschalter (Drehung 0,3 s).
- `prefers-reduced-motion` schaltet alle Übergänge und Animationen ab.

## Bedienung

- Jedes Bedienelement ist mindestens `hit` (44px) hoch und hat einen sichtbaren Fokusring (`focus`, 2px, Abstand 2px).
- Die wichtigsten Eingaben (Brutto, Stadt) stehen im Satz (Betragsfeld, Auswahl im Satz); alles Weitere steht in Feldern unter „Weitere Angaben“.
- Lange Listen und Tabellen sind zugeklappt (Aufklapper) und nennen im Titel, wie viele Einträge sie enthalten.

## Ikonen

Das System verwendet keine Icon-Bibliothek. Die einzigen Zeichen sind der Aufklapp-Pfeil, das Häkchen im Schalter und der Pfeil der Auswahl; alle drei sind aus CSS-Rändern gebaut und erben `ink`. Kein Logo: Der Name wird in `display` gesetzt.
