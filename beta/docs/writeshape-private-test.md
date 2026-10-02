# WriteShape private test environment

WriteShape is prepared as an isolated Cloudflare Worker deployment at
`https://writeshape.com`. Fountain Publisher remains on its existing GitHub
Pages production path and is not changed by this deployment.

## Isolation boundaries

- Worker: `writeshape-private-test`, separate from `fountain-publisher-beta`.
- Collaboration: a new `LIVE_ROOMS` Durable Object namespace is created by the
  WriteShape worker migration. Existing Fountain Publisher rooms are not read,
  renamed or deleted.
- Device drafts and history: IndexedDB and service-worker storage are isolated
  naturally by the `writeshape.com` browser origin.
- Static assets: the WriteShape build is uploaded directly to the new Worker;
  it does not publish to or read from the Fountain Publisher GitHub Pages tree.
- Accounts: the adapter still delegates provider accounts to the existing
  account Worker. App-owned cloud documents are intentionally not claimed by
  this milestone.

## Required Cloudflare controls

Before the first deployment, create a Cloudflare Access self-hosted application
covering both `writeshape.com/*` and any alternate hostname that can serve the
Worker. Its policy must allow only the intended tester email and deny all other
identities. Do not enable a public bypass policy. Keep Worker preview URLs and
`workers.dev` disabled, as enforced by `wrangler.writeshape.jsonc`.

The Access application is the authorization boundary for this private test
milestone. Confirm in a private browser window that an unauthenticated visitor
is challenged and that a different authenticated account is denied.

## Deployment

The `WriteShape private test deployment` workflow is manual-only. Create the
GitHub environment `writeshape-private-test`, add a least-privilege
`CLOUDFLARE_API_TOKEN` environment secret, and run the workflow from the exact
commit intended for testing. The token needs only the permissions required to
deploy this Worker and its custom domain/route.

The workflow runs unit tests, builds with the same-origin `/beta/api` adapter,
validates the Worker bundle, and then deploys. It never writes the `gh-pages`
branch and does not run on pushes to `main`.

## Acceptance check

1. Fountain Publisher still loads at `https://fountain-publisher.com`.
2. An unauthenticated visit to `https://writeshape.com` reaches Cloudflare
   Access, not the editor.
3. The allowed tester can open WriteShape, create a local screenplay, close the
   browser and reopen the same draft.
4. The same browser profile shows independent document lists at the Fountain
   Publisher and WriteShape origins.
5. A WriteShape collaboration room never resolves to an existing Fountain
   Publisher Durable Object instance.

Provider OAuth and app-owned cloud documents require a later account-domain
migration. Do not treat local-origin isolation as server-side cloud document
isolation. The next backend milestone remains private cloud documents with
autosave, reopen, version recovery and account-isolation tests.
