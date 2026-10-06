const eastern = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
function parts(seconds) {
  return Object.fromEntries(
    eastern
      .formatToParts(new Date(seconds * 1000))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );
}
function midnight(date, hour = 0) {
  const target =
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hour,
    ) / 1000;
  let result = target;
  // Resolve the IANA offset at the target date, including DST transitions.
  for (let i = 0; i < 3; i++) {
    const p = parts(result);
    const local =
      Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) / 1000;
    result += target - local;
  }
  return result;
}
export function backupDeadline(endedAt) {
  const p = parts(endedAt);
  // Thirty calendar days after access ends, through the end of that Eastern date.
  return midnight(new Date(Date.UTC(p.year, p.month - 1, p.day + 31)));
}
export function backupReminderAt(deadline, daysLeft) {
  const p = parts(deadline - 1);
  return midnight(new Date(Date.UTC(p.year, p.month - 1, p.day - daysLeft)), 9);
}
export function backupDeadlineLabel(deadline) {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date((deadline - 1) * 1000)) +
    " at 11:59:59 p.m. Eastern Time"
  );
}
