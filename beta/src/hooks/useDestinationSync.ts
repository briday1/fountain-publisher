import { useEffect, useRef, useState } from "react";
import type { DocumentSession } from "../core/session";
import { DestinationSync } from "../core/destinationSync";
import type { DestinationStatus } from "../core/destinationSync";
import { serializeDocument } from "../core/documentFormat";
import { importScreenplay } from "../core/fdx";
import { destinationAdapter, destinationKey } from "../storage/destinations";
import { workspace } from "../storage/workspace";

export function useDestinationSync(
  session: DocumentSession | undefined,
  documentId: string | undefined,
  key: string,
  accountId: string | undefined,
  premium: boolean,
  enabled: boolean,
) {
  const engine = useRef<DestinationSync | undefined>(undefined);
  const [status, setStatus] = useState<DestinationStatus>();
  const currentAccount = useRef(accountId);
  currentAccount.current = accountId;
  useEffect(() => {
    setStatus(undefined);
    if (!enabled || !session || !session.current.destination) return;
    const original = session.current.destination;
    if (original.provider !== "local" && original.accountId !== accountId) {
      setStatus({
        phase: "readonly",
        message:
          "Sign in to the account for this destination. Your device draft is preserved.",
      });
      return;
    }
    let active = true;
    const matches = () =>
      active &&
      session.current.id === documentId &&
      destinationKey(session.current.destination) === key &&
      (original.provider === "local" ||
        currentAccount.current === original.accountId);
    const assertBinding = () => {
      if (!matches())
        throw Object.assign(new Error("The active destination changed."), {
          code: "LOCAL_CONFLICT",
        });
    };
    const capture = () => {
      const s = session.capture();
      return { content: serializeDocument(s.screenplay), name: s.name };
    };
    const adapter = destinationAdapter(() => {
      assertBinding();
      return session.current.destination!;
    });
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("writeshape-destination-sync")
        : undefined;
    const sync = new DestinationSync({
      adapter: {
        read: async () => {
          assertBinding();
          const result = await adapter.read();
          assertBinding();
          return result;
        },
        write: async (value) => {
          await session.flush();
          assertBinding();
          return adapter.write(value);
        },
      },
      base: {
        content: original.baseContent,
        name: original.name,
        revision: original.revision,
      },
      capture,
      canWrite: original.canWrite && (original.provider === "local" || premium),
      apply: async (remote, expected) => {
        assertBinding();
        const now = capture();
        if (now.content !== expected.content || now.name !== expected.name)
          throw Object.assign(new Error("Your draft changed."), {
            code: "LOCAL_CONFLICT",
          });
        const token = session.token();
        await session.flush();
        assertBinding();
        session.assertCurrent(token);
        await session.applyExternal(
          importScreenplay(remote.content, remote.name).screenplay,
          remote.name,
          token,
          assertBinding,
        );
        assertBinding();
      },
      acknowledge: async (remote) => {
        assertBinding();
        session.setDestination({
          ...session.current.destination!,
          name: remote.name,
          revision: remote.revision,
          baseContent: remote.content,
        });
        await session.flush();
        assertBinding();
        channel?.postMessage(key);
      },
      onStatus: (value) => {
        if (matches()) setStatus(value);
      },
    });
    engine.current = sync;
    const refresh = () => {
      if (document.visibilityState !== "hidden") void sync.refresh(false);
    };
    const visibility = () =>
      document.visibilityState === "hidden"
        ? void sync.flush(false)
        : refresh();
    channel &&
      (channel.onmessage = (event) => {
        if (event.data === key) refresh();
      });
    window.addEventListener("focus", refresh);
    const online = () => void sync.refresh();
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibility);
    const interval = setInterval(refresh, 15000);
    void sync.refresh();
    return () => {
      active = false;
      sync.dispose();
      channel?.close();
      clearInterval(interval);
      if (engine.current === sync) engine.current = undefined;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [session, documentId, key, accountId, premium, enabled]);
  useEffect(() => {
    if (!enabled || !session) return;
    let subscribed = true;
    const unsubscribe = workspace.subscribe((id) => {
      if (id !== session.current.id) return;
      if (session.dirty || engine.current?.dirty) {
        setStatus({
          phase: "conflict",
          message:
            "Another tab saved this device draft. Your writing is preserved; save a copy before loading it.",
        });
        engine.current?.dispose();
        return;
      }
      void workspace
        .load(id)
        .then(async (saved) => {
          if (
            !subscribed ||
            !saved ||
            saved.id !== session.current.id ||
            session.dirty ||
            engine.current?.dirty
          )
            return;
          await session.adoptWorkspace(saved);
          void engine.current?.refresh(false);
        })
        .catch(() => {});
    });
    return () => {
      subscribed = false;
      unsubscribe();
    };
  }, [enabled, session]);
  return { engine, status };
}
