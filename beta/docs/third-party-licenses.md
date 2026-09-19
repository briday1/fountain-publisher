# Distributed licenses

The application ships third-party notices with every build. **Help → Third-party licenses** opens `/licenses.html`; `/THIRD_PARTY_NOTICES.txt` supplies a downloadable copy. Both are generated from the same reviewed inventory, served during local development, included in the production build, and cached with the installed app for offline use. About, Privacy, and Terms also link to the notices. Repository visibility does not affect their availability.

## Current runtime

All supported editor entrypoints use `beta/src` and the same PDF publishing worker. PDF preview, screenplay export, highlighted export, beat-sheet export, and page measurements use the same composition code, `pdf-lib`, `@pdf-lib/fontkit`, and Courier Prime. The Python/Screenplain/ReportLab/Pyodide application and its launchers and build tooling are retired. Importing older Fountain annotations and recovering existing browser drafts remain supported.

The optional local account server uses Express. The hosted account service and collaboration adapter run on Cloudflare. Their configuration and credentials are separate from local installations; the independent Express server does not supply Cloudflare's durable collaboration rooms. This does not select a different editor, document format, or PDF engine.

## Release requirements

`build-tools/notices.ts` walks installed runtime dependencies and their runtime dependencies, optional dependencies, and required peers. Its reviewed inventory also accounts for software and data already bundled inside the PDF packages, which cannot be discovered from npm's production dependency list alone. Additional upstream notices are stored with immutable source references and hashes under `build-tools/licenses/`.

A dependency version, package metadata, notice text, or reviewed vendored artifact change stops the build pending review. Unknown license expressions and incomplete permission texts also stop the build. Adding an entry to the inventory is a review decision, not an automated approval of a package's license. Audit its bundled code, data, and fonts as well as its declared npm dependencies; preserve actual notices without inventing copyright holders or years from package author fields.

Keep the generated notice files and any accompanying original notice documents in every hosted release or packaged installation. The Pages publication check refuses a build missing its HTML or text notices. Tests verify that offline navigation opens the notice document itself instead of falling back to the editor.

## Private-source distribution

The reviewed third-party components retain their own licenses even if Fountain Publisher's source is private. Preserve their copyright and permission texts, applicable attribution and NOTICE material, and any required modification notices. Do not apply a proprietary restriction to the third-party components that contradicts rights their licenses grant.

Courier Prime remains under SIL OFL 1.1. Its notice accompanies the application and font assets. Font embedding does not change the license of the user's screenplay. See the [OFL text and FAQ](https://openfontlicense.org/) for the font's conditions, including redistribution and reserved-name rules.

This inventory does not assign a license to Fountain Publisher's first-party code or revoke licenses granted with earlier releases. Changes in repository visibility do not do either. New dependencies, new distribution formats, and changes to third-party source require a fresh review; an inventory check is not a general legal opinion.
