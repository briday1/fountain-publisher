// Keep www links on the existing application origin so device-local writing,
// OAuth return origins and shared document links retain their original home.
export default {
  fetch(request) {
    const destination = new URL(request.url);
    destination.protocol = "https:";
    destination.hostname = "fountain-publisher.com";
    destination.port = "";
    return Response.redirect(destination.toString(), 301);
  },
};
