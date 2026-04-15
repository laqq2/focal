export interface MementoDisplayInput {
  label: string;
  birthYear?: number;
  /** ISO yyyy-mm-dd — preferred when set for day-accurate stats */
  birthDate?: string | null;
  lifeExpectancy: number;
  now?: Date;
}

export interface MementoDisplay {
  daysRemainingApprox: number;
  yearsMonthsRemaining: { years: number; months: number };
  daysTogetherApprox: number;
  progress: number;
}

function startOfDayUtc(d: Date) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function parseIsoDateLocal(iso: string): Date {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
}

export function computeMementoStats(input: MementoDisplayInput): MementoDisplay {
  const now = input.now ?? new Date();
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  let birthDay: number;
  let endDay: number;
  let birthYear: number;

  if (input.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) {
    const b = parseIsoDateLocal(input.birthDate);
    birthDay = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    birthYear = b.getFullYear();
    const end = new Date(b);
    end.setFullYear(end.getFullYear() + input.lifeExpectancy);
    endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  } else {
    const y = input.birthYear ?? 1990;
    birthYear = y;
    birthDay = Date.UTC(y, 0, 1);
    endDay = Date.UTC(y + input.lifeExpectancy, 0, 1);
  }

  const msPerDay = 86400000;
  const daysRemainingApprox = Math.max(0, Math.ceil((endDay - nowDay) / msPerDay));
  const daysTogetherApprox = Math.max(0, Math.floor((nowDay - birthDay) / msPerDay));
  const totalExpectedDays = Math.max(1, Math.floor((endDay - birthDay) / msPerDay));
  const progress = Math.min(1, Math.max(0, daysTogetherApprox / totalExpectedDays));

  const approxMonthsLeft = Math.max(0, Math.floor(daysRemainingApprox / 30.4375));
  const yearsPart = Math.floor(approxMonthsLeft / 12);
  const monthsPart = approxMonthsLeft % 12;

  return {
    daysRemainingApprox,
    yearsMonthsRemaining: { years: yearsPart, months: monthsPart },
    daysTogetherApprox,
    progress,
  };
}

/** Derive calendar year from DOB for legacy columns */
export function yearFromBirthDate(iso: string | null | undefined, fallbackYear: number) {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return parseInt(iso.slice(0, 4), 10);
  }
  return fallbackYear;
}
