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

Bewegung zeigt, was sich ändert. Sie ist nie Schmuck: Wer nichts tut, sieht nach dem Laden fast nichts mehr laufen. Dauern und Kurven stehen als Tokens bereit (`dauer-rueckmeldung`, `dauer-einblenden`, `dauer-wechsel`, `ease-wechsel`, `ease-auftritt`).

- **Wechsel nach einer Eingabe.** Diagramme, Anteilsbalken, Kalender und Kennzahlen gleiten vom alten zum neuen Stand (`dauer-wechsel`, `ease-wechsel`), statt neu aufzuspringen. Sankey-Bänder verformen sich, die sortierten Töpfe wandern an ihren neuen Rang, der Punkt „Du“ rutscht auf der Quote-Kurve, das Datum im Kalender zählt durch die Tage, Kennzahlen zählen zum neuen Betrag. Technik: Elemente mit `data-k` behalten über das Neuzeichnen ihren Namen (`src/scripts/bewegung.ts`, `mitUebergang`). Nur bei Eingaben der Person, nie bei Größenänderung, Thema oder dem ersten Zeichnen.
- **Neues blendet ein, Wegfallendes geht sofort.** Ein zugeschaltetes Band oder ein neuer Anteil kommt in `dauer-einblenden` dazu bzw. wächst aus null. Beschriftungen stehen immer sofort und voll deckend da.
- **Ein Auftritt je Kapitel, mit Inhalt.** Kapitel 2: das Raster als diagonale Welle beim ersten Zeichnen (je Kästchen 30 ms später, 0,55 s, `ease-auftritt`). Kapitel 3: der Zeitraffer der Bundesausgaben; die Balken warten, bis das Diagramm im Bild ist, und wachsen dann in Jahresfolge (90 ms Abstand, 0,6 s, `ease-auftritt`), die Summen erscheinen danach. Beide laufen einmal pro Seitenaufruf.
- **Raster bei Eingaben:** Die Kästchen färben sich mit derselben Diagonale um (12 ms je Schritt, 0,35 s `ease-out`).
- **Leben, aber leise:** Etwa alle 9 s läuft ein Schimmer diagonal durch das Raster (Deckkraft kurz auf 68 %), nur wenn das Raster im Bild, der Tab sichtbar und kein Zweck im Fokus ist. Überfahren eines Zwecks in der Liste stellt dessen Kästchen frei, die übrigen gehen auf 18 % Deckkraft.
- **Wechsel der Ansicht und der Seite:** Fluss und Fläche des Bundeshaushalts blenden ineinander, der Wechsel zu einer anderen Stadt blendet die Seite über (`dauer-einblenden`, View Transitions, wo der Browser sie kann).
- **Rückmeldung auf Handlungen:** Hover-Flächen (`dauer-rueckmeldung`), Druck auf Knöpfe (`scale 0.96`), das Aufklappen, der Themenschalter (Drehung 0,3 s).
- **Bewusst nicht:** WebGL, 3D, Parallax, Scroll-Kopplung, Einblenden jedes Abschnitts beim Scrollen, Zählen beim Laden. Videowerkzeuge wie Remotion oder Hyperframes gehören nicht auf die Seite; sie taugen höchstens für ein Video über die Seite.
- `prefers-reduced-motion` schaltet alle Übergänge und Animationen ab: Diagramme springen auf den neuen Stand, der Zeitraffer entfällt, Seiten wechseln ohne Überblenden.

## Bedienung

- Jedes Bedienelement ist mindestens `hit` (44px) hoch und hat einen sichtbaren Fokusring (`focus`, 2px, Abstand 2px).
- Die wichtigsten Eingaben (Brutto, Stadt) stehen im Satz (Betragsfeld, Auswahl im Satz); alles Weitere steht in Feldern unter „Weitere Angaben“. Direkt darunter sucht das Feld „Oder such deine Gemeinde“ alle Orte; die Trefferliste schwebt (`surface`, `shadow-pop`).
- Lange Listen und Tabellen sind zugeklappt (Aufklapper) und nennen im Titel, wie viele Einträge sie enthalten.

## Ikonen

Das System verwendet keine Icon-Bibliothek. Die einzigen Zeichen sind der Aufklapp-Pfeil, das Häkchen im Schalter und der Pfeil der Auswahl; alle drei sind aus CSS-Rändern gebaut und erben `ink`. Kein Logo: Der Name wird in `display` gesetzt.
