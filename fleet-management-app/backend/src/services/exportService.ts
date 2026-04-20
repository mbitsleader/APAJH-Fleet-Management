import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {
  formatDateMayotte, formatTimeMayotte, formatDateTimeMayotte,
  sanitizeExcelValue, generateCSV, addCSVMetadata,
  addExcelMetadata, addPDFMetadata,
  styleHeaderRow, styleDataRow, applyColorFill,
  drawPDFTableHeader, drawPDFTableRow,
  calculateTripDistance, calculateTripDuration, durationHours,
  calculateConsumption, calculateUtilizationRate, calculateTCO,
  countWorkingDays, getExpiryStatus, getInitials,
  ExportMetadata,
} from '../utils/exportHelpers';

// ─── HELPERS INTERNES ─────────────────────────────────────────────────────────

function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  return wb.xlsx.writeBuffer().then(b => Buffer.from(b));
}

function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function emptyMessage(sheet: ExcelJS.Worksheet, startRow: number, colCount: number) {
  const lastCol = String.fromCharCode(64 + Math.min(colCount, 26));
  sheet.mergeCells(`A${startRow}:${lastCol}${startRow}`);
  const cell = sheet.getCell(`A${startRow}`);
  cell.value = 'Aucune donnée sur la période sélectionnée.';
  cell.font = { italic: true, color: { argb: 'FF999999' } };
  cell.alignment = { horizontal: 'center' };
}

// ─── EXPORT 4 : Journal des déplacements ─────────────────────────────────────

export async function generateTripJournalExcel(trips: any[], meta: ExportMetadata): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestion de Flotte — APAJH Mayotte';
  wb.created = new Date();
  const sheet = wb.addWorksheet('Journal des déplacements');

  const COLS = 14;
  const dataStart = addExcelMetadata(sheet, meta, COLS);

  const headers = ['Date', 'Heure départ', 'Heure retour', 'Durée', 'Agent', 'Véhicule',
    'Immatriculation', 'Pôle', 'Km départ', 'Km retour', 'Km parcourus', 'Destination', 'Accompagnants', 'Notes'];
  const widths   = [12, 13, 13, 10, 22, 22, 15, 16, 11, 11, 14, 28, 30, 30];

  const headerRow = sheet.getRow(dataStart);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
    sheet.getColumn(i + 1).width = widths[i];
  });
  styleHeaderRow(headerRow);

  if (trips.length === 0) { emptyMessage(sheet, dataStart + 1, COLS); return toBuffer(wb); }

  let totalKm = 0;
  trips.forEach((trip, idx) => {
    const km = calculateTripDistance(trip);
    totalKm += km;
    const dur = trip.endTime ? durationHours(new Date(trip.startTime), new Date(trip.endTime)) + 'h' : '—';
    const passengers = trip.reservation?.passengers?.map((p: any) => p.user?.name).filter(Boolean).join(', ') || '';

    const row = sheet.getRow(dataStart + 1 + idx);
    row.getCell(1).value  = new Date(trip.startTime); row.getCell(1).numFmt = 'DD/MM/YYYY';
    row.getCell(2).value  = formatTimeMayotte(trip.startTime);
    row.getCell(3).value  = formatTimeMayotte(trip.endTime);
    row.getCell(4).value  = dur;
    row.getCell(5).value  = trip.user?.name || '—';
    row.getCell(6).value  = `${trip.vehicle?.brand || ''} ${trip.vehicle?.model || ''}`.trim();
    row.getCell(7).value  = trip.vehicle?.plateNumber || '—';
    row.getCell(8).value  = trip.vehicle?.service?.pole?.name || '—';
    row.getCell(9).value  = trip.startMileage ?? 0; row.getCell(9).numFmt = '#,##0';
    row.getCell(10).value = trip.endMileage ?? 0;   row.getCell(10).numFmt = '#,##0';
    row.getCell(11).value = km; row.getCell(11).numFmt = '#,##0'; row.getCell(11).font = { bold: true };
    row.getCell(12).value = sanitizeExcelValue(trip.reservation?.destination || trip.destination || '—');
    row.getCell(13).value = passengers;
    row.getCell(14).value = sanitizeExcelValue(trip.notes || '');
    styleDataRow(row, idx % 2 === 1);
  });

  const totalRow = sheet.getRow(dataStart + 1 + trips.length + 1);
  totalRow.getCell(1).value = 'TOTAL'; totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(5).value = `${trips.length} trajets`; totalRow.getCell(5).font = { bold: true };
  totalRow.getCell(11).value = totalKm; totalRow.getCell(11).numFmt = '#,##0'; totalRow.getCell(11).font = { bold: true };

  return toBuffer(wb);
}

export async function generateTripJournalCSV(trips: any[], meta: ExportMetadata): Promise<string> {
  const headers = ['Date', 'Heure départ', 'Heure retour', 'Durée', 'Agent', 'Véhicule',
    'Immatriculation', 'Pôle', 'Km départ', 'Km retour', 'Km parcourus', 'Destination', 'Accompagnants', 'Notes'];
  const rows = trips.map(trip => {
    const km = calculateTripDistance(trip);
    const dur = trip.endTime ? durationHours(new Date(trip.startTime), new Date(trip.endTime)) + 'h' : '—';
    const passengers = trip.reservation?.passengers?.map((p: any) => p.user?.name).filter(Boolean).join(' / ') || '';
    return [
      formatDateMayotte(trip.startTime), formatTimeMayotte(trip.startTime), formatTimeMayotte(trip.endTime), dur,
      trip.user?.name || '—',
      `${trip.vehicle?.brand || ''} ${trip.vehicle?.model || ''}`.trim(),
      trip.vehicle?.plateNumber || '—',
      trip.vehicle?.service?.pole?.name || '—',
      String(trip.startMileage ?? 0), String(trip.endMileage ?? 0), String(km),
      trip.reservation?.destination || trip.destination || '—', passengers, trip.notes || '',
    ];
  });
  return addCSVMetadata(meta) + generateCSV(headers, rows);
}

export async function generateTripJournalPDF(trips: any[], meta: ExportMetadata): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40,
    info: { Title: meta.reportName, Author: 'Gestion de Flotte APAJH' } });
  addPDFMetadata(doc, meta);

  const cols = [
    { header: 'Date', width: 65 }, { header: 'Heure D.', width: 55 }, { header: 'Heure R.', width: 55 },
    { header: 'Agent', width: 100 }, { header: 'Véhicule', width: 100 },
    { header: 'Km dép.', width: 55 }, { header: 'Km ret.', width: 55 }, { header: 'Km parc.', width: 60 },
    { header: 'Destination', width: 211 },
  ];
  const startX = 40;
  let y = drawPDFTableHeader(doc, cols, startX, doc.y);

  trips.forEach((trip, idx) => {
    if (y > 500) { doc.addPage(); y = 40; }
    const km = calculateTripDistance(trip);
    const values = [
      formatDateMayotte(trip.startTime), formatTimeMayotte(trip.startTime), formatTimeMayotte(trip.endTime),
      trip.user?.name || '—',
      `${trip.vehicle?.brand || ''} ${trip.vehicle?.model || ''}`.trim(),
      String(trip.startMileage ?? 0), String(trip.endMileage ?? 0), String(km),
      trip.reservation?.destination || trip.destination || '—',
    ];
    y = drawPDFTableRow(doc, cols, values, startX, y, idx % 2 === 1);
  });

  if (trips.length === 0) {
    doc.fontSize(10).fillColor('#999').text('Aucune donnée sur la période sélectionnée.', { align: 'center' });
  }

  doc.moveDown(1);
  doc.fontSize(8).fillColor('#666').text(`${trips.length} trajet(s) — Total km : ${trips.reduce((s, t) => s + calculateTripDistance(t), 0).toLocaleString('fr-FR')}`, { align: 'right' });

  return pdfToBuffer(doc);
}

