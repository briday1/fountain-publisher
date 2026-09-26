import { driveRoutes } from "./drive.mjs";
import { sharingRoutes } from "./sharing.mjs";
import { libraryRoutes } from "./library.mjs";
export { identity } from "./access.mjs";
import { resolveAccount, accountRoutes } from "./accounts.mjs";
import { billingConfigured, billingRoutes, stripeWebhook } from "./billing.mjs";
import { json, HttpError } from "./http.mjs";
export function createHandler(authenticate = resolveAccount) {
  return async function handle(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      if (url.pathname === "/api/billing/webhook")
        return await stripeWebhook(request, env);
      const user = await authenticate(request, env);
      const accountResponse = await accountRoutes(
        request,
        env,
        user,
        billingConfigured(env),
      );
      if (accountResponse) return accountResponse;
      const billingResponse = await billingRoutes(request, env, user);
      if (billingResponse) return billingResponse;
      const driveResponse = await driveRoutes(request, env, user);
      if (driveResponse) return driveResponse;
      const sharingResponse = await sharingRoutes(request, env, user);
      if (sharingResponse) return sharingResponse;
      if (!url.pathname.startsWith("/api/library"))
        return json({ error: "Not found." }, 404);
      return await libraryRoutes(request, env, user);
    } catch (error) {
      const callback =
        request.method === "GET" &&
        (url.pathname === "/api/drive/callback"
          ? "drive"
          : url.pathname === "/api/auth/google/callback"
            ? "google"
            : null);
      if (callback) {
        // Keep OAuth codes, state, and provider diagnostics out of the editor URL.
        const stateCookie =
          callback === "drive"
            ? "__Host-writeshape_drive_oauth"
            : "__Host-writeshape_oauth";
        return new Response(null, {
          status: 303,
          headers: {
            Location: `https://writeshape.com/?connectionError=${callback}`,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
            "Set-Cookie": `${stateCookie}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
          },
        });
      }
      return json(
        {
          code: error instanceof HttpError ? error.code : undefined,
          error:
            error instanceof HttpError
              ? error.message
              : error instanceof SyntaxError
                ? "Invalid request."
                : "The request could not finish. Your local draft is unchanged.",
        },
        error instanceof HttpError
          ? error.status
          : error instanceof SyntaxError
            ? 400
            : 500,
      );
    }
  };
}
export default { fetch: createHandler() };
