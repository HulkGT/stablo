/* Rodoslov — zajedničko obiteljsko stablo.
   Svatko tko ima poveznicu može dopuniti svoju granu; promjene vide svi. */
(function(){
'use strict';

var LS='rodoslov.doc', LQ='rodoslov.queue', LW='rodoslov.welcome', LM='korijeni.me', LF='korijeni.filter';
var ME=null, FILTER=null;
var CFG=window.CFG||{}, LABEL=48;
var state={people:[],couples:[]}, L=null, z=1, sel=null, stamp=null, busy=false, empty=false, fresh={};

var $=function(id){return document.getElementById(id)};
var stage=$('stage'), wires=$('wires');

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
  if(op.t==='p'&&ME){ op.p=Object.assign({},op.p); if(!op.p.by) op.p.by=ME; }
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
function photoSrc(p){
  var v=p&&p.ph; if(!v) return null;
  return (v.indexOf('data:')===0 || v.indexOf('photos/')===0) ? v : 'photos/'+v+'.jpg';
}
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]}) }
function initials(n){ return String(n||'?').trim().split(/\s+/).map(function(w){return w[0]}).slice(0,2).join('') }
function life(p){ return Home.life(p) }
function nameOf(p){ return Home.display(p) }
function photos(p){ var a=[]; if(p.ph) a.push(photoSrc(p)); (p.px||[]).forEach(function(x){ a.push(x) }); return a }

function card(p,x,y){
  var b=document.createElement('button');
  b.className='p'+(p.d?' dead':'')+((Date.now()-(fresh[p.id]||0)<90000)?' new':'');
  b.type='button'; b.dataset.id=p.id;
  var C=Math.round(Tree.CARD*z);
  b.style.left=Math.round(x*z)+'px'; b.style.top=Math.round(y*z)+'px';
  b.style.width=C+'px';
  var src=photoSrc(p);
  var fs=Math.max(8,Math.round(11.5*z)), fy=Math.max(8,Math.round(10.5*z));
  b.innerHTML='<span class="fr" style="width:'+C+'px;height:'+C+'px">'+
    (src?'<img src="'+esc(src)+'" alt="">':'<span class="mono" style="font-size:'+Math.round(C*0.26)+'px">'+esc(initials(p.n))+'</span>')+'</span>'+
    '<span class="nm" style="font-size:'+fs+'px;width:'+Math.round(C*1.2)+'px">'+esc(nameOf(p))+'</span>'+
    '<span class="yr" style="font-size:'+fy+'px">'+esc(life(p))+'</span>';
  return b;
}
function wire(d,red){
  var e=document.createElementNS('http://www.w3.org/2000/svg','path');
  e.setAttribute('d',d); e.setAttribute('fill','none');
  e.setAttribute('stroke',red?'#993720':'#B09B74');
  e.setAttribute('stroke-width',Math.max(1,(red?1.8:1.2)*z));
  wires.appendChild(e); return e;
}
function knot(x,y,r,red){
  var e=document.createElementNS('http://www.w3.org/2000/svg','path');
  e.setAttribute('d','M'+x+' '+(y-r)+'L'+(x+r)+' '+y+'L'+x+' '+(y+r)+'L'+(x-r)+' '+y+'Z');
  e.setAttribute('fill',red?'#993720':'#B09B74'); wires.appendChild(e);
}
function render(){
  L=Tree.build(state);
  var C=L.CARD, Z=function(v){ return v*z };
  stage.querySelectorAll('.p').forEach(function(e){ e.remove() });
  wires.innerHTML='';
  var W=Math.round((L.width+2)*z), H=Math.round((L.height+LABEL+10)*z);
  stage.style.width=W+'px'; stage.style.height=H+'px';
  stage.style.margin = (W > vw()-32) ? '0' : '0 auto';
  wires.setAttribute('viewBox','0 0 '+W+' '+H);
  wires.setAttribute('width',W); wires.setAttribute('height',H);

  L.units.forEach(function(u){
    u.m.forEach(function(id){ stage.appendChild(card(L.P[id],u.pos[id],u.y)) });
    if(u.m.length===2){
      var x1=u.pos[u.m[0]]+C, x2=u.pos[u.m[1]], y=u.y+C/2;
      wire('M'+Z(x1+4)+' '+Z(y)+'H'+Z(x2-4)); knot(Z((x1+x2)/2),Z(y),Math.max(2,4.5*z));
    }
    if(u.kids.length){
      var ox=u.x+u.w/2, oy=u.y+C+LABEL-6;
      var bus=Math.min.apply(null,u.kids.map(function(k){return k.y}))-34;
      u.kids.forEach(function(k){
        var kx=k.m.length===2 ? (k.par.indexOf(u)>=0 ? k.pos[k.m[0]]+C/2 : k.x+k.w/2) : k.x+k.w/2;
        k.m.forEach(function(id){ if(L.P[id].pc && L.C[L.P[id].pc]===L.C[u.cid]) kx=k.pos[id]+C/2 });
        wire('M'+Z(ox)+' '+Z(oy)+'V'+Z(bus)+'H'+Z(kx)+'V'+Z(k.y-5));
      });
      knot(Z(ox),Z(oy),Math.max(2,3.5*z));
    }
  });
  $('count').textContent=state.people.length+' osoba · '+L.gens+' koljena';
  if(typeof renderHome==='function') renderHome();
}