// ─── EXPORT 5 : Planning hebdomadaire PDF ─────────────────────────────────────

export async function generateWeeklyPlanningPDF(reservations: any[], weekStart: Date, meta: ExportMetadata): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 35,
    info: { Title: meta.reportName, Author: 'Gestion de Flotte APAJH' } });
  addPDFMetadata(doc, meta);

  // Collecter les véhicules
  const vehicleMap = new Map<string, any>();
  reservations.forEach(r => {
    if (r.vehicle && !vehicleMap.has(r.vehicleId)) vehicleMap.set(r.vehicleId, r.vehicle);
  });
  const vehicles = Array.from(vehicleMap.values());

  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
  const dayDates: Date[] = days.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const COL_VEH = 130;
  const COL_DAY = 118;
  const startX = 35;
  const rowH = 40;
  let y = doc.y;

  // En-tête tableau
  doc.rect(startX, y, COL_VEH, 24).fill('#1F4E79');
  doc.fillColor('#FFF').fontSize(8).text('Véhicule', startX + 4, y + 8, { width: COL_VEH - 8, lineBreak: false });
  days.forEach((day, i) => {
    const x = startX + COL_VEH + i * COL_DAY;
    doc.rect(x, y, COL_DAY, 24).fill('#1F4E79');
    doc.fillColor('#FFF').fontSize(7).text(`${day} ${formatDateMayotte(dayDates[i]).slice(0, 5)}`, x + 3, y + 8, { width: COL_DAY - 6, lineBreak: false });
  });
  y += 24;

  if (vehicles.length === 0) {
    doc.fontSize(10).fillColor('#999').text('Aucun véhicule sur la période.', startX, y + 10);
  }

  vehicles.forEach((veh, vIdx) => {
    if (y > 530) { doc.addPage(); y = 40; }
    const bg = vIdx % 2 === 1 ? '#F2F7FB' : '#FFFFFF';

    // Colonne véhicule
    doc.rect(startX, y, COL_VEH, rowH).fill(bg);
    doc.fillColor('#333').fontSize(7)
      .text(`${veh.brand} ${veh.model}`, startX + 4, y + 6, { width: COL_VEH - 8, lineBreak: false });
    doc.fillColor('#666').fontSize(6)
      .text(veh.plateNumber, startX + 4, y + 18, { width: COL_VEH - 8, lineBreak: false });

    // Colonnes jours
    days.forEach((_, di) => {
      const dayDate = dayDates[di];
      const x = startX + COL_VEH + di * COL_DAY;
      doc.rect(x, y, COL_DAY, rowH).fill(bg);

      const dayResv = reservations.filter(r =>
        r.vehicleId === veh.id &&
        new Date(r.startTime).toDateString() === dayDate.toDateString()
      );

      if (dayResv.length > 0) {
        doc.rect(x, y, COL_DAY, rowH).fill('#DBEAFE');
        dayResv.slice(0, 2).forEach((r, ri) => {
          const label = `${getInitials(r.user?.name)} ${formatTimeMayotte(r.startTime)}-${formatTimeMayotte(r.endTime)}`;
          doc.fillColor('#1E40AF').fontSize(6).text(label, x + 3, y + 5 + ri * 14, { width: COL_DAY - 6, lineBreak: false });
        });
        if (dayResv.length > 2) {
          doc.fillColor('#64748B').fontSize(6).text(`+${dayResv.length - 2} autre(s)`, x + 3, y + 30, { width: COL_DAY - 6, lineBreak: false });
        }
      }
    });
    y += rowH;
  });

  doc.moveDown(1);
  doc.fontSize(8).fillColor('#999').text(`Généré le ${formatDateTimeMayotte(new Date())}`, { align: 'right' });
  return pdfToBuffer(doc);
}

// ─── EXPORT 6 : Planning de nettoyage PDF ────────────────────────────────────

export async function generateCleaningPlanningPDF(schedules: any[], meta: ExportMetadata): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 45,
    info: { Title: meta.reportName, Author: 'Gestion de Flotte APAJH' } });
  addPDFMetadata(doc, meta);

  const cols = [
    { header: 'Véhicule', width: 180 },
    { header: 'Semaine', width: 80 },
    { header: 'Agent(s) assigné(s)', width: 160 },
    { header: 'Effectué', width: 80 },
  ];
  const startX = 45;
  let y = drawPDFTableHeader(doc, cols, startX, doc.y);

  if (schedules.length === 0) {
    doc.fontSize(10).fillColor('#999').text('Aucune donnée sur la période sélectionnée.', { align: 'center' });
  }

  schedules.forEach((sched, idx) => {
    if (y > 720) { doc.addPage(); y = 45; }
    const agents = sched.assignments?.map((a: any) => a.user?.name).filter(Boolean).join(', ') || '—';
    const done = sched.isDone
      ? (sched.logs?.[0]?.date ? `✓ ${formatDateMayotte(sched.logs[0].date)}` : '✓ Fait')
      : '✗ Non fait';
    const values = [
      `${sched.vehicle?.brand} ${sched.vehicle?.model} — ${sched.vehicle?.plateNumber}`,
      formatDateMayotte(sched.weekStart),
      agents,
      done,
    ];
    const bgColor = sched.isDone ? '#C6EFCE' : '#FFC7CE';
    y = drawPDFTableRow(doc, cols, values, startX, y, idx % 2 === 1, 22, sched.isDone ? '#C6EFCE' : (idx % 2 === 1 ? '#FFF2F2' : '#FFFFFF'));
  });

  doc.moveDown(1);
  doc.fontSize(8).fillColor('#999').text(`Généré le ${formatDateTimeMayotte(new Date())}`, { align: 'right' });
  return pdfToBuffer(doc);
}

// ─── EXPORT 1 : Rapport d'activité ───────────────────────────────────────────

