import { useState } from "react";
import { Modal } from "./Modal";
import { goalProgress, type WritingGoal } from "../core/writingGoals";
import type { useWritingGoals } from "./useWritingGoals";
import "./writing-goals.css";
export function WritingGoals({
  state,
  premium,
  onUpgrade,
}: {
  state: ReturnType<typeof useWritingGoals>;
  premium: boolean;
  onUpgrade: () => void;
}) {
  const [open, setOpen] = useState(false);
  const patch = (id: string, value: Partial<WritingGoal>) =>
    state.save(state.goals.map((g) => (g.id === id ? { ...g, ...value } : g)));
  const progress = (goal: WritingGoal) => {
    const value = goalProgress(goal, state.days);
    return (
      <div className="writing-goal" key={goal.id}>
        <div>
          <span>
            {goal.target.toLocaleString()} {goal.metric} / {goal.period}
          </span>
          <small>
            {Math.floor(value).toLocaleString()} /{" "}
            {goal.target.toLocaleString()}
          </small>
        </div>
        <progress
          aria-label={`${goal.metric} per ${goal.period}`}
          max={goal.target}
          value={Math.min(goal.target, value)}
        />
      </div>
    );
  };
  return (
    <section className="writing-goals" aria-label="Writing goals">
      <header>
        <h3>Writing goals</h3>
        <button onClick={() => (premium ? setOpen(true) : onUpgrade())}>
          {premium ? "Manage" : "Premium"}
        </button>
      </header>
      {premium && state.goals.length ? (
        state.goals.map(progress)
      ) : (
        <p>Make room for the writing you want to do.</p>
      )}
      {premium && state.goals.some((g) => g.metric !== "words") && (
        <button aria-pressed={state.running} onClick={state.toggleTimer}>
          {state.running ? "Pause writing timer" : "Start writing timer"}
        </button>
      )}
      {state.running && (
        <small>
          Timer armed · counts while you write, pauses after 30 seconds without
          edits.
        </small>
      )}
      {state.error && <p role="alert">{state.error}</p>}
      {open && premium && (
        <Modal title="Writing goals" onClose={() => setOpen(false)}>
          <p>
            Your words still count when you delete them. Goals and progress are
            saved for this account in this browser; they do not sync to other
            devices.
          </p>
          <div className="goal-editor">
            {state.goals.map((g, i) => (
              <fieldset key={g.id}>
                <legend>Goal {i + 1}</legend>
                <label>
                  Target
                  <input
                    aria-label={`Goal ${i + 1} target`}
                    type="number"
                    min="1"
                    max="10000000"
                    value={g.target}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (
                        Number.isFinite(value) &&
                        value >= 1 &&
                        value <= 10000000
                      )
                        patch(g.id, { target: value });
                    }}
                  />
                </label>
                <label>
                  Measure
                  <select
                    value={g.metric}
                    onChange={(e) =>
                      patch(g.id, {
                        metric: e.target.value as WritingGoal["metric"],
                      })
                    }
                  >
                    <option value="words">Words written</option>
                    <option value="minutes">Minutes writing</option>
                    <option value="hours">Hours writing</option>
                  </select>
                </label>
                <label>
                  Per
                  <select
                    value={g.period}
                    onChange={(e) =>
                      patch(g.id, {
                        period: e.target.value as WritingGoal["period"],
                      })
                    }
                  >
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </select>
                </label>
                <button
                  aria-label={`Remove goal ${i + 1}`}
                  onClick={() =>
                    state.save(state.goals.filter((goal) => goal.id !== g.id))
                  }
                >
                  Remove
                </button>
              </fieldset>
            ))}
          </div>
          <button
            disabled={state.goals.length >= 20}
            onClick={() =>
              state.save([
                ...state.goals,
                {
                  id: crypto.randomUUID(),
                  metric: "words",
                  target: 500,
                  period: "day",
                },
              ])
            }
          >
            Add goal
          </button>
          <details className="goal-counting">
            <summary>How progress is counted</summary>
            <p>
              New words typed here count across your documents, including new
              wording during revision. Continuing or correcting part of an
              existing word does not earn another word. Deleting never subtracts
              credit. Paste, import, reopening, undo/redo, and synced changes do
              not earn words.
            </p>
            <p>
              Start the timer to track writing time. It counts only while the
              editor is focused and visible, from your next edit until 30
              seconds after the last edit. It pauses in other tabs, dialogs and
              idle periods; reload starts paused.
            </p>
            <p>
              Days, Monday-start weeks and months use your local calendar.
              Changing targets does not erase progress. Current document word
              count is a separate statistic.
            </p>
          </details>
          <button onClick={() => setOpen(false)}>Done</button>
        </Modal>
      )}
    </section>
  );
}
