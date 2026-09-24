import { serializeFountain } from "./fountain";
import type { DocumentSession } from "./session";

/** Bind the response to the draft captured at submission, not the draft open later. */
export function captureWriteShapeSave<T extends { name: string }>(
  session: DocumentSession,
  associate: (item: T, localId: string) => void,
  isCurrentSession: () => boolean,
) {
  const snapshot = session.capture();
  return {
    content: serializeFountain(snapshot.screenplay),
    onSaved(item: T) {
      if (!isCurrentSession() || session.current.id !== snapshot.id) return;
      session.rename(item.name);
      associate(item, snapshot.id);
    },
  };
}