export async function generateActivityReportExcel(trips: any[], reservations: any[], meta: ExportMetadata): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestion de Flotte — APAJH Mayotte';

  // Feuille 1 : Synthèse
  const sheet1 = wb.addWorksheet('Synthèse');
  const COLS1 = 9;
  const ds1 = addExcelMetadata(sheet1, meta, COLS1);
  const h1 = ['Pôle', 'Véhicule', 'Immatriculation', 'Nb trajets', 'Km total', 'Km moy/trajet', 'Nb agents', 'Nb réservations', 'Taux utilisation'];
  const w1 = [18, 22, 15, 12, 13, 15, 12, 18, 17];
  const hr1 = sheet1.getRow(ds1);
  h1.forEach((h, i) => { hr1.getCell(i + 1).value = h; sheet1.getColumn(i + 1).width = w1[i]; });
  styleHeaderRow(hr1);

  // Agréger par véhicule
  const vehicleMap = new Map<string, { vehicle: any; trips: any[]; reservations: any[] }>();
  trips.forEach(t => {
    const id = t.vehicleId;
    if (!vehicleMap.has(id)) vehicleMap.set(id, { vehicle: t.vehicle, trips: [], reservations: [] });
    vehicleMap.get(id)!.trips.push(t);
  });
  reservations.forEach(r => {
    const id = r.vehicleId;
    if (!vehicleMap.has(id)) vehicleMap.set(id, { vehicle: r.vehicle, trips: [], reservations: [] });
    vehicleMap.get(id)!.reservations.push(r);
  });

  if (vehicleMap.size === 0) { emptyMessage(sheet1, ds1 + 1, COLS1); }
  else {
    let rowIdx = 0;
    vehicleMap.forEach(({ vehicle, trips: vTrips, reservations: vResv }) => {
      const km = vTrips.reduce((s, t) => s + calculateTripDistance(t), 0);
      const agents = new Set(vTrips.map(t => t.userId)).size;
      const reservedHours = vResv.reduce((s, r) => {
        if (r.startTime && r.endTime) return s + durationHours(new Date(r.startTime), new Date(r.endTime));
        return s;
      }, 0);
      const startDate = meta.filters.startDate ? new Date(meta.filters.startDate) : new Date(Date.now() - 30 * 86400000);
      const endDate   = meta.filters.endDate   ? new Date(meta.filters.endDate)   : new Date();
      const utilRate  = calculateUtilizationRate(reservedHours, startDate, endDate);

      const row = sheet1.getRow(ds1 + 1 + rowIdx);
      row.getCell(1).value = vehicle?.service?.pole?.name || '—';
      row.getCell(2).value = `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim();
      row.getCell(3).value = vehicle?.plateNumber || '—';
      row.getCell(4).value = vTrips.length;
      row.getCell(5).value = km; row.getCell(5).numFmt = '#,##0';
      row.getCell(6).value = vTrips.length > 0 ? Math.round(km / vTrips.length * 10) / 10 : 0;
      row.getCell(7).value = agents;
      row.getCell(8).value = vResv.length;
      row.getCell(9).value = utilRate / 100; row.getCell(9).numFmt = '0.0%';
      styleDataRow(row, rowIdx % 2 === 1);
      rowIdx++;
    });
  }

  // Feuille 2 : Détail par véhicule
  const sheet2 = wb.addWorksheet('Détail par véhicule');
  const ds2 = addExcelMetadata(sheet2, meta, 8);
  const h2 = ['Date', 'Agent', 'Véhicule', 'Immatriculation', 'Km départ', 'Km retour', 'Km parcourus', 'Destination'];
  const w2 = [12, 22, 22, 15, 12, 12, 13, 28];
  const hr2 = sheet2.getRow(ds2);
  h2.forEach((h, i) => { hr2.getCell(i + 1).value = h; sheet2.getColumn(i + 1).width = w2[i]; });
  styleHeaderRow(hr2);

  if (trips.length === 0) { emptyMessage(sheet2, ds2 + 1, 8); }
  else {
    trips.forEach((trip, idx) => {
      const row = sheet2.getRow(ds2 + 1 + idx);
      row.getCell(1).value = new Date(trip.startTime); row.getCell(1).numFmt = 'DD/MM/YYYY';
      row.getCell(2).value = getInitials(trip.user?.name);
      row.getCell(3).value = `${trip.vehicle?.brand || ''} ${trip.vehicle?.model || ''}`.trim();
      row.getCell(4).value = trip.vehicle?.plateNumber || '—';
      row.getCell(5).value = trip.startMileage ?? 0; row.getCell(5).numFmt = '#,##0';
      row.getCell(6).value = trip.endMileage ?? 0;   row.getCell(6).numFmt = '#,##0';
      row.getCell(7).value = calculateTripDistance(trip); row.getCell(7).numFmt = '#,##0'; row.getCell(7).font = { bold: true };
      row.getCell(8).value = sanitizeExcelValue(trip.reservation?.destination || trip.destination || '—');
      styleDataRow(row, idx % 2 === 1);
    });
  }

  // Feuille 3 : Top motifs
  const sheet3 = wb.addWorksheet('Top motifs');
  const ds3 = addExcelMetadata(sheet3, meta, 3);
  const h3 = ['Destination / Motif', 'Nombre de trajets', 'Km total'];
  const w3 = [35, 18, 14];
  const hr3 = sheet3.getRow(ds3);
  h3.forEach((h, i) => { hr3.getCell(i + 1).value = h; sheet3.getColumn(i + 1).width = w3[i]; });
  styleHeaderRow(hr3);

  const destMap = new Map<string, { count: number; km: number }>();
  trips.forEach(t => {
    const dest = t.reservation?.destination || t.destination || 'Non renseigné';
    const entry = destMap.get(dest) || { count: 0, km: 0 };
    entry.count++;
    entry.km += calculateTripDistance(t);
    destMap.set(dest, entry);
  });
  const sorted = Array.from(destMap.entries()).sort((a, b) => b[1].count - a[1].count);
  sorted.forEach(([dest, { count, km }], idx) => {
    const row = sheet3.getRow(ds3 + 1 + idx);
    row.getCell(1).value = sanitizeExcelValue(dest);
    row.getCell(2).value = count;
    row.getCell(3).value = km; row.getCell(3).numFmt = '#,##0';
    styleDataRow(row, idx % 2 === 1);
  });

  return toBuffer(wb);
}

export async function generateActivityReportPDF(trips: any[], meta: ExportMetadata): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40,
    info: { Title: meta.reportName, Author: 'Gestion de Flotte APAJH' } });
  addPDFMetadata(doc, meta);

  // Tableau synthèse
  const cols = [
    { header: 'Pôle', width: 90 }, { header: 'Véhicule', width: 110 },
    { header: 'Immatriculation', width: 90 }, { header: 'Nb trajets', width: 65 },
    { header: 'Km total', width: 70 }, { header: 'Nb agents', width: 65 },
    { header: 'Nb réserv.', width: 75 }, { header: 'Taux util.', width: 71 },
  ];
  const startX = 40;
  let y = drawPDFTableHeader(doc, cols, startX, doc.y);

  // Agréger
  const vehicleMap = new Map<string, { vehicle: any; trips: any[] }>();
  trips.forEach(t => {
    if (!vehicleMap.has(t.vehicleId)) vehicleMap.set(t.vehicleId, { vehicle: t.vehicle, trips: [] });
    vehicleMap.get(t.vehicleId)!.trips.push(t);
  });

  let vIdx = 0;
  vehicleMap.forEach(({ vehicle, trips: vTrips }) => {
    if (y > 520) { doc.addPage(); y = 40; }
    const km = vTrips.reduce((s, t) => s + calculateTripDistance(t), 0);
    const agents = new Set(vTrips.map(t => t.userId)).size;
    const values = [
      vehicle?.service?.pole?.name || '—',
      `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim(),
      vehicle?.plateNumber || '—',
      String(vTrips.length),
      km.toLocaleString('fr-FR'),
      String(agents),
      '—',
      '—',
    ];
    y = drawPDFTableRow(doc, cols, values, startX, y, vIdx % 2 === 1);
    vIdx++;
  });

  if (vehicleMap.size === 0) {
    doc.fontSize(10).fillColor('#999').text('Aucune donnée sur la période sélectionnée.', { align: 'center' });
  }

  // Histogramme km par véhicule
  if (vehicleMap.size > 0) {
    doc.addPage();
    doc.fontSize(12).fillColor('#1F4E79').text('Kilomètres parcourus par véhicule', { align: 'center' });
    doc.moveDown(0.5);

    const data = Array.from(vehicleMap.entries()).map(([, v]) => ({
      label: v.vehicle?.plateNumber || '—',
      km: v.trips.reduce((s: number, t: any) => s + calculateTripDistance(t), 0),
    }));
    const maxKm = Math.max(...data.map(d => d.km), 1);
    const barMaxW = 400;
    const barH = 18;
    const labelW = 90;
    const chartX = 50;
    let cy = doc.y + 10;

    data.forEach((d, i) => {
      const barW = Math.round((d.km / maxKm) * barMaxW);
      doc.rect(chartX, cy, barW, barH).fill(i % 2 === 0 ? '#1F4E79' : '#2E75B6');
      doc.fillColor('#333').fontSize(7).text(d.label, chartX - labelW - 5, cy + 5, { width: labelW, align: 'right', lineBreak: false });
      doc.fillColor('#FFF').fontSize(7).text(`${d.km.toLocaleString('fr-FR')} km`, chartX + barW + 5, cy + 5, { lineBreak: false });
      cy += barH + 6;
    });
  }

  doc.moveDown(1);
  return pdfToBuffer(doc);
}

