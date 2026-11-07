"""Länderhaushalte und Gemeinden je Land nach Aufgabenbereichen.

Quelle: Destatis, Statistischer Bericht „Rechnungsergebnisse der Kern- und Extrahaushalte
des Öffentlichen Gesamthaushalts 2022“, Tabelle 71711-12, Zeilen „Bereinigte Ausgaben“
(.44 = Staat/Land, .45 = Gemeinden/Gemeindeverbände), Mio €.

Schreibt:
  src/data/laender/<slug>.json          – Landesebene
  src/data/gemeinden-schaetzung.json    – Zweck-Anteile der Gemeinden je Land (Schätzbasis für Städte)

Aufruf (aus web/):  pipeline/.venv/bin/python -I pipeline/laender.py
"""
import json
import urllib.request
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
QUELLEN = ROOT / 'pipeline' / 'quellen'
URL = ('https://www.destatis.de/DE/Themen/Staat/Oeffentliche-Finanzen/Ausgaben-Einnahmen/Publikationen/'
       'Downloads-Ausgaben-und-Einnahmen/statistischer-bericht-rechnungsergebnis-oeffentlicher-haushalt-2140310227015.xlsx'
       '?__blob=publicationFile&v=2')
DATEI = QUELLEN / 'rechnungsergebnis-oeh-2022.xlsx'
JAHR = 2022
QUELLE = {
    'label': 'Destatis: Rechnungsergebnisse des Öffentlichen Gesamthaushalts 2022, Tabelle 71711-12',
    'url': 'https://www.destatis.de/DE/Themen/Staat/Oeffentliche-Finanzen/Ausgaben-Einnahmen/Publikationen/_publikationen-innen-ausgaben-einnahmen.html',
}

# Spaltenreihenfolge im Blatt (ab Spalte D) → Länderschlüssel, Name, Slug, Kirchensteuer
LAENDER = [
    ('08', 'Baden-Württemberg', 'baden-wuerttemberg', 0.08),
    ('09', 'Bayern', 'bayern', 0.08),
    ('12', 'Brandenburg', 'brandenburg', 0.09),
    ('06', 'Hessen', 'hessen', 0.09),
    ('13', 'Mecklenburg-Vorpommern', 'mecklenburg-vorpommern', 0.09),
    ('03', 'Niedersachsen', 'niedersachsen', 0.09),
    ('05', 'Nordrhein-Westfalen', 'nordrhein-westfalen', 0.09),
    ('07', 'Rheinland-Pfalz', 'rheinland-pfalz', 0.09),
    ('10', 'Saarland', 'saarland', 0.09),
    ('14', 'Sachsen', 'sachsen', 0.09),
    ('15', 'Sachsen-Anhalt', 'sachsen-anhalt', 0.09),
    ('01', 'Schleswig-Holstein', 'schleswig-holstein', 0.09),
    ('16', 'Thüringen', 'thueringen', 0.09),
    ('11', 'Berlin', 'berlin', 0.09),
    ('04', 'Bremen', 'bremen', 0.09),
    ('02', 'Hamburg', 'hamburg', 0.09),
]
STADTSTAATEN = {'02', '04', '11'}

# Anzeige-Kategorien: (Name, Gruppe, Formel aus Aufgabenbereichen)
KATEGORIEN = [
    ('Schulen', 'for', [1012]),
    ('Hochschulen', 'for', [1015]),
    ('Forschung und sonstige Bildung', 'for', [1016, 1017, 1018]),
    ('Kultur und Religion', 'for', [1019]),
    ('Kindertagesbetreuung', 'soz', [1028]),
    ('Soziales, Familie, Jugend', 'soz', [1021, -1028]),
    ('Gesundheit und Sport', 'soz', [1031, 1032]),
    ('Polizei, Sicherheit und Justiz', 'sich', [1008]),
    ('Umwelt- und Naturschutz', 'inf', [1030, -1031, -1032]),
    ('Wohnen, Städtebau, kommunale Dienste', 'inf', [1034]),
    ('Landwirtschaft und Forsten', 'inf', [1038]),
    ('Energie, Wasser, Wirtschaft', 'inf', [1039]),
    ('Verkehr', 'inf', [1046]),
    ('Zinsen', 'zins', [1058]),
    ('Finanzausgleich an Kommunen', 'verw', [1057]),
    ('Vermögen und Sondervermögen', 'verw', [1055, -1057, -1058]),
    ('Politische Führung und Verwaltung', 'verw', [1002]),
    ('Pensionen und Beihilfen', 'verw', [1059, 1060]),
]
GESAMT = 1001
UEBRIG = ('Übriges, nicht einzeln ausgewiesen', 'verw')


def lade():
    QUELLEN.mkdir(parents=True, exist_ok=True)
    if not DATEI.exists():
        print('Lade', URL)
        urllib.request.urlretrieve(URL, DATEI)
    wb = openpyxl.load_workbook(DATEI, read_only=True, data_only=True)
    return list(wb['71711-12'].iter_rows(values_only=True))


