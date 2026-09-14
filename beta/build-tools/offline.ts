import { createHash } from "node:crypto";
import type { Plugin } from "vite";
export function offlineShell(): Plugin {
  return {
    name: "offline-writing-room",
    apply: "build",
    generateBundle(_options, bundle) {
      const files = [
        "/",
        "/manifest.webmanifest",
        "/favicon.svg",
        ...Object.keys(bundle)
          .filter((path) => path !== "index.html" && !path.endsWith(".map"))
          .map((path) => "/" + path),
      ];
      const version = createHash("sha256")
        .update(files.join("\n"))
        .digest("hex")
        .slice(0, 16);
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `const CACHE='fp2-shell-${version}';const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=(await caches.keys()).filter(key=>key.startsWith('fp2-shell-'));for(const key of keys.slice(0,-3))await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const request=event.request;const url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/beta/api/'))return;if(request.mode==='navigate'){event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put('/',copy)));}return response;}).catch(()=>caches.match('/').then(response=>response||Response.error())));return;}if(FILES.includes(url.pathname)||url.pathname.startsWith('/assets/'))event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}return response;})));});`,
      });
    },
  };
}