// ─── EXPORT 2 : Synthèse des coûts ───────────────────────────────────────────

export async function generateCostSummaryExcel(fuelLogs: any[], trips: any[], meta: ExportMetadata): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Synthèse des coûts');
  const COLS = 9;
  const ds = addExcelMetadata(sheet, meta, COLS);

  const headers = ['Pôle', 'Véhicule', 'Km total', 'Coût carburant (€)', 'Litres totaux', 'Conso (L/100km)', 'Coût entretien (€)', 'Coût assurance (€)', 'TCO total (€)'];
  const widths  = [18, 28, 12, 20, 14, 16, 20, 20, 16];
  const hr = sheet.getRow(ds);
  headers.forEach((h, i) => { hr.getCell(i + 1).value = h; sheet.getColumn(i + 1).width = widths[i]; });
  styleHeaderRow(hr);

  // Agréger par véhicule
  const vehicleMap = new Map<string, { vehicle: any; km: number; fuelCost: number; liters: number }>();
  trips.forEach(t => {
    const id = t.vehicleId;
    if (!vehicleMap.has(id)) vehicleMap.set(id, { vehicle: t.vehicle, km: 0, fuelCost: 0, liters: 0 });
    vehicleMap.get(id)!.km += calculateTripDistance(t);
  });
  fuelLogs.forEach(f => {
    const id = f.vehicleId;
    if (!vehicleMap.has(id)) vehicleMap.set(id, { vehicle: f.vehicle, km: 0, fuelCost: 0, liters: 0 });
    const entry = vehicleMap.get(id)!;
    entry.fuelCost += f.cost ?? 0;
    entry.liters   += f.liters ?? 0;
  });

  if (vehicleMap.size === 0) { emptyMessage(sheet, ds + 1, COLS); return toBuffer(wb); }

  let totalFuel = 0, totalKm = 0, rowIdx = 0;
  vehicleMap.forEach(({ vehicle, km, fuelCost, liters }) => {
    const conso = calculateConsumption(liters, km);
    const tco   = calculateTCO(fuelCost, 0, 0);
    totalFuel += fuelCost; totalKm += km;

    const row = sheet.getRow(ds + 1 + rowIdx);
    row.getCell(1).value = vehicle?.service?.pole?.name || '—';
    row.getCell(2).value = `${vehicle?.brand || ''} ${vehicle?.model || ''} (${vehicle?.plateNumber || '—'})`.trim();
    row.getCell(3).value = km; row.getCell(3).numFmt = '#,##0';
    row.getCell(4).value = fuelCost; row.getCell(4).numFmt = '#,##0.00 €';
    row.getCell(5).value = Math.round(liters * 10) / 10; row.getCell(5).numFmt = '#,##0.0';
    row.getCell(6).value = conso ?? '—';
    row.getCell(7).value = '—'; // pas de données coût entretien dans le schéma actuel
    row.getCell(8).value = '—'; // pas de données assurance
    row.getCell(9).value = tco; row.getCell(9).numFmt = '#,##0.00 €'; row.getCell(9).font = { bold: true };
    styleDataRow(row, rowIdx % 2 === 1);
    rowIdx++;
  });

  const totalRow = sheet.getRow(ds + 1 + rowIdx + 1);
  totalRow.getCell(1).value = 'TOTAL GÉNÉRAL'; totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(3).value = totalKm; totalRow.getCell(3).numFmt = '#,##0'; totalRow.getCell(3).font = { bold: true };
  totalRow.getCell(4).value = totalFuel; totalRow.getCell(4).numFmt = '#,##0.00 €'; totalRow.getCell(4).font = { bold: true };

  return toBuffer(wb);
}

// ─── EXPORT 3 : Taux d'utilisation ───────────────────────────────────────────

export async function generateUtilizationExcel(vehicles: any[], reservations: any[], meta: ExportMetadata): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Taux d'utilisation");
  const COLS = 8;
  const ds = addExcelMetadata(sheet, meta, COLS);

  const headers = ['Véhicule', 'Pôle', 'Jours ouvrés', 'Heures ouvrées', 'Heures réservées', 'Taux utilisation', 'Jours sans résv.', 'Statut actuel'];
  const widths  = [28, 18, 13, 15, 17, 17, 17, 14];
  const hr = sheet.getRow(ds);
  headers.forEach((h, i) => { hr.getCell(i + 1).value = h; sheet.getColumn(i + 1).width = widths[i]; });
  styleHeaderRow(hr);

  const startDate = meta.filters.startDate ? new Date(meta.filters.startDate) : new Date(Date.now() - 30 * 86400000);
  const endDate   = meta.filters.endDate   ? new Date(meta.filters.endDate)   : new Date();
  const workDays  = countWorkingDays(startDate, endDate);
  const workHours = workDays * 8;

  if (vehicles.length === 0) { emptyMessage(sheet, ds + 1, COLS); return toBuffer(wb); }

  vehicles.forEach((veh, idx) => {
    const vResv = reservations.filter(r => r.vehicleId === veh.id);
    const resvedHours = vResv.reduce((s, r) => {
      if (r.startTime && r.endTime) return s + durationHours(new Date(r.startTime), new Date(r.endTime));
      return s;
    }, 0);
    const utilRate = calculateUtilizationRate(resvedHours, startDate, endDate);

    // Jours sans réservation
    let daysWithResv = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) {
        const dateStr = current.toDateString();
        if (vResv.some(r => new Date(r.startTime).toDateString() === dateStr)) daysWithResv++;
      }
      current.setDate(current.getDate() + 1);
    }
    const daysWithout = workDays - daysWithResv;

    const row = sheet.getRow(ds + 1 + idx);
    row.getCell(1).value = `${veh.brand} ${veh.model} (${veh.plateNumber})`;
    row.getCell(2).value = veh.service?.pole?.name || '—';
    row.getCell(3).value = workDays;
    row.getCell(4).value = workHours;
    row.getCell(5).value = Math.round(resvedHours * 10) / 10;
    row.getCell(6).value = utilRate / 100; row.getCell(6).numFmt = '0.0%'; row.getCell(6).font = { bold: true };
    row.getCell(7).value = daysWithout;
    row.getCell(8).value = veh.status;
    styleDataRow(row, idx % 2 === 1);

    // Couleur conditionnelle taux
    const color = utilRate < 30 ? 'red' : utilRate <= 70 ? 'orange' : 'green';
    applyColorFill(row.getCell(6), color);
  });

  return toBuffer(wb);
}

// ─── EXPORT 7 : Historique carburant ─────────────────────────────────────────

