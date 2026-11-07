// Excel-Blätter als Zeilen lesen (exceljs).
import ExcelJS from 'exceljs';

export type Zelle = string | number | null;

/** Ein Excel-Blatt als Zeilen mit einfachen Werten (Text, Zahl oder null), Spalte A = Index 0. */
export async function blatt(pfad: string, name: string): Promise<Zelle[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(pfad);
  const ws = wb.getWorksheet(name);
  if (!ws)
    throw new Error(`Blatt „${name}“ fehlt in ${pfad}; vorhanden: ${wb.worksheets.map((w) => w.name).join(', ')}`);
  const zeilen: Zelle[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, nr) => {
    const werte: Zelle[] = [];
    for (let c = 1; c <= ws.columnCount; c++) werte.push(einfach(row.getCell(c).value));
    zeilen[nr - 1] = werte;
  });
  return Array.from(zeilen, (z) => z ?? []);
}

function einfach(v: ExcelJS.CellValue): Zelle {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if ('richText' in v) return v.richText.map((t) => t.text).join('');
  if ('result' in v) return einfach(v.result as ExcelJS.CellValue);
  if ('text' in v) return String(v.text);
  return null;
}
