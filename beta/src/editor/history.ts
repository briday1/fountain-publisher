import {
  closeHistory as closeStandaloneHistory,
  undo as standaloneUndo,
  redo as standaloneRedo,
} from "prosemirror-history";
import {
  undo as sharedUndo,
  redo as sharedRedo,
  yUndoPluginKey,
} from "y-prosemirror";
import type { Command, Transaction } from "prosemirror-state";

export const closeHistory = (tr: Transaction): Transaction =>
  closeStandaloneHistory(tr).setMeta("closeWritingHistory", true);
export const undo: Command = (state, dispatch, view) =>
  yUndoPluginKey.getState(state)
    ? dispatch
      ? sharedUndo(state)
      : yUndoPluginKey.getState(state)?.undoManager.canUndo() === true
    : standaloneUndo(state, dispatch, view);
export const redo: Command = (state, dispatch, view) =>
  yUndoPluginKey.getState(state)
    ? dispatch
      ? sharedRedo(state)
      : yUndoPluginKey.getState(state)?.undoManager.canRedo() === true
    : standaloneRedo(state, dispatch, view);
