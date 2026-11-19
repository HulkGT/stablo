const VERSION='rodoslov-1.0.1';
const SHELL=['./','index.html','style.css','app.js','tree.js','seed.js','config.js',
  'manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL).catch(()=>{})));
});
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(k=>Promise.all(k.filter(x=>x!==VERSION).map(x=>caches.delete(x))))
      .then(()=>self.clients.claim())
      .then(()=>self.clients.matchAll({type:'window'}))
      .then(cs=>cs.forEach(c=>{ try{ c.navigate(c.url) }catch(e){} }))   // stara stranica se sama osvježi
  );
});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin) return;     // spremnik ide ravno na mrežu
  e.respondWith(
    fetch(e.request).then(r=>{
      const c=r.clone(); caches.open(VERSION).then(x=>x.put(e.request,c)); return r;
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html')))
  );
});
