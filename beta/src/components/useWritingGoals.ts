import { useCallback, useEffect, useRef, useState } from "react";
import {
  goalPrefix,
  readGoals,
  readGoalDays,
  recordGoalActivity,
  recordGoalTime,
  type WritingGoal,
} from "../core/writingGoals";
export function useWritingGoals(
  accountId: string | undefined,
  enabled: boolean,
) {
  const scope = accountId || "signed-out",
    actor = useRef(crypto.randomUUID());
  const context = useRef({ scope, enabled });
  context.current = { scope, enabled };
  const [revision, refresh] = useState(0),
    [running, setRunning] = useState(false),
    [error, setError] = useState("");
  const runningRef = useRef(false),
    lastActivity = useRef(0),
    lastTick = useRef(Date.now());
  useEffect(() => {
    setRunning(false);
    runningRef.current = false;
    lastActivity.current = 0;
    setError("");
    refresh((n) => n + 1);
  }, [scope, enabled]);
  const notify = () => refresh((n) => n + 1);
  const onActivity = useCallback((words: number, pasted = false) => {
    if (!context.current.enabled) return;
    lastActivity.current = Date.now();
    if (!pasted && words > 0)
      try {
        recordGoalActivity(
          localStorage,
          context.current.scope,
          actor.current,
          new Date(),
          words,
          0,
        );
        refresh((n) => n + 1);
      } catch {
        setError(
          "Writing progress could not be saved in this browser. Your document is unaffected.",
        );
      }
  }, []);
  const toggleTimer = () => {
    runningRef.current = !runningRef.current;
    setRunning(runningRef.current);
    lastActivity.current = 0;
    lastTick.current = Date.now();
  };
  useEffect(() => {
    const tick = () => {
      const now = Date.now(),
        start = lastTick.current;
      lastTick.current = now;
      if (
        !runningRef.current ||
        !context.current.enabled ||
        document.visibilityState !== "visible" ||
        !document.hasFocus() ||
        !document.activeElement?.closest(".ProseMirror")
      )
        return;
      const end = Math.min(now, lastActivity.current + 30000);
      if (end > start && now - start < 15000)
        try {
          recordGoalTime(
            localStorage,
            context.current.scope,
            actor.current,
            start,
            end,
          );
          notify();
        } catch {
          setError("Writing time could not be saved in this browser.");
        }
    };
    const timer = setInterval(tick, 1000);
    const storage = (e: StorageEvent) => {
      if (e.key?.startsWith(goalPrefix + scope + ".")) notify();
    };
    const visibility = () => {
      lastTick.current = Date.now();
      lastActivity.current = 0;
    };
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", visibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", visibility);
    };
  }, [scope]);
  const save = (goals: WritingGoal[]) => {
    try {
      localStorage.setItem(
        goalPrefix + scope + ".targets",
        JSON.stringify(goals),
      );
      setError("");
      notify();
    } catch {
      setError("Goals could not be saved in this browser.");
    }
  };
  void revision;
  let goals: WritingGoal[] = [],
    days: ReturnType<typeof readGoalDays> = [];
  try {
    goals = readGoals(localStorage, scope);
    days = readGoalDays(localStorage, scope);
  } catch {}
  return { goals, days, running, error, onActivity, toggleTimer, save };
}
