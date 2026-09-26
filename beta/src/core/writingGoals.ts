export type GoalPeriod = "day" | "week" | "month";
export interface WritingGoal {
  id: string;
  metric: "words" | "minutes" | "hours";
  target: number;
  period: GoalPeriod;
}
export interface GoalDay {
  day: string;
  words: number;
  milliseconds: number;
}
export const goalPrefix = "writeshape.goals.v1.";
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function periodStart(period: GoalPeriod, now: Date): string {
  const date = new Date(now);
  if (period === "month") date.setDate(1);
  if (period === "week")
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return localDay(date);
}
export function goalProgress(
  goal: WritingGoal,
  days: GoalDay[],
  now = new Date(),
): number {
  const start = periodStart(goal.period, now),
    end = localDay(now);
  return days
    .filter((d) => d.day >= start && d.day <= end)
    .reduce(
      (sum, d) =>
        sum +
        (goal.metric === "words"
          ? d.words
          : d.milliseconds / (goal.metric === "hours" ? 3600000 : 60000)),
      0,
    );
}
export function readGoals(storage: Storage, scope: string): WritingGoal[] {
  try {
    const value = JSON.parse(
      storage.getItem(goalPrefix + scope + ".targets") || "[]",
    );
    return Array.isArray(value)
      ? value
          .filter(
            (g) =>
              g &&
              typeof g.id === "string" &&
              ["words", "minutes", "hours"].includes(g.metric) &&
              ["day", "week", "month"].includes(g.period) &&
              Number.isFinite(g.target) &&
              g.target > 0,
          )
          .slice(0, 20)
      : [];
  } catch {
    return [];
  }
}
export function readGoalDays(storage: Storage, scope: string): GoalDay[] {
  const result: GoalDay[] = [];
  const prefix = goalPrefix + scope + ".activity.";
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(prefix)) continue;
    try {
      const day = JSON.parse(storage.getItem(key) || "null");
      if (
        day &&
        /^\d{4}-\d{2}-\d{2}$/.test(day.day) &&
        Number.isFinite(day.words) &&
        day.words >= 0 &&
        Number.isFinite(day.milliseconds) &&
        day.milliseconds >= 0
      )
        result.push(day);
    } catch {
      /* Other valid entries remain usable. */
    }
  }
  return result;
}
/** Each page instance writes its own bucket, so concurrent tabs cannot overwrite credit. */
export function recordGoalActivity(
  storage: Storage,
  scope: string,
  actor: string,
  date: Date,
  words: number,
  milliseconds: number,
) {
  const day = localDay(date),
    key = goalPrefix + scope + ".activity." + day + "." + actor;
  let previous: GoalDay = { day, words: 0, milliseconds: 0 };
  try {
    const saved = JSON.parse(storage.getItem(key) || "null");
    if (
      saved &&
      Number.isFinite(saved.words) &&
      Number.isFinite(saved.milliseconds)
    )
      previous = saved;
  } catch {}
  storage.setItem(
    key,
    JSON.stringify({
      day,
      words: previous.words + Math.max(0, words),
      milliseconds: previous.milliseconds + Math.max(0, milliseconds),
    }),
  );
}
export function recordGoalTime(
  storage: Storage,
  scope: string,
  actor: string,
  start: number,
  end: number,
) {
  let cursor = start;
  while (cursor < end) {
    const midnight = new Date(cursor);
    midnight.setHours(24, 0, 0, 0);
    const next = Math.min(end, midnight.getTime());
    recordGoalActivity(
      storage,
      scope,
      actor,
      new Date(cursor),
      0,
      next - cursor,
    );
    cursor = next;
  }
}
