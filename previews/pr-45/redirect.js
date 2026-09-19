// Keep shared-document links intact on the retired beta domain and preview URLs.
const destination = new URL(location.href);
destination.protocol = "https:";
destination.host = "fountain-publisher.com";
destination.pathname = destination.pathname.replace(
  /^\/previews\/(?:beta|pr-\d+)(?:\/|$)/,
  "/",
);
if (destination.pathname === "/index.html") destination.pathname = "/";
location.replace(destination.href);
