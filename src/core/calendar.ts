// Calendrier du jeu: jour et semaine ISO, dans un fuseau donne. Le serveur
// fixe le fuseau (le jeu vit a l'heure de Paris), le navigateur d'un invite
// utilise l'heure locale.

import type { Ctx } from './types';

export const GAME_TIME_ZONE = 'Europe/Paris';

interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

function dayIn(now: number, timeZone?: string): CalendarDay {
  if (!timeZone) {
    const d = new Date(now);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDay({ year, month, day }: CalendarDay): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Semaine ISO 8601 (AAAA-Snn) d'un jour du calendrier. */
export function isoWeek({ year, month, day }: CalendarDay): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = (date.getUTCDay() + 6) % 7; // lundi = 0
  date.setUTCDate(date.getUTCDate() - weekday + 3); // jeudi de la semaine
  const weekYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  const week =
    1 + Math.round((date.getTime() - firstThursday.getTime()) / 604_800_000);
  return `${weekYear}-S${pad(week)}`;
}

/** Contexte d'une action: horloge, jour, semaine et source de hasard. */
export function makeCtx(
  now: number,
  random: () => number,
  timeZone?: string,
): Ctx {
  const day = dayIn(now, timeZone);
  return { now, today: isoDay(day), week: isoWeek(day), random };
}
