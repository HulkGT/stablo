/* Rodoslov — zajedničko obiteljsko stablo.
   Svatko tko ima poveznicu može dopuniti svoju granu; promjene vide svi. */
(function(){
'use strict';

var LS='rodoslov.doc', LQ='rodoslov.queue', LW='rodoslov.welcome';
var CFG=window.CFG||{}, LABEL=48;
var state={people:[],couples:[]}, L=null, z=1, sel=null, stamp=null, busy=false, empty=false, fresh={};

var $=function(id){return document.getElementById(id)};
var stage=$('stage'), wires=$('wires'), viewport=$('viewport'), canvas=$('canvas');

/* ---------- pohrana na uređaju ---------- */
function jget(k,f){ try{ var s=localStorage.getItem(k); return s?JSON.parse(s):f }catch(e){ return f } }
function jset(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)) }catch(e){} }
function saveLocal(){ jset(LS,{doc:state,stamp:stamp}) }

/* ---------- promjene ---------- */
function uid(){ return 'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,6) }
function applyOp(doc,op){
  if(op.t==='p'){
    var i=doc.people.findIndex(function(x){return x.id===op.p.id});
    if(i<0) doc.people.push(op.p); else doc.people[i]=Object.assign({},doc.people[i],op.p);
  } else if(op.t==='c'){
    var j=doc.couples.findIndex(function(x){return x.id===op.c.id});
    if(j<0) doc.couples.push(op.c); else doc.couples[j]=Object.assign({},doc.couples[j],op.c);
  } else if(op.t==='d'){
    doc.people=doc.people.filter(function(x){return x.id!==op.id});
    var gone=doc.couples.filter(function(c){return c.a===op.id||c.b===op.id}).map(function(c){return c.id});
    doc.couples=doc.couples.filter(function(c){return c.a!==op.id&&c.b!==op.id});
    doc.people.forEach(function(p){ if(gone.indexOf(p.pc)>=0) delete p.pc });
  }
  return doc;
}
function doOp(op,msg){
  applyOp(state,op); saveLocal();
  var q=jget(LQ,[]); q.push(op); jset(LQ,q);
  if(op.t==='p') fresh[op.p.id]=Date.now();
  render(); if(msg) toast(msg); push();
}

/* ---------- zajednički spremnik ---------- */
function on(){ return CFG.url && CFG.key }
function head(extra){
  var h={apikey:CFG.key,'Content-Type':'application/json'};
  if(/^ey/.test(CFG.key)) h.Authorization='Bearer '+CFG.key;   // stari anon ključ; novi ide samo kao apikey
  for(var k in extra) h[k]=extra[k];
  return h;
}
function api(q,opt){ return fetch(CFG.url+'/rest/v1/'+CFG.table+q,opt) }
function setSync(txt,ok){
  var el=$('sync');
  if(!txt){ el.hidden=true; return }
  el.hidden=false; el.textContent=txt; el.className='sync'+(ok?' ok':'');
  if(ok) setTimeout(function(){ el.hidden=true },2500);
}
async function pull(force){
  if(!on()) return;
  try{
    var r=await api('?id=eq.1&select=updated_at',{headers:head()});
    var j=await r.json();
    if(!j||!j[0]) return;
    if(!force && j[0].updated_at===stamp) return;
    var r2=await api('?id=eq.1&select=data,updated_at',{headers:head()});
    var j2=await r2.json();
    if(j2&&j2[0]) stamp=j2[0].updated_at;
    var d=(j2&&j2[0])?j2[0].data:null;
    if(!d||!d.people||!d.people.length){ empty=true; return }   // spremnik je još prazan
    empty=false;
    var q=jget(LQ,[]);
    state=d;
    q.forEach(function(op){ applyOp(state,op) });      // vlastite neposlane promjene zadrži
    saveLocal(); render(); setSync('',true);
  }catch(e){ /* bez mreže radimo dalje */ }
}
async function push(){
  if(!on() || busy) return;
  var q=jget(LQ,[]); if(!q.length) return;
  busy=true;
  try{
    var r=await api('?id=eq.1&select=data,updated_at',{headers:head()});
    var j=await r.json();
    var rem=(j&&j[0])?j[0].data:null;
    var cur=(rem&&rem.people&&rem.people.length)?rem
          :{people:state.people.slice(),couples:state.couples.slice()};  // prazan spremnik: kreni od svog stabla
    var ts=j&&j[0]?j[0].updated_at:null;
    q.forEach(function(op){ applyOp(cur,op) });
    var u=await api('?id=eq.1'+(ts?'&updated_at=eq.'+encodeURIComponent(ts):''),{
      method:'PATCH',
      headers:head({Prefer:'return=representation'}),
      body:JSON.stringify({data:cur,updated_at:new Date().toISOString()})
    });
    var res=await u.json();
    if(!res||!res.length){ busy=false; return setTimeout(push,1500); }   // netko je bio brži
    state=res[0].data; stamp=res[0].updated_at; jset(LQ,[]); saveLocal(); render();
    setSync('Spremljeno za sve',true);
  }catch(e){
    setSync('Nema veze — spremljeno na mobitelu, poslat ću kasnije');
  }
  busy=false;
}

async function seedUp(){                 // prvi put: pošalji cijelo stablo u spremnik
  if(!on()) return;
  try{
    var r=await api('?id=eq.1&select=data,updated_at',{headers:head()});
    var j=await r.json(); if(!j||!j[0]) return;
    var d=j[0].data||{};
    if(d.people&&d.people.length){ empty=false; return }
    var u=await api('?id=eq.1&updated_at=eq.'+encodeURIComponent(j[0].updated_at),{
      method:'PATCH', headers:head({Prefer:'return=representation'}),
      body:JSON.stringify({data:state,updated_at:new Date().toISOString()})
    });
    var res=await u.json();
    if(res&&res.length){ stamp=res[0].updated_at; empty=false; saveLocal(); setSync('Stablo je sada kod svih',true) }
  }catch(e){}
}

/* ---------- crtanje ---------- */
function photoSrc(p){ return p.ph ? (p.ph.indexOf('data:')===0 ? p.ph : 'photos/'+p.ph+'.jpg') : null }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]}) }
function initials(n){ return String(n||'?').trim().split(/\s+/).map(function(w){return w[0]}).slice(0,2).join('') }
function life(p){ return (p.b||'?')+' – '+(p.d||'') }

