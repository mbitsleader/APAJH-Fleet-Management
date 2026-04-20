function padDatePart(value: number): string {
  return value.toString().padStart(2, '0');
}

export function formatLocalDate(date: Date): string {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-');
}

export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // If day is 0 (Sunday), diff is -6 (to last Monday). 
  // If day is 1 (Monday), diff is 0.
  // If day is 2 (Tuesday), diff is -1.
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatWeek(date: Date): string {
  const end = new Date(date);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  return `${date.toLocaleDateString('fr-FR', opts)} – ${end.toLocaleDateString('fr-FR', opts)}`;
}

export function isoWeek(d: Date): string {
  return formatLocalDate(d);
}
