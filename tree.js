/* Baum-Layout: rechnet aus Personen und Paaren die Koljena (Generationen),
   die Reihenfolge und die Positionen aus. Reine Rechnung, keine Anzeige. */
(function(root){
'use strict';

var CARD = 104, GAPIN = 12, GAPUNIT = 34, ROWGAP = 132;

function build(data){
  var people = data.people || [], couples = data.couples || [];
  var P = {}, C = {};
  people.forEach(function(p){ P[p.id] = p; });
  couples.forEach(function(c){ if(P[c.a] || P[c.b]) C[c.id] = c; });   // dopušten je i par bez druge osobe

  // Kinder je Paar
  var kids = {};
  people.forEach(function(p){
    if(p.pc && C[p.pc]) (kids[p.pc] = kids[p.pc] || []).push(p.id);
  });
  Object.keys(kids).forEach(function(cid){
    kids[cid].sort(function(x,y){ return (+P[x].b||9999) - (+P[y].b||9999); });
  });

  // Einheiten: ein Paar oder eine einzelne Person. Jede Person nur einmal.
  var unitOf = {}, units = [];
  Object.keys(C).forEach(function(cid){
    var c = C[cid];
    var mem = [c.a, c.b].filter(function(x){ return x && P[x] });
    if(!mem.length) return;
    if(mem.some(function(x){ return unitOf[x] })) return;   // Mehrfachehe: nur die erste im Bild
    var u = {id:'u_'+cid, cid:cid, m:mem};
    units.push(u); mem.forEach(function(x){ unitOf[x] = u });
  });
  people.forEach(function(p){
    if(unitOf[p.id]) return;
    var u = {id:'u_'+p.id, cid:null, m:[p.id]};
    units.push(u); unitOf[p.id] = u;
  });
  units.forEach(function(u){ u.w = u.m.length*CARD + (u.m.length-1)*GAPIN; });

  // Eltern-Einheit einer Einheit (ueber die Mitglieder)
  units.forEach(function(u){
    u.par = [];
    u.m.forEach(function(pid){
      var pc = P[pid].pc;
      if(pc && C[pc]){
        var pu = unitOf[C[pc].a] || unitOf[C[pc].b];
        if(pu && u.par.indexOf(pu)<0) u.par.push(pu);
      }
    });
    u.kids = [];
  });
  units.forEach(function(u){
    if(!u.cid) return;
    (kids[u.cid]||[]).forEach(function(kid){
      var ku = unitOf[kid];
      if(ku && u.kids.indexOf(ku)<0) u.kids.push(ku);
    });
  });

  // Koljeno: ohne Eltern oben, Kinder eins tiefer, Partner gleichziehen
  var gen = {};
  people.forEach(function(p){ gen[p.id] = 0; });
  for(var it=0; it<60; it++){
    var moved = false;
    people.forEach(function(p){
      if(p.pc && C[p.pc]){
        var pa=C[p.pc], ga=[];
        if(pa.a && gen[pa.a]!=null) ga.push(gen[pa.a]);
        if(pa.b && gen[pa.b]!=null) ga.push(gen[pa.b]);
        if(!ga.length) return;
        var g = Math.max.apply(null, ga) + 1;
        if(g > gen[p.id]){ gen[p.id] = g; moved = true; }
      }
    });
    units.forEach(function(u){
      var g = Math.max.apply(null, u.m.map(function(x){ return gen[x]; }));
      u.m.forEach(function(x){ if(gen[x] < g){ gen[x] = g; moved = true; } });
    });
    if(!moved) break;
  }
  units.forEach(function(u){ u.g = gen[u.m[0]]; });

  // Partnerlose Vorfahren nach unten ziehen, damit sie direkt ueber den Kindern stehen
  for(var it2=0; it2<20; it2++){
    var ch = false;
    units.forEach(function(u){
      if(u.par.length || !u.kids.length) return;
      var g = Math.min.apply(null, u.kids.map(function(k){ return k.g; })) - 1;
      if(g > u.g){ u.g = g; u.m.forEach(function(x){ gen[x] = g; }); ch = true; }
    });
    if(!ch) break;
  }

  // Reihen
  var rows = [], maxG = 0;
  units.forEach(function(u){ maxG = Math.max(maxG, u.g); });
  for(var g=0; g<=maxG; g++) rows.push(units.filter(function(u){ return u.g===g; }));

  // Reihenfolge: Schwerpunkt der Nachbarreihen, mehrere Durchgaenge
  var idx = function(u){ return rows[u.g].indexOf(u); };
  function bary(u, list){
    if(!list.length) return null;
    var s = 0, n = 0;
    list.forEach(function(v){ var i = idx(v); if(i>=0){ s += i; n++; } });
    return n ? s/n : null;
  }
  function order(list, pick){
    var keep = list.map(function(u,i){ return {u:u, i:i, b:pick(u)}; });
    keep.forEach(function(o){ if(o.b===null) o.b = o.i; });
    keep.sort(function(x,y){ return x.b===y.b ? x.i-y.i : x.b-y.b; });
    return keep.map(function(o){ return o.u; });
  }
  for(var pass=0; pass<6; pass++){
    for(var g=1; g<=maxG; g++) rows[g] = order(rows[g], function(u){ return bary(u, u.par); });
    for(var g2=maxG-1; g2>=0; g2--) rows[g2] = order(rows[g2], function(u){ return bary(u, u.kids); });
  }

  // Positionen: erst gleichmaessig, dann an Eltern bzw. Kindern ausrichten
  rows.forEach(function(r){
    var x = 0;
    r.forEach(function(u){ u.x = x; x += u.w + GAPUNIT; });
  });
  function center(u){ return u.x + u.w/2; }
  function pack(r, want){
    var wish = r.map(function(u,i){ var v = want(u); return v===null ? center(u) : v; });
    var x = -1e9;
    r.forEach(function(u,i){
      u.x = Math.max(wish[i] - u.w/2, x);
      x = u.x + u.w + GAPUNIT;
    });
  }
  function avg(list){
    if(!list.length) return null;
    var s = 0; list.forEach(function(v){ s += center(v); });
    return s/list.length;
  }
  function wish(u){                        // zwischen Eltern und Kindern ausbalancieren
    var a = avg(u.par), b = avg(u.kids);
    if(a===null) return b;
    if(b===null) return a;
    return (a+b)/2;
  }
  for(var p2=0; p2<12; p2++){
    for(var g3=maxG; g3>=0; g3--) pack(rows[g3], wish);
    for(var g4=0; g4<=maxG; g4++) pack(rows[g4], wish);
  }

  // Nullpunkt und Groesse
  var minX = 1e9, maxX = -1e9;
  units.forEach(function(u){ minX = Math.min(minX, u.x); maxX = Math.max(maxX, u.x + u.w); });
  units.forEach(function(u){
    u.x -= minX;
    u.y = u.g * (CARD + ROWGAP);
    u.pos = {};
    u.m.forEach(function(pid, i){ u.pos[pid] = u.x + i*(CARD+GAPIN); });
  });

  return {
    units: units, rows: rows, unitOf: unitOf, P: P, C: C, kids: kids, gen: gen,
    width: maxX - minX, height: (maxG+1)*CARD + maxG*ROWGAP,
    gens: maxG+1, CARD: CARD, GAPIN: GAPIN, ROWGAP: ROWGAP
  };
}

root.Tree = {build: build, CARD: CARD, GAPIN: GAPIN, ROWGAP: ROWGAP};
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = (typeof window!=='undefined'?window:globalThis).Tree;