function card(p,x,y){
  var b=document.createElement('button');
  b.className='p'+(p.d?' dead':'')+((Date.now()-(fresh[p.id]||0)<90000)?' new':'');
  b.type='button'; b.dataset.id=p.id;
  b.style.left=x+'px'; b.style.top=y+'px';
  var src=photoSrc(p);
  b.innerHTML='<span class="fr">'+(src?'<img src="'+esc(src)+'" alt="">':'<span class="mono">'+esc(initials(p.n))+'</span>')+'</span>'+
    '<span class="nm">'+esc(p.n)+'</span><span class="yr">'+esc(life(p))+'</span>';
  return b;
}
function wire(d,red){
  var e=document.createElementNS('http://www.w3.org/2000/svg','path');
  e.setAttribute('d',d); e.setAttribute('fill','none');
  e.setAttribute('stroke',red?'#993720':'#B09B74');
  e.setAttribute('stroke-width',red?1.8:1.2);
  e.setAttribute('vector-effect','non-scaling-stroke');
  wires.appendChild(e); return e;
}
function knot(x,y,r,red){
  var e=document.createElementNS('http://www.w3.org/2000/svg','path');
  e.setAttribute('d','M'+x+' '+(y-r)+'L'+(x+r)+' '+y+'L'+x+' '+(y+r)+'L'+(x-r)+' '+y+'Z');
  e.setAttribute('fill',red?'#993720':'#B09B74'); wires.appendChild(e);
}
function render(){
  L=Tree.build(state);
  var C=L.CARD;
  stage.querySelectorAll('.p').forEach(function(e){ e.remove() });
  wires.innerHTML='';
  var W=L.width+2, H=L.height+LABEL+10;
  stage.style.width=W+'px'; stage.style.height=H+'px';
  wires.setAttribute('viewBox','0 0 '+W+' '+H);
  wires.setAttribute('width',W); wires.setAttribute('height',H);

  L.units.forEach(function(u){
    u.m.forEach(function(id){ stage.appendChild(card(L.P[id],u.pos[id],u.y)) });
    if(u.m.length===2){
      var x1=u.pos[u.m[0]]+C, x2=u.pos[u.m[1]], y=u.y+C/2;
      wire('M'+(x1+4)+' '+y+'H'+(x2-4)); knot((x1+x2)/2,y,4.5);
    }
    if(u.kids.length){
      var ox=u.x+u.w/2, oy=u.y+C+LABEL-6;
      var bus=Math.min.apply(null,u.kids.map(function(k){return k.y}))-34;
      u.kids.forEach(function(k){
        var kx=k.m.length===2 ? (k.par.indexOf(u)>=0 ? k.pos[k.m[0]]+C/2 : k.x+k.w/2) : k.x+k.w/2;
        k.m.forEach(function(id){ if(L.P[id].pc && L.C[L.P[id].pc]===L.C[u.cid]) kx=k.pos[id]+C/2 });
        wire('M'+ox+' '+oy+'V'+bus+'H'+kx+'V'+(k.y-5));
      });
      knot(ox,oy,3.5);
    }
  });
  $('count').textContent=state.people.length+' osoba · '+L.gens+' koljena';
  apply();
}

