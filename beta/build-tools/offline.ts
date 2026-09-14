import { createHash } from "node:crypto";
import type { Plugin } from "vite";

/** The offline HTML and its assets are one release; never replace only its HTML. */
export function offlineShell(): Plugin {
  return {
    name: "offline-writing-room",
    apply: "build",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const html = bundle["index.html"];
        if (!html || html.type !== "asset")
          throw new Error(
            "The offline build needs the generated application HTML.",
          );
        const assets = Object.keys(bundle)
          .filter((path) => path !== "index.html" && !path.endsWith(".map"))
          .map((path) => "/" + path);
        const version = createHash("sha256")
          .update(assets.join("\n"))
          .update(html.source)
          .digest("hex")
          .slice(0, 16);
        const shell = `/offline-shell-${version}.html`;
        const files = [
          shell,
          "/manifest.webmanifest",
          "/favicon.svg",
          ...assets,
        ];
        this.emitFile({
          type: "asset",
          fileName: shell.slice(1),
          source: html.source,
        });
        this.emitFile({
          type: "asset",
          fileName: "sw.js",
          source: `const CACHE='fp2-shell-${version}';
const SHELL=${JSON.stringify(shell)};
const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const alreadyInstalled=await caches.has(CACHE);
  const cache=await caches.open(CACHE);
  try{await cache.addAll(FILES.map(path=>new Request(path,{cache:'reload'})));}
  catch(error){if(!alreadyInstalled)await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=(await caches.keys()).filter(key=>key.startsWith('fp2-shell-')&&key!==CACHE);
  for(const key of keys.slice(0,-2))await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/beta/api/'))return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{const response=await fetch(request);if(response.ok)return response;}catch{}
      return (await (await caches.open(CACHE)).match(SHELL,{ignoreVary:true}))||Response.error();
    })());
    return;
  }
  if(FILES.includes(url.pathname)||url.pathname.startsWith('/assets/')){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const cached=await cache.match(request,{ignoreVary:true});
      if(cached)return cached;
      const response=await fetch(request);
      if(response.ok)event.waitUntil(cache.put(request,response.clone()));
      return response;
    })());
  }
});`,
        });
      },
    },
  };
}
