from pathlib import Path


def replace(path, old, new):
    file = Path(path)
    source = file.read_text()
    if source.count(old) != 1:
        raise RuntimeError(f"{path}: expected one match for {old[:100]!r}; got {source.count(old)}")
    file.write_text(source.replace(old, new))


commands = 'beta/src/editor/commands.ts'
replace(commands, 'import { newId } from "../core/model";', 'import { newId } from "../core/model";\nimport { dualDialogueAt, setDualDialogue } from "./dualDialogue";')
replace(commands, '''export function setBlockKind(kind: BlockKind, dual = false): Command {
  return (state, dispatch) => {
    const { from, to, $from } = state.selection;''', '''export function setBlockKind(kind: BlockKind, dual = false): Command {
  return (state, dispatch, view) => {
    if (dual) return setDualDialogue(true)(state, dispatch, view);
    const pair = dualDialogueAt(state);
    const { from, to, $from } = state.selection;''')
replace(commands, '''      const tr = closeHistory(state.tr);
      for (const pos of positions) {''', '''      const tr = closeHistory(state.tr);
      if (pair?.active && pair.pair) {
        const cue = pair.pair.right.cue;
        tr.setNodeMarkup(cue.pos, undefined, { ...cue.node.attrs, dual: false });
      }
      for (const pos of positions) {''')
replace(commands, '          dual: kind === "character" ? dual : false,', '          dual: false,')
replace(commands, '''  if (view?.composing) return false;
  if (!dispatch) return true;
  const tr = closeHistory(state.tr).deleteSelection();''', '''  if (view?.composing) return false;
  if (!dispatch) return true;
  const inDual = dualDialogueAt(state)?.active ?? false;
  const tr = closeHistory(state.tr).deleteSelection();''')
replace(commands, '''          character: "dialogue",
          parenthetical: "dialogue",''', '''          character: "dialogue",
          parenthetical: "dialogue",
          dialogue: inDual ? "dialogue" : "action",''')

controller = 'beta/src/editor/EditorController.ts'
replace(controller, 'import { annotationPlugin } from "./annotations";', 'import { annotationPlugin } from "./annotations";\nimport { dualDialogueAt, dualDialoguePlugin } from "./dualDialogue";')
replace(controller, '        characterCompletion(),', '        dualDialoguePlugin(),\n        characterCompletion(),')
replace(controller, '''    const dual =
      kind === "character" &&
      Boolean(this.view.state.selection.$from.parent.attrs.dual);''', '''    const dual = dualDialogueAt(this.view.state)?.active ?? false;''')
replace(controller, '''    if (this.destroyed || this.view.composing || !this.writable) return false;
    const result = command(this.view.state, this.view.dispatch, this.view);''', '''    if (this.destroyed || this.view.composing || !this.writable) return false;
    syncNativeSelection(this.view);
    const result = command(this.view.state, this.view.dispatch, this.view);''')

toolbar = Path('beta/src/components/WritingToolbar.tsx')
s = toolbar.read_text()
start = s.index('        <div\n          className="writing-control-group writing-format-group"')
end = s.index('        <div\n          className="writing-control-group writing-story-group"', start)
s = s[:start] + '''        <FormatControls
          kind={kind}
          dualDialogue={dualDialogue}
          onKind={onKind}
          onMark={onMark}
        />
''' + s[end:]
for name in ['Bold', 'Italic', 'Underline']:
    s = s.replace(f'  {name},\n', '')
s = s.replace('import { blockLabels } from "../core/model";', 'import { FormatControls } from "./FormatControls";')
toolbar.write_text(s)

app = 'beta/src/App.tsx'
replace(app, 'import { WritingToolbar } from "./components/WritingToolbar";', 'import { WritingToolbar } from "./components/WritingToolbar";\nimport { FormatControls } from "./components/FormatControls";')
replace(app, '  const writingControls = (', '''  const changeElement = (value: BlockKind, dual = false) => {
    const changed = editor.current?.setKind(value, dual);
    if (dual && !changed)
      tell("Choose a character or dialogue next to another speech to create dual dialogue.");
  };
  const writingControls = (''')
