const CACHE='fp2-shell-cd22f6ed788da29e';
const SHELL="/offline-shell-cd22f6ed788da29e.html";
const FILES=["/offline-shell-cd22f6ed788da29e.html","/manifest.webmanifest","/favicon.svg","/assets/courier-prime-latin-400-italic-CaR7PCvg.woff2","/assets/courier-prime-latin-ext-400-normal-B-EsvyE4.woff2","/assets/courier-prime-latin-400-normal-BbyBr73r.woff2","/assets/courier-prime-latin-ext-400-italic-BTeyNO-8.woff2","/assets/courier-prime-latin-700-normal-D1YCjmaD.woff2","/assets/courier-prime-latin-ext-700-normal-ByMJlNdM.woff2","/assets/courier-prime-latin-ext-700-italic-BzK4HIs4.woff2","/assets/courier-prime-latin-700-italic-CZikIXQl.woff2","/assets/courier-prime-latin-400-italic-GR5bBv_9.woff","/assets/courier-prime-latin-ext-400-normal-CKOCNFvK.woff","/assets/courier-prime-latin-400-normal-BAlbUm6l.woff","/assets/courier-prime-latin-ext-400-italic-DU0XzPqs.woff","/assets/courier-prime-latin-700-normal-CVvp4Sof.woff","/assets/courier-prime-latin-ext-700-normal-BIFoAzHx.woff","/assets/courier-prime-latin-ext-700-italic-DHJjmZA7.woff","/assets/courier-prime-latin-700-italic-Cxv_jV69.woff","/assets/index-QrnfgaWS.css","/assets/index-srbLPJnv.js","/assets/export-0Xtyd8HR.js","/assets/index-wfqlhpXR.js","/assets/fontkit.es-F6kXRIp7.js","/assets/index-Dz1sUzo-.js","/assets/index-fDdggEIY.js","/assets/fontkit.es-NacMhbjk.js","/assets/index-B0LVhTEE.js","/assets/publish.worker-BFjCy5DC.js","/THIRD_PARTY_NOTICES.txt","/licenses.html","/licenses/Adobe-AFM-MustRead.html"];
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
      const cache=await caches.open(CACHE);
      if(FILES.includes(url.pathname))return (await cache.match(url.pathname,{ignoreVary:true}))||Response.error();
      return (await cache.match(SHELL,{ignoreVary:true}))||Response.error();
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
});