import { test } from "node:test";
import assert from "node:assert/strict";
import {
  backupDeadline,
  backupDeadlineLabel,
  backupReminderAt,
} from "./backup-deadline.mjs";
const seconds = (text) => Date.parse(text) / 1000;
test("all times on the same Eastern date get the same end-of-day deadline", () => {
  for (const time of [
    "2026-10-06T00:01:00-04:00",
    "2026-10-06T16:45:00-04:00",
    "2026-10-06T23:59:59-04:00",
  ])
    assert.equal(
      backupDeadline(seconds(time)),
      seconds("2026-11-06T00:00:00-05:00"),
    );
  assert.equal(
    backupDeadlineLabel(backupDeadline(seconds("2026-10-06T12:00:00-04:00"))),
    "November 5, 2026 at 11:59:59 p.m. Eastern Time",
  );
});
test("calendar-day grace and reminders cross both daylight-saving transitions", () => {
  const spring = backupDeadline(seconds("2026-02-15T12:00:00-05:00"));
  assert.equal(spring, seconds("2026-03-18T00:00:00-04:00"));
  assert.equal(
    backupReminderAt(spring, 10),
    seconds("2026-03-07T09:00:00-05:00"),
  );
  assert.equal(
    backupReminderAt(spring, 1),
    seconds("2026-03-16T09:00:00-04:00"),
  );
  const fall = backupDeadline(seconds("2026-10-06T12:00:00-04:00"));
  assert.equal(
    backupReminderAt(fall, 10),
    seconds("2026-10-26T09:00:00-04:00"),
  );
  assert.equal(backupReminderAt(fall, 1), seconds("2026-11-04T09:00:00-05:00"));
});
