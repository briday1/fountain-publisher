// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");
const styles = readFileSync(resolve(root, "src/styles.css"), "utf8");
const settings = readFileSync(
  resolve(root, "src/components/Settings.tsx"),
  "utf8",
);
const mobileSettings = readFileSync(
  resolve(root, "src/mobile-settings.css"),
  "utf8",
);

describe("mobile settings access", () => {
  it("keeps Settings available while the compact header hides other standalone shortcuts", () => {
    expect(app).toMatch(
      /className="menu-trigger"[\s\S]*?setDialog\("settings"\)[\s\S]*?>\s*Settings\s*<\/button>/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.menus > \.menu-trigger\s*{\s*display:\s*none;/,
    );
    expect(mobileSettings).toMatch(
      /@media \(max-width: 950px\)[\s\S]*?\.menus > \.menu-trigger:first-of-type\s*{[\s\S]*?display:\s*inline-flex;/,
    );
  });

  it("uses the screenplay page as the full mobile canvas", () => {
    expect(app).toMatch(/className="paper-wrap"/);
    expect(app).toMatch(/className={`screenplay-paper/);
    expect(mobileSettings).toMatch(
      /\.writing-scroll\s*{\s*background-color:\s*var\(--paper\);\s*background-image:\s*none;/,
    );
    expect(mobileSettings).toMatch(
      /\.paper-wrap\s*{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?margin:\s*0;/,
    );
    expect(mobileSettings).toMatch(
      /\.screenplay-paper\s*{\s*box-shadow:\s*none;/,
    );
  });

  it("removes the irrelevant workspace background control on mobile", () => {
    expect(settings).toMatch(
      /<label className="workspace-background-setting">\s*Workspace background/,
    );
    expect(mobileSettings).toMatch(
      /\.workspace-background-setting\s*{\s*display:\s*none;/,
    );
  });
});
