import { now } from "./http.mjs";

// This is the verified destination behind support@writeshape.com.
const supportInbox = "writeshape-support@agentmail.to";
export async function sendPendingFeedback(env) {
  if (!env.SUPPORT_EMAIL) return;
  const pending = await env.DB.prepare(
    `SELECT f.*,a.email FROM cancellation_feedback f JOIN accounts a ON a.id=f.account_id
     WHERE f.confirmed_at IS NOT NULL AND f.sent_at IS NULL AND f.next_attempt<=? ORDER BY f.created LIMIT 10`,
  )
    .bind(now())
    .all();
  for (const item of pending.results) {
    // A lease avoids sending the same notice from overlapping requests or cron runs.
    const claimed = await env.DB.prepare(
      `UPDATE cancellation_feedback SET next_attempt=?,attempts=attempts+1
       WHERE id=? AND sent_at IS NULL AND next_attempt<=? RETURNING id`,
    )
      .bind(now() + 300, item.id, now())
      .first();
    if (!claimed) continue;
    try {
      await env.SUPPORT_EMAIL.send({
        from: "support@writeshape.com",
        to: supportInbox,
        subject: `${item.billing_mode === "test" ? "[Test] " : ""}WriteShape Premium cancellation`,
        text: `Account: ${item.email}\nReference: ${item.id}\n\n${item.reason || "No reason provided."}`,
      });
      await env.DB.prepare(
        "UPDATE cancellation_feedback SET sent_at=? WHERE id=?",
      )
        .bind(now(), item.id)
        .run();
    } catch {
      await env.DB.prepare(
        "UPDATE cancellation_feedback SET next_attempt=? WHERE id=?",
      )
        .bind(
          now() + Math.min(86400, 900 * 2 ** Math.min(item.attempts, 7)),
          item.id,
        )
        .run();
      console.error(
        JSON.stringify({ event: "cancellation_feedback_delivery_pending" }),
      );
    }
  }
}
