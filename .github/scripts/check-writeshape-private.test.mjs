import test from "node:test";
import assert from "node:assert/strict";
import { checkPrivateRelease } from "./check-writeshape-private.mjs";

const origin = "https://example.test";
const accessTeam = "qa-team";
const gate = (location = "https://qa-team.cloudflareaccess.com/cdn-cgi/access/login/example.test") =>
  new Response(null, { status: 302, headers: { location } });
const signatureRejection = () => Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
const check = fetchImpl => checkPrivateRelease({ origin, accessTeam, fetchImpl });

test("private endpoints require Access, while exact webhook rejects an unsigned event", async () => {
  const calls = [];
  const results = await check(async (url, options) => {
    calls.push({ url, options });
    return url.pathname === "/api/billing/webhook" ? signatureRejection() : gate();
  });
  assert.equal(results.length, 7);
  assert.ok(calls.some(({ url }) => url.pathname === "/api/billing/webhook/"));
  for (const { options } of calls) {
    assert.equal(options.redirect, "manual");
    assert.equal(options.headers?.Authorization, undefined);
    assert.equal(options.headers?.Cookie, undefined);
  }
  assert.equal(calls.at(-1).options.method, "POST");
  assert.equal(calls.at(-1).options.body, "{}");
});

for (const status of [200, 401, 403, 500]) {
  test(`does not mistake HTTP ${status} for a verified private Access gate`, async () => {
    await assert.rejects(check(async () => new Response(null, { status })), /expected an Access redirect/);
  });
}
for (const location of [
  "http://qa-team.cloudflareaccess.com/login",
  "https://qa-team.cloudflareaccess.com.attacker.test/login",
  "https://other-team.cloudflareaccess.com/login",
  "/login",
]) {
  test(`rejects an unexpected redirect destination: ${location}`, async () => {
    await assert.rejects(check(async () => gate(location)), /insecure redirect|configured Access team/);
  });
}
test("does not accept a webhook hidden behind Access", async () => {
  await assert.rejects(check(async () => gate()), /expected invalid-signature rejection/);
});
test("accepts the Worker's authenticated-route denial for the slash variant only", async () => {
  const reference = "8d8b52fc-1584-4442-869c-18dbdc45f92c";
  const denial = () => Response.json({ error: "Please sign in again.", reference }, {
    status: 401, headers: { "X-WriteShape-Request-ID": reference },
  });
  const results = await check(async url => {
    if (url.pathname === "/api/billing/webhook/") return denial();
    return url.pathname === "/api/billing/webhook" ? signatureRejection() : gate();
  });
  assert.ok(results.includes("/api/billing/webhook/: application authentication required"));
  await assert.rejects(check(async () => denial()), /expected an Access redirect/);
});
test("does not accept an arbitrary 401 page on the slash variant", async () => {
  for (const body of [{ error: "Unauthorized" }, { error: "Please sign in again." }]) {
    await assert.rejects(check(async url => url.pathname === "/api/billing/webhook/"
      ? Response.json(body, { status: 401 }) : gate()), /authentication denial|request reference/);
  }
});
test("does not accept unsigned webhooks or unrelated error pages", async () => {
  for (const response of [Response.json({ received: true }), Response.json({ error: "Other failure" }, { status: 400 })]) {
    await assert.rejects(check(async url => url.pathname === "/api/billing/webhook" ? response : gate()),
      /expected invalid-signature rejection|signature validation/);
  }
});
