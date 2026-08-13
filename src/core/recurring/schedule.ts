export type Cadence = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const pad = (value: number): string => String(value).padStart(2, '0');

const iso = (year: number, monthIndex: number, day: number): string =>
  `${year}-${pad(monthIndex + 1)}-${pad(day)}`;

export const nextDate = (date: string, cadence: Cadence): string => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];

  if (cadence === 'weekly') {
    const shifted = new Date(Date.UTC(y, m - 1, d + 7));
    return shifted.toISOString().slice(0, 10);
  }

  const addMonths = cadence === 'monthly' ? 1 : cadence === 'quarterly' ? 3 : 12;
  const monthIndex = m - 1 + addMonths;
  const year = y + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return iso(year, month, Math.min(d, lastDay));
};

export interface DueOccurrences {
  dates: string[];
  nextRun: string;
}

export const dueOccurrences = (
  nextRun: string,
  today: string,
  cadence: Cadence,
  cap = 120,
): DueOccurrences => {
  const dates: string[] = [];
  let run = nextRun;
  while (run <= today && dates.length < cap) {
    dates.push(run);
    run = nextDate(run, cadence);
  }
  return { dates, nextRun: run };
};
