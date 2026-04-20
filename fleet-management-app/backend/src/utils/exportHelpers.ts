import ExcelJS from 'exceljs';

export const MAYOTTE_TZ = 'Indian/Mayotte'; // UTC+3, pas de DST

// ─── Formatage dates ──────────────────────────────────────────────────────────

export function formatDateMayotte(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    timeZone: MAYOTTE_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTimeMayotte(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fr-FR', {
    timeZone: MAYOTTE_TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTimeMayotte(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return `${formatDateMayotte(date)} ${formatTimeMayotte(date)}`;
}

export function toMayotteDate(date: Date): Date {
  const parts = date.toLocaleDateString('fr-CA', { timeZone: MAYOTTE_TZ }).split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

// ─── Formatage monétaire et km ────────────────────────────────────────────────

export function formatEuro(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

export function formatKm(km: number | null | undefined): string {
  if (km === null || km === undefined) return '—';
  return new Intl.NumberFormat('fr-FR').format(km) + ' km';
}

// ─── Sécurité Excel / CSV Injection ──────────────────────────────────────────

export function sanitizeExcelValue(value: any): any {
  if (typeof value !== 'string') return value;
  if (/^[=+\-@\t\r\n]/.test(value)) return "'" + value;
  return value;
}

export function sanitizeRowForExcel(row: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    sanitized[key] = sanitizeExcelValue(value);
  }
  return sanitized;
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

export function generateCSV(headers: string[], rows: string[][]): string {
  const BOM = '\uFEFF';
  const escape = (val: string) => {
    if (/^[=+\-@\t\r]/.test(val)) val = "'" + val;
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  };
  const headerLine = headers.map(escape).join(',');
  const dataLines = rows.map(row => row.map(String).map(escape).join(',')).join('\n');
  return BOM + headerLine + '\n' + dataLines;
}

// ─── Jours ouvrés ─────────────────────────────────────────────────────────────

function getJoursFeries(year: number): Date[] {
  const feries: Date[] = [
    new Date(year, 0, 1),   // Jour de l'an
    new Date(year, 3, 27),  // Abolition esclavage Mayotte
    new Date(year, 4, 1),   // Fête du travail
    new Date(year, 4, 8),   // Victoire 1945
    new Date(year, 6, 14),  // Fête nationale
    new Date(year, 7, 15),  // Assomption
    new Date(year, 10, 1),  // Toussaint
    new Date(year, 10, 11), // Armistice
    new Date(year, 11, 25), // Noël
  ];
  if (year === 2026) {
    feries.push(new Date(2026, 3, 5));   // Lundi de Pâques
    feries.push(new Date(2026, 4, 14));  // Ascension
    feries.push(new Date(2026, 4, 25));  // Lundi de Pentecôte
    feries.push(new Date(2026, 2, 20));  // Aïd el-Fitr (approx)
    feries.push(new Date(2026, 4, 27));  // Aïd el-Adha (approx)
    feries.push(new Date(2026, 7, 17));  // Mawlid (approx)
  }
  return feries;
}

export function isJourFerie(date: Date, feries?: Date[]): boolean {
  const list = feries || getJoursFeries(date.getFullYear());
  return list.some(f =>
    f.getDate() === date.getDate() &&
    f.getMonth() === date.getMonth() &&
    f.getFullYear() === date.getFullYear()
  );
}

export function countWorkingDays(start: Date, end: Date): number {
  const feries = getJoursFeries(start.getFullYear());
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endCopy = new Date(end);
  endCopy.setHours(23, 59, 59, 999);
  while (current <= endCopy) {
    const day = current.getDay();
    if (day !== 0 && day !== 6 && !isJourFerie(current, feries)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// ─── Calculs métier ───────────────────────────────────────────────────────────

export function durationHours(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10;
}

export function calculateTripDistance(trip: { startMileage: number | null; endMileage: number | null }): number {
  if (!trip.startMileage || !trip.endMileage) return 0;
  return Math.max(0, trip.endMileage - trip.startMileage);
}

export function calculateTripDuration(trip: { startTime: Date | string; endTime: Date | string | null }): number {
  if (!trip.endTime) return 0;
  return durationHours(new Date(trip.startTime), new Date(trip.endTime));
}

export function calculateConsumption(liters: number, km: number): number | null {
  if (km <= 0 || liters <= 0) return null;
  return Math.round((liters / km) * 100 * 10) / 10;
}

export function calculateUtilizationRate(reservedHours: number, periodStart: Date, periodEnd: Date): number {
  const workingDays = countWorkingDays(periodStart, periodEnd);
  const availableHours = workingDays * 8;
  if (availableHours === 0) return 0;
  return Math.round((reservedHours / availableHours) * 100 * 10) / 10;
}

export function calculateTCO(fuelCost: number, maintenanceCost: number, insuranceCost: number): number {
  return Math.round((fuelCost + maintenanceCost + insuranceCost) * 100) / 100;
}

export function getExpiryStatus(expiryDate: Date | string | null | undefined): { label: string; color: 'red' | 'orange' | 'yellow' | 'green' | 'gray' } {
  if (!expiryDate) return { label: '—', color: 'gray' };
  const expiry = new Date(expiryDate);
  const now = new Date();
  const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysRemaining < 0) return { label: 'EXPIRÉ', color: 'red' };
  if (daysRemaining <= 7)  return { label: `URGENT (${daysRemaining}j)`, color: 'red' };
  if (daysRemaining <= 30) return { label: `À prévoir (${daysRemaining}j)`, color: 'orange' };
  if (daysRemaining <= 60) return { label: `OK (${daysRemaining}j)`, color: 'yellow' };
  return { label: `Valide (${daysRemaining}j)`, color: 'green' };
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '—';
  return name.split(' ').map(p => p[0]?.toUpperCase()).filter(Boolean).join('.');
}

// ─── Métadonnées export ───────────────────────────────────────────────────────

export interface ExportMetadata {
  reportName: string;
  generatedBy: { name: string; role: string };
  filters: {
    startDate?: string;
    endDate?: string;
    pole?: string;
    vehicle?: string;
  };
}

export function addExcelMetadata(sheet: ExcelJS.Worksheet, meta: ExportMetadata, colCount = 14): number {
  const lastCol = String.fromCharCode(64 + Math.min(colCount, 26));
  const range = `A1:${lastCol}1`;

  sheet.mergeCells(`A1:${lastCol}1`);
  sheet.getCell('A1').value = 'APAJH Mayotte — Gestion de Flotte';
  sheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FF1F4E79' } };
  sheet.getRow(1).height = 22;

  sheet.mergeCells(`A2:${lastCol}2`);
  sheet.getCell('A2').value = `Rapport : ${meta.reportName}`;
  sheet.getCell('A2').font = { size: 11, bold: true };

  sheet.mergeCells(`A3:${lastCol}3`);
  sheet.getCell('A3').value = `Généré le ${formatDateTimeMayotte(new Date())} — par ${meta.generatedBy.name} (${meta.generatedBy.role})`;
  sheet.getCell('A3').font = { size: 10, italic: true, color: { argb: 'FF666666' } };

  const filterParts: string[] = [];
  if (meta.filters.startDate && meta.filters.endDate) {
    filterParts.push(`Période : ${formatDateMayotte(meta.filters.startDate)} → ${formatDateMayotte(meta.filters.endDate)}`);
  }
  filterParts.push(`Pôle : ${meta.filters.pole || 'Tous'}`);
  filterParts.push(`Véhicule : ${meta.filters.vehicle || 'Tous'}`);

  sheet.mergeCells(`A4:${lastCol}4`);
  sheet.getCell('A4').value = `Filtres : ${filterParts.join(' | ')}`;
  sheet.getCell('A4').font = { size: 9, color: { argb: 'FF999999' } };

  sheet.mergeCells(`A5:${lastCol}5`);
  sheet.getCell('A5').value = 'Heures en heure locale de Mayotte (UTC+3)';
  sheet.getCell('A5').font = { size: 8, italic: true, color: { argb: 'FFAAAAAA' } };

  return 7; // données démarrent ligne 7
}

export function addCSVMetadata(meta: ExportMetadata): string {
  return [
    `# APAJH Mayotte — Gestion de Flotte`,
    `# Rapport : ${meta.reportName}`,
    `# Généré le : ${formatDateTimeMayotte(new Date())} par ${meta.generatedBy.name} (${meta.generatedBy.role})`,
    `# Période : ${meta.filters.startDate ? formatDateMayotte(meta.filters.startDate) : 'Toute'} → ${meta.filters.endDate ? formatDateMayotte(meta.filters.endDate) : 'Toute'}`,
    `# Pôle : ${meta.filters.pole || 'Tous'}`,
    `# Heures en heure locale de Mayotte (UTC+3)`,
    `#`,
    '',
  ].join('\n');
}

// ─── Style cellule Excel selon couleur ───────────────────────────────────────

export function applyColorFill(cell: ExcelJS.Cell, color: 'red' | 'orange' | 'yellow' | 'green' | 'gray') {
  const map: Record<string, string> = {
    red:    'FFFFC7CE',
    orange: 'FFFFCC99',
    yellow: 'FFFFFF99',
    green:  'FFC6EFCE',
    gray:   'FFF2F2F2',
  };
  const argb = map[color] || map['gray'];
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

export function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF1F4E79' } },
    };
  });
  row.height = 22;
}

export function styleDataRow(row: ExcelJS.Row, isAlternate: boolean) {
  if (isAlternate) {
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F7FB' } };
    });
  }
  row.eachCell(cell => {
    cell.alignment = { vertical: 'middle', wrapText: false };
  });
}

// ─── PDF helpers ──────────────────────────────────────────────────────────────

export interface PDFTableColumn {
  header: string;
  width: number;
}

export function drawPDFTableHeader(
  doc: any,
  columns: PDFTableColumn[],
  x: number,
  y: number,
  rowHeight = 20
): number {
  let cx = x;
  doc.fontSize(8).fillColor('#FFFFFF');
  columns.forEach(col => {
    doc.rect(cx, y, col.width, rowHeight).fill('#1F4E79');
    doc.fillColor('#FFFFFF').fontSize(7).text(col.header, cx + 3, y + 6, { width: col.width - 6, lineBreak: false });
    cx += col.width;
  });
  return y + rowHeight;
}

export function drawPDFTableRow(
  doc: any,
  columns: PDFTableColumn[],
  values: string[],
  x: number,
  y: number,
  isAlternate: boolean,
  rowHeight = 18,
  bgColor?: string
): number {
  let cx = x;
  const bg = bgColor || (isAlternate ? '#F2F7FB' : '#FFFFFF');
  columns.forEach((col, i) => {
    doc.rect(cx, y, col.width, rowHeight).fill(bg);
    doc.fillColor('#333333').fontSize(7).text(
      String(values[i] ?? '—'),
      cx + 3, y + 5,
      { width: col.width - 6, lineBreak: false }
    );
    cx += col.width;
  });
  return y + rowHeight;
}

export function addPDFMetadata(doc: any, meta: ExportMetadata) {
  doc.fontSize(16).fillColor('#1F4E79').text('APAJH Mayotte — Gestion de Flotte', { align: 'center' });
  doc.fontSize(13).fillColor('#333333').text(meta.reportName, { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor('#666666').text(
    `Généré le ${formatDateTimeMayotte(new Date())} — par ${meta.generatedBy.name} (${meta.generatedBy.role})`,
    { align: 'center' }
  );
  const filterParts: string[] = [];
  if (meta.filters.startDate && meta.filters.endDate) {
    filterParts.push(`Période : ${formatDateMayotte(meta.filters.startDate)} → ${formatDateMayotte(meta.filters.endDate)}`);
  }
  filterParts.push(`Pôle : ${meta.filters.pole || 'Tous'}`);
  filterParts.push(`Véhicule : ${meta.filters.vehicle || 'Tous'}`);
  doc.fontSize(9).fillColor('#555555').text(filterParts.join('  |  '), { align: 'center' });
  doc.fontSize(8).fillColor('#999999').text('Heures en heure locale de Mayotte (UTC+3)', { align: 'center' });
  doc.moveDown(1.2);
}
