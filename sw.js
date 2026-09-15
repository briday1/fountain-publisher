const CACHE='fp2-shell-7b28176a1ba9add5';
const SHELL="/offline-shell-7b28176a1ba9add5.html";
const FILES=["/offline-shell-7b28176a1ba9add5.html","/manifest.webmanifest","/favicon.svg","/assets/courier-prime-latin-ext-400-normal-B-EsvyE4.woff2","/assets/courier-prime-latin-400-normal-BbyBr73r.woff2","/assets/courier-prime-latin-ext-400-italic-BTeyNO-8.woff2","/assets/courier-prime-latin-400-italic-CaR7PCvg.woff2","/assets/courier-prime-latin-ext-700-normal-ByMJlNdM.woff2","/assets/courier-prime-latin-700-normal-D1YCjmaD.woff2","/assets/courier-prime-latin-ext-700-italic-BzK4HIs4.woff2","/assets/courier-prime-latin-700-italic-CZikIXQl.woff2","/assets/courier-prime-latin-400-normal-BAlbUm6l.woff","/assets/courier-prime-latin-ext-400-normal-CKOCNFvK.woff","/assets/courier-prime-latin-ext-400-italic-DU0XzPqs.woff","/assets/courier-prime-latin-400-italic-GR5bBv_9.woff","/assets/courier-prime-latin-700-normal-CVvp4Sof.woff","/assets/courier-prime-latin-ext-700-normal-BIFoAzHx.woff","/assets/courier-prime-latin-ext-700-italic-DHJjmZA7.woff","/assets/courier-prime-latin-700-italic-Cxv_jV69.woff","/assets/index-BtEIyA-A.css","/assets/index-I0tMZtkm.js","/assets/export-CKBICGs5.js","/assets/index-De8nm_h-.js","/assets/fontkit.es-Dyb_zuY0.js","/assets/index-Dn2ioIgP.js","/assets/index-DxEa_kac.js","/assets/fontkit.es-DnSO1DdL.js","/assets/index-Dc7YlXRz.js","/assets/publish.worker-CSvO8vvt.js","/THIRD_PARTY_NOTICES.txt"];
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
});