export async function generateFuelHistoryExcel(fuelLogs: any[], meta: ExportMetadata): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Historique carburant');
  const COLS = 8;
  const ds = addExcelMetadata(sheet, meta, COLS);

  const headers = ['Date', 'Véhicule', 'Pôle', 'Agent', 'Litres', 'Coût (€)', 'Prix/litre (€)', 'Km au plein'];
  const widths  = [12, 28, 18, 22, 10, 12, 14, 14];
  const hr = sheet.getRow(ds);
  headers.forEach((h, i) => { hr.getCell(i + 1).value = h; sheet.getColumn(i + 1).width = widths[i]; });
  styleHeaderRow(hr);

  if (fuelLogs.length === 0) { emptyMessage(sheet, ds + 1, COLS); return toBuffer(wb); }

  let totalLiters = 0, totalCost = 0;
  fuelLogs.forEach((f, idx) => {
    const prixLitre = f.liters && f.cost ? Math.round((f.cost / f.liters) * 1000) / 1000 : null;
    totalLiters += f.liters ?? 0;
    totalCost   += f.cost   ?? 0;

    const row = sheet.getRow(ds + 1 + idx);
    row.getCell(1).value = new Date(f.date); row.getCell(1).numFmt = 'DD/MM/YYYY';
    row.getCell(2).value = `${f.vehicle?.brand || ''} ${f.vehicle?.model || ''} (${f.vehicle?.plateNumber || '—'})`.trim();
    row.getCell(3).value = f.vehicle?.service?.pole?.name || '—';
    row.getCell(4).value = f.user?.name || '—';
    row.getCell(5).value = f.liters ?? '—'; if (f.liters) row.getCell(5).numFmt = '#,##0.00';
    row.getCell(6).value = f.cost   ?? '—'; if (f.cost)   row.getCell(6).numFmt = '#,##0.00 €';
    row.getCell(7).value = prixLitre ?? '—'; if (prixLitre) row.getCell(7).numFmt = '#,##0.000 €';
    row.getCell(8).value = f.mileageAtFill ?? '—'; if (f.mileageAtFill) row.getCell(8).numFmt = '#,##0';
    styleDataRow(row, idx % 2 === 1);
  });

  const totalRow = sheet.getRow(ds + 1 + fuelLogs.length + 1);
  totalRow.getCell(1).value = 'TOTAL'; totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(5).value = Math.round(totalLiters * 100) / 100; totalRow.getCell(5).numFmt = '#,##0.00'; totalRow.getCell(5).font = { bold: true };
  totalRow.getCell(6).value = totalCost; totalRow.getCell(6).numFmt = '#,##0.00 €'; totalRow.getCell(6).font = { bold: true };

  return toBuffer(wb);
}

export async function generateFuelHistoryCSV(fuelLogs: any[], meta: ExportMetadata): Promise<string> {
  const headers = ['Date', 'Véhicule', 'Pôle', 'Agent', 'Litres', 'Coût (€)', 'Prix/litre (€)', 'Km au plein'];
  const rows = fuelLogs.map(f => {
    const prixLitre = f.liters && f.cost ? String(Math.round((f.cost / f.liters) * 1000) / 1000) : '—';
    return [
      formatDateMayotte(f.date),
      `${f.vehicle?.brand || ''} ${f.vehicle?.model || ''} (${f.vehicle?.plateNumber || '—'})`.trim(),
      f.vehicle?.service?.pole?.name || '—',
      f.user?.name || '—',
      String(f.liters ?? '—'), String(f.cost ?? '—'), prixLitre, String(f.mileageAtFill ?? '—'),
    ];
  });
  return addCSVMetadata(meta) + generateCSV(headers, rows);
}

// ─── EXPORT 8 : Rapport d'incidents ──────────────────────────────────────────

export async function generateIncidentReportExcel(incidents: any[], meta: ExportMetadata): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Rapport d'incidents");
  const COLS = 9;
  const ds = addExcelMetadata(sheet, meta, COLS);

  const headers = ['Date', 'Véhicule', 'Pôle', 'Signalé par', 'Sévérité', 'Description', 'Statut', 'Date résolution', 'Photo'];
  const widths  = [14, 24, 18, 22, 12, 40, 12, 15, 8];
  const hr = sheet.getRow(ds);
  headers.forEach((h, i) => { hr.getCell(i + 1).value = h; sheet.getColumn(i + 1).width = widths[i]; });
  styleHeaderRow(hr);

  if (incidents.length === 0) { emptyMessage(sheet, ds + 1, COLS); return toBuffer(wb); }

  incidents.forEach((inc, idx) => {
    const row = sheet.getRow(ds + 1 + idx);
    row.getCell(1).value = new Date(inc.createdAt); row.getCell(1).numFmt = 'DD/MM/YYYY HH:mm';
    row.getCell(2).value = `${inc.vehicle?.brand || ''} ${inc.vehicle?.model || ''} (${inc.vehicle?.plateNumber || '—'})`.trim();
    row.getCell(3).value = inc.vehicle?.service?.pole?.name || '—';
    row.getCell(4).value = inc.user?.name || '—';
    row.getCell(5).value = inc.severity;
    row.getCell(6).value = sanitizeExcelValue(inc.description || '—'); row.getCell(6).alignment = { wrapText: true };
    row.getCell(7).value = inc.status;
    row.getCell(8).value = inc.resolvedAt ? formatDateMayotte(inc.resolvedAt) : '—';
    row.getCell(9).value = inc.photoUrl ? 'Oui' : 'Non';
    styleDataRow(row, idx % 2 === 1);

    const severityColor: Record<string, 'red' | 'orange' | 'yellow' | 'gray'> = {
      CRITICAL: 'red', MAJOR: 'orange', MODERATE: 'yellow', MINOR: 'gray',
    };
    const col = severityColor[inc.severity] || 'gray';
    if (col !== 'gray') applyColorFill(row.getCell(5), col);
  });

  return toBuffer(wb);
}

export async function generateIncidentReportPDF(incidents: any[], meta: ExportMetadata): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40,
    info: { Title: meta.reportName, Author: 'Gestion de Flotte APAJH' } });
  addPDFMetadata(doc, meta);

  const cols = [
    { header: 'Date', width: 70 }, { header: 'Véhicule', width: 110 },
    { header: 'Signalé par', width: 100 }, { header: 'Sévérité', width: 65 },
    { header: 'Description', width: 200 }, { header: 'Statut', width: 65 }, { header: 'Résolution', width: 66 },
  ];
  const startX = 40;
  let y = drawPDFTableHeader(doc, cols, startX, doc.y);

  const severityColors: Record<string, string> = {
    CRITICAL: '#FFC7CE', MAJOR: '#FFCC99', MODERATE: '#FFFF99', MINOR: '#FFFFFF',
  };

  incidents.forEach((inc, idx) => {
    if (y > 520) { doc.addPage(); y = 40; }
    const bg = severityColors[inc.severity] || (idx % 2 === 1 ? '#F2F7FB' : '#FFFFFF');
    const values = [
      formatDateMayotte(inc.createdAt),
      `${inc.vehicle?.brand || ''} ${inc.vehicle?.model || ''} ${inc.vehicle?.plateNumber || ''}`.trim(),
      inc.user?.name || '—',
      inc.severity, inc.description || '—', inc.status,
      inc.resolvedAt ? formatDateMayotte(inc.resolvedAt) : '—',
    ];
    y = drawPDFTableRow(doc, cols, values, startX, y, idx % 2 === 1, 18, bg);
  });

  if (incidents.length === 0) {
    doc.fontSize(10).fillColor('#999').text('Aucun incident sur la période sélectionnée.', { align: 'center' });
  }

  return pdfToBuffer(doc);
}