replace(app, '      onKind={(value, dual = false) => editor.current?.setKind(value, dual)}', '      onKind={changeElement}')
s = Path(app).read_text()
start = s.index('        <button\n          className="document-name"')
end = s.index('        <button\n          className="save-button"', start)
original = s[start:end].rstrip()
s = s[:start] + '''        {mobile ? (
          <div className="mobile-header-format">
            <FormatControls
              kind={kind}
              dualDialogue={dualDialogue}
              onKind={changeElement}
              onMark={(mark) => editor.current?.toggleMark(mark)}
            />
          </div>
        ) : (
''' + original + '''
        )}
''' + s[end:]
Path(app).write_text(s)
replace(app, '''            <MenuItem onClick={() => void run(listWorkspace)}>
              Workspace…
            </MenuItem>''', '''            <MenuItem onClick={() => {
              setRename(snapshot.name);
              setDialog("rename");
            }}>
              Rename screenplay…
            </MenuItem>
            <MenuItem onClick={() => void run(listWorkspace)}>
              Workspace…
            </MenuItem>''')

css = Path('beta/src/components/mobile-command-panel.css')
css.write_text(css.read_text() + '''
@media (max-width: 950px) {
  .app-header {
    padding-inline: 8px;
    gap: 4px;
  }
  .app-header > .spacer {
    display: none;
  }
  .app-header > .mobile-header-format {
    display: flex;
    order: 1;
    flex: 1 1 auto;
    min-width: 0;
  }
  .mobile-header-format .writing-format-group {
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    height: 44px;
    padding: 0;
    border: 0;
    gap: 2px;
    background: transparent;
  }
  .mobile-header-format .writing-group-rule {
    display: none;
  }
  .mobile-header-format .writing-element {
    flex: 1 1 0;
    width: 0;
    min-width: 64px;
    min-height: 44px;
    height: 44px;
    padding: 4px;
    font-size: 12px;
    background: var(--raised);
    color: var(--ink);
  }
  .mobile-header-format .writing-tool {
    flex: 0 0 34px;
    width: 34px;
    min-width: 34px;
    height: 44px;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ink);
  }
  .mobile-header-format .writing-tool:hover,
  .mobile-header-format .writing-tool:active {
    background: var(--raised);
  }
}
''')

# Replace the earlier regression that incorrectly treated an isolated action as dual dialogue.
tests = Path('beta/tests/editor.test.ts')
s = tests.read_text()
start = s.index('it("sets and clears standard Fountain dual dialogue on a character cue",')
end = s.index('it("excludes character cues from spellcheck', start)
s = s[:start] + '''it("sets and clears dual dialogue without changing the selected speech", () => {
  const editor = create([
    ["character", "MARA"], ["dialogue", "First speech."],
    ["character", "ELI"], ["dialogue", "Second speech."],
  ]);
  select(editor, 1);
  expect(editor.setKind("character", true)).toBe(true);
  expect(editor.getBlocks()[2]).toMatchObject({ kind: "character", text: "ELI", dual: true });
  expect(serializeFountain(editor.getDocument(emptyScreenplay()))).toContain("ELI ^");
  expect(editor.setKind("character")).toBe(true);
  expect(editor.getBlocks()[2].dual).toBeUndefined();
  expect(editor.getBlocks()[1]).toMatchObject({ kind: "dialogue", text: "First speech." });
});

''' + s[end:]
tests.write_text(s)

tests = Path('beta/e2e/writing-toolbar.spec.ts')
s = tests.read_text()
start = s.index('test("element picker stays themed and exposes dual dialogue"')
end = s.index('test("writing controls stay in one compact row', start)
chunk = s[start:end]
chunk = chunk.replace('  await page.keyboard.type("MARA");', '''  await page.keyboard.type("MARA");
  await page.keyboard.press("Enter");
  await page.keyboard.type("First speech.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("ELI");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second speech.");''')
chunk = chunk.replace(').toHaveText("MARA");', ').toHaveText("ELI");')
chunk = chunk.replace('await element.selectOption("character");', 'await element.selectOption("single-dialogue");')
chunk = chunk.replace('await expect(element).toHaveValue("character");', 'await expect(element).toHaveValue("dialogue");')
tests.write_text(s[:start] + chunk + s[end:])

readme = Path('beta/README.md')
readme.write_text(readme.read_text() + '''
## Dual dialogue and mobile formatting

Place the caret in either adjacent character cue, dialogue, or parenthetical and choose **Dual dialogue** in the element picker. The command links whole speeches without changing the selected line's type or text. From a later speech it pairs with the preceding speech; from the first speech it uses the following one. Existing pairs cannot overlap, and scene/action boundaries are not crossed. Choose **Single dialogue** to unlink a pair from either column.

Both columns remain directly editable and wrap independently in the writing surface. Enter continues a dual speech; Enter again on an empty line exits it. Fountain and Final Draft exports keep the existing standard second-cue marker.

On mobile the header has the element picker and bold, italic, and underline controls in place of the filename. The File panel still displays the filename and provides **Rename screenplay…**.
''')
print('Applied dual-dialogue and mobile-header changes successfully.')