/* ---------- zum ---------- */
function apply(){
  stage.style.transform='scale('+z+')';
  canvas.style.width=(parseFloat(stage.style.width)+48)*z+'px';
  canvas.style.height=(parseFloat(stage.style.height)+86)*z+'px';
}
function setZ(v){ z=Math.min(1.8,Math.max(.14,v)); apply() }
function fit(){ setZ(Math.min(1.1,(viewport.clientWidth-16)/(L.width+48))) }

/* ---------- listić o osobi ---------- */
function rel(id){
  var p=L.P[id], out=[];
  var cs=state.couples.filter(function(c){return c.a===id||c.b===id});
  cs.forEach(function(c){ var o=c.a===id?c.b:c.a; if(o&&L.P[o]) out.push('u paru s '+L.P[o].n) });
  if(p.pc&&L.C[p.pc]){ var c=L.C[p.pc]; out.push('dijete: '+[c.a,c.b].filter(Boolean).map(function(x){return L.P[x]?L.P[x].n:''}).filter(Boolean).join(' i ')) }
  var kids=[];
  cs.forEach(function(c){ (L.kids[c.id]||[]).forEach(function(k){ kids.push(L.P[k].n) }) });
  if(kids.length) out.push((kids.length===1?'dijete: ':'djeca: ')+kids.join(', '));
  return out.join(' · ');
}
function openSheet(id){
  sel=id; var p=L.P[id], src=photoSrc(p), s=$('sheet');
  var age=(p.b&&p.d)?('  ·  '+((+p.d)-(+p.b))+' g.'):'';
  s.innerHTML='<div class="grip"></div><div class="sh">'+
    '<span class="fr">'+(src?'<img src="'+esc(src)+'" alt="">':'<span class="mono">'+esc(initials(p.n))+'</span>')+'</span>'+
    '<div><h3>'+esc(p.n)+'</h3><div class="meta">'+esc(life(p))+esc(age)+'</div></div></div>'+
    (p.nt?'<p class="note">'+esc(p.nt)+'</p>':'')+
    '<p class="note" style="color:var(--ink2)">'+esc(rel(id))+'</p>'+
    '<div class="acts">'+
      '<button class="btn" data-a="partner">Dodaj partnera</button>'+
      '<button class="btn" data-a="child">Dodaj dijete</button>'+
      '<button class="btn" data-a="parent">Dodaj roditelja</button>'+
      '<button class="btn" data-a="edit">Uredi</button>'+
      '<button class="btn quiet full" data-a="close">Zatvori</button>'+
    '</div>';
  s.hidden=false;
}
function closeSheet(){ $('sheet').hidden=true; sel=null }