def zahl(v):
    return 0.0 if v in (None, '-', '.', 'x', '–') else float(v)


def werte(rows):
    """{(bereich, zeile): [16 Länderwerte]} plus Prüfung der Zeilenbeschriftungen."""
    kopf = [str(c).replace('-\n', '-').replace('\n', '').strip() for c in rows[3][3:19]]
    erwartet = [n for _, n, _, _ in LAENDER]
    assert [k.replace(' ', '') for k in kopf] == [e.replace(' ', '') for e in erwartet], kopf
    out, labels = {}, {}
    for r in rows[5:]:
        key = str(r[0] or '').split('\n')[-1].strip()
        if key.count('.') != 1:
            continue
        b, z = key.split('.')
        if not (b.isdigit() and z.isdigit()):
            continue
        out[(int(b), z)] = [zahl(v) for v in r[3:19]]
        labels[(int(b), z)] = str(r[1] or '').strip()
    for (b, z), lab in labels.items():
        if z == '43':
            assert lab.startswith('Bereinigte Ausgaben'), (b, lab)
        if z == '44':
            assert lab == 'Staat', (b, lab)
        if z == '45':
            assert lab.startswith('Gemeinden'), (b, lab)
    return out


def kategorien(w, zeile, i):
    """Kategorien für Land i. Positive Posten plus „Übriges“ (Rest zur Gesamtzeile).
    Saldiert negative Posten (Verrechnungen) werden nicht gezeigt, aber zurückgegeben."""
    v = lambda b: w[(abs(b), zeile)][i] * (1 if b > 0 else -1)
    gesamt = w[(GESAMT, zeile)][i]
    alle = [{'name': n, 'v': round(sum(v(b) for b in f), 1), 'g': g} for n, g, f in KATEGORIEN]
    rest = round(gesamt - sum(p['v'] for p in alle), 1)
    if rest >= 0.5:
        alle.append({'name': UEBRIG[0], 'v': rest, 'g': UEBRIG[1]})
    posten = [p for p in alle if p['v'] > 0.4]
    negativ = [p for p in alle if p['v'] < -0.4]
    abw = gesamt - sum(p['v'] for p in posten)
    return posten, gesamt, abw, negativ


def de_zahl(v):
    """−1.234 statt -1,234"""
    t = f'{abs(v):,.0f}'.replace(',', '.')
    return ('−' if v < 0 else '') + t


def fmt_neg(negativ):
    return ', '.join(f"{p['name']} ({de_zahl(p['v'])} Mio €)" for p in negativ)


def main():
    rows = lade()
    w = werte(rows)
    ziel = ROOT / 'src' / 'data' / 'laender'
    ziel.mkdir(parents=True, exist_ok=True)
    schaetzung = {}
    for i, (code, name, slug, kist) in enumerate(LAENDER):
        posten, gesamt, abw, negativ = kategorien(w, '44', i)
        assert abs(abw - sum(p['v'] for p in negativ)) < 1, (name, abw)  # exakte Abstimmung: Gesamt = positive + negative Posten
        hinweis = ('Stadtstaat: Land und Stadt haben einen gemeinsamen Haushalt.' if code in STADTSTAATEN
                   else '„Finanzausgleich an Kommunen“ fließt an Städte, Gemeinden und Landkreise weiter.')
        if negativ:
            hinweis += f' Unterm Strich negativ und daher nicht gezeigt: {fmt_neg(negativ)}.'
        land = {
            'code': code, 'slug': slug, 'name': name, 'jahr': JAHR, 'einheit': 'Mio €',
            'art': 'Rechnungsergebnis, bereinigte Ausgaben nach Aufgabenbereichen',
            'kirchensteuer': kist, 'posten': sorted(posten, key=lambda p: -p['v']),
            'quellen': [QUELLE], 'hinweis': hinweis,
        }
        (ziel / f'{slug}.json').write_text(json.dumps(land, ensure_ascii=False, indent=2) + '\n')
        print(f'{name:24s} {gesamt:9.0f} Mio €  {len(posten):2d} Posten  Abw. {abw:+7.1f}  {fmt_neg(negativ)}')
        if code not in STADTSTAATEN:
            gp, gg, gabw, gneg = kategorien(w, '45', i)
            assert abs(gabw - sum(p['v'] for p in gneg)) / gg < 0.01, (name, 'Gemeinden', gabw)  # Teilsummen überschneiden sich leicht
            print(f'{"  Gemeinden":24s} {gg:9.0f} Mio €  {len(gp):2d} Posten  Abw. {gabw:+7.1f}  {fmt_neg(gneg)}')
            schaetzung[code] = {'jahr': JAHR, 'gesamt': gg, 'posten': sorted(gp, key=lambda p: -p['v'])}
    (ROOT / 'src' / 'data' / 'gemeinden-schaetzung.json').write_text(
        json.dumps({'quelle': QUELLE, 'laender': schaetzung}, ensure_ascii=False, indent=2) + '\n')
    print('Gemeinden-Schätzbasis für', len(schaetzung), 'Länder geschrieben.')


if __name__ == '__main__':
    main()
