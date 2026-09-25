export interface DestinationDraft {
  content: string;
  name: string;
}

export interface DestinationSnapshot extends DestinationDraft {
  revision: string;
}

export interface DestinationAdapter {
  read(): Promise<DestinationSnapshot>;
  /** Must reject stale revisions; never implement this as an unconditional write. */
  write(expected: DestinationSnapshot): Promise<DestinationSnapshot>;
}

export type DestinationPhase =
  | "pending"
  | "saving"
  | "saved"
  | "offline"
  | "conflict"
  | "error"
  | "readonly";

export interface DestinationStatus {
  phase: DestinationPhase;
  message: string;
  remote?: DestinationSnapshot;
}

export interface DestinationSyncOptions {
  adapter: DestinationAdapter;
  base: DestinationSnapshot;
  capture(): DestinationDraft;
  /** Atomically check the active binding and expectedLocal before replacing it.
   * Reject if either changed. Never overwrite a draft that changed while awaiting. */
  apply(
    remote: DestinationSnapshot,
    expectedLocal: DestinationDraft,
  ): Promise<void>;
  /** Persist only the synchronized base, preserving any newer local draft.
   * Async callbacks must also guard their binding after their own awaits. */
  acknowledge(remote: DestinationSnapshot): Promise<void>;
  onStatus(status: DestinationStatus): void;
  canWrite: boolean;
  debounceMs?: number;
  maxWaitMs?: number;
}

const equal = (a: DestinationDraft, b: DestinationDraft) =>
  a.content === b.content && a.name === b.name;

/** One instance per account/document/destination binding. Local recovery belongs
 * to DocumentSession and must run independently of this best-effort sync queue. */
export class DestinationSync {
  private base: DestinationSnapshot;
  private writable: boolean;
  private disposed = false;
  private conflicted = false;
  private paused = false;
  private queue: Promise<void> = Promise.resolve();
  private debounce?: ReturnType<typeof setTimeout>;
  private maximum?: ReturnType<typeof setTimeout>;
  private activeWrite = false;

  constructor(private readonly options: DestinationSyncOptions) {
    this.base = { ...options.base };
    this.writable = options.canWrite;
  }

  get dirty(): boolean {
    return !equal(this.options.capture(), this.base);
  }

  setWritable(writable: boolean): void {
    if (this.disposed) return;
    const changed = writable !== this.writable;
    this.writable = writable;
    if (changed) this.paused = false;
    this.changed();
  }

  changed(): void {
    if (this.disposed) return;
    if (!this.dirty) {
      this.clearTimers();
      if (!this.activeWrite && !this.conflicted && !this.paused)
        this.setSettledStatus();
      return;
    }
    if (!this.writable) {
      this.clearTimers();
      this.status(
        "readonly",
        "Local draft preserved. This destination is read-only.",
      );
      return;
    }
    if (this.conflicted || this.paused) return;
    this.status("pending", "Changes saved locally; synchronization pending.");
    this.schedule();
  }

  /** Explicit retry, except that a conflict always requires user resolution. */
  flush(retry = true): Promise<void> {
    this.clearTimers();
    return this.enqueue(async () => {
      if (!this.paused || retry) await this.save();
    });
  }

  /** Call on focus, online, a provider notification, or a bounded poll. */
  refresh(retry = true): Promise<void> {
    return this.enqueue(async () => {
      const remote = await this.options.adapter.read();
      if (this.disposed) return;
      const local = { ...this.options.capture() };
      if (equal(remote, local)) {
        await this.accept(remote);
        return;
      }
      const remoteChanged =
        remote.revision !== this.base.revision || !equal(remote, this.base);
      if (remoteChanged) {
        if (!equal(local, this.base) || this.conflicted) {
          this.conflict(remote);
          return;
        }
        await this.options.apply({ ...remote }, local);
        if (this.disposed) return;
        // The callback must perform its own atomic guard. This additional check
        // catches typing during an asynchronous apply without acknowledging it.
        if (!equal(this.options.capture(), remote)) {
          this.conflict(remote);
          return;
        }
        await this.accept(remote);
        return;
      }
      if (this.conflicted) return;
      if (this.paused && !retry) return;
      this.paused = false;
      await this.save();
    });
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.queue.then(async () => {
      if (this.disposed) return;
      try {
        await operation();
      } catch (error) {
        if (!this.disposed) this.failure(error);
      }
    });
    this.queue = next;
    return next;
  }

