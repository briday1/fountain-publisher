# Beta deployment and rollback

## Topology

- Repository: `briday1/fountain-publisher`
- Branch: `beta/writing-first`
- App directory: `beta/`
- User URL: `https://beta.fountain-publisher.com`
- Static build storage: the existing Pages deployment's `previews/beta/` directory
- Cloudflare Worker: `fountain-publisher-beta`
- Shared account Worker: `fountain-publisher` (service binding)
- Shared API adapter: `https://api.fountain-publisher.com/beta/api/*`

The original production workflow preserves the entire `previews/` directory, so subsequent main releases keep beta. The beta workflow uses the same `pages-push` concurrency group as production pushes, and changes only its own preview subtree. It never replaces the primary application's files or CNAME.

## Routine frontend deployment

Make changes under `beta/`, run checks, commit, and push `beta/writing-first`. `.github/workflows/beta.yml` runs contract tests, browser tests, and `npm run build:beta`, then publishes the preserved Pages tree. No additional Cloudflare CI token is required for frontend changes.

## Cloudflare adapter changes

The infrastructure adapter is deployed separately from frontend builds. After testing changes:

```sh
cd beta
npm run check
npm run build:beta
npx wrangler deploy --dry-run
npx wrangler deploy
```

Wrangler uses the existing authenticated Cloudflare account. `wrangler.jsonc` binds the existing account service and creates the beta custom domain/certificate. No secrets are stored in this file, and no main-worker code is imported or copied into the beta implementation.

The Worker proxies public static assets from the preserved Pages beta subtree. Its bundled static assets remain useful for local dry runs; the configured Pages origin supplies hosted assets. Browser API requests bypass Pages entirely.

HTML, `sw.js`, and other mutable shell files bypass upstream CDN caching and return `no-store`. Hashed assets retain caching. Each service-worker release precaches its own versioned HTML with matching assets, so offline loading cannot mix deployments. Updates wait for existing clients to close; they do not reload an active writing session.

## OAuth callback routing

Two additional exact routes are registered on the existing API host:

- `api.fountain-publisher.com/auth/github/callback`
- `api.fountain-publisher.com/auth/google/callback`

These preserve the existing provider callback registrations. Main-origin responses pass through unchanged; beta-origin responses redirect only the popup message destination. Regression tests cover both paths and session-cookie preservation.

## Rollback

Revert the beta branch commit and push to publish its previous static build. For an adapter failure, use `npx wrangler rollback` for `fountain-publisher-beta` to restore its previous deployment.

To remove beta entirely, remove its two exact callback routes and `/beta/*` route first, returning callbacks to the original API custom-domain Worker, then remove the beta custom domain/Worker. The shared Worker, its D1 data, and its credentials must remain intact. Local browser drafts are origin-specific: export important beta drafts before retiring the beta origin.

## Eventual main migration

Keep the beta directory isolated until acceptance is complete. Promote the tested editor as a deliberate application migration rather than replacing the current root app during beta testing. Carry the new Fountain metadata reader and a migration strategy for local drafts and collaboration rooms into that change.
