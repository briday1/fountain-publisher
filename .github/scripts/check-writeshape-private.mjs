import assert from "node:assert/strict";
import { readFile, appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// No cookies, account tokens or Stripe credentials are sent by this smoke check.
// It checks the deployed boundary, not authenticated editing or provider approval.
export async function checkPrivateRelease({ origin, accessTeam, fetchImpl = fetch }) {
  const base = new URL(origin);
  assert.equal(base.protocol, "https:");
  assert.match(accessTeam, /^[a-z0-9-]+$/);
  const results = [];
  for (const path of [
    "/", "/api/account", "/api/library", "/api/drive/browser",
    "/api/billing", "/api/billing/webhook/",
  ]) {
    const response = await fetchImpl(new URL(path, base), {
      redirect: "manual", signal: AbortSignal.timeout(15000),
    });
    // Access may normalize a trailing slash when matching its webhook exception.
    // The Worker still treats only the exact path as a webhook; the slash variant
    // must either reach Access login or return its own authenticated-route denial.
    if (path === "/api/billing/webhook/" && response.status === 401) {
      const denial = await response.json();
      assert.equal(denial.error, "Please sign in again.", "Webhook slash: expected authentication denial");
      assert.match(denial.reference ?? "", /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        "Webhook slash: missing application request reference");
      assert.equal(response.headers.get("X-WriteShape-Request-ID"), denial.reference,
        "Webhook slash: mismatched application request reference");
      results.push(`${path}: application authentication required`);
      continue;
    }
    await response.body?.cancel();
    assert.ok([302, 303, 307, 308].includes(response.status),
      `${path}: expected an Access redirect, received ${response.status}`);
    const location = response.headers.get("location");
    assert.ok(location, `${path}: missing Access redirect`);
    const destination = new URL(location, base);
    assert.equal(destination.protocol, "https:", `${path}: insecure redirect`);
    assert.equal(destination.hostname, `${accessTeam}.cloudflareaccess.com`,
      `${path}: redirect did not reach the configured Access team`);
    results.push(`${path}: Access redirect verified`);
  }
  const response = await fetchImpl(new URL("/api/billing/webhook", base), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: "{}", redirect: "manual", signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 400,
    `Webhook: expected invalid-signature rejection, received ${response.status}`);
  assert.equal((await response.json()).error, "Invalid Stripe signature.",
    "Webhook: did not reach the application's signature validation");
  results.push("/api/billing/webhook: unsigned event rejected by signature validation");
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = JSON.parse(await readFile(
      new URL("../../beta/wrangler.writeshape.json", import.meta.url), "utf8"));
    assert.equal(config.vars.BILLING_MODE, "test", "Private release must use test billing");
    assert.notEqual(config.vars.PUBLIC_LAUNCH, "true", "Private release cannot enable public signup");
    assert.notEqual(config.vars.LIVE_BILLING_APPROVED, "true", "Private release cannot approve live billing");
    const results = await checkPrivateRelease({
      origin: config.vars.APP_ORIGIN, accessTeam: config.vars.ACCESS_TEAM,
    });
    console.log(results.join("\n"));
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY,
        "\n### Private deployment smoke\n\n" + results.map(line => `- ${line}`).join("\n") +
        "\n\nUnauthenticated boundary checks only; no customer data was changed.\n");
    }
  } catch (error) {
    // Never print a redirect URL, response body, credentials or customer data.
    console.error(`Private release check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