export async function generateIncidentReportCSV(incidents: any[], meta: ExportMetadata): Promise<string> {
  const headers = ['Date', 'Véhicule', 'Pôle', 'Signalé par', 'Sévérité', 'Description', 'Statut', 'Date résolution', 'Photo'];
  const rows = incidents.map(inc => [
    formatDateTimeMayotte(inc.createdAt),
    `${inc.vehicle?.brand || ''} ${inc.vehicle?.model || ''} (${inc.vehicle?.plateNumber || '—'})`.trim(),
    inc.vehicle?.service?.pole?.name || '—',
    inc.user?.name || '—',
    inc.severity, inc.description || '—', inc.status,
    inc.resolvedAt ? formatDateMayotte(inc.resolvedAt) : '—',
    inc.photoUrl ? 'Oui' : 'Non',
  ]);
  return addCSVMetadata(meta) + generateCSV(headers, rows);
}

// ─── EXPORT 9 : Historique entretien ─────────────────────────────────────────

export async function generateMaintenanceHistoryExcel(alerts: any[], meta: ExportMetadata): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Historique d'entretien");
  const COLS = 6;
  const ds = addExcelMetadata(sheet, meta, COLS);

  const headers = ['Véhicule', 'Pôle', 'Type', 'Date échéance', 'Statut', 'Note'];
  const widths  = [30, 18, 22, 15, 12, 40];
  const hr = sheet.getRow(ds);
  headers.forEach((h, i) => { hr.getCell(i + 1).value = h; sheet.getColumn(i + 1).width = widths[i]; });
  styleHeaderRow(hr);

  if (alerts.length === 0) { emptyMessage(sheet, ds + 1, COLS); return toBuffer(wb); }

  alerts.forEach((alert, idx) => {
    const { label, color } = getExpiryStatus(alert.expiryDate);
    const row = sheet.getRow(ds + 1 + idx);
    row.getCell(1).value = `${alert.vehicle?.brand || ''} ${alert.vehicle?.model || ''} (${alert.vehicle?.plateNumber || '—'})`.trim();
    row.getCell(2).value = alert.vehicle?.service?.pole?.name || '—';
    row.getCell(3).value = alert.type;
    row.getCell(4).value = formatDateMayotte(alert.expiryDate);
    row.getCell(5).value = alert.isResolved ? 'Résolu' : label;
    row.getCell(6).value = alert.isResolved ? 'Traité' : '—';
    styleDataRow(row, idx % 2 === 1);
    if (!alert.isResolved) applyColorFill(row.getCell(5), color);
  });

  return toBuffer(wb);
}

export async function generateMaintenanceHistoryPDF(alerts: any[], meta: ExportMetadata): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 45,
    info: { Title: meta.reportName, Author: 'Gestion de Flotte APAJH' } });
  addPDFMetadata(doc, meta);

  const cols = [
    { header: 'Véhicule', width: 160 }, { header: 'Pôle', width: 90 },
    { header: 'Type', width: 90 }, { header: 'Date échéance', width: 80 }, { header: 'Statut', width: 90 },
  ];
  const startX = 45;
  let y = drawPDFTableHeader(doc, cols, startX, doc.y);

  alerts.forEach((alert, idx) => {
    if (y > 720) { doc.addPage(); y = 45; }
    const { label } = getExpiryStatus(alert.expiryDate);
    const values = [
      `${alert.vehicle?.brand || ''} ${alert.vehicle?.model || ''} (${alert.vehicle?.plateNumber || '—'})`.trim(),
      alert.vehicle?.service?.pole?.name || '—',
      alert.type, formatDateMayotte(alert.expiryDate),
      alert.isResolved ? 'Résolu' : label,
    ];
    y = drawPDFTableRow(doc, cols, values, startX, y, idx % 2 === 1);
  });

  if (alerts.length === 0) {
    doc.fontSize(10).fillColor('#999').text('Aucune alerte sur la période sélectionnée.', { align: 'center' });
  }

  return pdfToBuffer(doc);
}

export async function generateMaintenanceHistoryCSV(alerts: any[], meta: ExportMetadata): Promise<string> {
  const headers = ['Véhicule', 'Pôle', 'Type', 'Date échéance', 'Résolu', 'Statut'];
  const rows = alerts.map(a => {
    const { label } = getExpiryStatus(a.expiryDate);
    return [
      `${a.vehicle?.brand || ''} ${a.vehicle?.model || ''} (${a.vehicle?.plateNumber || '—'})`.trim(),
      a.vehicle?.service?.pole?.name || '—',
      a.type, formatDateMayotte(a.expiryDate),
      a.isResolved ? 'Oui' : 'Non',
      a.isResolved ? 'Résolu' : label,
    ];
  });
  return addCSVMetadata(meta) + generateCSV(headers, rows);
}

// ─── EXPORT 10 : Échéancier documents ────────────────────────────────────────

export async function generateDocumentScheduleExcel(vehicles: any[], meta: ExportMetadata): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Échéancier documents');
  const COLS = 8;
  const ds = addExcelMetadata(sheet, meta, COLS);

  const headers = ['Véhicule', 'Pôle', 'CT — Date expiration', 'CT — Statut', 'Km actuel', 'Type alerte', 'Date alerte', 'Statut alerte'];
  const widths  = [30, 18, 20, 18, 13, 20, 18, 18];
  const hr = sheet.getRow(ds);
  headers.forEach((h, i) => { hr.getCell(i + 1).value = h; sheet.getColumn(i + 1).width = widths[i]; });
  styleHeaderRow(hr);

  if (vehicles.length === 0) { emptyMessage(sheet, ds + 1, COLS); return toBuffer(wb); }

  let rowIdx = 0;
  vehicles.forEach(veh => {
    const { label: ctLabel, color: ctColor } = getExpiryStatus(veh.nextTechnicalInspection);

    // Ligne principale véhicule
    const row = sheet.getRow(ds + 1 + rowIdx);
    row.getCell(1).value = `${veh.brand} ${veh.model} (${veh.plateNumber})`;
    row.getCell(2).value = veh.service?.pole?.name || '—';
    row.getCell(3).value = veh.nextTechnicalInspection ? formatDateMayotte(veh.nextTechnicalInspection) : '—';
    row.getCell(4).value = ctLabel;
    row.getCell(5).value = veh.currentMileage ?? 0; row.getCell(5).numFmt = '#,##0';
    row.getCell(6).value = veh.maintenanceAlert?.[0]?.type || '—';
    row.getCell(7).value = veh.maintenanceAlert?.[0]?.expiryDate ? formatDateMayotte(veh.maintenanceAlert[0].expiryDate) : '—';
    row.getCell(8).value = veh.maintenanceAlert?.[0] ? getExpiryStatus(veh.maintenanceAlert[0].expiryDate).label : '—';
    styleDataRow(row, rowIdx % 2 === 1);
    applyColorFill(row.getCell(4), ctColor);
    if (veh.maintenanceAlert?.[0]) {
      applyColorFill(row.getCell(8), getExpiryStatus(veh.maintenanceAlert[0].expiryDate).color);
    }
    rowIdx++;
  });

  return toBuffer(wb);
}

