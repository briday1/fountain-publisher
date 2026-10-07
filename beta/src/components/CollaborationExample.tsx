import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { EditorSurface } from "./EditorSurface";
import { premiumSample } from "./premiumSampleData";
import { sampleBook } from "./BookPremiumExamples";
import { collaborationCursor } from "../editor/collaborationCursor";

/** Read-only illustration using the editor's real inline cursor styling. */
export function CollaborationExample({
  mode,
}: {
  mode: "book" | "screenplay";
}) {
  const book = mode === "book";
  const doc = book ? sampleBook : premiumSample;
  return (
    <div className="collaboration-concept" aria-label="Shared editing preview">
      <div className="collaboration-presence">
        <span className="collaborator-avatar">A</span>
        <span className="collaborator-avatar second">J</span>
        <span>
          Alex &amp; Jordan <small>Editing</small>
        </span>
      </div>
      <div className="collaboration-page" inert aria-hidden="true">
        <div className={`sample-document${book ? " novel-mode" : ""}`}>
          <article className="screenplay-paper">
            <EditorSurface
              key={mode}
              initial={{ ...doc, blocks: doc.blocks.slice(0, 8) }}
              onChange={() => {}}
              onSelection={() => {}}
              onReady={(editor) => {
                if (!editor) return;
                editor.setDestinationReadOnly(true);
                const decorations: Decoration[] = [];
                editor.view.state.doc.forEach((node, offset) => {
                  if (
                    decorations.length === 2 ||
                    !node.textContent ||
                    !["action", "dialogue"].includes(node.attrs.kind)
                  )
                    return;
                  const index = decorations.length;
                  // A word boundary within a paragraph survives responsive wrapping.
                  const space = node.textContent.indexOf(
                    " ",
                    Math.min(12, node.textContent.length - 1),
                  );
                  const position =
                    offset + 1 + (space < 0 ? node.textContent.length : space);
                  decorations.push(
                    Decoration.widget(
                      position,
                      () => {
                        const cursor = collaborationCursor({
                          name: index === 0 ? "Alex" : "Jordan",
                          color: index === 0 ? "#39765e" : "#87559c",
                        });
                        cursor.dataset.previewCursor =
                          index === 0 ? "Alex" : "Jordan";
                        return cursor;
                      },
                      { side: -1 },
                    ),
                  );
                });
                const cursors = DecorationSet.create(
                  editor.view.state.doc,
                  decorations,
                );
                editor.view.updateState(
                  editor.view.state.reconfigure({
                    plugins: [
                      ...editor.view.state.plugins,
                      new Plugin({
                        props: { decorations: () => cursors },
                      }),
                    ],
                  }),
                );
              }}
            />
          </article>
        </div>
      </div>
    </div>
  );
}
