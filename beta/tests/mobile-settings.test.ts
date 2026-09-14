import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const app = readFileSync(`${root}src/App.tsx`, "utf8");
const styles = readFileSync(`${root}src/styles.css`, "utf8");
const mobileSettings = readFileSync(`${root}src/mobile-settings.css`, "utf8");

describe("mobile settings access", () => {
  it("keeps Settings available while the compact header hides other standalone shortcuts", () => {
    expect(app).toMatch(
      /className="menu-trigger"[\s\S]*?setDialog\("settings"\)[\s\S]*?>\s*Settings\s*<\/button>/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.menus > \.menu-trigger\s*{\s*display:\s*none;/,
    );
    expect(mobileSettings).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.menus > \.menu-trigger:first-of-type\s*{[\s\S]*?display:\s*inline-flex;/,
    );
  });
});