/* ---------- zum ---------- */
var zoomByUser=false;
function apply(){ render() }
function setZ(v){ z=Math.min(1.8,Math.max(.22,v)); try{ if(zoomByUser) localStorage.setItem('korijeni.zoom',z) }catch(e){} render() }
function vw(){                                   // najmanja stvarna širina: neki preglednici lažu
  var a=[window.innerWidth, document.documentElement.clientWidth];
  if(window.visualViewport) a.push(window.visualViewport.width);
  if(window.screen&&screen.width) a.push(screen.width);
  a=a.filter(function(x){ return x>200 });
  return a.length?Math.round(Math.min.apply(null,a)):360;
}
function vhh(){
  var a=[window.innerHeight, document.documentElement.clientHeight];
  if(window.visualViewport) a.push(window.visualViewport.height);
  a=a.filter(function(x){ return x>200 });
  return a.length?Math.round(Math.min.apply(null,a)):640;
}
function fit(){                                   // cijelo stablo stane na zaslon
  setZ(Math.min(1.1,(vw()-24)/(L.width+40), (vhh()-150)/(L.height+90)));
}
function startZoom(){                             // čitljivo, ali ne šire nego što treba
  var f=Math.min(1.1,(vw()-24)/(L.width+40), (vhh()-150)/(L.height+90));
  return Math.max(.38, f);
}
function start(){                                              // čitljiv početak
  var saved=null; try{ saved=parseFloat(localStorage.getItem('korijeni.zoom'))||null }catch(e){}
  if(saved) setZ(saved); else setZ(startZoom());
  setTimeout(function(){
    var el=document.scrollingElement||document.documentElement;
    el.scrollLeft=Math.max(0,(stage.offsetWidth-vw())/2);
    el.scrollTop=0;
  },0);
}

/* Listić/obrazac prate vidljivi dio zaslona, i kad je stranica raširena prstima */
function syncOverlay(){                       // prozori su preko cijelog zaslona, ništa se ne pomiče
  ['sheet','modal','toast'].forEach(function(id){
    var el=$(id); if(el&&id!=='toast'){ el.style.transform=''; el.style.width='' }
  });
  if(true) return;
  var v=window.visualViewport; if(!v) return;
  var ch=document.documentElement.clientHeight||window.innerHeight;
  var cw=document.documentElement.clientWidth||window.innerWidth;
  var dx=Math.round(Math.max(0,v.offsetLeft));
  var dy=Math.min(0, Math.round(v.offsetTop+v.height-ch));   // samo prema gore (tipkovnica), nikad dolje
  ['sheet','modal','toast'].forEach(function(id){
    var el=$(id); if(!el||el.hidden) return;
    el.style.transform='translate('+dx+'px,'+dy+'px)'+(id==='toast'?' translateX(-50%)':'');
    if(id!=='toast') el.style.width=Math.round(Math.min(v.width,cw))+'px';
  });
}
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',syncOverlay);
  window.visualViewport.addEventListener('scroll',syncOverlay);
}