  private async save(): Promise<void> {
    if (this.disposed || this.conflicted) return;
    this.clearTimers();
    if (!this.writable) {
      this.status(
        "readonly",
        "Local draft preserved. This destination is read-only.",
      );
      return;
    }
    if (!this.dirty) {
      this.paused = false;
      this.setSettledStatus();
      return;
    }
    const captured = {
      ...this.options.capture(),
      revision: this.base.revision,
    };
    this.activeWrite = true;
    this.status("saving", "Synchronizing changes…");
    try {
      const remote = await this.options.adapter.write(captured);
      if (this.disposed) return;
      // Adapters must return the snapshot actually accepted by their provider.
      // A mismatched response cannot safely advance the local synchronization base.
      if (!equal(remote, captured)) {
        this.conflict(remote);
        return;
      }
      await this.accept(remote);
    } finally {
      this.activeWrite = false;
    }
  }

  private async accept(remote: DestinationSnapshot): Promise<void> {
    if (this.disposed) return;
    // A no-op poll must not persist/broadcast again: otherwise two instances
    // that announce acknowledgments can trigger an endless refresh cycle.
    if (remote.revision !== this.base.revision || !equal(remote, this.base)) {
      await this.options.acknowledge({ ...remote });
      if (this.disposed) return;
    }
    this.base = { ...remote };
    this.conflicted = false;
    this.paused = false;
    if (this.dirty) {
      this.status(
        this.writable ? "pending" : "readonly",
        this.writable
          ? "Newer changes saved locally; synchronization pending."
          : "Local draft preserved. This destination is read-only.",
      );
      if (this.writable) this.schedule();
    } else {
      this.clearTimers();
      this.setSettledStatus();
    }
  }

  private schedule(): void {
    if (this.debounce) clearTimeout(this.debounce);
    const run = () => {
      this.clearTimers();
      void this.enqueue(async () => {
        if (!this.paused && !this.conflicted) await this.save();
      });
    };
    this.debounce = setTimeout(run, this.options.debounceMs ?? 1000);
    this.maximum ??= setTimeout(run, this.options.maxWaitMs ?? 5000);
  }

  private clearTimers(): void {
    if (this.debounce) clearTimeout(this.debounce);
    if (this.maximum) clearTimeout(this.maximum);
    this.debounce = undefined;
    this.maximum = undefined;
  }

  private conflict(remote?: DestinationSnapshot): void {
    this.conflicted = true;
    this.clearTimers();
    this.status(
      "conflict",
      "Another instance changed this file. Your local draft is preserved; review both versions before saving.",
      remote,
    );
  }

  private failure(error: unknown): void {
    this.clearTimers();
    const detail = error as {
      status?: number;
      statusCode?: number;
      code?: string;
      message?: string;
    } | null;
    const status = detail?.status ?? detail?.statusCode;
    const code = String(detail?.code ?? "");
    const message = String(detail?.message ?? "");
    if (status === 409 || status === 412 || /CONFLICT/i.test(code)) {
      this.conflict();
      return;
    }
    this.paused = true;
    if (status === 403) {
      this.status(
        "readonly",
        "This destination denied the save. Your local draft is preserved.",
      );
    } else if (
      status === 0 ||
      /OFFLINE|NETWORK/i.test(code) ||
      error instanceof TypeError ||
      /offline|network|failed to fetch/i.test(message)
    ) {
      this.status(
        "offline",
        "Changes saved locally. Reconnect to synchronize this destination.",
      );
    } else {
      this.status(
        "error",
        "Synchronization could not complete. Your local draft is preserved; retry to check the destination.",
      );
    }
  }

  private setSettledStatus(): void {
    this.status(
      this.writable ? "saved" : "readonly",
      this.writable
        ? "Synchronized with this destination."
        : "This destination is read-only.",
    );
  }

  private status(
    phase: DestinationPhase,
    message: string,
    remote?: DestinationSnapshot,
  ): void {
    if (!this.disposed)
      this.options.onStatus({
        phase,
        message,
        ...(remote ? { remote: { ...remote } } : {}),
      });
  }
}
