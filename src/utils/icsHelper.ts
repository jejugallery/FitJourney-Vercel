/**
 * Helper utility to generate and download ICS calendar files entirely client-side.
 */

export const formatDateToICS = (iso: string): string => {
  if (!iso) return '';
  const hasTimezone = iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso);
  const dateStr = hasTimezone ? iso : iso + '+07:00';
  return new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

export const generateICSContent = (event: {
  name: string;
  startDatetimeIso: string;
  endDatetimeIso?: string;
  description?: string;
  location?: string;
}): string => {
  const start = formatDateToICS(event.startDatetimeIso);
  const adjustedStart = event.startDatetimeIso
    ? (event.startDatetimeIso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(event.startDatetimeIso)
        ? event.startDatetimeIso
        : event.startDatetimeIso + '+07:00')
    : '';
  const endIso = event.endDatetimeIso ||
    (adjustedStart ? new Date(new Date(adjustedStart).getTime() + 2 * 60 * 60 * 1000).toISOString() : '');
  const end = formatDateToICS(endIso);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FitJourney//TH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${event.name || 'กิจกรรม'}`,
    `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location || ''}`,
    `UID:fitjourney-${Date.now()}@fitjourneythailand.web.app`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
};

export const downloadICS = (event: {
  name: string;
  startDatetimeIso: string;
  endDatetimeIso?: string;
  description?: string;
  location?: string;
}) => {
  const content = generateICSContent(event);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${event.name || 'calendar'}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