/* ---------- listić o osobi ---------- */
function rel(id){
  var p=L.P[id], out=[];
  var cs=state.couples.filter(function(c){return c.a===id||c.b===id});
  cs.forEach(function(c){ var o=c.a===id?c.b:c.a; if(o&&L.P[o]) out.push('u paru s '+nameOf(L.P[o])) });
  if(p.pc&&L.C[p.pc]){ var c=L.C[p.pc]; out.push('dijete: '+[c.a,c.b].filter(Boolean).map(function(x){return L.P[x]?L.P[x].n:''}).filter(Boolean).join(' i ')) }
  var kids=[];
  cs.forEach(function(c){ (L.kids[c.id]||[]).forEach(function(k){ kids.push(L.P[k].n) }) });
  if(kids.length) out.push((kids.length===1?'dijete: ':'djeca: ')+kids.join(', '));
  return out.join(' · ');
}
function openSheet(id){
  if($('treeview').hidden) go('stablo');
  sel=id; var p=L.P[id], s=$('sheet');
  var ph=photos(p), main=ph[0];
  var yb=Home.year(p.b), yd=Home.year(p.d);
  var age=(yb&&yd)?('  ·  '+(yd-yb)+' g.'):'';
  var datum=Home.fmt(p.b)+(p.d?' – '+Home.fmt(p.d):(p.b?' –':''));
  s.innerHTML='<div class="grip"><button class="close" data-a="close" aria-label="Zatvori">&times;</button></div><div class="sh">'+
    '<span class="fr">'+(main?'<img src="'+esc(main)+'" alt="">':'<span class="mono">'+esc(initials(p.n))+'</span>')+'</span>'+
    '<div><h3>'+esc(nameOf(p))+'</h3><div class="meta">'+esc(datum||'godine nepoznate')+esc(age)+'</div></div></div>'+
    (ph.length>1?'<div class="gal">'+ph.map(function(x){return '<img src="'+esc(x)+'" alt="">'}).join('')+'</div>':'')+
    (p.nt?'<p class="note">'+esc(p.nt)+'</p>':'')+
    '<p class="note soft">'+esc(rel(id))+'</p>'+
    (p.by?'<p class="note soft small">upisao/la '+esc(p.by)+'</p>':'')+
    '<div class="acts">'+
      '<button class="btn" data-a="partner">Dodaj partnera</button>'+
      '<button class="btn" data-a="child">Dodaj dijete</button>'+
      '<button class="btn" data-a="parent">Dodaj roditelja</button>'+
      '<button class="btn" data-a="edit">Uredi</button>'+
      '<button class="btn quiet full" data-a="close">Zatvori</button>'+
    '</div>';
  s.hidden=false; syncOverlay();
}
function closeSheet(){ $('sheet').hidden=true; sel=null }

