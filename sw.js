const CACHE='fp2-shell-cc4524bb3b529203';
const SHELL="/offline-shell-cc4524bb3b529203.html";
const FILES=["/offline-shell-cc4524bb3b529203.html","/manifest.webmanifest","/favicon.svg","/assets/DejaVuSerif-regular-CVd__PRv.woff","/assets/DejaVuSerif-bold-CIacUclX.woff","/assets/DejaVuSerif-italic-9g8XVSN-.woff","/assets/DejaVuSerif-boldItalic-U0jxU-E0.woff","/assets/DejaVuSans-regular-BSP1L0Ua.woff","/assets/DejaVuSans-bold-B1-5gqaq.woff","/assets/DejaVuSans-boldItalic-P5WmRDxG.woff","/assets/DejaVuSansMono-regular-B2yFx1z2.woff","/assets/DejaVuSansMono-bold-5lmLBdLS.woff","/assets/DejaVuSansMono-italic-Cl1HeTfM.woff","/assets/DejaVuSansMono-boldItalic-4bO4Q19D.woff","/assets/courier-prime-latin-ext-400-normal-B-EsvyE4.woff2","/assets/courier-prime-latin-400-normal-BbyBr73r.woff2","/assets/courier-prime-latin-ext-400-italic-BTeyNO-8.woff2","/assets/courier-prime-latin-400-italic-CaR7PCvg.woff2","/assets/courier-prime-latin-ext-700-normal-ByMJlNdM.woff2","/assets/courier-prime-latin-700-normal-D1YCjmaD.woff2","/assets/courier-prime-latin-ext-700-italic-BzK4HIs4.woff2","/assets/courier-prime-latin-700-italic-CZikIXQl.woff2","/assets/DejaVuSans-italic-NTrZzTOm.woff","/assets/courier-prime-latin-ext-400-normal-CKOCNFvK.woff","/assets/courier-prime-latin-400-normal-BAlbUm6l.woff","/assets/courier-prime-latin-ext-400-italic-DU0XzPqs.woff","/assets/courier-prime-latin-ext-700-normal-BIFoAzHx.woff","/assets/courier-prime-latin-700-normal-CVvp4Sof.woff","/assets/courier-prime-latin-ext-700-italic-DHJjmZA7.woff","/assets/courier-prime-latin-400-italic-GR5bBv_9.woff","/assets/courier-prime-latin-700-italic-Cxv_jV69.woff","/assets/index-B9mgD01v.css","/assets/index-KwtIENL3.js","/assets/export-BdXPQtND.js","/assets/fontkit.es-dwB1gsqL.js","/assets/index-DkU4I8Ui.js","/assets/index-2bpBDjIR.js","/assets/index-fDdggEIY.js","/assets/fontkit.es-NacMhbjk.js","/assets/index-B0LVhTEE.js","/assets/publish.worker-DqusY0ei.js","/THIRD_PARTY_NOTICES.txt","/licenses.html","/licenses/Adobe-AFM-MustRead.html"];
function cachedNavigation(response){
  if(!response)return Response.error();
  if(!response.redirected)return response;
  // Hosts can redirect .html to canonical URLs. A redirected cached response
  // cannot satisfy a navigation's manual redirect mode while offline.
  const headers=new Headers(response.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
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
      try{
        const response=await fetch(request);
        // Access login redirects are opaque with status 0; preserve them so
        // the browser can authenticate instead of receiving an offline error.
        if(response.ok||response.type==='opaqueredirect'||response.status===401||response.status===403)return response;
      }catch{}
      const cache=await caches.open(CACHE);
      if(FILES.includes(url.pathname))return cachedNavigation(await cache.match(url.pathname,{ignoreVary:true}));
      return cachedNavigation(await cache.match(SHELL,{ignoreVary:true}));
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