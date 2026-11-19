/* Korijeni — početni zaslon: rođendani živih, tko upisuje, ulaz u stablo.
   Radi nad istim podacima kao stablo; ništa se ne sprema dvaput. */
(function(root){
'use strict';

var MJ=['siječnja','veljače','ožujka','travnja','svibnja','lipnja',
        'srpnja','kolovoza','rujna','listopada','studenoga','prosinca'];
var MK=['sij','velj','ožu','tra','svi','lip','srp','kol','ruj','lis','stu','pro'];

/* Datum je '1966-11-22', '1966-11' ili '1966' — sve troje je dopušteno */
function parts(s){
  if(!s) return null;
  var m=/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(String(s).trim());
  if(!m) return null;
  return {y:+m[1], m:m[2]?+m[2]:null, d:m[3]?+m[3]:null};
}
function fmt(s){                       // '22. studenoga 1966.'
  var p=parts(s); if(!p) return '';
  if(p.m&&p.d) return p.d+'. '+MJ[p.m-1]+' '+p.y+'.';
  if(p.m) return MJ[p.m-1]+' '+p.y+'.';
  return String(p.y);
}
function short(s){                     // '22. stu'
  var p=parts(s); if(!p||!p.m||!p.d) return '';
  return p.d+'. '+MK[p.m-1];
}
function year(s){ var p=parts(s); return p?p.y:null }
function life(p){
  var a=year(p.b), b=year(p.d);
  return (a||'?')+' – '+(b||'');
}
function surname(n){
  var w=String(n||'').trim().split(/\s+/);
  return w.length>1 ? w[w.length-1] : '';
}
function display(p){                   // 'Anka Jozić (r. Čalušić)'
  return p.n + (p.md ? ' (r. '+p.md+')' : '');
}

/* Sljedeći rođendani živih osoba, s punim datumom */
function birthdays(people, filter, today){
  var now=today||new Date();
  var t0=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  var out=[];
  people.forEach(function(p){
    if(p.d) return;                                   // samo živi
    var b=parts(p.b); if(!b||!b.m||!b.d) return;      // treba dan i mjesec
    if(filter && filter.length && filter.indexOf(surname(p.n))<0) return;
    var y=t0.getFullYear(), next=new Date(y,b.m-1,b.d);
    if(next<t0) next=new Date(y+1,b.m-1,b.d);
    var days=Math.round((next-t0)/86400000);
    out.push({p:p, days:days, when:next, turns:next.getFullYear()-b.y});
  });
  out.sort(function(a,b){ return a.days-b.days });
  return out;
}
function inDays(n){
  if(n===0) return 'Danas';
  if(n===1) return 'Sutra';
  if(n<7) return 'Za '+n+' dana';
  if(n<14) return 'Za tjedan dana';
  if(n<31) return 'Za '+Math.round(n/7)+' tjedna';
  return 'Za '+Math.round(n/30)+' mjeseca';
}
function surnames(people){
  var s={};
  people.forEach(function(p){ var x=surname(p.n); if(x) s[x]=(s[x]||0)+1 });
  return Object.keys(s).sort(function(a,b){ return s[b]-s[a] || a.localeCompare(b,'hr') });
}
function editors(people){
  var s={}, out=[];
  people.forEach(function(p){ if(p.by) s[p.by]=(s[p.by]||0)+1 });
  Object.keys(s).forEach(function(k){ out.push({name:k,n:s[k]}) });
  out.sort(function(a,b){ return b.n-a.n });
  return out;
}

root.Home={parts:parts, fmt:fmt, short:short, year:year, life:life, surname:surname,
  display:display, birthdays:birthdays, inDays:inDays, surnames:surnames, editors:editors, MJ:MJ};
})(typeof window!=='undefined'?window:globalThis);
if(typeof module!=='undefined') module.exports=(typeof window!=='undefined'?window:globalThis).Home;
