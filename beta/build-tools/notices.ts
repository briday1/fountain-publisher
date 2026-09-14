import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

/** Carry the installed production packages' own license information into each release. */
export function dependencyNotices(): Plugin {
  const root = fileURLToPath(new URL("../", import.meta.url));
  return {
    name: "dependency-notices",
    apply: "build",
    async generateBundle() {
      const visited = new Set<string>();
      const notices = new Map<string, string>();
      const visit = async (directory: string) => {
        if (visited.has(directory)) return;
        visited.add(directory);
        const pkg = JSON.parse(
          await readFile(join(directory, "package.json"), "utf8"),
        ) as {
          name: string;
          version: string;
          license?: string;
          author?: unknown;
          contributors?: unknown;
          homepage?: string;
          dependencies?: Record<string, string>;
        };
        if (directory !== root.replace(/\/$/, "")) {
          const files = (await readdir(directory, { withFileTypes: true }))
            .filter(
              (entry) =>
                entry.isFile() &&
                /^(licen[sc]e|copying|ofl|notice)([._-].*)?$/i.test(entry.name),
            )
            .map((entry) => entry.name)
            .sort();
          const texts = await Promise.all(
            files.map((file) => readFile(join(directory, file), "utf8")),
          );
          if (!texts.length) {
            const readme = await readFile(join(directory, "README.md"), "utf8");
            const notice = readme
              .match(/^#+\s+Licen[sc]e[^\n]*\n([\s\S]*)/im)?.[1]
              ?.split(/^#+\s/m)[0]
              ?.trim();
            if (!notice)
              throw new Error(
                `Missing distributed license information for ${pkg.name}`,
              );
            texts.push(
              `${notice}\n\nPackage author: ${JSON.stringify(pkg.author ?? "")}` +
                `\nContributors: ${JSON.stringify(pkg.contributors ?? [])}\nSource: ${pkg.homepage ?? ""}`,
            );
          }
          notices.set(
            `${pkg.name}@${pkg.version}`,
            `${pkg.name} ${pkg.version}\nLicense: ${pkg.license ?? "See text below"}\n\n${texts.join("\n\n")}`,
          );
        }
        for (const name of Object.keys(pkg.dependencies ?? {})) {
          let parent = directory;
          for (;;) {
            const dependency = join(parent, "node_modules", name);
            try {
              await readFile(join(dependency, "package.json"));
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ENOENT")
                throw error;
              const next = dirname(parent);
              if (next === parent)
                throw new Error(`Missing dependency ${name} for ${pkg.name}`);
              parent = next;
              continue;
            }
            await visit(dependency);
            break;
          }
        }
      };
      await visit(resolve(root));
      this.emitFile({
        type: "asset",
        fileName: "THIRD_PARTY_NOTICES.txt",
        source:
          "Fountain Publisher — dependency notices\n\nBrowser and optional account-server dependencies.\n\n" +
          [...notices]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, text]) => text)
            .join("\n\n----------------------------------------\n\n"),
      });
    },
  };
}