/* ---------- obrazac ---------- */
var pendingPhoto=null;
function form(title,person,hint,onSave,extra){
  pendingPhoto=person&&person.ph||null;
  var m=$('modal');
  m.innerHTML='<div class="grip"></div><h4>'+esc(title)+'</h4>'+
    (hint?'<p class="hint">'+esc(hint)+'</p>':'')+
    '<label>Ime i prezime<input type="text" id="f_n" value="'+esc(person?person.n:'')+'" autocomplete="off"></label>'+
    '<div class="row2"><label>Godina rođenja<input type="number" id="f_b" inputmode="numeric" value="'+esc(person?person.b:'')+'"></label>'+
    '<label>Godina smrti<input type="number" id="f_d" inputmode="numeric" value="'+esc(person?person.d:'')+'"></label></div>'+
    '<label>Bilješka<textarea id="f_t">'+esc(person?person.nt:'')+'</textarea></label>'+
    '<div class="phpick"><span class="fr" id="f_prev">'+(pendingPhoto?'<img src="'+esc(photoSrc({ph:pendingPhoto}))+'" alt="">':'<span class="mono">+</span>')+'</span>'+
    '<button class="btn" data-a="pick">Fotografija</button>'+
    '<input type="file" id="f_f" accept="image/*" hidden></div>'+
    '<div class="acts"><button class="btn primary full" data-a="save">Spremi</button>'+
    (extra||'')+
    '<button class="btn quiet full" data-a="cancel">Odustani</button></div>';
  m.hidden=false;
  m._save=onSave;
  setTimeout(function(){ var e=$('f_n'); if(e&&!person) e.focus() },120);
}
function closeForm(){ $('modal').hidden=true; pendingPhoto=null }
function readForm(){
  return {n:($('f_n').value||'').trim(),b:($('f_b').value||'').trim(),d:($('f_d').value||'').trim(),
          nt:($('f_t').value||'').trim(),ph:pendingPhoto||null};
}
function shrink(file,cb){
  var fr=new FileReader();
  fr.onload=function(){
    var im=new Image();
    im.onload=function(){
      var s=Math.min(im.width,im.height), c=document.createElement('canvas'), S=420;
      c.width=S; c.height=S;
      c.getContext('2d').drawImage(im,(im.width-s)/2,(im.height-s)/2,s,s,0,0,S,S);
      cb(c.toDataURL('image/jpeg',.72));
    };
    im.onerror=function(){ toast('Slika se ne može otvoriti') };
    im.src=fr.result;
  };
  fr.readAsDataURL(file);
}

/* ---------- radnje ---------- */
function addPartner(id){
  form('Novi partner','',  'Osoba se dodaje uz '+L.P[id].n+'.', function(v){
    if(!v.n) return toast('Upiši barem ime');
    var np=Object.assign({id:uid()},v);
    doOp({t:'p',p:np});
    var mine=state.couples.filter(function(c){return (c.a===id&&!c.b)});
    if(mine.length) doOp({t:'c',c:{id:mine[0].id,a:id,b:np.id}},'Dodano');
    else doOp({t:'c',c:{id:'c'+uid(),a:id,b:np.id}},'Dodano');
  });
}
function addChild(id){
  var c=state.couples.filter(function(x){return x.a===id||x.b===id})[0];
  form('Novo dijete','', c? ('Dijete od: '+[c.a,c.b].filter(Boolean).map(function(x){return L.P[x].n}).join(' i ')+'.')
                           : ('Dijete od: '+L.P[id].n+'. Partnera možeš dodati kasnije.'), function(v){
    if(!v.n) return toast('Upiši barem ime');
    var cid;
    if(c) cid=c.id; else { cid='c'+uid(); doOp({t:'c',c:{id:cid,a:id,b:null}}); }
    doOp({t:'p',p:Object.assign({id:uid(),pc:cid},v)},'Dodano');
  });
}
function addParent(id){
  var p=L.P[id], have=p.pc&&L.C[p.pc]?L.C[p.pc]:null;
  if(have&&have.a&&have.b) return toast('Oba roditelja su već upisana');
  form('Novi roditelj','', 'Roditelj od: '+p.n+'.', function(v){
    if(!v.n) return toast('Upiši barem ime');
    var np=Object.assign({id:uid()},v);
    doOp({t:'p',p:np});
    if(have) doOp({t:'c',c:{id:have.id,a:have.a,b:np.id}},'Dodano');
    else{ var cid='c'+uid(); doOp({t:'c',c:{id:cid,a:np.id,b:null}}); doOp({t:'p',p:{id:id,pc:cid}},'Dodano'); }
  });
}
function editPerson(id){
  var p=L.P[id];
  form('Uredi osobu',p,'',function(v){
    if(!v.n) return toast('Ime ne smije biti prazno');
    doOp({t:'p',p:Object.assign({id:id},v)},'Spremljeno');
  },'<button class="btn full" data-a="del">Obriši osobu</button>');
}

