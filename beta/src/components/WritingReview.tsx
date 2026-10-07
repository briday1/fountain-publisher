import { useEffect, useState } from "react";
import { RefreshCw, Undo2 } from "lucide-react";
import { Modal } from "./Modal";
import { MergeReview } from "./MergeReview";
import type { LiveClient } from "../collaboration/LiveClient";
import type { Screenplay, ScriptBlock } from "../core/model";
import type {
  AttributedSpan,
  WritingChange,
  WritingReview as Review,
} from "../core/changeReview";
import type { MergeChoice, MergeConflict } from "../core/merge";
import { apiBase } from "../storage/cloud";
import "./version-comparison.css";
interface ReviewResponse {
  screenplay: Screenplay;
  review: Review;
  revision: number;
  canEdit: boolean;
  name: string;
  merge?: { conflicts: MergeConflict[]; etag: string };
}
async function request(fileId: string, action: string, body?: unknown) {
  const response = await fetch(
    `${apiBase}/collaboration/${encodeURIComponent(fileId)}/${action}`,
    {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  const data = await response.json();
  if (!response.ok && data.code !== "REVIEW_CONFLICT")
    throw new Error(data.error || "The review could not be loaded.");
  return data;
}
const when = (time: number) =>
  new Date(time).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
function passage(
  block: ScriptBlock,
  spans: AttributedSpan[],
  select: (id: string) => void,
) {
  const bounds = [
    ...new Set([
      0,
      block.text.length,
      ...spans.flatMap((s) => [s.start, s.end]),
      ...(block.spans || []).flatMap((_s, i, list) => [
        list.slice(0, i).reduce((n, s) => n + s.text.length, 0),
        list.slice(0, i + 1).reduce((n, s) => n + s.text.length, 0),
      ]),
    ]),
  ].sort((a, b) => a - b);
  return bounds.slice(0, -1).map((start, index) => {
    const end = bounds[index + 1],
      writer = spans.find((s) => s.start <= start && s.end >= end);
    let position = 0;
    const marks = block.spans?.find((s) => {
      const found = start >= position && start < position + s.text.length;
      position += s.text.length;
      return found;
    })?.marks;
    const text = (
      <span
        style={{
          fontWeight: marks?.includes("bold") ? "bold" : undefined,
          fontStyle: marks?.includes("italic") ? "italic" : undefined,
          textDecoration: marks?.includes("underline")
            ? "underline"
            : undefined,
        }}
      >
        {block.text.slice(start, end)}
      </span>
    );
    return writer ? (
      <button
        type="button"
        key={start}
        className="writing-attribution"
        title={`${writer.author.name} · ${when(writer.at)}`}
        aria-label={`${block.text.slice(start, end)} · ${writer.author.name} · ${when(writer.at)}`}
        onClick={() => select(writer.changeId)}
      >
        {text}
        <span className="writing-attribution-label">
          {writer.author.name} · {when(writer.at)}
        </span>
      </button>
    ) : (
      <span key={start}>{text}</span>
    );
  });
}
export function WritingReview({
  fileId,
  client,
  onClose,
  onMerged,
}: {
  fileId: string;
  client?: LiveClient;
  onClose(): void;
  onMerged?(): Promise<void>;
}) {
  const [data, setData] = useState<ReviewResponse>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [conflict, setConflict] = useState<{
    change: WritingChange;
    conflicts: MergeConflict[];
    revision: number;
  }>();
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    void (async () => {
      if (client?.canCheckpoint) await client.checkpoint();
      const result = await request(fileId, "review");
      if (active) setData(result);
    })()
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [fileId, client, reload]);
  const undo = async (
    change: WritingChange,
    choices?: Record<string, MergeChoice>,
    revision?: number,
  ) => {
    setBusy(true);
    setError("");
    try {
      if (client) await client.checkpoint();
      const result = await request(fileId, "undo", {
        id: change.id,
        updatedAt: change.updatedAt,
        choices,
        revision,
      });
      if (result.code === "REVIEW_CONFLICT") {
        setConflict({
          change,
          conflicts: result.conflicts,
          revision: result.revision,
        });
        return;
      }
      setConflict(undefined);
      setNotice("Change undone. Other writing is kept.");
      setReload((n) => n + 1);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "The change could not be undone.";
      setError(message);
      if (choices) throw e;
    } finally {
      setBusy(false);
    }
  };
  const pending = client?.pendingMerge;
  return (
    <>
      <Modal
        title="Review changes"
        eyebrow={data?.name}
        wide
        className="writing-review-dialog"
        suspended={!!conflict || !!pending || !!data?.merge}
        onClose={() => {
          if (!busy) onClose();
        }}
      >
        <div className="writing-review-heading">
          <p>
            See who wrote each passage and when. Undo a change while keeping
            later writing that fits.
          </p>
          <button disabled={busy} onClick={() => setReload((n) => n + 1)}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert">{error}</p>}
        {busy && !data && <p role="status">Loading changes…</p>}
        {data && !data.merge && (
          <div className="writing-review-layout">
            <div
              className={`version-diff-paper writing-review-paper${data.screenplay.metadata.format === "markdown" ? " novel-review-paper" : ""}`}
              aria-label="Writing with authors"
            >
              {data.screenplay.blocks.map((block) => (
                <div className={`diff-block diff-${block.kind}`} key={block.id}>
                  <p>
                    {passage(
                      block,
                      data.review.attribution[block.id] || [],
                      (id) => {
                        setSelected(id);
                        document
                          .getElementById(`review-${id}`)
                          ?.scrollIntoView({ block: "nearest" });
                      },
                    )}
                  </p>
                  {!!data.review.attribution[block.id]?.length && (
                    <div className="writing-passage-authors">
                      {[
                        ...new Map(
                          data.review.attribution[block.id].map((s) => [
                            s.author.id,
                            s,
                          ]),
                        ).values(),
                      ].map((s) => (
                        <span key={s.author.id}>
                          {s.author.name}{" "}
                          <time dateTime={new Date(s.at).toISOString()}>
                            {when(s.at)}
                          </time>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <small className="muted">
                Earlier writing without recorded authorship has no writer label.
              </small>
            </div>
            <aside className="writing-change-list" aria-label="Recent changes">
              <h3>Recent changes</h3>
              {!data.review.changes.length && (
                <p>Changes will appear here as writers edit this document.</p>
              )}
              {[...data.review.changes].reverse().map((change) => (
                <article
                  key={change.id}
                  id={`review-${change.id}`}
                  className={`writing-change-card${selected === change.id ? " selected" : ""}`}
                >
                  <header>
                    <strong>{change.author.name}</strong>
                    <time
                      dateTime={new Date(change.updatedAt).toISOString()}
                      title={new Date(change.updatedAt).toLocaleString()}
                    >
                      {when(change.updatedAt)}
                    </time>
                  </header>
                  {change.order ? (
                    <p>Paragraph order changed</p>
                  ) : change.details ? (
                    <p>Document details and story notes</p>
                  ) : (
                    <p className="writing-change-excerpt">
                      {change.before && (
                        <del>{change.before.text || "Empty paragraph"}</del>
                      )}
                      {change.after && (
                        <ins>{change.after.text || "Empty paragraph"}</ins>
                      )}
                    </p>
                  )}
                  {change.undoOf && <small>Undid an earlier change</small>}
                  <button
                    disabled={busy || !data.canEdit || !!change.undoneBy}
                    onClick={() => void undo(change)}
                  >
                    <Undo2 size={14} />
                    {change.undoneBy ? "Undone" : "Undo this change"}
                  </button>
                </article>
              ))}
            </aside>
          </div>
        )}
      </Modal>
      {data?.merge && (
        <MergeReview
          conflicts={data.merge.conflicts}
          incomingLabel="Saved file changes"
          onClose={onClose}
          onSave={async (choices) => {
            await request(fileId, "merge", {
              choices,
              revision: data.revision,
              etag: data.merge!.etag,
            });
            await onMerged?.();
            setReload((n) => n + 1);
          }}
        />
      )}
      {pending && (
        <MergeReview
          conflicts={pending.conflicts}
          onClose={onClose}
          onSave={async (choices) => {
            await client!.resolveMerge(choices);
            setReload((n) => n + 1);
          }}
        />
      )}
      {conflict && (
        <MergeReview
          conflicts={conflict.conflicts}
          incomingLabel="Undo this change"
          onClose={() => setConflict(undefined)}
          onSave={(choices) =>
            undo(conflict.change, choices, conflict.revision)
          }
        />
      )}
    </>
  );
}
