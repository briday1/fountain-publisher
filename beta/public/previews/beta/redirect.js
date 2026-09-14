// Keep shared-document links intact on both the beta domain and its Pages URL.
const destination = new URL(location.href);
destination.protocol = "https:";
destination.host = "fountain-publisher.com";
destination.pathname = destination.pathname.replace(
  /^\/previews\/beta(?:\/|$)/,
  "/",
);
if (destination.pathname === "/index.html") destination.pathname = "/";
location.replace(destination.href);