/* ---------- pomoć ---------- */
function help(){
  var m=$('modal');
  m.innerHTML='<div class="grip"></div><h4>Kako dopuniti stablo</h4>'+
    '<p class="hint">Dodirni bilo koju osobu. Otvori se njezin listić s gumbima: <b>Dodaj partnera</b>, <b>Dodaj dijete</b>, <b>Dodaj roditelja</b> i <b>Uredi</b>.</p>'+
    '<p class="hint">Dovoljno je ime. Godine, bilješka i fotografija mogu doći kasnije — fotografiju slikaš mobitelom ili biraš iz galerije.</p>'+
    '<p class="hint">Sve što upišeš vide i svi ostali. Ako nemaš internet, sprema se na mobitel i šalje se samo kad se vratiš na mrežu.</p>'+
    '<div class="acts"><button class="btn primary full" data-a="cancel">Jasno</button></div>';
  m.hidden=false; m._save=null;
}

/* ---------- poruke ---------- */
var tt;
function toast(msg){ var t=$('toast'); t.textContent=msg; t.hidden=false; clearTimeout(tt); tt=setTimeout(function(){t.hidden=true},2600) }

/* ---------- instalacija ---------- */
var INSTALL=null;
window.addEventListener('beforeinstallprompt',function(e){ e.preventDefault(); INSTALL=e; if(!$('wel').hidden) drawWel() });
window.addEventListener('appinstalled',function(){ try{localStorage.setItem(LW,'done')}catch(e){} });
var UA=navigator.userAgent||'';
var IOS=/iphone|ipad|ipod/i.test(UA)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
var AND=/android/i.test(UA);
var INAPP=/FBAN|FBAV|FB_IAB|Instagram|LinkedIn|Line\/|MicroMessenger|TikTok|Snapchat/i.test(UA)||(AND&&/;\s*wv\)/.test(UA));
var SAFARI=IOS&&!INAPP&&!/CriOS|FxiOS|EdgiOS|OPiOS/i.test(UA);
var standalone=function(){ try{ return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true }catch(e){ return false } };
function drawWel(){
  var h='<img class="wellogo" src="icon-192.png" alt="">';
  if(INSTALL) h+='<h2>Dodaj stablo na ekran</h2><p>Jedan dodir i rodoslov stoji na ekranu kao svaka druga aplikacija.</p>'+
    '<button class="welbig" data-w="prompt">Instaliraj</button>';
  else if(IOS&&SAFARI) h+='<h2>Dva koraka do ekrana</h2>'+
    '<ol class="welsteps"><li>Dolje dodirni <b>Podijeli</b> (kvadratić sa strelicom).</li>'+
    '<li>Odaberi <b>Dodaj na početni zaslon</b>, pa gore desno <b>Dodaj</b>.</li></ol>'+
    '<svg class="welar" viewBox="0 0 24 44"><path d="M12 2v34M4 28l8 9 8-9"/></svg>';
  else if(IOS) h+='<h2>Otvori u Safariju</h2><p>Na iPhoneu samo Safari može staviti stablo na ekran.</p>'+
    '<button class="welbig" data-w="safari">Otvori u Safariju</button>'+
    '<p class="hint">Ne otvara se? Dodirni <b>⋯</b> pa <b>Otvori u Safariju</b>.</p>';
  else if(AND) h+='<h2>Otvori u Chromeu</h2><p>'+(INAPP?'Ovo je preglednik WhatsAppa ili Facebooka — on ne može instalirati.':'U Chromeu dobiješ gumb za instalaciju.')+'</p>'+
    '<button class="welbig" data-w="chrome">Otvori u Chromeu</button>';
  else h+='<h2>Dobrodošli</h2><p>Ovo je naše obiteljsko stablo. Dodirni osobu i dopuni svoju granu.</p>'+
    '<button class="welbig" data-w="later">Uđi</button>';
  h+='<button class="welghost" data-w="later">Samo pogledaj</button>';
  $('wel').innerHTML='<div class="welin">'+h+'</div>';
}
function maybeWel(){
  if(standalone()) return;
  if(!IOS&&!AND&&!INSTALL) return;
  try{ if(sessionStorage.getItem(LW)) return }catch(e){}
  drawWel(); $('wel').hidden=false;
}
function hereUrl(){ return location.host+location.pathname }