export async function generateDocumentSchedulePDF(vehicles: any[], meta: ExportMetadata): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40,
    info: { Title: meta.reportName, Author: 'Gestion de Flotte APAJH' } });
  addPDFMetadata(doc, meta);

  const cols = [
    { header: 'Véhicule', width: 140 }, { header: 'Pôle', width: 80 },
    { header: 'CT — expiration', width: 95 }, { header: 'CT — statut', width: 95 },
    { header: 'Km actuel', width: 70 }, { header: 'Type alerte', width: 90 }, { header: 'Statut alerte', width: 106 },
  ];
  const startX = 40;
  let y = drawPDFTableHeader(doc, cols, startX, doc.y);

  const ctColors: Record<string, string> = {
    red: '#FFC7CE', orange: '#FFCC99', yellow: '#FFFF99', green: '#C6EFCE', gray: '#FFFFFF',
  };

  vehicles.forEach((veh, idx) => {
    if (y > 520) { doc.addPage(); y = 40; }
    const { label: ctLabel, color: ctColor } = getExpiryStatus(veh.nextTechnicalInspection);
    const alertStatus = veh.maintenanceAlert?.[0] ? getExpiryStatus(veh.maintenanceAlert[0].expiryDate).label : '—';
    const values = [
      `${veh.brand} ${veh.model} (${veh.plateNumber})`,
      veh.service?.pole?.name || '—',
      veh.nextTechnicalInspection ? formatDateMayotte(veh.nextTechnicalInspection) : '—',
      ctLabel,
      (veh.currentMileage ?? 0).toLocaleString('fr-FR'),
      veh.maintenanceAlert?.[0]?.type || '—',
      alertStatus,
    ];
    y = drawPDFTableRow(doc, cols, values, startX, y, idx % 2 === 1, 18, ctColors[ctColor] || '#FFFFFF');
  });

  if (vehicles.length === 0) {
    doc.fontSize(10).fillColor('#999').text('Aucune donnée disponible.', { align: 'center' });
  }

  return pdfToBuffer(doc);
}

export async function generateDocumentScheduleCSV(vehicles: any[], meta: ExportMetadata): Promise<string> {
  const headers = ['Véhicule', 'Pôle', 'CT — Date expiration', 'CT — Statut', 'Km actuel', 'Type alerte', 'Date alerte', 'Statut alerte'];
  const rows = vehicles.map(veh => {
    const { label: ctLabel } = getExpiryStatus(veh.nextTechnicalInspection);
    const alertStatus = veh.maintenanceAlert?.[0] ? getExpiryStatus(veh.maintenanceAlert[0].expiryDate).label : '—';
    return [
      `${veh.brand} ${veh.model} (${veh.plateNumber})`,
      veh.service?.pole?.name || '—',
      veh.nextTechnicalInspection ? formatDateMayotte(veh.nextTechnicalInspection) : '—',
      ctLabel, String(veh.currentMileage ?? 0),
      veh.maintenanceAlert?.[0]?.type || '—',
      veh.maintenanceAlert?.[0]?.expiryDate ? formatDateMayotte(veh.maintenanceAlert[0].expiryDate) : '—',
      alertStatus,
    ];
  });
  return addCSVMetadata(meta) + generateCSV(headers, rows);
}

// ─── EXPORT 11 : Fiche véhicule PDF ──────────────────────────────────────────

