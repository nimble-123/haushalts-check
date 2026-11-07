"""Stammliste aller kreisfreien Städte → src/data/staedte/<slug>.json

Quelle: Destatis Gemeindeverzeichnis (GV-ISys), Kreisfreie Städte und Landkreise, Stand 31.12.2024.
Ausgabearten je Stadt ergänzt pipeline/ausgabearten.mjs (braucht Zugang zu regionalstatistik.de).

Aufruf (aus web/):  pipeline/.venv/bin/python -I pipeline/staedte.py
"""
import json
import re
import unicodedata
import urllib.request
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
QUELLEN = ROOT / 'pipeline' / 'quellen'
URL = 'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/04-kreise.xlsx?__blob=publicationFile'
DATEI = QUELLEN / 'gv-kreise-2024.xlsx'
ZIEL = ROOT / 'src' / 'data' / 'staedte'
TYPEN = {'Kreisfreie Stadt', 'Stadtkreis'}
STADTSTAATEN = {'02', '04', '11'}


def slugify(s: str) -> str:
    s = s.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('Ä', 'Ae').replace('Ö', 'Oe').replace('Ü', 'Ue').replace('ß', 'ss')
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def anzeigename(amtlich: str) -> str:
    """„Kiel, Landeshauptstadt“ → „Kiel“; „Oldenburg (Oldenburg), Stadt“ → „Oldenburg (Oldenburg)“"""
    return amtlich.split(',')[0].strip()


def main():
    QUELLEN.mkdir(parents=True, exist_ok=True)
    if not DATEI.exists():
        print('Lade', URL)
        urllib.request.urlretrieve(URL, DATEI)
    ws = openpyxl.load_workbook(DATEI, read_only=True, data_only=True)['Kreisfreie Städte u. Landkreise']
    staedte = []
    for r in ws.iter_rows(min_row=4, values_only=True):
        ags, typ, name, ew = r[0], r[1], r[2], r[5]
        if not (isinstance(ags, str) and len(ags) == 5 and typ in TYPEN):
            continue
        staedte.append({'ags': ags, 'name': anzeigename(name), 'amtlich': name, 'einwohner': int(ew), 'land': ags[:2]})

    # Kurzer Slug ohne Klammerzusatz, solange keine andere Stadt mit demselben Wort beginnt
    # (sonst z. B. „frankfurt“ für Frankfurt (Oder) neben „frankfurt-am-main“)
    erstes = [slugify(s['name']).split('-')[0] for s in staedte]
    for s, e in zip(staedte, erstes):
        kurz = slugify(re.sub(r'\s*\(.*?\)', '', s['name']))
        s['slug'] = kurz if erstes.count(e) == 1 else slugify(s['name'])
    assert len({s['slug'] for s in staedte}) == len(staedte), 'Slugs nicht eindeutig'

    ZIEL.mkdir(parents=True, exist_ok=True)
    # Bereits abgerufene Ausgabearten (pipeline/ausgabearten.mjs) nach AGS merken, damit sie erhalten bleiben
    alt = {}
    for f in ZIEL.glob('*.json'):
        d = json.loads(f.read_text())
        if 'ausgabearten' in d:
            alt[d['ags']] = d['ausgabearten']
        f.unlink()
    for s in staedte:
        datei = ZIEL / f"{s['slug']}.json"
        stadt = {
            'slug': s['slug'], 'ags': s['ags'], 'land': s['land'], 'name': s['name'], 'amtlich': s['amtlich'],
            'einwohner': s['einwohner'], 'stadtstaat': s['land'] in STADTSTAATEN,
        }
        if s['ags'] in alt:
            stadt['ausgabearten'] = alt[s['ags']]
        datei.write_text(json.dumps(stadt, ensure_ascii=False, indent=2) + '\n')
    print(len(staedte), 'kreisfreie Städte geschrieben;',
          sum(1 for s in staedte if s['land'] in STADTSTAATEN), 'davon in Stadtstaaten.')
    print('Beispiele:', ', '.join(f"{s['slug']}" for s in staedte[::15]))


if __name__ == '__main__':
    main()
