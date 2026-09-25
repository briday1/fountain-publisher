import { act, Fragment } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, expect, it, vi } from "vitest";
import { ApplicationMenu } from "../src/components/ApplicationMenu";
import { Menu, MenuItem } from "../src/components/Menu";
import { WritingToolbar } from "../src/components/WritingToolbar";
import { defaults } from "../src/components/Settings";

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
const noop = () => {};
const controls = (
  <WritingToolbar
    kind="action"
    dualDialogue={false}
    onKind={noop}
    onMark={noop}
    preferences={defaults}
    onPreferences={noop}
    beatGuide={false}
    onBeatGuide={noop}
    onBeatSheet={noop}
    searchOpen={false}
    onSearch={noop}
    onPdf={noop}
    zen={false}
    onZen={noop}
    fullscreen={false}
    onFullscreen={noop}
  />
);
async function mount(children: ReactNode, mobile = true) {
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  await act(async () =>
    root.render(
      <ApplicationMenu
        mobile={mobile}
        controls={controls}
        filename="Draft.fountain"
      >
        {children}
      </ApplicationMenu>,
    ),
  );
  return {
    node,
    close: async () => {
      await act(async () => root.unmount());
      node.remove();
    },
  };
}
function button(node: ParentNode, name: string) {
  const found = [...node.querySelectorAll("button")].find(
    (b) => b.getAttribute("aria-label") === name || b.textContent === name,
  );
  if (!found) throw Error("Missing button: " + name);
  return found;
}
const click = async (node: ParentNode, name: string) => {
  await act(async () => button(node, name).click());
};
function fountainCommands(action: (name: string) => void) {
  return (
    <Fragment>
      <Menu label="File">
        <small>SCREENPLAY</small>
        <MenuItem onClick={() => action("new")}>New screenplay</MenuItem>
        <>
          <small>CONNECTED STORAGE</small>
          <MenuItem onClick={() => action("github-open")}>
            Open from GitHub…
          </MenuItem>
          <MenuItem onClick={() => action("github-save")}>
            Save to GitHub…
          </MenuItem>
          <>
            <MenuItem onClick={() => action("drive-open")}>
              Open from Google Drive…
            </MenuItem>
            <MenuItem onClick={() => action("drive-save")}>
              Save to Google Drive…
            </MenuItem>
          </>
          <hr />
        </>
        <small>PUBLISH</small>
        <MenuItem onClick={() => action("export")}>Export…</MenuItem>
      </Menu>
    </Fragment>
  );
}
it("discovers Fountain provider shortcuts inside nested conditional fragments and dismisses before opening them", async () => {
  const action = vi.fn((_name: string) =>
    expect(document.querySelector(".mobile-command-panel")).toBeNull(),
  );
  const h = await mount(fountainCommands(action));
  try {
    for (const [provider, expected] of [
      ["GitHub", "github-open"],
      ["Google Drive", "drive-open"],
    ]) {
      await click(h.node, "File");
      const shortcuts = h.node.querySelector(
        '[aria-label="Connected storage"]',
      )!;
      expect(shortcuts).not.toBeNull();
      await click(shortcuts, provider);
      expect(action).toHaveBeenLastCalledWith(expected);
      expect(h.node.querySelector("dialog")).toBeNull();
    }
  } finally {
    await h.close();
  }
});
it("categorizes fragment-wrapped Drive/GitHub saves under Share, preserving callbacks", async () => {
  const action = vi.fn();
  const h = await mount(fountainCommands(action));
  try {
    await click(h.node, "File");
    expect(
      h.node.querySelector('[aria-label="File commands"]')!.textContent,
    ).not.toContain("Save to Google Drive…");
    await click(
      h.node.querySelector('[aria-label="Command categories"]')!,
      "Share",
    );
    expect(
      h.node.querySelector('[aria-label="Share commands"]')!.textContent,
    ).toContain("Save to GitHub…");
    expect(h.node.textContent).toContain("Export…");
    await click(h.node, "Save to Google Drive…");
    expect(action).toHaveBeenCalledExactlyOnceWith("drive-save");
    expect(h.node.querySelector("dialog")).toBeNull();
  } finally {
    await h.close();
  }
});
it("keeps WriteShape unified open/save and local download in File without provider shortcuts", async () => {
  const action = vi.fn((_name: string) =>
    expect(document.querySelector(".mobile-command-panel")).toBeNull(),
  );
  const h = await mount(
    <Menu label="File">
      <small>SCREENPLAY</small>
      <MenuItem onClick={() => action("open")}>Open screenplay…</MenuItem>
      <MenuItem onClick={() => action("save-as")}>Save As…</MenuItem>
      <>
        <MenuItem onClick={() => action("download")}>
          Download local copy…
        </MenuItem>
      </>
      <small>PUBLISH</small>
      <MenuItem onClick={() => action("export")}>Export…</MenuItem>
    </Menu>,
  );
  try {
    for (const [label, expected] of [
      ["Open screenplay…", "open"],
      ["Save As…", "save-as"],
      ["Download local copy…", "download"],
    ]) {
      await click(h.node, "File");
      expect(
        h.node.querySelector('[aria-label="Connected storage"]'),
      ).toBeNull();
      await click(h.node.querySelector('[aria-label="File commands"]')!, label);
      expect(action).toHaveBeenLastCalledWith(expected);
    }
  } finally {
    await h.close();
  }
});
it("leaves Fountain desktop provider commands in their original File menu", async () => {
  const action = vi.fn();
  const h = await mount(fountainCommands(action), false);
  try {
    await click(h.node, "File");
    expect(h.node.querySelector(".mobile-command-panel")).toBeNull();
    await click(h.node, "Save to Google Drive…");
    expect(action).toHaveBeenCalledExactlyOnceWith("drive-save");
  } finally {
    await h.close();
  }
});
