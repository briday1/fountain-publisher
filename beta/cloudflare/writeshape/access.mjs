const decode = (value) =>
  Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
let cachedKeys;
export async function identity(request, env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new Error("Unauthorized");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Unauthorized");
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  const issuer = `https://${env.ACCESS_TEAM}.cloudflareaccess.com`;
  const now = Date.now() / 1000;
  if (
    header.alg !== "RS256" ||
    claims.iss !== issuer ||
    !Array.isArray(claims.aud) ||
    !claims.aud.includes(env.ACCESS_AUD) ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= now ||
    (claims.nbf && claims.nbf > now + 30) ||
    typeof claims.sub !== "string" ||
    !claims.sub ||
    claims.email !== env.TESTER_EMAIL
  )
    throw new Error("Unauthorized");
  if (!cachedKeys || cachedKeys.expires < Date.now()) {
    const response = await fetch(`${issuer}/cdn-cgi/access/certs`);
    if (!response.ok) throw new Error("Unauthorized");
    cachedKeys = {
      keys: (await response.json()).keys,
      expires: Date.now() + 300000,
    };
  }
  const jwk = cachedKeys.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Unauthorized");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decode(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1]),
    ))
  )
    throw new Error("Unauthorized");
  return { id: claims.sub, email: claims.email };
}