/* ---------- obrazac ---------- */
var pendingPhotos=[];
function dateFields(pre,label,val){
  var p=Home.parts(val)||{y:'',m:'',d:''};
  return '<label>'+label+'</label><div class="row3">'+
    '<input type="number" id="'+pre+'_d" inputmode="numeric" placeholder="dan" min="1" max="31" value="'+(p.d||'')+'">'+
    '<input type="number" id="'+pre+'_m" inputmode="numeric" placeholder="mjesec" min="1" max="12" value="'+(p.m||'')+'">'+
    '<input type="number" id="'+pre+'_y" inputmode="numeric" placeholder="godina" value="'+(p.y||'')+'"></div>';
}
function readDate(pre){
  var d=($(pre+'_d').value||'').trim(), m=($(pre+'_m').value||'').trim(), y=($(pre+'_y').value||'').trim();
  if(!y) return '';
  var o=String(+y);
  if(m){ o+='-'+(+m<10?'0':'')+(+m); if(d) o+='-'+(+d<10?'0':'')+(+d) }
  return o;
}
function photoStrip(){
  var h='';
  pendingPhotos.forEach(function(src,i){
    h+='<span class="ph"><img src="'+esc(src)+'" alt=""><button class="x" data-a="rmph" data-i="'+i+'" aria-label="Makni">×</button></span>';
  });
  if(pendingPhotos.length<3) h+='<button class="ph add" data-a="pick">+</button>';
  return h;
}
function form(title,person,hint,onSave,extra){
  pendingPhotos=person?photos(person).slice(0,3):[];
  var m=$('modal');
  m.innerHTML='<div class="grip"><button class="close" data-a="cancel" aria-label="Zatvori">&times;</button></div><h4>'+esc(title)+'</h4>'+
    (hint?'<p class="hint">'+esc(hint)+'</p>':'')+
    '<label>Ime i prezime<input type="text" id="f_n" value="'+esc(person?person.n:'')+'" autocomplete="off"></label>'+
    '<label>Djevojačko prezime <span class="opt">ako se mijenjalo</span>'+
      '<input type="text" id="f_md" value="'+esc(person&&person.md?person.md:'')+'" autocomplete="off"></label>'+
    dateFields('f_b','Rođenje',person?person.b:'')+
    dateFields('f_x','Smrt <span class="opt">ostavi prazno ako je živ/a</span>',person?person.d:'')+
    '<label>Bilješka<textarea id="f_t">'+esc(person&&person.nt?person.nt:'')+'</textarea></label>'+
    '<label>Fotografije <span class="opt">najviše tri</span></label>'+
    '<div class="phs" id="f_phs">'+photoStrip()+'</div>'+
    '<input type="file" id="f_f" accept="image/*" hidden>'+
    '<div class="acts"><button class="btn primary full" data-a="save">Spremi</button>'+
    (extra||'')+
    '<button class="btn quiet full" data-a="cancel">Odustani</button></div>';
  m.hidden=false; syncOverlay();
  m._save=onSave;
  setTimeout(function(){ var e=$('f_n'); if(e&&!person) e.focus() },120);
}
function closeForm(){ $('modal').hidden=true; pendingPhotos=[] }
function readForm(){
  return {n:($('f_n').value||'').trim(), md:($('f_md').value||'').trim(),
          b:readDate('f_b'), d:readDate('f_x'),
          nt:($('f_t').value||'').trim(),
          ph:pendingPhotos[0]||null, px:pendingPhotos.slice(1)};
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

/* ---------- početni zaslon ---------- */
function go(view){
  var tree = view==='stablo';
  $('home').hidden=tree; $('treeview').hidden=!tree;
  $('back').hidden=!tree; $('treetools').hidden=!tree; $('count').hidden=!tree;
  if(location.hash!==(tree?'#stablo':'')) try{ history.replaceState(null,'',tree?'#stablo':location.pathname) }catch(e){}
  if(tree && L) start();
  if(!tree){ closeSheet(); closeForm(); renderHome(); }
  window.scrollTo(0,0);
}
function filterSet(){ if(FILTER===null) FILTER=jget(LF,null); return FILTER }
function renderHome(){
  if(!L) return;
  var el=$('home'); if(!el) return;
  var B=Home.birthdays(state.people, filterSet(), new Date());
  var ed=Home.editors(state.people);
  var h='';
  if(B.length){
    var n=B[0], src=photos(n.p)[0];
    h+='<button class="big" data-h="osoba" data-id="'+n.p.id+'">'+
      '<span class="fr">'+(src?'<img src="'+esc(src)+'" alt="">':'<span class="mono">'+esc(initials(n.p.n))+'</span>')+'</span>'+
      '<div><span class="s">'+esc(Home.inDays(n.days))+'</span>'+
      '<div class="n">'+esc(nameOf(n.p))+'</div>'+
      '<div class="d">puni '+n.turns+' · '+esc(Home.fmt(n.p.b))+'</div></div></button>';
  } else {
    h+='<div class="big empty"><div><div class="n">Još nema rođendana</div>'+
       '<div class="d">Upiši dan i mjesec kod osoba i ovdje će se pojaviti.</div></div></div>';
  }
  h+='<button class="cta" data-h="stablo">Otvori stablo</button>'+
     '<div class="statline">'+state.people.length+' osoba · '+L.gens+' koljena</div>';
  if(B.length>1){
    h+='<div class="sec">Dalje u godini<button class="lnk" data-h="filter">Postavke</button></div><div class="rowlist">';
    B.slice(1,6).forEach(function(b){
      var s2=photos(b.p)[0];
      h+='<button class="row" data-h="osoba" data-id="'+b.p.id+'">'+
        (s2?'<img src="'+esc(s2)+'" alt="">':'<span class="rmono">'+esc(initials(b.p.n))+'</span>')+
        '<span class="nm">'+esc(nameOf(b.p))+'</span>'+
        '<span class="dt">'+esc(Home.short(b.p.b))+' · '+b.turns+'</span></button>';
    });
    h+='</div>';
  } else if(B.length===1){
    h+='<div class="sec">Rođendani<button class="lnk" data-h="filter">Postavke</button></div>'+
       '<p class="soft small">Još nema drugih upisanih datuma.</p>';
  }
  h+='<div class="sec">Tko upisuje</div><div class="who">';
  if(ed.length) ed.forEach(function(e){ h+='<span class="chip'+(e.name===ME?' me':'')+'">'+esc(e.name)+'</span>' });
  else h+='<span class="chip">još nitko</span>';
  if(ME) h+='<button class="chip add" data-h="ime">to si ti: '+esc(ME)+'</button>';
  else h+='<button class="chip add" data-h="ime">upiši svoje ime</button>';
  h+='</div>';
  el.innerHTML=h;
}
function askName(first){
  var m=$('modal');
  m.innerHTML='<div class="grip"><button class="close" data-a="cancel" aria-label="Zatvori">&times;</button></div><h4>Kako se zoveš?</h4>'+
    '<p class="hint">Samo ime, bez lozinke. Tako ostali vide tko je koga upisao. Možeš i preskočiti.</p>'+
    '<label>Tvoje ime<input type="text" id="f_me" value="'+esc(ME||'')+'" autocomplete="given-name"></label>'+
    '<div class="acts"><button class="btn primary full" data-a="saveme">Spremi</button>'+
    '<button class="btn quiet full" data-a="cancel">'+(first?'Preskoči':'Odustani')+'</button></div>';
  m.hidden=false; syncOverlay(); m._save=null;
  setTimeout(function(){ var e=$('f_me'); if(e) e.focus() },150);
}
function askFilter(){
  var all=Home.surnames(state.people), cur=filterSet();
  var m=$('modal');
  m.innerHTML='<div class="grip"><button class="close" data-a="cancel" aria-label="Zatvori">&times;</button></div><h4>Čije rođendane želiš vidjeti</h4>'+
    '<p class="hint">Bez odabira vidiš sve. Odaberi prezimena koja te zanimaju — vrijedi samo za ovaj mobitel.</p>'+
    '<div class="who pick">'+all.map(function(x){
      var on=cur&&cur.indexOf(x)>=0;
      return '<button class="chip'+(on?' on':'')+'" data-a="tog" data-s="'+esc(x)+'">'+esc(x)+'</button>';
    }).join('')+'</div>'+
    '<div class="acts"><button class="btn full" data-a="allf">Pokaži sve</button>'+
    '<button class="btn primary full" data-a="cancel">Gotovo</button></div>';
  m.hidden=false; syncOverlay(); m._save=null;
}

/* ---------- pomoć ---------- */
function help(){
  var m=$('modal');
  m.innerHTML='<div class="grip"><button class="close" data-a="cancel" aria-label="Zatvori">&times;</button></div><h4>Kako dopuniti stablo</h4>'+
    '<p class="hint">Dodirni bilo koju osobu. Otvori se njezin listić s gumbima: <b>Dodaj partnera</b>, <b>Dodaj dijete</b>, <b>Dodaj roditelja</b> i <b>Uredi</b>.</p>'+
    '<p class="hint">Dovoljno je ime. Godine, bilješka i fotografija mogu doći kasnije — fotografiju slikaš mobitelom ili biraš iz galerije.</p>'+
    '<p class="hint">Sve što upišeš vide i svi ostali. Ako nemaš internet, sprema se na mobitel i šalje se samo kad se vratiš na mrežu.</p>'+
    '<div class="acts"><button class="btn primary full" data-a="cancel">Jasno</button></div>';
  m.hidden=false; m._save=null;
}

/* ---------- poruke ---------- */
var tt;
function toast(msg){ var t=$('toast'); t.textContent=msg; t.hidden=false; syncOverlay(); clearTimeout(tt); tt=setTimeout(function(){t.hidden=true},2600) }

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
  if(a==='cancel'){ closeForm(); renderHome(); return }
  if(a==='saveme'){
    var v=($('f_me').value||'').trim();
    if(v){ ME=v; try{ localStorage.setItem(LM,v) }catch(x){} }
    closeForm(); renderHome(); return;
  }
  if(a==='tog'){
    var sn=b.dataset.s, cur=(filterSet()||[]).slice(), i=cur.indexOf(sn);
    if(i<0) cur.push(sn); else cur.splice(i,1);
    FILTER=cur.length?cur:null; jset(LF,FILTER); askFilter(); renderHome(); return;
  }
  if(a==='allf'){ FILTER=null; jset(LF,null); askFilter(); renderHome(); return }
  if(a==='pick') return $('f_f').click();
  if(a==='rmph'){ pendingPhotos.splice(+b.dataset.i,1); $('f_phs').innerHTML=photoStrip(); return }
  if(a==='save'){ var v=readForm(), f=m._save; if(f){ var r=f(v); if(r!==false) closeForm(); } return }
  if(a==='del'){
    if(confirm('Obrisati ovu osobu iz stabla?')){ doOp({t:'d',id:sel},'Obrisano'); closeForm(); }
  }
});
document.addEventListener('change',function(e){
  if(e.target.id!=='f_f'||!e.target.files||!e.target.files[0]) return;
  shrink(e.target.files[0],function(d){
    if(pendingPhotos.length<3) pendingPhotos.push(d);
    $('f_phs').innerHTML=photoStrip();
  });
  e.target.value='';
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
$('home').addEventListener('click',function(e){
  var b=e.target.closest('[data-h]'); if(!b) return;
  var h=b.dataset.h;
  if(h==='stablo') return go('stablo');
  if(h==='ime') return askName(false);
  if(h==='filter') return askFilter();
  if(h==='osoba'){ go('stablo'); openSheet(b.dataset.id) }
});
$('back').onclick=function(){ go('home') };
$('zin').onclick=function(){ zoomByUser=true; setZ(z*1.25) };
$('zout').onclick=function(){ zoomByUser=true; setZ(z/1.25) };
$('zfit').onclick=function(){ zoomByUser=true; fit() };
$('help').onclick=help;
window.addEventListener('hashchange',function(){ go(location.hash==='#stablo'?'stablo':'home') });
window.addEventListener('online',push);
document.addEventListener('visibilitychange',function(){ if(!document.hidden){ pull(); push() } });

/* ---------- start ---------- */
(function init(){
  var saved=jget(LS,null);
  if(saved&&saved.doc&&saved.doc.people&&saved.doc.people.length){ state=saved.doc; stamp=saved.stamp||null }
  else { state=JSON.parse(JSON.stringify(window.SEED)); }
  try{ ME=localStorage.getItem(LM)||null }catch(e){}
  render();
  go(location.hash==='#stablo'?'stablo':'home');
  if(!ME) setTimeout(function(){ if($('wel').hidden) askName(true) },1200);
  setTimeout(function(){ if(!$('wel').hidden) return; toast('Povuci prstom za pomicanje · dodirni osobu za upis') },1400);
  if(!on()) setSync('Zajednički spremnik još nije postavljen — promjene ostaju na ovom mobitelu');
  pull(true).then(function(){ if(empty && state.people.length) return seedUp().then(push); push() });
  setInterval(function(){ if(!document.hidden) pull() },20000);
  setTimeout(maybeWel,500);
})();
})();
