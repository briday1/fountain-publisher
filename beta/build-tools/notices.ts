import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { noticesPage } from "./licenses-page";

const defaultRoot = fileURLToPath(new URL("../", import.meta.url));
interface VerifiedFile {
  path: string;
  sha256: string;
  section?: "license";
}
interface ReviewedPackage {
  license: string;
  packageJsonSha256: string;
  files: VerifiedFile[];
  supplements?: string[];
  artifacts?: VerifiedFile[];
}
interface SupplementalNotice {
  title: string;
  license: string;
  file: string;
  sha256: string;
  sources: string[];
}
interface NoticeInventory {
  packages: Record<string, ReviewedPackage>;
  supplements: Record<string, SupplementalNotice>;
  assets?: (VerifiedFile & { output: string })[];
}
interface Package {
  name: string;
  version: string;
  license?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}
const sha256 = (text: string | Buffer) =>
  createHash("sha256").update(text).digest("hex");

/** A new license requires a review; a bare name or URL is never sufficient. */
export function validateLicenseText(
  license: string,
  text: string,
  label: string,
) {
  const normalized = text
    .replace(/^\s*(?:\*|\/\/)\s?/gm, "")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ");
  const signatures: Record<string, RegExp[]> = {
    MIT: [
      /Permission is hereby granted, free of charge/i,
      /copyright notice and this permission notice/i,
      /THE SOFTWARE IS PROVIDED ["']AS IS["']/i,
    ],
    ISC: [
      /Permission to use, copy, modify,? and\/or distribute/i,
      /copyright notice and this permission notice/i,
      /THE SOFTWARE IS PROVIDED ["']AS IS["']/i,
    ],
    "0BSD": [
      /Permission to use, copy, modify,? and\/or distribute/i,
      /for any purpose with or without fee is hereby granted/i,
      /THE SOFTWARE IS PROVIDED ["']AS IS["']/i,
    ],
    "BSD-2-Clause": [
      /Redistribution and use in source and binary forms/i,
      /Redistributions of source code must retain/i,
      /Redistributions in binary form must reproduce/i,
      /THIS SOFTWARE IS PROVIDED/i,
    ],
    "BSD-3-Clause": [
      /Redistribution and use in source and binary forms/i,
      /Redistributions of source code must retain/i,
      /Redistributions in binary form must reproduce/i,
      /Neither the name/i,
      /THIS SOFTWARE IS PROVIDED/i,
    ],
    "OFL-1.1": [
      /SIL OPEN FONT LICENSE Version 1\.1/i,
      /PERMISSION & CONDITIONS/i,
      /Neither the Font Software nor any of its individual components/i,
      /TERMINATION/i,
      /DISCLAIMER/i,
    ],
    "Apache-2.0": [
      /Apache License Version 2\.0/i,
      /Grant of Patent License/i,
      /Redistribution/i,
      /END OF TERMS AND CONDITIONS/i,
    ],
    Zlib: [
      /origin of this software must not be misrepresented/i,
      /Altered source versions must be plainly marked/i,
      /notice may not be removed or altered from any source distribution/i,
    ],
    "Unicode-DFS-2016": [
      /COPYRIGHT AND PERMISSION NOTICE/i,
      /Permission is hereby granted, free of charge/i,
      /DATA FILES AND SOFTWARE ARE PROVIDED/i,
    ],
    "Unicode-DFS-2015": [
      /COPYRIGHT AND PERMISSION NOTICE/i,
      /Permission is hereby granted, free of charge/i,
      /clear notice in each modified Data File/i,
      /DATA FILES AND SOFTWARE ARE PROVIDED/i,
    ],
    ICU: [
      /Permission is hereby granted, free of charge/i,
      /copyright notice\(s\) and this permission notice/i,
      /THE SOFTWARE IS PROVIDED/i,
    ],
    HarfBuzz: [
      /Permission is hereby granted, without written agreement/i,
      /IN NO EVENT SHALL THE COPYRIGHT HOLDER/i,
    ],
    "Adobe-AFM": [
      /may be used, copied, and distributed for any purpose/i,
      /files are not distributed without this file/i,
    ],
  };
  for (const part of license.replace(/[()]/g, "").split(/\s+AND\s+/)) {
    if (!signatures[part])
      throw new Error(`Unreviewed license ${part} for ${label}`);
    if (!signatures[part].every((pattern) => pattern.test(normalized))) {
      throw new Error(`Incomplete ${part} license text for ${label}`);
    }
  }
}

async function verifiedText(directory: string, file: VerifiedFile) {
  const bytes = await readFile(join(directory, file.path));
  if (sha256(bytes) !== file.sha256) {
    throw new Error(`License review required: ${file.path} has changed`);
  }
  const text = bytes.toString("utf8");
  if (!file.section) return text;
  const section = text
    .match(/^#+\s+Licen[sc]e[^\n]*\n([\s\S]*)/im)?.[1]
    ?.split(/^#+\s/m)[0];
  if (!section) throw new Error(`Missing license section in ${file.path}`);
  return section;
}

/**
 * Offline, reproducible notices for production packages, optional account-server
 * dependencies, and reviewed code/data vendored inside prebuilt packages.
 * Version, metadata, notice and vendored-artifact changes require a new review.
 */
export async function buildDependencyNotices(
  root = defaultRoot,
  inventoryPath = join(root, "build-tools/licenses/inventory.json"),
): Promise<string> {
  const inventory = JSON.parse(
    await readFile(inventoryPath, "utf8"),
  ) as NoticeInventory;
  const inventoryDirectory = dirname(inventoryPath);
  const visited = new Set<string>();
  const notices = new Map<string, string>();
  const supplementalTexts = new Map<string, string>();
  async function supplement(id: string): Promise<string> {
    const cached = supplementalTexts.get(id);
    if (cached !== undefined) return cached;
    const notice = inventory.supplements[id];
    if (!notice) throw new Error(`Missing reviewed supplemental notice ${id}`);
    const text = await verifiedText(inventoryDirectory, {
      path: notice.file,
      sha256: notice.sha256,
    });
    validateLicenseText(notice.license, text, notice.title);
    supplementalTexts.set(id, text);
    notices.set(
      `Supplement: ${id}`,
      `${notice.title}\nLicense: ${notice.license}\nSource: ${notice.sources.join("\nSource: ")}\n\n${text}`,
    );
    return text;
  }
  async function visit(directory: string) {
    if (visited.has(directory)) return;
    visited.add(directory);
    const packageJson = await readFile(join(directory, "package.json"));
    const pkg = JSON.parse(packageJson.toString("utf8")) as Package;
    if (directory !== resolve(root)) {
      const id = `${pkg.name}@${pkg.version}`;
      const review = inventory.packages[id];
      if (!review) throw new Error(`License review required for ${id}`);
      if (
        pkg.license !== review.license ||
        sha256(packageJson) !== review.packageJsonSha256
      ) {
        throw new Error(
          `License review required: ${id} package metadata changed`,
        );
      }
      for (const artifact of review.artifacts ?? [])
        await verifiedText(directory, artifact);
      const texts = await Promise.all(
        review.files.map((file) => verifiedText(directory, file)),
      );
      const extra = await Promise.all(
        (review.supplements ?? []).map(supplement),
      );
      validateLicenseText(review.license, [...texts, ...extra].join("\n"), id);
      notices.set(
        id,
        `${pkg.name} ${pkg.version}\nLicense: ${review.license}\n\n${texts.join("\n\n")}` +
          (review.supplements?.length
            ? `\n\nAdditional license texts and incorporated notices: ${review.supplements.map((key) => inventory.supplements[key].title).join("; ")}. See the corresponding entries below.`
            : ""),
      );
    }
    const dependencies = {
      ...pkg.peerDependencies,
      ...pkg.dependencies,
      ...pkg.optionalDependencies,
    };
    for (const name of Object.keys(dependencies).sort()) {
      let parent = directory;
      for (;;) {
        const dependency = join(parent, "node_modules", name);
        try {
          await readFile(join(dependency, "package.json"));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          const next = dirname(parent);
          if (next === parent) {
            if (
              name in (pkg.optionalDependencies ?? {}) ||
              pkg.peerDependenciesMeta?.[name]?.optional
            )
              break;
            throw new Error(`Missing dependency ${name} for ${pkg.name}`);
          }
          parent = next;
          continue;
        }
        await visit(dependency);
        break;
      }
    }
  }
  await visit(resolve(root));
  return (
    "Fountain Publisher — third-party licenses and notices\n\n" +
    "These notices accompany the distributed application, fonts, PDF export components, and optional account-server dependencies. They apply to the identified third-party components; they do not change the license of your documents or Fountain Publisher's own code.\n\n" +
    [...notices]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, text]) => text)
      .join("\n\n----------------------------------------\n\n") +
    "\n"
  );
}

export function dependencyNotices(): Plugin {
  return {
    name: "dependency-notices",
    async generateBundle() {
      const text = await buildDependencyNotices();
      this.emitFile({
        type: "asset",
        fileName: "THIRD_PARTY_NOTICES.txt",
        source: text,
      });
      this.emitFile({
        type: "asset",
        fileName: "licenses.html",
        source: noticesPage(text),
      });
      const directory = join(defaultRoot, "build-tools/licenses");
      const inventory = JSON.parse(
        await readFile(join(directory, "inventory.json"), "utf8"),
      ) as NoticeInventory;
      for (const asset of inventory.assets ?? []) {
        this.emitFile({
          type: "asset",
          fileName: asset.output,
          source: await verifiedText(directory, asset),
        });
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split("?", 1)[0];
        if (path === "/licenses/Adobe-AFM-MustRead.html") {
          const directory = join(defaultRoot, "build-tools/licenses");
          void readFile(join(directory, "inventory.json"), "utf8")
            .then(async (text) => {
              const inventory = JSON.parse(text) as NoticeInventory;
              const asset = inventory.assets?.find(
                (item) => `/${item.output}` === path,
              );
              if (!asset)
                throw new Error("Missing reviewed Adobe AFM permission file");
              const source = await verifiedText(directory, asset);
              response.setHeader("Content-Type", "text/html; charset=utf-8");
              response.end(source);
            })
            .catch(next);
          return;
        }
        if (path !== "/THIRD_PARTY_NOTICES.txt" && path !== "/licenses.html") {
          next();
          return;
        }
        void buildDependencyNotices().then((text) => {
          response.setHeader(
            "Content-Type",
            path.endsWith(".html")
              ? "text/html; charset=utf-8"
              : "text/plain; charset=utf-8",
          );
          response.setHeader("Cache-Control", "no-store");
          response.end(path.endsWith(".html") ? noticesPage(text) : text);
        }, next);
      });
    },
  };
}

/** Run in both the main build and worker builds, after minification, before hashing. */
export function licenseAttribution(): Plugin {
  return {
    name: "license-attribution",
    renderChunk: {
      order: "post",
      handler(code, chunk) {
        const modules = Object.keys(chunk.modules)
          .join("\n")
          .replaceAll("\\", "/");
        let note =
          "Third-party licenses and notices: /THIRD_PARTY_NOTICES.txt; /licenses.html.";
        if (modules.includes("/node_modules/@pdf-lib/standard-fonts/")) {
          note +=
            " Adobe AFM metric data was converted to compressed JSON by @pdf-lib/standard-fonts and bundled here. The unmodified Adobe permission file accompanies this application at /licenses/Adobe-AFM-MustRead.html.";
        }
        if (modules.includes("/node_modules/@pdf-lib/fontkit/")) {
          note +=
            " Fontkit includes modified JavaScript ports of HarfBuzz, ICU, Google Brotli, and Joergen Ibsen's tinf, Node/browserify polyfills, and Unicode data transformed to compressed lookup tables. Fountain Publisher bundles and minifies the published implementations. Original copyright, license terms, and modification notices accompany this application in the files above.";
        }
        return { code: `/*! ${note} */\n${code}`, map: null };
      },
    },
  };
}
