// Shared boundary for both editor surfaces and scripted document commands.
// Native DOM readOnly/contentEditable flags are UI affordances, not this rule.
export function canMutateDocument({ readOnly = false, composing = false }, origin = "local") {
  if (origin === "load" || origin === "remote") return true;
  return !readOnly && !composing;
}

// Async clipboard/open operations must not apply coordinates from another
// revision (even if the new document happens to contain identical text).
export function captureEditTarget(state, value) {
  return { documentRevision: state.documentRevision, editRevision: state.editRevision, value };
}

export function isCurrentEditTarget(target, state, value) {
  return Boolean(target) && target.documentRevision === state.documentRevision
    && target.editRevision === state.editRevision && target.value === value
    && !state.previewComposing && !state.sourceComposing;
}