export async function generateVehicleCardPDF(vehicle: any, trips: any[], incidents: any[], fuelLogs: any[], cleaningSchedules: any[], meta: ExportMetadata, variant: 'summary' | 'detailed'): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 45,
    info: { Title: `Fiche véhicule — ${vehicle.brand} ${vehicle.model} ${vehicle.plateNumber}`, Author: 'Gestion de Flotte APAJH' } });

  // Page 1 : Identité
  doc.fontSize(18).fillColor('#1F4E79').text('APAJH Mayotte — Fiche Véhicule', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(variant === 'summary' ? 14 : 13).fillColor('#333')
    .text(`${vehicle.brand} ${vehicle.model} — ${vehicle.plateNumber}`, { align: 'center' });
  doc.fontSize(9).fillColor('#666')
    .text(`Généré le ${formatDateTimeMayotte(new Date())} | ${variant === 'summary' ? 'Version synthèse' : 'Version détaillée'}`, { align: 'center' });
  doc.moveDown(1);

  // Infos principales
  const infoLines = [
    ['Marque / Modèle', `${vehicle.brand} ${vehicle.model}`],
    ['Immatriculation', vehicle.plateNumber],
    ['Type carburant', vehicle.fuelType || '—'],
    ['Pôle', vehicle.service?.pole?.name || '—'],
    ['Service', vehicle.service?.name || '—'],
    ['Km actuel', (vehicle.currentMileage ?? 0).toLocaleString('fr-FR') + ' km'],
    ['Statut', vehicle.status],
    ['Type', vehicle.type],
    ['CT prochain', vehicle.nextTechnicalInspection ? formatDateMayotte(vehicle.nextTechnicalInspection) : '—'],
  ];

  const col1 = 45, col2 = 200, rowH = 18;
  let y = doc.y;
  infoLines.forEach(([label, value]) => {
    doc.fontSize(8).fillColor('#666').text(label, col1, y, { width: 140, lineBreak: false });
    doc.fontSize(8).fillColor('#222').font('Helvetica-Bold').text(value, col2, y, { width: 300, lineBreak: false });
    doc.font('Helvetica');
    y += rowH;
  });
  doc.y = y + 10;

  if (variant === 'summary') {
    // Résumé 3 derniers mois
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#1F4E79').text('Résumé activité (données disponibles)', { underline: true });
    doc.moveDown(0.3);
    const totalKm  = trips.reduce((s, t) => s + calculateTripDistance(t), 0);
    const agents   = new Set(trips.map(t => t.userId)).size;
    const totalL   = fuelLogs.reduce((s, f) => s + (f.liters ?? 0), 0);
    const totalCost= fuelLogs.reduce((s, f) => s + (f.cost   ?? 0), 0);
    const cleanDone= cleaningSchedules.filter(s => s.isDone).length;
    const openInc  = incidents.filter(i => i.status === 'OPEN').length;

    const summary = [
      `Trajets : ${trips.length}   |   Km parcourus : ${totalKm.toLocaleString('fr-FR')}   |   Agents : ${agents}`,
      `Carburant : ${Math.round(totalL * 10) / 10} L  (${totalCost.toFixed(2)} €)`,
      `Incidents ouverts : ${openInc}`,
      `Nettoyages effectués : ${cleanDone} / ${cleaningSchedules.length}`,
    ];
    summary.forEach(line => doc.fontSize(9).fillColor('#333').text(line));
    return pdfToBuffer(doc);
  }

  // ── Detailed ──

  // Page 2 : Trajets
  if (trips.length > 0) {
    doc.addPage();
    doc.fontSize(12).fillColor('#1F4E79').text('Historique des trajets (20 derniers)', { underline: true });
    doc.moveDown(0.4);
    const cols = [
      { header: 'Date', width: 65 }, { header: 'Agent', width: 120 },
      { header: 'Km dép.', width: 60 }, { header: 'Km ret.', width: 60 },
      { header: 'Km parc.', width: 65 }, { header: 'Destination', width: 155 },
    ];
    let ty = drawPDFTableHeader(doc, cols, 45, doc.y);
    trips.slice(0, 20).forEach((t, i) => {
      if (ty > 720) { doc.addPage(); ty = 45; }
      const vals = [
        formatDateMayotte(t.startTime), t.user?.name || '—',
        String(t.startMileage ?? 0), String(t.endMileage ?? 0),
        String(calculateTripDistance(t)),
        t.reservation?.destination || t.destination || '—',
      ];
      ty = drawPDFTableRow(doc, cols, vals, 45, ty, i % 2 === 1);
    });
  }

  // Page 3 : Incidents
  if (incidents.length > 0) {
    doc.addPage();
    doc.fontSize(12).fillColor('#1F4E79').text('Historique des incidents', { underline: true });
    doc.moveDown(0.4);
    const cols = [
      { header: 'Date', width: 70 }, { header: 'Agent', width: 110 },
      { header: 'Sévérité', width: 70 }, { header: 'Description', width: 200 }, { header: 'Statut', width: 75 },
    ];
    let iy = drawPDFTableHeader(doc, cols, 45, doc.y);
    incidents.forEach((inc, i) => {
      if (iy > 720) { doc.addPage(); iy = 45; }
      const vals = [
        formatDateMayotte(inc.createdAt), inc.user?.name || '—',
        inc.severity, inc.description || '—', inc.status,
      ];
      iy = drawPDFTableRow(doc, cols, vals, 45, iy, i % 2 === 1);
    });
  }

  // Page 4 : Entretien
  if (vehicle.maintenanceAlert?.length > 0) {
    doc.addPage();
    doc.fontSize(12).fillColor('#1F4E79').text("Historique d'entretien / alertes", { underline: true });
    doc.moveDown(0.4);
    const cols = [
      { header: 'Type', width: 120 }, { header: 'Date échéance', width: 100 },
      { header: 'Résolu', width: 70 }, { header: 'Statut', width: 235 },
    ];
    let my = drawPDFTableHeader(doc, cols, 45, doc.y);
    vehicle.maintenanceAlert.forEach((a: any, i: number) => {
      if (my > 720) { doc.addPage(); my = 45; }
      const { label } = getExpiryStatus(a.expiryDate);
      const vals = [a.type, formatDateMayotte(a.expiryDate), a.isResolved ? 'Oui' : 'Non', a.isResolved ? 'Résolu' : label];
      my = drawPDFTableRow(doc, cols, vals, 45, my, i % 2 === 1);
    });
  }

  // Page 5 : Carburant
  if (fuelLogs.length > 0) {
    doc.addPage();
    doc.fontSize(12).fillColor('#1F4E79').text('Historique carburant', { underline: true });
    doc.moveDown(0.4);
    const cols = [
      { header: 'Date', width: 70 }, { header: 'Agent', width: 130 },
      { header: 'Litres', width: 60 }, { header: 'Coût (€)', width: 80 }, { header: 'Km au plein', width: 185 },
    ];
    let fy = drawPDFTableHeader(doc, cols, 45, doc.y);
    fuelLogs.forEach((f, i) => {
      if (fy > 720) { doc.addPage(); fy = 45; }
      const vals = [
        formatDateMayotte(f.date), f.user?.name || '—',
        f.liters ? String(Math.round(f.liters * 100) / 100) : '—',
        f.cost   ? String(Math.round(f.cost   * 100) / 100) : '—',
        f.mileageAtFill ? f.mileageAtFill.toLocaleString('fr-FR') : '—',
      ];
      fy = drawPDFTableRow(doc, cols, vals, 45, fy, i % 2 === 1);
    });
  }

  // Page 6 : Nettoyage
  if (cleaningSchedules.length > 0) {
    doc.addPage();
    doc.fontSize(12).fillColor('#1F4E79').text('Historique nettoyage', { underline: true });
    doc.moveDown(0.4);
    const cols = [
      { header: 'Semaine', width: 80 }, { header: 'Agent(s)', width: 200 },
      { header: 'Effectué', width: 245 },
    ];
    let cy2 = drawPDFTableHeader(doc, cols, 45, doc.y);
    cleaningSchedules.forEach((sched, i) => {
      if (cy2 > 720) { doc.addPage(); cy2 = 45; }
      const agents = sched.assignments?.map((a: any) => a.user?.name).filter(Boolean).join(', ') || '—';
      const done = sched.isDone ? `✓ ${sched.logs?.[0]?.date ? formatDateMayotte(sched.logs[0].date) : 'Fait'}` : '✗ Non fait';
      const vals = [formatDateMayotte(sched.weekStart), agents, done];
      cy2 = drawPDFTableRow(doc, cols, vals, 45, cy2, i % 2 === 1, 22, sched.isDone ? '#C6EFCE' : (i % 2 === 1 ? '#FFF2F2' : '#FFFFFF'));
    });
  }

  doc.moveDown(1);
  doc.fontSize(8).fillColor('#999').text(`Généré le ${formatDateTimeMayotte(new Date())} — Heures locales Mayotte (UTC+3)`, { align: 'right' });
  return pdfToBuffer(doc);
}

// ─── EXPORT 12 : RGPD ─────────────────────────────────────────────────────────

export async function generateUserDataJSON(user: any, reservations: any[], trips: any[], incidents: any[], fuelLogs: any[], cleaningAssignments: any[]): Promise<string> {
  const data = {
    exportDate: new Date().toISOString(),
    notice: 'Export de vos données personnelles — Conformité RGPD Article 15',
    user: {
      name: user.name, email: user.email, role: user.role,
      department: user.department || null, createdAt: user.createdAt,
    },
    poles: user.userPoles?.map((p: any) => p.pole?.name).filter(Boolean) || [],
    services: user.userServices?.map((s: any) => s.service?.name).filter(Boolean) || [],
    reservations: reservations.map(r => ({
      date: formatDateMayotte(r.startTime),
      vehicle: `${r.vehicle?.brand || ''} ${r.vehicle?.model || ''} — ${r.vehicle?.plateNumber || ''}`.trim(),
      startTime: formatTimeMayotte(r.startTime),
      endTime:   formatTimeMayotte(r.endTime),
      destination: r.destination || null,
      approvalStatus: r.approvalStatus,
      passengers: r.passengers?.map((p: any) => p.user?.name).filter(Boolean) || [],
    })),
    trips: trips.map(t => ({
      date: formatDateMayotte(t.startTime),
      vehicle: `${t.vehicle?.brand || ''} ${t.vehicle?.model || ''} — ${t.vehicle?.plateNumber || ''}`.trim(),
      startMileage: t.startMileage, endMileage: t.endMileage,
      destination: t.destination || null, notes: t.notes || null,
    })),
    incidents: incidents.map(i => ({
      date: formatDateMayotte(i.createdAt),
      vehicle: `${i.vehicle?.brand || ''} ${i.vehicle?.model || ''} — ${i.vehicle?.plateNumber || ''}`.trim(),
      severity: i.severity, description: i.description, status: i.status,
    })),
    fuelLogs: fuelLogs.map(f => ({
      date: formatDateMayotte(f.date),
      vehicle: `${f.vehicle?.brand || ''} ${f.vehicle?.model || ''} — ${f.vehicle?.plateNumber || ''}`.trim(),
      liters: f.liters, cost: f.cost,
    })),
    cleaningAssignments: cleaningAssignments.map(ca => ({
      weekStart: formatDateMayotte(ca.schedule?.weekStart),
      vehicle: `${ca.schedule?.vehicle?.brand || ''} ${ca.schedule?.vehicle?.model || ''} — ${ca.schedule?.vehicle?.plateNumber || ''}`.trim(),
      completedAt: ca.completedAt ? formatDateMayotte(ca.completedAt) : null,
    })),
  };
  return JSON.stringify(data, null, 2);
}
