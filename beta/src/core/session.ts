import type { Screenplay } from "./model";
import { newId } from "./model";
import { workspace } from "../storage/workspace";
import type { WorkspaceDocument } from "../storage/workspace";
import type { RemoteLocation } from "../storage/cloud";
export interface SessionEditor {
  getDocument(base: Screenplay): Screenplay;
  setDocument(doc: Screenplay): void;
}
export interface SessionSnapshot {
  id: string;
  name: string;
  screenplay: Screenplay;
  remote?: RemoteLocation;
  epoch: number;
}
type Repository = Pick<
  typeof workspace,
  "save" | "writeRecovery" | "setActiveId"
>;
export class DocumentSession {
  editor: SessionEditor | null = null;
  current: SessionSnapshot;
  private epoch = 0;
  private persistedEpoch = -1;
  private revisions = new Map<string, number | null>();
  private tail: Promise<void> = Promise.resolve();
  private timer?: ReturnType<typeof setTimeout>;
  private maximum?: ReturnType<typeof setTimeout>;
  private disposed = false;
  onSnapshot: (snapshot: SessionSnapshot) => void = () => {};
  onStatus: (status: "saving" | "saved" | "error", message?: string) => void =
    () => {};
  constructor(
    initial: WorkspaceDocument | SessionSnapshot,
    private repository: Repository = workspace,
  ) {
    this.current = {
      id: initial.id,
      name: initial.name,
      screenplay: initial.screenplay,
      remote: initial.remote,
      epoch: 0,
    };
    this.revisions.set(
      initial.id,
      "revision" in initial ? initial.revision : null,
    );
    this.persistedEpoch = "revision" in initial ? 0 : -1;
  }
  get dirty() {
    return this.epoch !== this.persistedEpoch;
  }
  capture(): SessionSnapshot {
    this.current = {
      ...this.current,
      screenplay:
        this.editor?.getDocument(this.current.screenplay) ??
        this.current.screenplay,
      epoch: this.epoch,
    };
    return this.current;
  }
  markChanged() {
    this.epoch++;
    this.onStatus("saving");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush().catch(() => {}), 350);
    if (!this.maximum)
      this.maximum = setTimeout(() => void this.flush().catch(() => {}), 1500);
  }
  updateMetadata(screenplay: Screenplay) {
    this.current = {
      ...this.current,
      screenplay: {
        ...this.current.screenplay,
        titlePage: screenplay.titlePage,
        metadata: screenplay.metadata,
      },
    };
    this.markChanged();
    this.onSnapshot(this.capture());
  }
  rename(name: string) {
    this.current = { ...this.current, name };
    this.markChanged();
    this.onSnapshot(this.capture());
  }
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    clearTimeout(this.maximum);
    this.timer = undefined;
    this.maximum = undefined;
    const snapshot = this.capture();
    this.onSnapshot(snapshot);
    if (!this.dirty) {
      await this.tail;
      return;
    }
    const task = this.tail
      .catch(() => {})
      .then(async () => {
        try {
          const saved = await this.repository.save(
            {
              id: snapshot.id,
              name: snapshot.name,
              screenplay: snapshot.screenplay,
              remote: snapshot.remote,
            },
            this.revisions.get(snapshot.id) ?? null,
          );
          this.revisions.set(snapshot.id, saved.revision);
          if (this.current.id === snapshot.id) {
            this.persistedEpoch = snapshot.epoch;
            if (this.epoch === snapshot.epoch) this.onStatus("saved");
          }
        } catch (error) {
          try {
            await this.repository.writeRecovery(
              snapshot.id,
              snapshot.screenplay,
              this.revisions.get(snapshot.id) ?? undefined,
            );
          } catch {
            /* The original error is surfaced; memory still owns the draft. */
          }
          if (this.current.id === snapshot.id)
            this.onStatus(
              "error",
              error instanceof Error
                ? error.message
                : "The draft could not be saved.",
            );
          throw error;
        }
      });
    this.tail = task;
    await task;
  }
  async open(
    screenplay: Screenplay,
    name: string,
    remote?: RemoteLocation,
    saved?: WorkspaceDocument,
  ): Promise<void> {
    const token = this.token();
    await this.flush();
    this.assertCurrent(token);
    this.epoch++;
    this.persistedEpoch = saved ? this.epoch : -1;
    this.current = {
      id: saved?.id ?? newId(),
      name,
      screenplay,
      remote: remote ?? saved?.remote,
      epoch: this.epoch,
    };
    this.revisions.set(this.current.id, saved?.revision ?? null);
    this.repository.setActiveId(this.current.id);
    this.editor?.setDocument(screenplay);
    this.onSnapshot(this.current);
    if (saved) this.onStatus("saved");
    else await this.flush();
  }
  token() {
    return { id: this.current.id, epoch: this.epoch };
  }
  assertCurrent(token: { id: string; epoch: number }) {
    if (token.id !== this.current.id || token.epoch !== this.epoch)
      throw new Error(
        "The screenplay changed while this request was running. Your current writing was kept. Try opening the file again.",
      );
  }
  setRemote(remote: RemoteLocation, token: { id: string; epoch: number }) {
    if (token.id !== this.current.id) return;
    this.current = { ...this.current, remote };
    this.markChanged();
    this.onSnapshot(this.capture());
  }
  async fork(): Promise<void> {
    const token = this.token();
    await this.tail.catch(() => {});
    if (token.id !== this.current.id)
      throw new Error("The active document changed. Try making a copy again.");
    const snapshot = this.capture();
    this.current = {
      ...snapshot,
      id: newId(),
      name: snapshot.name.replace(/\.fountain$/i, "") + " copy.fountain",
      remote: undefined,
    };
    this.revisions.set(this.current.id, null);
    this.epoch++;
    this.persistedEpoch = -1;
    this.repository.setActiveId(this.current.id);
    this.onSnapshot(this.capture());
    await this.flush();
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    clearTimeout(this.maximum);
  }
}