/* ---------- događaji ---------- */
stage.addEventListener('click',function(e){
  var c=e.target.closest('.p'); if(c) openSheet(c.dataset.id);
});
$('sheet').addEventListener('click',function(e){
  var b=e.target.closest('[data-a]'); if(!b) return;
  var a=b.dataset.a, id=sel;
  if(a==='close') return closeSheet();
  closeSheet();
  if(a==='partner') addPartner(id);
  if(a==='child') addChild(id);
  if(a==='parent') addParent(id);
  if(a==='edit') editPerson(id);
});
$('modal').addEventListener('click',function(e){
  var b=e.target.closest('[data-a]'); if(!b) return;
  var a=b.dataset.a, m=$('modal');
  if(a==='cancel') return closeForm();
  if(a==='pick') return $('f_f').click();
  if(a==='save'){ var v=readForm(), f=m._save; if(f){ var r=f(v); if(r!==false) closeForm(); } return }
  if(a==='del'){
    if(confirm('Obrisati ovu osobu iz stabla?')){ doOp({t:'d',id:sel},'Obrisano'); closeForm(); }
  }
});
document.addEventListener('change',function(e){
  if(e.target.id!=='f_f'||!e.target.files||!e.target.files[0]) return;
  shrink(e.target.files[0],function(d){
    pendingPhoto=d;
    $('f_prev').innerHTML='<img src="'+d+'" alt="">';
  });
});
$('wel').addEventListener('click',function(e){
  var b=e.target.closest('[data-w]'); if(!b) return;
  var w=b.dataset.w;
  if(w==='later'){ try{sessionStorage.setItem(LW,'1')}catch(x){} return $('wel').hidden=true }
  if(w==='prompt'){
    var ev=INSTALL; INSTALL=null;
    if(!ev) return;
    ev.prompt(); ev.userChoice.then(function(r){ if(r&&r.outcome==='accepted') $('wel').hidden=true; else { INSTALL=ev; drawWel() } });
    return;
  }
  if(w==='chrome') location.href='intent://'+hereUrl()+'#Intent;scheme=https;package=com.android.chrome;end';
  if(w==='safari') location.href='x-safari-https://'+hereUrl();
});
$('zin').onclick=function(){ setZ(z*1.25) };
$('zout').onclick=function(){ setZ(z/1.25) };
$('zfit').onclick=fit;
$('help').onclick=help;
window.addEventListener('online',push);
document.addEventListener('visibilitychange',function(){ if(!document.hidden){ pull(); push() } });

/* ---------- start ---------- */
(function init(){
  var saved=jget(LS,null);
  if(saved&&saved.doc&&saved.doc.people&&saved.doc.people.length){ state=saved.doc; stamp=saved.stamp||null }
  else { state=JSON.parse(JSON.stringify(window.SEED)); }
  render(); fit();
  if(!on()) setSync('Zajednički spremnik još nije postavljen — promjene ostaju na ovom mobitelu');
  pull(true).then(function(){ if(empty && state.people.length) return seedUp().then(push); push() });
  setInterval(function(){ if(!document.hidden) pull() },20000);
  setTimeout(maybeWel,500);
})();
})();
