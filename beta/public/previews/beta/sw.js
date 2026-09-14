// Retire the beta offline shell without deleting drafts or interrupting an open editor.
self.addEventListener("install", (event) =>
  event.waitUntil(self.skipWaiting()),
);
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate" || event.request.method !== "GET")
    return;
  const destination = new URL(event.request.url);
  destination.protocol = "https:";
  destination.host = "fountain-publisher.com";
  destination.pathname = destination.pathname.replace(
    /^\/previews\/beta(?:\/|$)/,
    "/",
  );
  if (destination.pathname === "/index.html") destination.pathname = "/";
  event.respondWith(Response.redirect(destination.href, 302));
});
