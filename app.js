/* =====================================================================
   OSMOS — app engine
   WebGL2 renderer (feedback trails, SDF shapes, bloom, field shader)
   with a Canvas 2D fallback; evidence-tagged scent → visual mapping;
   Web Audio sound layer; olfactory adaptation model; library + map.
   ===================================================================== */
(function(){
  "use strict";

  const D = window.OSMOS_DATA;
  const { SCENTS, DESCRIPTORS, CATEGORIES, LEXICON, PLEASANT_WORDS, UNPLEASANT_WORDS, COCO_TO_SCENT } = D;
  const CAT_NAME = Object.fromEntries(CATEGORIES);
  const SCENT_BY_ID = {}; SCENTS.forEach(s=>{ SCENT_BY_ID[s.id] = s; });
  const MAX_ACTIVE = 3;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (id)=> document.getElementById(id);

  /* ============================== UTIL ============================== */
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
  const lerp = (a,b,t)=> a + (b-a)*t;
  const rand = (a,b)=> a + Math.random()*(b-a);
  function hexToRgb(hex){ const h = hex.replace("#",""); return [0,2,4].map(i=> parseInt(h.slice(i,i+2),16)/255); }
  function rgbToHsl(r,g,b){
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b); let h = 0, s = 0; const l = (mx+mn)/2;
    if(mx !== mn){
      const d = mx-mn; s = l > .5 ? d/(2-mx-mn) : d/(mx+mn);
      if(mx === r) h = (g-b)/d + (g<b?6:0); else if(mx === g) h = (b-r)/d + 2; else h = (r-g)/d + 4;
      h *= 60;
    }
    return [h,s,l];
  }
  function hslToRgb(h,s,l){
    h = (((h%360)+360)%360)/360;
    if(s === 0) return [l,l,l];
    const q = l < .5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
    const f = (t)=>{ if(t<0) t+=1; if(t>1) t-=1; if(t<1/6) return p+(q-p)*6*t; if(t<1/2) return q; if(t<2/3) return p+(q-p)*(2/3-t)*6; return p; };
    return [f(h+1/3), f(h), f(h-1/3)];
  }
  const css = (rgb, a=1)=> `rgba(${Math.round(rgb[0]*255)},${Math.round(rgb[1]*255)},${Math.round(rgb[2]*255)},${a})`;
  const escHtml = (s)=> String(s).replace(/[&<>"']/g, c=> ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function hashSeed(str){ let h = 2166136261; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h,16777619); } return h>>>0; }
  const fmtSigned = (v)=> (v>=0?"+":"−") + Math.abs(v).toFixed(2);

  const store = {
    get(k, d){ try{ const v = localStorage.getItem("osmos."+k); return v === null ? d : JSON.parse(v); }catch(e){ return d; } },
    set(k, v){ try{ localStorage.setItem("osmos."+k, JSON.stringify(v)); }catch(e){} }
  };
  const settings = { adapt: store.get("adapt", true), sound: false, view: store.get("view", "consensus") === "mine" ? "mine" : "consensus" };

  /* ===================== PERSONAL SYNAESTHESIA =======================
     A synaesthete's own painting of a scent. It is the user's experience,
     not data: stored only on this device (localStorage) or carried in a
     share link, and always labelled "personal" in the UI.              */
  const FORMS = ["orbs","shards","threads","mist","sheet","rain"];
  const TEXTURES = ["smooth","grain","stripes","ripples","cells","fibres"];
  const MOTIONS = ["drift","rise","fall","swirl","pulse","still"];
  const TEX_ID = { smooth:0, grain:1, stripes:2, ripples:3, cells:4, fibres:5 };
  const num = (v, d)=> (typeof v === "number" && isFinite(v)) ? v : (typeof v === "string" && v.trim() !== "" && isFinite(+v)) ? +v : d;
  function sanitizeProfile(p){
    if(!p || typeof p !== "object") return null;
    const hex = /^#[0-9a-f]{6}$/i;
    return {
      c1: hex.test(p.c1) ? p.c1.toLowerCase() : "#cccccc",
      c2: hex.test(p.c2) ? p.c2.toLowerCase() : "#ffffff",
      form: FORMS.includes(p.form) ? p.form : "orbs",
      tex: TEXTURES.includes(p.tex) ? p.tex : "smooth",
      motion: MOTIONS.includes(p.motion) ? p.motion : "drift",
      x: clamp(num(p.x,.5),0,1), y: clamp(num(p.y,.45),0,1),
      size: clamp(num(p.size,.5),0,1), density: clamp(num(p.density,.5),0,1),
      note: String(p.note || "").slice(0, 400),
      n: String(p.n || "").slice(0, 40)
    };
  }
  let mine = {};
  (function(){ const raw = store.get("mine", {}); if(raw && typeof raw === "object") for(const k in raw){ const sp = sanitizeProfile(raw[k]); if(sp && /^[\w-]{1,60}$/.test(k)) mine[k] = sp; } })();
  const shared = {};      // profiles opened from share links (this session only)
  const saveMine = ()=> store.set("mine", mine);
  const profileFor = (id)=> shared[id] || mine[id] || null;
  const personalActive = (s)=> settings.view === "mine" && !!profileFor(s.id);

  /* =========================== THE MAPPING ===========================
     Everything visual/aural derives from the scent's data here, so the
     science panel can show exactly what drove what.                    */
  const VCACHE = new Map();
  const dv = (s,k)=> (s.d && s.d[k]) || 0;
  const PENT = [0,2,4,7,9];
  function quantizePent(m){
    let best = Math.round(m), bd = 99;
    for(let o=-1;o<=1;o++){
      const oct = Math.floor(m/12)+o;
      for(const p of PENT){ const c = oct*12+p; const d = Math.abs(c-m); if(d<bd){ bd=d; best=c; } }
    }
    return best;
  }
  const NOTE = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
  const noteName = (m)=> NOTE[((m%12)+12)%12] + (Math.floor(m/12)-1);

  function colourName(h,s,l){
    if(l > .86 && h >= 28 && h <= 66 && s > .2) return "cream";
    if(s < .13 || (l > .9 && s < .5)){
      if(l > .85) return "white"; if(l > .6) return "pale grey"; if(l > .3) return "grey"; return "charcoal";
    }
    let n;
    if(h < 12 || h >= 345) n = "red";
    else if(h < 40) n = l < .42 ? "brown" : "orange";
    else if(h < 52) n = l < .42 ? "umber" : "amber";
    else if(h < 66) n = "yellow";
    else if(h < 90) n = "lime";
    else if(h < 150) n = "green";
    else if(h < 180) n = "teal";
    else if(h < 200) n = "cyan";
    else if(h < 225) n = "sky blue";
    else if(h < 255) n = "blue";
    else if(h < 280) n = "violet";
    else if(h < 305) n = "purple";
    else if(h < 330) n = "magenta";
    else n = "pink";
    const pre = l < .22 ? "deep " : l < .36 ? "dark " : l > .84 ? "pale " : l > .68 ? "light " : "";
    return pre + n;
  }
  const shapeWord = (a)=> a < .2 ? "round orbs" : a < .4 ? "soft-edged forms" : a < .6 ? "faceted forms" : a < .8 ? "angular shards" : "sharp spikes";
  const motionWord = (V)=> V > .75 ? "quick-rising, fleeting" : V > .5 ? "rising, drifting" : V > .25 ? "slow-drifting" : "heavy, lingering";
  const noteWord = (V)=> V > .66 ? "top note" : V > .33 ? "heart note" : "base note";

  function derive(s){
    if(VCACHE.has(s.id)) return VCACHE.get(s.id);
    const [h, sat, l0] = rgbToHsl(...hexToRgb(s.col));
    const I = s.I, P = s.P, V = s.V;
    // EVIDENCE — stronger odours ↔ darker colours (Kemp & Gilbert 1997)
    const Lraw = clamp(l0 - (I-.5)*.24, .06, .95);
    const Lemit = .34 + .62*Lraw;                  // compressed so dark stays visible
    const rgb = hslToRgb(h, sat, Lemit);
    const rgbLight = hslToRgb(h, sat*.85, Math.min(.93, Lemit+.17));
    const rgbDeep = hslToRgb(h, Math.min(1, sat*1.05), Math.max(.16, Lemit-.17));
    const fieldRgb = hslToRgb(h, Math.max(sat,.08), clamp(Lraw, .1, .72));
    // EVIDENCE — unpleasant & intense → angular; pleasant & sweet → round
    // (Hanson-Vaux et al. 2013; Deroy et al. 2013)
    const sharp = Math.max(dv(s,"sour"), dv(s,"acid"), dv(s,"cold")*.8, dv(s,"chemical")*.8, dv(s,"ammonia"));
    const ang = clamp(.42 - .40*P + .40*(I-.5) - .22*dv(s,"sweet")
      + .22*Math.max(dv(s,"sour"), dv(s,"acid")) + .12*dv(s,"chemical") + .10*dv(s,"ammonia"), 0, 1);
    const points = Math.round(clamp(4 + 4*Math.max(sharp, dv(s,"spices")*.7), 4, 8));
    // PHYSICAL — volatility → rise speed, lifetime, trail persistence
    const rise = .25 + 1.05*V;
    const life = lerp(7.2, 2.4, V);
    const decay = lerp(.976, .925, V);
    // ARTISTIC
    const rate = 26 + 150*I;
    const jitter = .04 + .85*sharp;
    const size = lerp(7, 15, 1-ang*.6) * (.8 + .5*(1-V));
    const nDesc = Object.values(s.d||{}).filter(v=> v >= .25).length;
    const complexity = clamp((nDesc-1)/6, 0, 1);
    // EVIDENCE — fruity/sweet higher, smoky/musky/woody lower
    // (Belkin et al. 1997; Crisinel & Spence 2012)
    const hi = dv(s,"fruit") + .5*dv(s,"sweet") + .35*dv(s,"flower") + .25*dv(s,"sour") + .2*dv(s,"cold");
    const lo = dv(s,"burnt") + dv(s,"musky") + .7*dv(s,"wood") + .6*dv(s,"earthy") + .4*dv(s,"decayed");
    const pitchT = clamp(.5 + .34*hi - .36*lo, 0, 1);
    const midi = quantizePent(40 + pitchT*44);
    const v = { h, sat, l0, Lraw, rgb, rgbLight, rgbDeep, fieldRgb, ang, points, rise, life, decay, rate,
      jitter, sharp, size, complexity, pitchT, midi, hi, lo,
      colour: s.custom ? "neutral grey (no colour data)" : colourName(h, sat, Lraw) };
    // ARTISTIC — surface texture, loosely motivated by odour–touch links
    // (Demattè et al. 2006: pleasant odours make fabric feel softer)
    const texScores = [["grain", Math.max(dv(s,"earthy"), dv(s,"burnt"), dv(s,"decayed"))],
      ["fibres", Math.max(dv(s,"wood"), dv(s,"grass"))*.9], ["ripples", Math.max(dv(s,"cold"), dv(s,"fish"))*.9],
      ["cells", dv(s,"chemical")*.8]].sort((a,b)=> b[1]-a[1]);
    v.texName = (texScores[0][1] >= .45 && P < .85) ? texScores[0][0] : "smooth";
    v.tex = TEX_ID[v.texName]; v.texAmt = .38; v.texScale = 1;
    v.formId = 0; v.mist = 0; v.swirl = 0; v.pulse = 0; v.flowMul = 1; v.personal = false;
    v.spread = .07 + .12*V; v.out = .25 + .7*V; v.dust = .3;
    v.alphaNorm = alphaNorm(v);
    v.blurb = `${s.custom ? "neutral grey" : v.colour} · ${shapeWord(ang)} · ${motionWord(V)}`;
    VCACHE.set(s.id, v);
    return v;
  }

  // keeps lingering, dense scents from blowing out to white: normalises
  // expected on-screen energy (spawn rate × lifetime × area × trail length)
  function alphaNorm(v){
    const energy = v.rate * v.life * v.size * v.size / Math.max(.01, 1 - v.decay);
    return clamp(Math.pow(2.9e6 / energy, .75), .18, 1.05);
  }
  const rgbToHex = (c)=> "#" + c.map(x=> Math.round(clamp(x,0,1)*255).toString(16).padStart(2,"0")).join("");
  const FORM_ID = { orbs:0, shards:0, threads:1, mist:2, rain:3, sheet:4 };
  function derivePersonal(s, p){
    const base = derive(s);
    const c1 = hexToRgb(p.c1), c2 = hexToRgb(p.c2);
    const [h, sat, l] = rgbToHsl(...c1);
    const lift = (c)=>{ const [hh,ss,ll] = rgbToHsl(...c); return hslToRgb(hh, ss, .22 + .78*ll); };
    const rgb = lift(c1), rgbLight = lift(c2), rgbDeep = hslToRgb(h, sat, Math.max(.14, (.22+.78*l) - .18));
    const m = p.motion, f = p.form;
    const v = Object.assign({}, base, {
      personal: true, profile: p, h, sat, Lraw: l, l0: l,
      rgb, rgbLight, rgbDeep, fieldRgb: hslToRgb(h, sat, clamp(l, .12, .7)),
      ang: f === "shards" ? .92 : f === "rain" ? .15 : .02,
      points: f === "shards" ? 5 : 6,
      formId: FORM_ID[f], mist: f === "mist" ? 1 : 0,
      tex: TEX_ID[p.tex], texName: p.tex, texAmt: p.tex === "smooth" ? 0 : .9, texScale: 1.2,
      rise: { drift:.45, rise:1.25, fall:-.9, swirl:.08, pulse:.2, still:.02 }[m],
      life: m === "still" ? 9 : m === "fall" ? 4.5 : 5.5,
      decay: (m === "still" || m === "pulse") ? .975 : .955,
      rate: f === "sheet" ? 8 + 30*p.density : f === "mist" ? 10 + 45*p.density : 20 + 170*p.density,
      jitter: m === "drift" ? .1 : .04,
      size: f === "sheet" ? 3 : f === "mist" ? lerp(26, 70, p.size) : f === "threads" ? lerp(2.5, 7, p.size) : lerp(5, 30, p.size),
      swirl: m === "swirl" ? 1 : 0, pulse: m === "pulse" ? 1 : 0,
      flowMul: m === "still" ? .12 : m === "swirl" ? .35 : 1,
      spread: .03 + .12*p.size, out: m === "still" ? .05 : .3, dust: f === "sheet" ? 1 : (f === "mist" || f === "threads") ? 0 : .2,
      complexity: .5
    });
    v.alphaNorm = alphaNorm(v) * (f === "mist" ? 2.2 : f === "threads" ? 1.8 : 1);
    v.colour = colourName(h, sat, l);
    v.blurb = `your view · ${v.colour} ${p.form} · ${p.tex} · ${p.motion}`;
    return v;
  }

  /* ============================== SEARCH ============================= */
  const norm = (s)=> s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," ").trim();
  const escRe = (s)=> s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  function scoreScent(q, s){
    const name = norm(s.name);
    if(name === q) return 100;
    const words = s.words.map(norm);
    if(words.includes(q)) return 95;
    let best = 0;
    if(name.startsWith(q)) best = Math.max(best, 82);
    for(const w of words) if(w.startsWith(q)) best = Math.max(best, 76);
    const wb = new RegExp("(^|[\\s/(-])" + escRe(q));
    if(wb.test(name)) best = Math.max(best, 72);
    for(const w of words) if(wb.test(w)) best = Math.max(best, 66);
    for(const w of [name, ...words]){
      if(w.length >= 3 && new RegExp("(^|\\W)" + escRe(w) + "(\\W|$)").test(q)) best = Math.max(best, 60 + Math.min(w.length, 12));
    }
    return best;
  }
  function lev(a,b){
    if(Math.abs(a.length-b.length) > 3) return 99;
    const m = []; for(let i=0;i<=b.length;i++) m[i] = [i];
    for(let j=0;j<=a.length;j++) m[0][j] = j;
    for(let i=1;i<=b.length;i++) for(let j=1;j<=a.length;j++)
      m[i][j] = b[i-1] === a[j-1] ? m[i-1][j-1] : 1 + Math.min(m[i-1][j-1], m[i][j-1], m[i-1][j]);
    return m[b.length][a.length];
  }
  function searchScents(text, limit=6){
    const q = norm(text); if(!q) return [];
    const res = [];
    for(const s of SCENTS){ const sc = scoreScent(q, s); if(sc > 0) res.push({ s, score: sc }); }
    if(q.length >= 3 && !res.some(r=> r.score >= 60)){
      const thr = q.length <= 5 ? 1 : 2;
      for(const s of SCENTS){
        if(res.some(r=> r.s === s)) continue;
        let bd = 99;
        for(const w of [norm(s.name), ...s.words.map(norm)]) bd = Math.min(bd, lev(q, w));
        if(bd <= thr) res.push({ s, score: 50 - bd*10 });
      }
    }
    res.sort((a,b)=> b.score - a.score || a.s.name.localeCompare(b.s.name));
    return res.slice(0, limit);
  }
  function descriptorReading(text){
    const toks = norm(text).match(/[a-z]+/g) || [];
    const d = {}; const hits = [];
    for(const [k, words] of Object.entries(LEXICON)){
      for(const t of toks) if(words.includes(t)){ d[k] = .7; hits.push(t); }
    }
    if(!hits.length) return null;
    let P = .1;
    toks.forEach(t=>{ if(PLEASANT_WORDS.includes(t)) P += .3; if(UNPLEASANT_WORDS.includes(t)) P -= .5; });
    P += .25*(d.sweet||0) + .2*(d.flower||0) + .15*(d.fruit||0) - .5*(d.decayed||0) - .4*(d.sweaty||0) - .5*(d.ammonia||0);
    const label = text.trim().slice(0, 40);
    return { id: "custom-"+hashSeed(norm(text)), name: label, cat: "custom", emoji: "✦", col: "#a29eb4",
      I: .5, P: clamp(P,-1,1), V: .5, d, words: [], literal: "", mol: "", note: "", custom: true, hits: [...new Set(hits)] };
  }

  /* ============================ PARTICLES ============================ */
  const PF = 14; // floats per particle
  const PART = { n: 0, max: 0, a: null };
  // layout: 0 x,1 y,2 vx,3 vy,4 life,5 maxLife,6 size,7 rot,8 rs,9 r,10 g,11 b,12 ang|pts packed? -> separate below
  // we keep two arrays for clarity: core (PF) + extra (ang, pts, rise, jit, alpha)
  // extras: 0 rise,1 jit,2 alpha,3 seed,4 V,5 swirl,6 cx,7 cy,8 pulse,9 form,10 tex,11 texAmt,12 texScale,13 mist,14 flowMul
  const EX = 15; PART.e = null;
  function allocParticles(max){
    PART.max = max; PART.n = Math.min(PART.n, max);
    const a = new Float32Array(max*PF), e = new Float32Array(max*EX);
    if(PART.a){ a.set(PART.a.subarray(0, PART.n*PF)); e.set(PART.e.subarray(0, PART.n*EX)); }
    PART.a = a; PART.e = e;
  }
  function killParticle(i){
    const last = PART.n-1;
    if(i !== last){
      PART.a.copyWithin(i*PF, last*PF, last*PF+PF);
      PART.e.copyWithin(i*EX, last*EX, last*EX+EX);
    }
    PART.n--;
  }

  let W = 0, H = 0, fieldScale = 1;
  const pointer = { down:false, x:0, y:0, R:200 };
  let sniff = 0;

  function flowAngle(x,y,t){
    return Math.sin(x*.0026 + t*.6) + Math.cos(y*.0031 - t*.42) + Math.sin((x+y)*.0016 + t*.23)*.8;
  }

  class Emitter{
    constructor(scent, opts={}){
      this.scent = scent;
      this.active = true; this.demo = !!opts.demo;
      this.age = 0; this.exposure = opts.exposure || 0; this.fade = 0; this.spawnAcc = 0; this.eff = 0;
      this.phase = Math.random()*6.283;
      this.consAnchors = [0,1,2].map(()=>({
        bx: .14 + Math.random()*.72, by: .26 + Math.random()*.5,
        ax: .05 + Math.random()*.1, ay: .04 + Math.random()*.08,
        f: .04 + Math.random()*.05, ph: Math.random()*6.283
      }));
      this.applyView();
    }
    applyView(){
      const prof = (!this.demo && personalActive(this.scent)) ? profileFor(this.scent.id) : null;
      this.personal = !!prof;
      this.v = prof ? derivePersonal(this.scent, prof) : derive(this.scent);
      this.anchors = prof ? [0,1,2].map(()=>({
        bx: clamp(prof.x + (Math.random()-.5)*.08, .03, .97), by: clamp(prof.y + (Math.random()-.5)*.06, .03, .97),
        ax: .012 + Math.random()*.02, ay: .01 + Math.random()*.02, f: .05 + Math.random()*.05, ph: Math.random()*6.283
      })) : this.consAnchors;
    }
    anchorPos(i, t){ const a = this.anchors[i]; return [a.bx + Math.sin(t*a.f + a.ph)*a.ax, a.by + Math.cos(t*a.f*.8 + a.ph)*a.ay]; }
    adaptMul(){ return (settings.adapt && !this.demo) ? 1 - .55*(1 - Math.exp(-this.exposure/75)) : 1; }
    update(dt){
      this.age += dt;
      if(this.active){ this.fade = Math.min(1, this.fade + dt/1.2); if(!this.demo) this.exposure += dt; }
      else this.fade = Math.max(0, this.fade - dt/1.6);
    }
    dead(){ return !this.active && this.fade <= 0; }
  }

  function spawnFrom(em, t){
    if(PART.n >= PART.max) return;
    const v = em.v, s = em.scent;
    const [ax, ay] = em.anchorPos((Math.random()*3)|0, t);
    const spread = Math.min(W,H) * v.spread;
    const r = spread * Math.sqrt(-2*Math.log(Math.random()+1e-6)) * .55;
    const th = Math.random()*6.2832;
    const x = ax*W + Math.cos(th)*r, y = ay*H + Math.sin(th)*r*.8;
    const fs = fieldScale;
    const out = v.out * fs;
    const u = Math.random();
    const c = v.personal ? (u < .55 ? v.rgb : u < .9 ? v.rgbLight : v.rgbDeep) : (u < .6 ? v.rgb : u < .82 ? v.rgbLight : v.rgbDeep);
    const br = rand(.88, 1.12);
    const i = PART.n++;
    const o = i*PF, e = i*EX, A = PART.a, E = PART.e;
    const life = v.life * rand(.7, 1.3);
    A[o] = x; A[o+1] = y;
    A[o+2] = Math.cos(th)*out*.6; A[o+3] = Math.sin(th)*out*.4 - v.rise*.6*fs;
    A[o+4] = life; A[o+5] = life;
    const dust = Math.random() < v.dust;
    A[o+6] = v.size * fs * (dust ? rand(.18, .32) : rand(.6, 1.3));
    A[o+7] = Math.random()*6.2832; A[o+8] = (Math.random()-.5)*(.4 + 2.2*v.ang);
    A[o+9] = c[0]*br; A[o+10] = c[1]*br; A[o+11] = c[2]*br;
    A[o+12] = clamp(v.ang + (Math.random()-.5)*.12, 0, 1); A[o+13] = v.points;
    E[e] = v.rise; E[e+1] = v.jitter; E[e+2] = (.55 + .45*clamp(em.eff, 0, 1.2)) * (dust ? 1.6 : 1) * (v.mist ? .5 : 1) * v.alphaNorm; E[e+3] = Math.random(); E[e+4] = s.V;
    E[e+5] = v.swirl; E[e+6] = ax*W; E[e+7] = ay*H; E[e+8] = v.pulse; E[e+9] = dust ? 0 : v.formId;
    E[e+10] = dust ? 0 : v.tex; E[e+11] = v.texAmt; E[e+12] = v.texScale; E[e+13] = dust ? 0 : v.mist; E[e+14] = v.flowMul;
  }

  function stepParticles(dt, t){
    const f = dt*60, damp = Math.pow(.986, f), A = PART.a, E = PART.e;
    const fs = fieldScale, R = pointer.R, pd = pointer.down;
    for(let i=0; i<PART.n; i++){
      const o = i*PF, e = i*EX;
      A[o+4] -= dt;
      if(A[o+4] <= 0){ killParticle(i); i--; continue; }
      const x = A[o], y = A[o+1];
      const fa = flowAngle(x, y, t);
      let vx = A[o+2], vy = A[o+3];
      const fm = E[e+14];
      vx += Math.cos(fa)*.035*f*fs*fm; vy += Math.sin(fa)*.025*f*fs*fm - E[e]*.012*f*fs;
      if(E[e+5] > 0){
        const dx = x - E[e+6], dy = y - E[e+7], d = Math.sqrt(dx*dx + dy*dy) + 24;
        vx += (-dy/d*.11*fs - dx/d*.025)*f; vy += (dx/d*.11*fs - dy/d*.025)*f;
      }
      if(fm < .5){ vx *= .97; vy *= .97; }
      const j = E[e+1];
      if(j > .06 && !reduceMotion){ vx += (Math.random()-.5)*j*.55*f; vy += (Math.random()-.5)*j*.55*f; }
      if(pd){
        const dx = pointer.x - x, dy = pointer.y - y, d2 = dx*dx + dy*dy;
        if(d2 < R*R){ const d = Math.sqrt(d2)+1, k = (1 - d/R)*.6*f; vx += dx/d*k; vy += dy/d*k; }
      }
      vx *= damp; vy *= damp;
      A[o] = x + vx*f; A[o+1] = y + vy*f;
      A[o+2] = vx; A[o+3] = vy;
      A[o+7] += A[o+8]*dt;
      if(A[o] < -200 || A[o] > W+200 || A[o+1] < -260 || A[o+1] > H+200){ killParticle(i); i--; }
    }
  }

  /* ============================ WEBGL2 ============================== */
  const GLSL_HEAD = "#version 300 es\nprecision highp float;\n";
  const VS_FULL = GLSL_HEAD + `
    const vec2 P[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
    out vec2 vUv;
    void main(){ vec2 p = P[gl_VertexID]; vUv = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;
  const NOISE = `
    float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+vec2(17.1,9.3); a*=.5; } return s; }`;
  const FS_FEEDBACK = GLSL_HEAD + NOISE + `
    in vec2 vUv; out vec4 o;
    uniform sampler2D uPrev, uAdd; uniform vec2 uTexel; uniform float uDecay, uTime, uFlow, uRise, uAspect, uFloor, uMix;
    void main(){
      vec2 p = vec2(vUv.x*uAspect, vUv.y)*2.4;
      float a = vn(p + vec2(uTime*.05, -uTime*.035))*12.566;
      vec2 off = vec2(cos(a), sin(a))*uFlow*uTexel + vec2(0., uRise*uTexel.y);
      vec2 uv = vUv - off;
      vec3 c = texture(uPrev, uv).rgb*.8
        + (texture(uPrev, uv+vec2(uTexel.x,0.)).rgb + texture(uPrev, uv-vec2(uTexel.x,0.)).rgb
         + texture(uPrev, uv+vec2(0.,uTexel.y)).rgb + texture(uPrev, uv-vec2(0.,uTexel.y)).rgb)*.05;
      o = vec4(max(c*uDecay - uFloor, 0.) + texture(uAdd, vUv).rgb*uMix, 1.);
    }`;
  const PATTERN = `
    vec2 hsh2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))))*43758.5453); }
    float pattern(float id, vec2 p, float sc, float sd){
      vec2 q = p*sc + sd*13.7;
      if(id < .5) return 1.;
      if(id < 1.5) return .4 + 1.2*hsh(floor(q*6.));
      if(id < 2.5) return .3 + .9*smoothstep(-.35, .35, sin(q.y*7.5 + sd*6.));
      if(id < 3.5) return .3 + .9*smoothstep(-.35, .35, sin(length(p)*sc*10. - sd*20.));
      if(id < 4.5){
        vec2 g = floor(q*2.2), f = fract(q*2.2); float md = 1.;
        for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 n = vec2(float(i), float(j)); md = min(md, length(n + hsh2(g+n) - f)); }
        return .25 + 1.1*smoothstep(.04, .5, md);
      }
      return .35 + 1.*hsh(vec2(floor(q.x*9.), floor(q.y*1.3)));
    }`;
  const VS_PART = GLSL_HEAD + `
    layout(location=0) in vec2 aQ;
    layout(location=1) in vec4 aA; // x y size rot
    layout(location=2) in vec4 aB; // r g b alpha
    layout(location=3) in vec4 aC; // ang points stretch seed
    layout(location=4) in vec4 aD; // texture id, amount, scale, mist
    uniform vec2 uRes;
    out vec2 vUv; out vec4 vCol; out vec3 vShape; out vec4 vTex; out float vSeed;
    void main(){
      float st = 1. + aC.z;
      vec2 q = vec2(aQ.x*st, aQ.y)*2.4;
      float c = cos(aA.w), s = sin(aA.w);
      vec2 p = vec2(c*q.x - s*q.y, s*q.x + c*q.y)*aA.z + aA.xy;
      vec2 clip = p/uRes*2. - 1.; clip.y = -clip.y;
      gl_Position = vec4(clip, 0., 1.);
      vUv = q; vCol = aB; vShape = aC.xyz; vTex = aD; vSeed = aC.w;
    }`;
  const FS_PART = GLSL_HEAD + `
    in vec2 vUv; in vec4 vCol; in vec3 vShape; in vec4 vTex; in float vSeed; out vec4 o;
    uniform float uGain;
    float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    ${PATTERN}
    float sdStar(vec2 p, float r, float n, float m){
      float an = 3.141593/n, en = 3.141593/m;
      vec2 acs = vec2(cos(an), sin(an)), ecs = vec2(cos(en), sin(en));
      float bn = mod(atan(p.x, p.y), 2.*an) - an;
      p = length(p)*vec2(cos(bn), abs(sin(bn)));
      p -= r*acs;
      p += ecs*clamp(-dot(p, ecs), 0., r*acs.y/ecs.y);
      return length(p)*sign(p.x);
    }
    void main(){
      vec2 p = vec2(vUv.x/(1.+vShape.z), vUv.y);
      float ang = vShape.x, n = vShape.y;
      float dc = length(p) - 1.;
      float ds = sdStar(p, 1.25, n, mix(n, 2.15, ang));
      float k = smoothstep(.08, .9, ang);
      float d = mix(dc, ds, k);
      float aa = .06 + .04*(1.-k);
      float core = 1. - smoothstep(-aa, aa, d);
      float glow = exp(-max(d, 0.)*mix(2.2, 4.5, k));
      float hot = exp(-dot(p,p)*3.);
      float e = core*(.6 + .6*hot) + glow*mix(.32, .14, k);
      if(vTex.w > .5){ e = exp(-dot(p,p)*1.2)*.5; }
      else if(vTex.x > .5){ e *= mix(1., pattern(vTex.x, p, vTex.z, vSeed), vTex.y); }
      o = vec4(vCol.rgb*e*vCol.a*uGain, 0.);
    }`;
  const FS_FIELD = GLSL_HEAD + NOISE + `
    in vec2 vUv; out vec4 o;
    uniform vec3 uC[3]; uniform float uW[3]; uniform vec2 uP[3];
    uniform float uTime, uAspect, uWarp, uAmt;
    void main(){
      vec2 p = vec2(vUv.x*uAspect, vUv.y);
      float t = uTime;
      vec2 q = vec2(fbm(p*1.5 + t*.018), fbm(p*1.5 + vec2(5.2,1.3) - t*.014));
      vec2 r = vec2(fbm(p*1.5 + 3.*q + vec2(1.7,9.2) + t*.026), fbm(p*1.5 + 3.*q + vec2(8.3,2.8) - t*.02));
      float n = fbm(p*1.5 + (1.2 + uWarp*2.8)*r);
      vec3 col = vec3(0.);
      for(int i=0;i<3;i++){
        vec2 d = p - vec2(uP[i].x*uAspect, uP[i].y) + (r - .5)*(.25 + .45*uWarp);
        float f = exp(-dot(d,d)*2.4);
        col += uC[i]*uW[i]*(f*.85 + .22)*(.25 + n*1.05);
      }
      o = vec4(col*uAmt, 1.);
    }`;
  const FS_SHEET = GLSL_HEAD + NOISE + PATTERN + `
    in vec2 vUv; out vec4 o;
    uniform int uN; uniform vec3 uC1[3], uC2[3]; uniform vec4 uA[3], uB[3]; uniform float uPh[3], uSp[3];
    uniform float uTime, uAspect;
    float surf(float x, float t, float amp){ return amp*(sin(x*1.7 + t)*.5 + sin(x*3.3 - t*1.27)*.28) + (fbm(vec2(x*1.1, t*.35)) - .5)*amp*1.3; }
    void main(){
      vec3 col = vec3(0.);
      float x = vUv.x*uAspect;
      for(int i=0;i<3;i++){
        if(i >= uN) break;
        float t = uTime*uSp[i] + uPh[i];
        float cx = uA[i].x*uAspect, hw = uB[i].x*uAspect*.5;
        float ends = smoothstep(cx-hw, cx-hw+.22, x)*(1. - smoothstep(cx+hw-.22, cx+hw, x));
        if(ends <= 0.) continue;
        float amp = uA[i].z;
        float y0 = uA[i].y + surf(x, t, amp);
        float slope = (surf(x+.01, t, amp) - surf(x-.01, t, amp))/.02;
        float th = uB[i].y*(.55 + .45*sin(x*2.1 + t*.8));
        float d = (vUv.y - y0)/th;
        float inside = 1. - smoothstep(.72, 1., abs(d));
        if(inside <= 0.) continue;
        float fold = .5 + .5*cos(slope*3. + d*2.2 + sin(x*5. + t)*.6);
        float sheen = pow(max(0., 1. - abs(d - .45*sin(x*3. + t*1.3))*1.6), 8.)*.7;
        float pt = pattern(uB[i].z, vec2(x*2.2, d*.9 + t*.04), uB[i].w*1.4, float(i)*.37);
        vec3 c = mix(uC1[i], uC2[i], clamp(.5 + .5*d*fold, 0., 1.));
        col += (c*(.3 + .7*fold)*mix(1., pt, uB[i].z > .5 ? .75 : 0.) + uC2[i]*sheen)*inside*ends*uA[i].w;
      }
      o = vec4(col, 1.);
    }`;
  const FS_DOWN = GLSL_HEAD + `
    in vec2 vUv; out vec4 o; uniform sampler2D uSrc, uSrc2; uniform vec2 uTexel; uniform float uW1, uW2;
    vec3 tap(vec2 uv){ return texture(uSrc, uv).rgb*uW1 + texture(uSrc2, uv).rgb*uW2; }
    void main(){
      o = vec4((tap(vUv + uTexel*vec2(-1.,-1.)) + tap(vUv + uTexel*vec2(1.,-1.))
        + tap(vUv + uTexel*vec2(-1.,1.)) + tap(vUv + uTexel*vec2(1.,1.)))*.25, 1.);
    }`;
  const FS_BLUR = GLSL_HEAD + `
    in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform vec2 uDir;
    void main(){
      vec3 c = texture(uSrc, vUv).rgb*.227027
        + (texture(uSrc, vUv + uDir*1.3846).rgb + texture(uSrc, vUv - uDir*1.3846).rgb)*.316216
        + (texture(uSrc, vUv + uDir*3.2308).rgb + texture(uSrc, vUv - uDir*3.2308).rgb)*.070270;
      o = vec4(c, 1.);
    }`;
  const FS_COMP = GLSL_HEAD + `
    in vec2 vUv; out vec4 o;
    uniform sampler2D uTrail, uSharp, uField, uB1, uB2;
    uniform vec3 uBg; uniform float uBloom, uTime, uCam, uExp;
    float hsh(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    vec3 tonemap(vec3 x){ float m = max(max(x.r, x.g), x.b); return x*(1. + m/5.)/(1. + m); }
    void main(){
      vec3 trail = texture(uTrail, vUv).rgb*.9 + texture(uSharp, vUv).rgb;
      vec3 field = texture(uField, vUv).rgb*(1. - .45*uCam);
      vec3 bloom = texture(uB1, vUv).rgb*.6 + texture(uB2, vUv).rgb*.75;
      vec3 c = tonemap((trail + bloom*uBloom)*uExp + field);
      c += uBg*(1. - uCam)*(1. - c);
      vec2 q = vUv - .5;
      c *= 1. - dot(q,q)*(.85 - .5*uCam);
      c += (hsh(gl_FragCoord.xy + fract(uTime*7.13)*97.) - .5)*(2.5/255.);
      o = vec4(c, 1.);
    }`;

  class GLRenderer{
    constructor(canvas){
      const gl = canvas.getContext("webgl2", { alpha:false, antialias:false, depth:false, stencil:false, premultipliedAlpha:false, powerPreference:"high-performance" });
      if(!gl) throw new Error("WebGL2 unavailable");
      this.gl = gl; this.canvas = canvas; this.kind = "webgl2";
      this.floatOK = !!gl.getExtension("EXT_color_buffer_float");
      if(!this.floatOK) this.floatOK = !!gl.getExtension("EXT_color_buffer_half_float");
      this.p = {
        feedback: this.prog(VS_FULL, FS_FEEDBACK), part: this.prog(VS_PART, FS_PART),
        field: this.prog(VS_FULL, FS_FIELD), down: this.prog(VS_FULL, FS_DOWN), sheet: this.prog(VS_FULL, FS_SHEET),
        blur: this.prog(VS_FULL, FS_BLUR), comp: this.prog(VS_FULL, FS_COMP)
      };
      this.locs = new Map();
      this.emptyVao = gl.createVertexArray();
      this.pvao = gl.createVertexArray();
      gl.bindVertexArray(this.pvao);
      const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.ib);
      this.icap = 0; this.inst = null;
      for(let k=0;k<4;k++){
        gl.enableVertexAttribArray(1+k);
        gl.vertexAttribPointer(1+k, 4, gl.FLOAT, false, 64, k*16);
        gl.vertexAttribDivisor(1+k, 1);
      }
      gl.bindVertexArray(null);
      this.t = {}; this.w = 0; this.h = 0;
    }
    prog(vs, fs){
      const gl = this.gl;
      const sh = (type, src)=>{ const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return p;
    }
    u(p, name){
      let m = this.locs.get(p); if(!m){ m = {}; this.locs.set(p, m); }
      if(!(name in m)) m[name] = this.gl.getUniformLocation(p, name);
      return m[name];
    }
    target(w, h){
      const gl = this.gl;
      w = Math.max(1, w|0); h = Math.max(1, h|0);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if(this.floatOK) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE){
        gl.deleteFramebuffer(fb); gl.deleteTexture(tex);
        if(this.floatOK){ this.floatOK = false; return this.target(w, h); }
        throw new Error("framebuffer incomplete");
      }
      gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex, fb, w, h };
    }
    resize(cw, ch){
      const gl = this.gl;
      if(cw === this.w && ch === this.h) return;
      for(const k in this.t){ gl.deleteTexture(this.t[k].tex); gl.deleteFramebuffer(this.t[k].fb); }
      this.w = cw; this.h = ch;
      this.t = {
        A: this.target(cw, ch), B: this.target(cw, ch), S: this.target(cw, ch),
        field: this.target(cw/3, ch/3),
        b2: this.target(cw/2, ch/2), b4a: this.target(cw/4, ch/4), b4b: this.target(cw/4, ch/4),
        b8a: this.target(cw/8, ch/8), b8b: this.target(cw/8, ch/8)
      };
    }
    clear(){
      const gl = this.gl;
      for(const k of ["A","B","S"]){ gl.bindFramebuffer(gl.FRAMEBUFFER, this.t[k].fb); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    pass(prog, dst, setup){
      const gl = this.gl;
      gl.useProgram(prog);
      if(dst){ gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0,0,dst.w,dst.h); }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0,0,this.w,this.h); }
      setup && setup();
      gl.bindVertexArray(this.emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    tex(prog, name, unit, tex){
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(this.u(prog, name), unit);
    }
    render(st){
      const gl = this.gl, P = this.p, T = this.t;
      gl.disable(gl.BLEND);
      // 1. field
      this.pass(P.field, T.field, ()=>{
        const p = P.field;
        gl.uniform3fv(this.u(p, "uC"), st.fieldC);
        gl.uniform1fv(this.u(p, "uW"), st.fieldW);
        gl.uniform2fv(this.u(p, "uP"), st.fieldP);
        gl.uniform1f(this.u(p, "uTime"), st.t);
        gl.uniform1f(this.u(p, "uAspect"), this.w/this.h);
        gl.uniform1f(this.u(p, "uWarp"), st.warp);
        gl.uniform1f(this.u(p, "uAmt"), .48);
      });
      // 2. particles (additive) into the sharp layer S
      const n = PART.n;
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.S.fb); gl.viewport(0,0,T.S.w,T.S.h);
      gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
      if(st.sheetN > 0){
        const p = P.sheet;
        gl.useProgram(p);
        gl.uniform1i(this.u(p, "uN"), st.sheetN);
        gl.uniform3fv(this.u(p, "uC1"), st.sC1); gl.uniform3fv(this.u(p, "uC2"), st.sC2);
        gl.uniform4fv(this.u(p, "uA"), st.sA); gl.uniform4fv(this.u(p, "uB"), st.sB);
        gl.uniform1fv(this.u(p, "uPh"), st.sPh); gl.uniform1fv(this.u(p, "uSp"), st.sSp);
        gl.uniform1f(this.u(p, "uTime"), st.t); gl.uniform1f(this.u(p, "uAspect"), this.w/this.h);
        gl.bindVertexArray(this.emptyVao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      if(n > 0){
        if(!this.inst || this.icap < n){
          this.icap = Math.max(n, PART.max); this.inst = new Float32Array(this.icap*16);
          gl.bindBuffer(gl.ARRAY_BUFFER, this.ib); gl.bufferData(gl.ARRAY_BUFFER, this.inst.byteLength, gl.DYNAMIC_DRAW);
        }
        const A = PART.a, E = PART.e, I = this.inst;
        for(let i=0;i<n;i++){
          const o = i*PF, e = i*EX, k = i*16;
          const lt = A[o+4]/A[o+5];
          const env = Math.sin(lt*Math.PI);
          const vx = A[o+2], vy = A[o+3];
          const sp = Math.sqrt(vx*vx + vy*vy);
          const form = E[e+9];
          const stretch = form === 1 ? 5 : form === 3 ? 2.6 : Math.min(2.6, sp*.12*(.3 + E[e+4]));
          const pulse = E[e+8] > 0 ? 1 + .35*Math.sin(st.t*2.2 + E[e+3]*6.283) : 1;
          I[k] = A[o]; I[k+1] = A[o+1]; I[k+2] = A[o+6]*(.7 + .3*env)*pulse;
          I[k+3] = (stretch > .3 && sp > .01) ? Math.atan2(vy, vx) : A[o+7];
          I[k+4] = A[o+9]; I[k+5] = A[o+10]; I[k+6] = A[o+11]; I[k+7] = Math.pow(env, .9)*E[e+2];
          I[k+8] = A[o+12]; I[k+9] = A[o+13]; I[k+10] = stretch; I[k+11] = E[e+3];
          I[k+12] = E[e+10]; I[k+13] = E[e+11]; I[k+14] = E[e+12]; I[k+15] = E[e+13];
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.ib);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, I, 0, n*16);
        gl.useProgram(P.part);
        gl.uniform2f(this.u(P.part, "uRes"), st.cssW, st.cssH);
        gl.uniform1f(this.u(P.part, "uGain"), .46 * st.gain);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        gl.bindVertexArray(this.pvao);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
        gl.disable(gl.BLEND);
      }
      // 3. feedback: B = advect(A)*decay + S*mix  → smoky trails
      this.pass(P.feedback, T.B, ()=>{
        const p = P.feedback;
        this.tex(p, "uPrev", 0, T.A.tex);
        this.tex(p, "uAdd", 1, T.S.tex);
        gl.uniform2f(this.u(p, "uTexel"), 1/T.A.w, 1/T.A.h);
        gl.uniform1f(this.u(p, "uDecay"), st.decay);
        gl.uniform1f(this.u(p, "uTime"), st.t);
        gl.uniform1f(this.u(p, "uFlow"), st.flow);
        gl.uniform1f(this.u(p, "uRise"), st.rise);
        gl.uniform1f(this.u(p, "uAspect"), this.w/this.h);
        gl.uniform1f(this.u(p, "uMix"), .15);
        gl.uniform1f(this.u(p, "uFloor"), this.floatOK ? .0004 : 1.6/255);
      });
      // swap
      const tmp = T.A; T.A = T.B; T.B = tmp;
      // 4. bloom
      this.pass(P.down, T.b2, ()=>{ this.tex(P.down, "uSrc", 0, T.A.tex); this.tex(P.down, "uSrc2", 1, T.S.tex); gl.uniform1f(this.u(P.down, "uW1"), .75); gl.uniform1f(this.u(P.down, "uW2"), 1); gl.uniform2f(this.u(P.down, "uTexel"), .5/T.A.w, .5/T.A.h); });
      this.pass(P.down, T.b4a, ()=>{ this.tex(P.down, "uSrc", 0, T.b2.tex); this.tex(P.down, "uSrc2", 1, T.b2.tex); gl.uniform1f(this.u(P.down, "uW1"), 1); gl.uniform1f(this.u(P.down, "uW2"), 0); gl.uniform2f(this.u(P.down, "uTexel"), .5/T.b2.w, .5/T.b2.h); });
      this.pass(P.blur, T.b4b, ()=>{ this.tex(P.blur, "uSrc", 0, T.b4a.tex); gl.uniform2f(this.u(P.blur, "uDir"), 1/T.b4a.w, 0); });
      this.pass(P.blur, T.b4a, ()=>{ this.tex(P.blur, "uSrc", 0, T.b4b.tex); gl.uniform2f(this.u(P.blur, "uDir"), 0, 1/T.b4b.h); });
      this.pass(P.down, T.b8a, ()=>{ this.tex(P.down, "uSrc", 0, T.b4a.tex); this.tex(P.down, "uSrc2", 1, T.b4a.tex); gl.uniform1f(this.u(P.down, "uW1"), 1); gl.uniform1f(this.u(P.down, "uW2"), 0); gl.uniform2f(this.u(P.down, "uTexel"), .5/T.b4a.w, .5/T.b4a.h); });
      this.pass(P.blur, T.b8b, ()=>{ this.tex(P.blur, "uSrc", 0, T.b8a.tex); gl.uniform2f(this.u(P.blur, "uDir"), 1.5/T.b8a.w, 0); });
      this.pass(P.blur, T.b8a, ()=>{ this.tex(P.blur, "uSrc", 0, T.b8b.tex); gl.uniform2f(this.u(P.blur, "uDir"), 0, 1.5/T.b8b.h); });
      // 5. composite
      this.pass(P.comp, null, ()=>{
        const p = P.comp;
        this.tex(p, "uTrail", 0, T.A.tex); this.tex(p, "uField", 1, T.field.tex);
        this.tex(p, "uB1", 2, T.b4a.tex); this.tex(p, "uB2", 3, T.b8a.tex); this.tex(p, "uSharp", 4, T.S.tex);
        gl.uniform3f(this.u(p, "uBg"), 10/255, 9/255, 18/255);
        gl.uniform1f(this.u(p, "uBloom"), .55);
        gl.uniform1f(this.u(p, "uTime"), st.t);
        gl.uniform1f(this.u(p, "uCam"), st.cam ? 1 : 0);
        gl.uniform1f(this.u(p, "uExp"), 1.0);
      });
    }
  }

  /* ========================= CANVAS 2D FALLBACK ======================= */
  class Canvas2DRenderer{
    constructor(canvas){ this.ctx = canvas.getContext("2d"); this.kind = "canvas2d"; this.canvas = canvas; this.scale = 1; }
    resize(cw, ch){ this.scale = cw / Math.max(1, W); }
    clear(){ this.ctx.setTransform(1,0,0,1,0,0); this.ctx.fillStyle = "#0a0912"; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); }
    render(st){
      const ctx = this.ctx, s = this.scale;
      ctx.setTransform(s,0,0,s,0,0);
      ctx.globalCompositeOperation = "source-over";
      if(st.cam){ ctx.fillStyle = "rgba(0,0,0,0.22)"; }
      else ctx.fillStyle = `rgba(10,9,18,${clamp(1.15 - st.decay, .12, .3)})`;
      ctx.fillRect(0,0,W,H);
      ctx.globalCompositeOperation = "lighter";
      for(let i=0;i<3;i++){
        const w = st.fieldW[i]; if(w <= .01) continue;
        const x = st.fieldP[i*2]*W, y = (1 - st.fieldP[i*2+1])*H, r = Math.max(W,H)*.45;
        const g = ctx.createRadialGradient(x,y,0,x,y,r);
        const c = [st.fieldC[i*3], st.fieldC[i*3+1], st.fieldC[i*3+2]];
        g.addColorStop(0, css(c, .05*w)); g.addColorStop(1, css(c, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.fill();
      }
      const A = PART.a, E = PART.e;
      for(let i=0;i<PART.n;i++){
        const o = i*PF, e = i*EX;
        const env = Math.sin(A[o+4]/A[o+5]*Math.PI);
        const a = env*E[e+2]*.17; if(a < .01) continue;
        const sz = A[o+6]*.75, ang = A[o+12], n = A[o+13];
        ctx.fillStyle = css([A[o+9],A[o+10],A[o+11]], a);
        ctx.beginPath();
        if(ang < .3){ ctx.arc(A[o], A[o+1], sz, 0, 6.2832); }
        else {
          const inner = sz*lerp(.85, .38, ang);
          for(let k=0;k<n*2;k++){
            const rr = k%2 ? inner : sz*1.25, th = A[o+7] + k*Math.PI/n;
            const px = A[o] + Math.cos(th)*rr, py = A[o+1] + Math.sin(th)*rr;
            k ? ctx.lineTo(px,py) : ctx.moveTo(px,py);
          }
          ctx.closePath();
        }
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
  }

  /* ============================== SOUND ============================== */
  class Sound{
    constructor(){ this.ctx = null; this.voices = new Map(); this.enabled = false; }
    async enable(){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return false;
      if(!this.ctx){
        const ctx = this.ctx = new AC();
        this.master = ctx.createGain(); this.master.gain.value = 0;
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
        this.bus = ctx.createGain();
        const verb = ctx.createConvolver(); verb.buffer = this.impulse(3.4);
        const wet = ctx.createGain(); wet.gain.value = .5;
        const dry = ctx.createGain(); dry.gain.value = .7;
        this.bus.connect(dry); this.bus.connect(verb); verb.connect(wet);
        dry.connect(comp); wet.connect(comp); comp.connect(this.master); this.master.connect(ctx.destination);
      }
      try{ await this.ctx.resume(); }catch(e){}
      this.enabled = true;
      this.master.gain.setTargetAtTime(.9, this.ctx.currentTime, .3);
      return true;
    }
    disable(){
      this.enabled = false;
      if(this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, .25);
    }
    impulse(sec){
      const ctx = this.ctx, len = Math.floor(ctx.sampleRate*sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
      for(let c=0;c<2;c++){ const d = b.getChannelData(c); for(let i=0;i<len;i++) d[i] = (Math.random()*2-1)*Math.pow(1 - i/len, 2.6); }
      return b;
    }
    makeVoice(em){
      const ctx = this.ctx, v = em.v, now = ctx.currentTime;
      const f0 = 440*Math.pow(2, (v.midi-69)/12);
      const out = ctx.createGain(); out.gain.value = 0;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if(pan) pan.pan.value = clamp((em.anchors[0].bx - .5)*1.3, -.8, .8);
      const trem = ctx.createGain(); trem.gain.value = .7;
      const lfo = ctx.createOscillator(); lfo.frequency.value = .05 + .55*em.scent.V;
      const lfoAmt = ctx.createGain(); lfoAmt.gain.value = .3; lfo.connect(lfoAmt); lfoAmt.connect(trem.gain);
      const filt = ctx.createBiquadFilter(); filt.type = "lowpass";
      filt.frequency.value = 380 + 3800*Math.pow(v.ang, 1.3); filt.Q.value = .7 + 4*v.ang;
      const oscs = [];
      const add = (type, freq, gain, detune=0)=>{
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
        const g = ctx.createGain(); g.gain.value = gain; o.connect(g); g.connect(filt); oscs.push(o);
      };
      add("sine", f0, .55);
      add("triangle", f0*2, .22, 4);
      add("sawtooth", f0, .05 + .3*v.ang, -7 - 10*v.ang);
      if(v.ang > .5) add("square", f0*1.5, .06*v.ang, 9);
      if(v.pitchT < .45) add("sine", f0/2, .35*(1 - v.pitchT));
      filt.connect(trem); trem.connect(out);
      if(pan){ out.connect(pan); pan.connect(this.bus); } else out.connect(this.bus);
      oscs.forEach(o=> o.start(now)); lfo.start(now);
      return { out, oscs: [...oscs, lfo] };
    }
    sync(emitters){
      if(!this.ctx) return;
      const now = this.ctx.currentTime, seen = new Set();
      for(const em of emitters){
        if(em.demo) continue;
        seen.add(em);
        let vc = this.voices.get(em);
        if(!vc){ if(!this.enabled) continue; vc = this.makeVoice(em); this.voices.set(em, vc); }
        const lvl = this.enabled ? clamp(em.eff, 0, 1.3)*.15 : 0;
        vc.out.gain.setTargetAtTime(lvl, now, .5);
      }
      for(const [em, vc] of this.voices){
        if(seen.has(em) && this.enabled) continue;
        vc.out.gain.setTargetAtTime(0, now, .4);
        if(!seen.has(em) || !this.enabled){
          vc.oscs.forEach(o=>{ try{ o.stop(now + 2.5); }catch(e){} });
          this.voices.delete(em);
        }
      }
    }
  }
  const sound = new Sound();

  /* ============================ RENDERER ============================ */
  const canvas = $("viz");
  let renderer;
  try{ renderer = new GLRenderer(canvas); }
  catch(err){ console.warn("[OSMOS] WebGL2 unavailable, using Canvas 2D:", err && err.message); renderer = new Canvas2DRenderer(canvas); }
  let renderScale = 1;
  const lowEnd = (navigator.hardwareConcurrency || 4) <= 4 || Math.min(screen.width, screen.height) < 500;
  function resize(){
    W = window.innerWidth; H = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const cap = renderer.kind === "webgl2" ? (lowEnd ? 1.25 : 1.6) : Math.min(dpr, 2);
    const rs = Math.min(dpr, cap) * renderScale;
    const cw = Math.max(1, Math.round(W*rs)), ch = Math.max(1, Math.round(H*rs));
    canvas.width = cw; canvas.height = ch;
    fieldScale = clamp(Math.min(W,H)/430, .9, 2.4);
    pointer.R = Math.min(W,H)*.32;
    renderer.resize(cw, ch);
    if(renderer.kind !== "webgl2") renderer.clear();
  }
  allocParticles(renderer.kind === "webgl2" ? (lowEnd ? 2600 : 4200) : 900);
  window.addEventListener("resize", resize);
  resize();

  canvas.addEventListener("webglcontextlost", (e)=>{ e.preventDefault(); }, false);
  canvas.addEventListener("webglcontextrestored", ()=>{ try{ renderer = new GLRenderer(canvas); renderer.w = 0; resize(); }catch(e){ location.reload(); } }, false);

  /* ============================ STATE / LOOP ========================== */
  let emitters = [];
  let activeScents = [];
  const adaptMem = new Map();
  let camOn = false;
  let last = performance.now();
  let ema = 1/60, slowFor = 0;
  let lastUi = 0, lastSound = 0;
  const st = { t:0, fieldC:new Float32Array(9), fieldW:new Float32Array(3), fieldP:new Float32Array(6),
    warp:0, decay:.95, flow:.6, rise:.6, gain:1, cam:false, cssW:1, cssH:1,
    sheetN:0, sC1:new Float32Array(9), sC2:new Float32Array(9), sA:new Float32Array(12), sB:new Float32Array(12), sPh:new Float32Array(3), sSp:new Float32Array(3) };
  const SHEET_SPEED = { drift:.3, rise:.42, fall:.42, swirl:.6, pulse:.3, still:.07 };

  function frame(now){
    const dt = Math.min((now - last)/1000, .05);
    last = now;
    const t = now/1000;
    sniff = pointer.down ? Math.min(1, sniff + dt*2.5) : Math.max(0, sniff - dt*.8);

    const real = emitters.filter(e=> e.active && !e.demo).length;
    const mixMul = real > 1 ? Math.pow(real, -.3) : 1;     // hypo-additive mixtures
    const qual = reduceMotion ? .4 : 1;
    for(const em of emitters){
      em.update(dt);
      em.eff = em.fade * em.adaptMul() * mixMul * (1 + .4*sniff) * (em.demo ? .7 : 1);
      if(em.fade > 0){
        em.spawnAcc += em.v.rate * em.eff * qual * dt;
        while(em.spawnAcc >= 1){ spawnFrom(em, t); em.spawnAcc -= 1; }
        if(PART.n >= PART.max) em.spawnAcc = 0;
      }
    }
    stepParticles(dt, t);
    emitters = emitters.filter(em=> !em.dead());

    // render state: strongest three emitters drive the field
    const ranked = emitters.slice().sort((a,b)=> b.eff - a.eff).slice(0,3);
    let wsum = 0, dec = 0, rise = 0, warp = 0;
    for(let i=0;i<3;i++){
      const em = ranked[i];
      if(em){
        const c = em.v.fieldRgb, w = clamp(em.eff, 0, 1.3), [px, py] = em.anchorPos(0, t);
        st.fieldC[i*3] = c[0]; st.fieldC[i*3+1] = c[1]; st.fieldC[i*3+2] = c[2];
        st.fieldW[i] = w; st.fieldP[i*2] = px; st.fieldP[i*2+1] = 1 - py;
        wsum += w; dec += em.v.decay*w; rise += (.3 + 1.2*em.scent.V)*w; warp += em.v.complexity*w;
      } else { st.fieldW[i] = 0; }
    }
    st.decay = wsum > .01 ? dec/wsum : .95;
    st.decay = Math.pow(st.decay, dt*60);
    st.rise = wsum > .01 ? rise/wsum : .6;
    st.warp = wsum > .01 ? warp/wsum : .3;
    st.flow = .5 + st.warp*.9;
    st.t = t; st.cam = camOn; st.cssW = W; st.cssH = H;
    const sheets = emitters.filter(em=> em.v.formId === 4 && em.fade > 0).slice(0, 3);
    st.sheetN = sheets.length;
    sheets.forEach((em, i)=>{
      const v = em.v, p = v.profile, w = clamp(em.eff, 0, 1.2);
      st.sC1.set(v.rgb, i*3); st.sC2.set(v.rgbLight, i*3);
      const yy = p.motion === "rise" ? p.y - .04*Math.sin(t*.2) : p.motion === "fall" ? p.y + .04*Math.sin(t*.2) : p.y;
      st.sA.set([p.x, 1 - yy, .05 + .07*(p.motion === "still" ? .3 : 1), .62*w*(p.motion === "pulse" ? .75 + .25*Math.sin(t*2.2) : 1)], i*4);
      st.sB.set([.5 + .45*p.size, .05 + .12*p.size, v.tex, 1], i*4);
      st.sPh[i] = em.phase; st.sSp[i] = SHEET_SPEED[p.motion] || .3;
    });
    st.gain = 1 + .25*sniff;
    renderer.render(st);

    // adaptive quality
    ema = ema*.95 + dt*.05;
    if(ema > 1/38 && renderScale > .6){ slowFor += dt; if(slowFor > 2.5){ renderScale = Math.max(.6, renderScale - .15); slowFor = 0; resize(); allocParticles(Math.max(1200, Math.round(PART.max*.8))); } }
    else slowFor = Math.max(0, slowFor - dt);

    if(now - lastUi > 500){ lastUi = now; updateLive(); }
    if(now - lastSound > 120){ lastSound = now; sound.sync(emitters); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ============================== GLYPHS ============================= */
  function glyphPath(ang, n){
    if(ang < .12) return "M1 0A1 1 0 1 1 -1 0A1 1 0 1 1 1 0Z";
    const inner = lerp(.9, .36, (ang-.12)/.88), outer = lerp(1, 1.18, ang);
    let d = "";
    for(let k=0;k<n*2;k++){
      const r = k%2 ? inner : outer, th = -Math.PI/2 + k*Math.PI/n;
      d += (k ? "L" : "M") + (Math.cos(th)*r).toFixed(3) + " " + (Math.sin(th)*r).toFixed(3);
    }
    return d + "Z";
  }
  function viewOf(s){ return personalActive(s) ? derivePersonal(s, profileFor(s.id)) : derive(s); }
  function glyph(s, size=18, useView=false){
    const v = useView ? viewOf(s) : derive(s);
    return `<svg class="glyph" width="${size}" height="${size}" viewBox="-1.5 -1.5 3 3" aria-hidden="true">`
      + `<circle r="1.45" fill="${css(v.rgb,.16)}"/><path d="${glyphPath(v.ang, v.points)}" fill="${css(v.rgb)}"/></svg>`;
  }

  /* ================================ UI =============================== */
  const pillRow = $("pillRow"), chipRow = $("chipRow"), searchInput = $("searchInput"), suggestEl = $("suggest");
  const hintText = $("hintText"), readout = $("readout"), toastEl = $("toast");
  const panels = { science: $("sciencePanel"), describe: $("describePanel"), library: $("libraryPanel"), mine: $("minePanel") };
  const panelBtns = { science: $("sciBtn"), describe: $("describeBtn"), library: $("libBtn"), mine: $("paintBtn") };
  const flashEl = $("flash");
  let sheetCat = store.get("sheetCat", "all");

  // ----- toast
  let toastTimer = null;
  function toast(html, opts={}){
    toastEl.innerHTML = html;
    if(opts.actions && opts.actions.length){
      const row = document.createElement("div"); row.className = "t-actions";
      opts.actions.forEach(a=>{
        const b = document.createElement("button"); b.innerHTML = a.label;
        b.addEventListener("click", ()=>{ a.fn(); hideToast(); });
        row.appendChild(b);
      });
      toastEl.appendChild(row);
    }
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    if(opts.ms !== 0) toastTimer = setTimeout(hideToast, opts.ms || 3200);
  }
  function hideToast(){ toastEl.classList.remove("show"); }

  // ----- category tabs
  function catTabs(el, current, onPick){
    el.innerHTML = "";
    [["all","All"], ...CATEGORIES].forEach(([k,label])=>{
      const b = document.createElement("button");
      b.className = "cat-tab" + (k === current ? " on" : "");
      b.textContent = label; b.dataset.cat = k;
      b.addEventListener("click", ()=>{ el.querySelectorAll(".cat-tab").forEach(x=> x.classList.toggle("on", x === b)); onPick(k); });
      el.appendChild(b);
    });
  }
  const catOrder = Object.fromEntries(CATEGORIES.map(([k],i)=> [k,i]));
  function sortedScents(){ return SCENTS.slice().sort((a,b)=> (catOrder[a.cat]-catOrder[b.cat]) || a.name.localeCompare(b.name)); }

  // ----- chips
  function renderChips(){
    chipRow.innerHTML = "";
    const list = sortedScents().filter(s=> sheetCat === "all" || s.cat === sheetCat);
    list.forEach(s=>{
      const chip = document.createElement("button");
      chip.className = "chip"; chip.dataset.id = s.id;
      chip.innerHTML = `${glyph(s, 18)}<span>${escHtml(s.name)}</span>`;
      chip.addEventListener("click", ()=> toggleScent(s));
      chipRow.appendChild(chip);
    });
    chipRow.scrollLeft = 0;
    renderChipStates();
  }
  function renderChipStates(){
    const ids = activeScents.map(s=> s.id), atCap = activeScents.length >= MAX_ACTIVE;
    chipRow.querySelectorAll(".chip").forEach(c=>{
      const on = ids.includes(c.dataset.id);
      c.classList.toggle("active", on); c.classList.toggle("dim", atCap && !on);
      c.setAttribute("aria-pressed", on);
    });
  }

  // ----- pills + readout
  function emitterFor(s){ return emitters.find(e=> e.scent.id === s.id && e.active && !e.demo); }
  function adaptPct(s){ const em = emitterFor(s); return em ? Math.round((1 - em.adaptMul())*100) : 0; }
  function renderPills(){
    pillRow.innerHTML = "";
    activeScents.forEach(s=>{
      const p = document.createElement("button");
      p.className = "pill"; p.dataset.id = s.id;
      p.setAttribute("aria-label", `Remove ${s.name}`);
      p.innerHTML = `${glyph(s, 18, true)}<span>${escHtml(s.name)}</span>${personalActive(s) ? '<span class="me-dot" title="Your personal view">✎</span>' : ""}<span class="ad"></span><span class="x">✕</span>`;
      p.addEventListener("click", ()=> toggleScent(s));
      pillRow.appendChild(p);
    });
    updateLive();
  }
  function updateLive(){
    pillRow.querySelectorAll(".pill").forEach(p=>{
      const s = activeScents.find(a=> a.id === p.dataset.id); if(!s) return;
      const pct = adaptPct(s);
      p.querySelector(".ad").textContent = (settings.adapt && pct >= 8) ? `−${pct}%` : "";
    });
    if(activeScents.length){
      const anyMine = activeScents.some(personalActive);
      const meta = (anyMine ? "PERSONAL VIEW — NOT DATA · " : "") + (activeScents.length === 1 ? (()=>{
        const s = activeScents[0], v = derive(s);
        return `INTENSITY ${s.I.toFixed(2)} · PLEASANT ${fmtSigned(s.P)} · ${noteWord(s.V).toUpperCase()} · ♪ ${noteName(v.midi)}`;
      })() : `${activeScents.length}-PART BLEND · MIXTURE INTENSITY < SUM OF PARTS`);
      const adapt = settings.adapt ? Math.max(...activeScents.map(adaptPct)) : 0;
      $("readoutMeta").textContent = meta + (adapt >= 10 ? ` · NOSE ADAPTED ${adapt}%` : "");
    }
  }
  function renderReadout(){
    if(!activeScents.length){ readout.classList.add("empty"); $("viewRow").hidden = true; return; }
    readout.classList.remove("empty");
    $("readoutName").textContent = activeScents.map(s=> s.name).join(" + ");
    $("readoutBlurb").textContent = activeScents.length === 1
      ? viewOf(activeScents[0]).blurb + (activeScents[0].custom && !personalActive(activeScents[0]) ? " · descriptor-only reading" : "")
      : activeScents.map(s=> viewOf(s).colour).join(" / ") + " · blended signal";
    const note = activeScents.length === 1 && personalActive(activeScents[0]) ? profileFor(activeScents[0].id).note : "";
    $("readoutNote").textContent = note ? `“${note}”` : "";
    $("viewRow").hidden = false;
    $("vCons").classList.toggle("on", settings.view === "consensus"); $("vMine").classList.toggle("on", settings.view === "mine");
    updateLive();
  }

  // ----- science panel
  function radarSVG(s){
    const v = derive(s), N = DESCRIPTORS.length, cx = 170, cy = 150, R = 104;
    let grid = "", spokes = "", labels = "", pts = [];
    for(const rr of [.25,.5,.75,1]){
      let d = ""; for(let i=0;i<N;i++){ const a = -Math.PI/2 + i*2*Math.PI/N; d += (i?"L":"M") + (cx+Math.cos(a)*R*rr).toFixed(1) + " " + (cy+Math.sin(a)*R*rr).toFixed(1); }
      grid += `<path d="${d}Z" fill="none" stroke="rgba(237,231,255,${rr===1?.14:.06})"/>`;
    }
    DESCRIPTORS.forEach(([k, short], i)=>{
      const a = -Math.PI/2 + i*2*Math.PI/N, val = dv(s,k);
      const x = cx + Math.cos(a)*R, y = cy + Math.sin(a)*R;
      spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(237,231,255,.05)"/>`;
      pts.push([cx + Math.cos(a)*R*val, cy + Math.sin(a)*R*val]);
      if(val >= .2){
        const lx = cx + Math.cos(a)*(R+14), ly = cy + Math.sin(a)*(R+14);
        const anchor = Math.abs(Math.cos(a)) < .3 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        labels += `<text x="${lx.toFixed(1)}" y="${(ly+3).toFixed(1)}" text-anchor="${anchor}" opacity="${(.45+.55*val).toFixed(2)}">${short}</text>`;
      } else {
        const tx = cx + Math.cos(a)*(R+5), ty = cy + Math.sin(a)*(R+5);
        labels += `<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="1" fill="rgba(237,231,255,.25)"/>`;
      }
    });
    const poly = pts.map((p,i)=> (i?"L":"M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("") + "Z";
    return `<svg class="radar" viewBox="0 0 340 300" role="img" aria-label="Descriptor fingerprint for ${escHtml(s.name)}">${grid}${spokes}`
      + `<path d="${poly}" fill="${css(v.rgb,.22)}" stroke="${css(v.rgbLight,.95)}" stroke-width="1.4" stroke-linejoin="round"/>`
      + pts.map(p=> `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.6" fill="${css(v.rgb)}"/>`).join("") + labels + `</svg>`;
  }
  function scaleRow(label, value, txt, mode, col){
    let fill;
    if(mode === "div"){ const x = (value+1)/2; fill = x >= .5 ? `left:50%;width:${(x-.5)*100}%` : `left:${x*100}%;width:${(.5-x)*100}%`; }
    else fill = `left:0;width:${value*100}%`;
    return `<div class="scale-row"><span>${label}</span><div class="track">${mode==="div"?'<div class="mid"></div>':""}<div class="fill" style="${fill};background:${col}"></div></div><span class="val">${txt}</span></div>`;
  }
  function topDescriptors(s, n=3){
    return DESCRIPTORS.map(([k,,long])=> [long.toLowerCase(), dv(s,k)]).filter(x=> x[1] > 0).sort((a,b)=> b[1]-a[1]).slice(0,n);
  }
  function renderScience(){
    const el = $("scienceReadouts");
    if(!activeScents.length){ el.innerHTML = `<p style="opacity:.6">Choose a scent to see its signal.</p>`; return; }
    el.innerHTML = activeScents.map(s=>{
      const v = derive(s), col = css(v.rgb);
      const hiTxt = topDescriptors(s,3).map(x=> x[0]).join(", ");
      const darker = Math.round((v.l0 - v.Lraw)*100);
      const custom = s.custom ? `<p class="db-empty">Descriptor-only reading built from the words you typed (${escHtml(s.hits.join(", "))}). No association colour exists for it, so it renders in neutral grey; intensity and volatility are left at a neutral midpoint.</p>` : "";
      const mineNote = personalActive(s) ? `<p class="me-note"><span class="badge me">Personal</span> The stage is showing <em>your</em> painting of this scent${shared[s.id] ? " (from a shared link)" : ""}. Everything below is the consensus mapping, for comparison.</p>` : "";
      return `<div class="sig">
        ${mineNote}
        <div class="sig-head">${glyph(s, 36)}<div><div class="nm">${escHtml(s.name)}</div><div class="sub">${s.custom ? "TYPED ENTRY" : escHtml(CAT_NAME[s.cat]).toUpperCase()} · ${s.custom ? "KEYWORD ESTIMATE" : "EDITORIAL ESTIMATE"}</div></div></div>
        ${custom}
        ${radarSVG(s)}
        ${scaleRow("INTENSITY", s.I, s.I.toFixed(2), "fill", col)}
        ${scaleRow("PLEASANTNESS", s.P, fmtSigned(s.P), "div", col)}
        ${scaleRow("VOLATILITY", s.V, noteWord(s.V).split(" ")[0], "fill", col)}
        <table class="derive">
          <tr><td>Colour</td><td><span class="v"><span class="swatch" style="background:${css(hslToRgb(v.h, v.sat, v.Lraw))}"></span>${escHtml(v.colour)}</span><span class="why">${s.custom ? "no source-object association available" : "association colour of the smell's source"}</span></td><td><span class="badge ev">Evidence</span></td></tr>
          <tr><td>Darkness</td><td><span class="v">${darker > 0 ? `${darker}% darker` : darker < 0 ? `${-darker}% lighter` : "unchanged"}</span><span class="why">intensity ${s.I.toFixed(2)} → stronger reads darker</span></td><td><span class="badge ev">Evidence</span></td></tr>
          <tr><td>Shape</td><td><span class="v">${shapeWord(v.ang)}</span> <span class="gauge"><span>round</span><span class="g"><i style="left:${(v.ang*100).toFixed(0)}%"></i></span><span>angular</span></span><span class="why">pleasantness ${fmtSigned(s.P)}, intensity ${s.I.toFixed(2)}${dv(s,"sweet")>.3?", sweet":""}${Math.max(dv(s,"sour"),dv(s,"acid"))>.3?", sour/acid":""}</span></td><td><span class="badge ev">Evidence</span></td></tr>
          <tr><td>Pitch</td><td><span class="v">${noteName(v.midi)}</span><span class="why">${v.hi > v.lo + .2 ? "fruity/sweet qualities pull it higher" : v.lo > v.hi + .2 ? "smoky/musky/woody qualities pull it lower" : "balanced — sits mid-range"}</span></td><td><span class="badge ev">Evidence</span></td></tr>
          <tr><td>Motion</td><td><span class="v">${motionWord(s.V)}</span><span class="why">${noteWord(s.V)} — volatility ${s.V.toFixed(2)}</span></td><td><span class="badge ph">Physical</span></td></tr>
          <tr><td>Turbulence</td><td><span class="v">${v.jitter > .6 ? "high" : v.jitter > .3 ? "moderate" : "calm"}</span><span class="why">from cold / sour / acid / chemical qualities</span></td><td><span class="badge art">Artistic</span></td></tr>
          <tr><td>Strongest</td><td><span class="v">${escHtml(hiTxt || "—")}</span><span class="why">top descriptors (Keller &amp; Vosshall vocabulary)</span></td><td></td></tr>
        </table>
      </div>`;
    }).join("");
  }

  // ----- describe panel
  let speakingBtn = null;
  function speakText(text, btn){
    if(!("speechSynthesis" in window)) return;
    const was = btn.classList.contains("speaking");
    window.speechSynthesis.cancel();
    document.querySelectorAll(".listen-btn.speaking").forEach(b=> b.classList.remove("speaking"));
    if(was) return;
    const u = new SpeechSynthesisUtterance(text); u.rate = .98;
    u.onstart = ()=> btn.classList.add("speaking");
    u.onend = u.onerror = ()=> btn.classList.remove("speaking");
    speakingBtn = btn;
    window.speechSynthesis.speak(u);
  }
  function renderDescribe(){
    const el = $("describeReadouts");
    if(!activeScents.length){ el.innerHTML = `<p style="opacity:.6">Choose a scent to see its description.</p>`; return; }
    el.innerHTML = "";
    activeScents.forEach(s=>{
      const b = document.createElement("div"); b.className = "desc-block";
      if(s.custom){
        b.innerHTML = `<div class="db-head"><div class="db-name">${glyph(s,26)}${escHtml(s.name)}</div></div>
          <div class="db-empty">There's no verified description for a typed entry. Pick a scent from the library for an accurate, plain-language description.</div>`;
      } else {
        const mol = s.mol && s.mol !== "—" ? `<div class="db-meta"><b>Key molecules</b>${escHtml(s.mol)}</div>` : "";
        const note = s.note ? `<div class="db-meta"><b>Worth knowing</b>${escHtml(s.note)}</div>` : "";
        b.innerHTML = `<div class="db-head"><div class="db-name">${glyph(s,26)}${escHtml(s.name)}</div>
          <button class="listen-btn" type="button" aria-label="Read description aloud">🔊 Listen</button></div>
          <div class="db-text">${escHtml(s.literal)}</div>${mol}${note}`;
        const btn = b.querySelector(".listen-btn");
        btn.addEventListener("click", ()=> speakText(`${s.name}. ${s.literal} ${s.note || ""}`, btn));
      }
      el.appendChild(b);
    });
  }

  // ----- library panel
  let libView = "grid", libCat = "all", libSort = "name", libAxes = "P-I", libQuery = "";
  function libList(){
    let list = SCENTS.filter(s=> libCat === "all" || s.cat === libCat);
    if(libQuery){
      const q = norm(libQuery);
      const hits = new Set(searchScents(q, 200).map(r=> r.s.id));
      list = list.filter(s=> hits.has(s.id) || norm(s.mol).includes(q) || norm(s.literal).includes(q));
    }
    const k = libSort;
    list.sort((a,b)=> k === "name" ? a.name.localeCompare(b.name)
      : k === "P" ? b.P - a.P : k === "I" ? b.I - a.I : k === "V" ? b.V - a.V : a.V - b.V);
    return list;
  }
  function renderLibrary(){
    const list = libList(), body = $("libBody"), ids = activeScents.map(s=> s.id);
    $("libCount").textContent = `${list.length} OF ${SCENTS.length} SCENTS` + (libView === "map" ? " · TAP A POINT TO ADD IT" : "");
    if(libView === "grid"){
      body.innerHTML = `<div class="lib-grid">` + list.map(s=>{
        const mini = (lab, val)=> `<span>${lab}</span><span class="mt"><i style="width:${(val*100).toFixed(0)}%"></i></span>`;
        return `<button class="lib-card${ids.includes(s.id)?" on":""}" data-id="${s.id}" aria-pressed="${ids.includes(s.id)}">
          ${glyph(s, 30)}<span class="nm">${escHtml(s.name)}${mine[s.id] ? ' <span class="me-dot" title="You have a personal view">✎</span>' : ""}</span><span class="ct">${escHtml(CAT_NAME[s.cat])}</span>
          <span class="mini">${mini("I", s.I)}${mini("P", (s.P+1)/2)}${mini("V", s.V)}</span></button>`;
      }).join("") + `</div>`;
      body.querySelectorAll(".lib-card").forEach(c=> c.addEventListener("click", ()=>{ toggleScent(SCENT_BY_ID[c.dataset.id]); }));
    } else {
      const wpx = Math.max(300, body.clientWidth || 560), hpx = Math.round(wpx*.86);
      const m = { l:34, r:14, t:16, b:34 };
      const [ax, ay] = libAxes.split("-");
      const rng = { P:[-1,1], I:[0,1], V:[0,1] };
      const axisName = { P:"Pleasantness", I:"Intensity", V:"Volatility" };
      const ends = { P:["unpleasant","pleasant"], I:["faint","strong"], V:["lingers","fleeting"] };
      const X = (val)=> m.l + (val - rng[ax][0])/(rng[ax][1]-rng[ax][0])*(wpx - m.l - m.r);
      const Y = (val)=> hpx - m.b - (val - rng[ay][0])/(rng[ay][1]-rng[ay][0])*(hpx - m.t - m.b);
      let svg = `<svg class="lib-map" viewBox="0 0 ${wpx} ${hpx}" width="100%" role="img" aria-label="Scatter map of scents by ${axisName[ax]} and ${axisName[ay]}">`;
      for(let i=0;i<=4;i++){
        const gx = m.l + i/4*(wpx-m.l-m.r), gy = m.t + i/4*(hpx-m.t-m.b);
        svg += `<line x1="${gx}" y1="${m.t}" x2="${gx}" y2="${hpx-m.b}" stroke="rgba(237,231,255,${i===2&&ax==="P"?.16:.05})"/>`;
        svg += `<line x1="${m.l}" y1="${gy}" x2="${wpx-m.r}" y2="${gy}" stroke="rgba(237,231,255,.05)"/>`;
      }
      svg += `<text x="${m.l}" y="${hpx-12}" font-size="9.5" fill="#7d7891">← ${ends[ax][0]}</text>`;
      svg += `<text x="${wpx-m.r}" y="${hpx-12}" font-size="9.5" fill="#7d7891" text-anchor="end">${ends[ax][1]} →</text>`;
      svg += `<text x="${(wpx+m.l-m.r)/2}" y="${hpx-12}" font-size="9.5" fill="#c7c2d6" text-anchor="middle" letter-spacing="1">${axisName[ax].toUpperCase()}</text>`;
      svg += `<text transform="translate(14 ${(hpx-m.b+m.t)/2}) rotate(-90)" font-size="9.5" fill="#c7c2d6" text-anchor="middle" letter-spacing="1">${axisName[ay].toUpperCase()}</text>`;
      svg += `<text transform="translate(14 ${hpx-m.b}) rotate(-90)" font-size="9" fill="#7d7891">${ends[ay][0]}</text>`;
      svg += `<text transform="translate(14 ${m.t}) rotate(-90)" font-size="9" fill="#7d7891" text-anchor="end">${ends[ay][1]}</text>`;
      const pts = list.map(s=>{
        const h = hashSeed(s.id);
        const jx = ((h & 255)/255 - .5)*7, jy = (((h>>8) & 255)/255 - .5)*7;
        return { s, x: X(s[ax]) + jx, y: Y(s[ay]) + jy };
      });
      pts.sort((a,b)=> ids.includes(a.s.id) - ids.includes(b.s.id));
      for(const p of pts){
        const v = derive(p.s), on = ids.includes(p.s.id), sz = on ? 9 : 6.5;
        const right = p.x < wpx*.62;
        svg += `<g class="pt${on?" on":""}" data-id="${p.s.id}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})">`
          + `<circle r="13" fill="transparent"/>`
          + (on ? `<circle r="${sz+5}" fill="none" stroke="${css(v.rgb,.8)}" stroke-width="1.2"/>` : "")
          + `<path transform="scale(${sz})" d="${glyphPath(v.ang, v.points)}" fill="${css(v.rgb, on ? 1 : .85)}"/>`
          + `<text class="lbl" x="${right ? 12 : -12}" y="4" text-anchor="${right ? "start" : "end"}">${escHtml(p.s.name)}</text>`
          + `<title>${escHtml(p.s.name)} — I ${p.s.I.toFixed(2)}, P ${fmtSigned(p.s.P)}, V ${p.s.V.toFixed(2)}</title></g>`;
      }
      svg += `</svg>`;
      body.innerHTML = svg + `<p class="map-note">Positions are OSMOS's editorial estimates, slightly jittered so overlapping scents stay tappable. Shape and colour follow the same mapping as the stage — notice how the unpleasant side fills with angular forms.</p>`;
      body.querySelectorAll(".pt").forEach(g=> g.addEventListener("click", ()=> toggleScent(SCENT_BY_ID[g.dataset.id])));
    }
  }

  // ----- panels
  function openPanel(name){
    const opening = !panels[name].classList.contains("open");
    closeAllPanels();
    if(!opening) return;
    panels[name].classList.add("open"); panelBtns[name].classList.add("active");
    if(name === "library") renderLibrary();
    if(name === "mine") renderMineList();
  }
  function closeAllPanels(){
    Object.keys(panels).forEach(k=>{ panels[k].classList.remove("open"); panelBtns[k].classList.remove("active"); });
    if("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
  ["science","describe","library"].forEach(k=> panelBtns[k].addEventListener("click", ()=> openPanel(k)));
  document.querySelectorAll("[data-close]").forEach(b=> b.addEventListener("click", closeAllPanels));

  // ----- flash
  function triggerFlash(s){
    const v = derive(s);
    flashEl.style.setProperty("--flash-color", css(v.rgbLight, .7));
    flashEl.classList.remove("burst"); void flashEl.offsetWidth;
    if(!reduceMotion) flashEl.classList.add("burst");
  }

  // ----- toggling scents
  let firstAdd = true;
  function toggleScent(s){
    if(!s) return;
    const idx = activeScents.findIndex(a=> a.id === s.id);
    if(idx >= 0){
      activeScents.splice(idx, 1);
      const em = emitterFor(s);
      if(em){ em.active = false; adaptMem.set(s.id, { exposure: em.exposure, t: performance.now() }); }
      hintText.textContent = "";
    } else {
      if(activeScents.length >= MAX_ACTIVE){
        hintText.textContent = "People can rarely pick out more than ~3 smells in a mix — remove one first.";
        return;
      }
      stopDemo();
      activeScents.push(s);
      let exposure = 0;
      const mem = adaptMem.get(s.id);
      if(mem){ exposure = mem.exposure * Math.exp(-(performance.now() - mem.t)/1000/40); }
      emitters.push(new Emitter(s, { exposure }));
      triggerFlash(s);
      if(firstAdd && !store.get("tipShown", false)){ firstAdd = false; store.set("tipShown", true); setTimeout(()=>{ if(!pointer.used) toast("Tip: press and hold on the light to <em>sniff</em> — it draws the scent towards you.", { ms: 4200 }); }, 2600); }
      hintText.textContent = activeScents.length > 1 ? "Blending — mixtures smell weaker than the sum of their parts." : "";
    }
    if("speechSynthesis" in window) window.speechSynthesis.cancel();
    renderPills(); renderChipStates(); renderReadout(); renderScience(); renderDescribe(); syncBoxActiveStates();
    if(panels.library.classList.contains("open")) renderLibrary();
    if(panels.mine.classList.contains("open")){ if(!activeScents.some(a=> a.id === edId)) edId = activeScents[0] ? activeScents[0].id : null; fillEditor(); }
  }

  /* ======================= MY SYNAESTHESIA (UI) ======================= */
  const CUSTOM = {};                       // typed readings seen this session
  const scentById = (id)=> SCENT_BY_ID[id] || CUSTOM[id] || activeScents.find(a=> a.id === id) || null;
  let edId = null, savedTimer = null;
  const FORM_LABEL = { orbs:"Orbs", shards:"Shards", threads:"Threads", mist:"Mist", sheet:"Sheet", rain:"Rain" };
  const TEX_LABEL = { smooth:"Smooth", grain:"Grain", stripes:"Stripes", ripples:"Ripples", cells:"Cells", fibres:"Fibres" };
  const MOTION_LABEL = { drift:"Drift", rise:"Rise", fall:"Fall", swirl:"Swirl", pulse:"Pulse", still:"Still" };
  function defaultProfile(s){
    const v = derive(s);
    return sanitizeProfile({ c1: s.custom ? "#b9b4cc" : s.col, c2: rgbToHex(v.rgbLight), form: v.ang > .6 ? "shards" : "orbs",
      tex: v.texName, motion: s.V > .66 ? "rise" : s.V < .25 ? "still" : "drift", x: .5, y: .42, size: .5, density: .5, note: "", n: s.name });
  }
  function setViewMode(view){
    settings.view = view; store.set("view", view);
    emitters.forEach(e=>{ if(!e.demo) e.applyView(); });
    renderPills(); renderReadout(); renderScience();
    if(panels.library.classList.contains("open")) renderLibrary();
  }
  function refreshPersonal(){
    emitters.forEach(e=>{ if(!e.demo && e.scent.id === edId) e.applyView(); });
    renderPills(); renderReadout(); renderScience();
    $("edSaved").textContent = "Saved on this device";
    clearTimeout(savedTimer); savedTimer = setTimeout(()=>{ $("edSaved").textContent = ""; }, 1600);
  }
  function editProfile(){
    if(!edId) return null;
    if(shared[edId] && !mine[edId]) mine[edId] = Object.assign({}, shared[edId]);
    delete shared[edId];
    if(!mine[edId]) mine[edId] = defaultProfile(scentById(edId));
    return mine[edId];
  }
  function openEditor(id){
    if(!activeScents.length){ toast("Add a scent first, then paint how <em>you</em> perceive it."); return; }
    edId = id && activeScents.some(a=> a.id === id) ? id : (edId && activeScents.some(a=> a.id === edId) ? edId : activeScents[0].id);
    if(!profileFor(edId)){ mine[edId] = defaultProfile(scentById(edId)); saveMine(); }
    if(settings.view !== "mine") setViewMode("mine");
    fillEditor();
    if(!panels.mine.classList.contains("open")) openPanel("mine");
  }
  function optRow(el, opts, labels, current, field){
    el.innerHTML = opts.map(o=> `<button type="button" class="ed-opt${o === current ? " on" : ""}" data-v="${o}" aria-pressed="${o === current}">${labels[o]}</button>`).join("");
    el.querySelectorAll(".ed-opt").forEach(b=> b.addEventListener("click", ()=>{
      const pr = editProfile(); if(!pr) return;
      pr[field] = b.dataset.v; saveMine();
      el.querySelectorAll(".ed-opt").forEach(x=>{ x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
      refreshPersonal();
    }));
  }
  function fillEditor(){
    const body = $("edBody");
    if(!edId || !activeScents.length){ body.hidden = true; $("edEmpty").hidden = false; renderMineList(); return; }
    body.hidden = false; $("edEmpty").hidden = true;
    const pr = profileFor(edId) || defaultProfile(scentById(edId));
    $("mineScents").innerHTML = activeScents.map(a=> `<button type="button" class="ed-scent${a.id === edId ? " on" : ""}" data-id="${a.id}">${glyph(a, 18, true)}<span>${escHtml(a.name)}</span></button>`).join("");
    $("mineScents").querySelectorAll(".ed-scent").forEach(b=> b.addEventListener("click", ()=> openEditor(b.dataset.id)));
    $("edC1").value = pr.c1; $("edC2").value = pr.c2;
    optRow($("edForm"), FORMS, FORM_LABEL, pr.form, "form");
    optRow($("edTex"), TEXTURES, TEX_LABEL, pr.tex, "tex");
    optRow($("edMotion"), MOTIONS, MOTION_LABEL, pr.motion, "motion");
    $("edSize").value = pr.size; $("edDensity").value = pr.density; $("edNote").value = pr.note;
    placeDot(pr.x, pr.y);
    $("edShared").hidden = !shared[edId];
    renderMineList();
  }
  function placeDot(x, y){ const d = $("edDot"); d.style.left = (x*100) + "%"; d.style.top = (y*100) + "%"; }
  ["edC1","edC2"].forEach((id, i)=> $(id).addEventListener("input", (e)=>{ const pr = editProfile(); if(!pr) return; pr[i ? "c2" : "c1"] = e.target.value.toLowerCase(); saveMine(); refreshPersonal(); }));
  [["edSize","size"],["edDensity","density"]].forEach(([id, f])=> $(id).addEventListener("input", (e)=>{ const pr = editProfile(); if(!pr) return; pr[f] = clamp(+e.target.value, 0, 1); saveMine(); refreshPersonal(); }));
  $("edNote").addEventListener("input", (e)=>{ const pr = editProfile(); if(!pr) return; pr.note = e.target.value.slice(0, 400); saveMine(); refreshPersonal(); });
  $("edFromCons").addEventListener("click", ()=>{
    const pr = editProfile(); if(!pr) return;
    const d = defaultProfile(scentById(edId)); pr.c1 = d.c1; pr.c2 = d.c2; saveMine(); fillEditor(); refreshPersonal();
  });
  (function(){
    const pad = $("edPad"); let dragging = false;
    const setFrom = (e)=>{
      const r = pad.getBoundingClientRect();
      const x = clamp((e.clientX - r.left)/r.width, .02, .98), y = clamp((e.clientY - r.top)/r.height, .02, .98);
      const pr = editProfile(); if(!pr) return; pr.x = x; pr.y = y; placeDot(x, y); saveMine(); refreshPersonal();
    };
    pad.addEventListener("pointerdown", (e)=>{ dragging = true; try{ pad.setPointerCapture(e.pointerId); }catch(_){} setFrom(e); });
    pad.addEventListener("pointermove", (e)=>{ if(dragging) setFrom(e); });
    const end = ()=>{ dragging = false; };
    pad.addEventListener("pointerup", end); pad.addEventListener("pointercancel", end);
  })();
  $("edDelete").addEventListener("click", ()=>{
    if(!edId) return;
    delete mine[edId]; delete shared[edId]; saveMine();
    emitters.forEach(e=>{ if(!e.demo) e.applyView(); });
    renderPills(); renderReadout(); renderScience(); fillEditor();
    toast("Personal view deleted — showing the consensus mapping for this scent.");
  });
  const b64url = (str)=> btoa(unescape(encodeURIComponent(str))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  const unb64url = (str)=>{ let t = str.replace(/-/g,"+").replace(/_/g,"/"); while(t.length % 4) t += "="; return decodeURIComponent(escape(atob(t))); };
  $("edShare").addEventListener("click", async ()=>{
    const sc = scentById(edId), pr = profileFor(edId); if(!sc || !pr) return;
    const payload = Object.assign({}, pr, { n: sc.name });
    const url = location.origin + location.pathname + "#p=" + b64url(JSON.stringify({ id: sc.id, p: payload }));
    if(navigator.share){ try{ await navigator.share({ title: `How I perceive ${sc.name} — OSMOS`, url }); return; }catch(e){ if(e && e.name === "AbortError") return; } }
    try{ await navigator.clipboard.writeText(url); toast("Share link copied — anyone who opens it sees your painting, labelled as personal."); }
    catch(e){ toast(`Copy this link:<br><span style="word-break:break-all;font-family:var(--mono);font-size:11px">${escHtml(url)}</span>`, { ms: 0, actions: [{ label: "Done", fn: ()=>{} }] }); }
  });
  function renderMineList(){
    const ids = Object.keys(mine);
    const el = $("mineList");
    if(!ids.length){ el.innerHTML = `<p style="opacity:.6">Nothing saved yet.</p>`; return; }
    el.innerHTML = ids.map(id=>{
      const sc = scentById(id), name = sc ? sc.name : (mine[id].n || id);
      return `<button type="button" class="ed-scent" data-id="${escHtml(id)}"><span class="swatch" style="background:${mine[id].c1}"></span><span>${escHtml(name)}</span><span class="c">${escHtml(mine[id].form)} · ${escHtml(mine[id].tex)}</span></button>`;
    }).join("");
    el.querySelectorAll(".ed-scent").forEach(b=> b.addEventListener("click", ()=>{
      const id = b.dataset.id; let sc = scentById(id);
      if(!sc){ sc = customFromName(mine[id].n || "Personal scent", id); }
      if(!activeScents.some(a=> a.id === id)) toggleScent(sc);
      if(activeScents.some(a=> a.id === id)) openEditor(id);
    }));
  }
  function customFromName(name, id){
    const r = descriptorReading(name) || { id: "custom-"+hashSeed(norm(name)), name, cat:"custom", emoji:"✦", col:"#a29eb4", I:.5, P:0, V:.5, d:{}, words:[], literal:"", mol:"", note:"", custom:true, hits:[] };
    if(id) r.id = id;
    CUSTOM[r.id] = r; return r;
  }
  $("vCons").addEventListener("click", ()=> setViewMode("consensus"));
  $("vMine").addEventListener("click", ()=>{
    if(!activeScents.some(a=> profileFor(a.id))) return openEditor();
    setViewMode("mine");
  });
  $("paintBtn").addEventListener("click", ()=>{ if(panels.mine.classList.contains("open")) closeAllPanels(); else openEditor(); });

  // shared links: #p=<base64url json>
  function readShare(){
    const m = location.hash.match(/^#p=([A-Za-z0-9_-]{4,6000})$/);
    if(!m) return;
    try{ history.replaceState(null, "", location.pathname + location.search); }catch(e){}
    let d; try{ d = JSON.parse(unb64url(m[1])); }catch(e){ return; }
    const prof = sanitizeProfile(d && d.p); if(!prof) return;
    const id = String(d.id || "").slice(0, 60);
    let sc = SCENT_BY_ID[id] || customFromName(prof.n || "Shared scent", /^custom-\d+$/.test(id) ? id : null);
    const note = prof.note ? `<br><span style="opacity:.8">“${escHtml(prof.note)}”</span>` : "";
    const view = (save)=>{
      if(save){ mine[sc.id] = prof; saveMine(); } else shared[sc.id] = prof;
      landing.classList.add("hidden"); document.body.classList.remove("landing"); stopDemo();
      settings.view = "mine"; store.set("view", "mine");
      if(!activeScents.some(a=> a.id === sc.id)){ if(activeScents.length >= MAX_ACTIVE) toggleScent(activeScents[0]); toggleScent(sc); }
      else setViewMode("mine");
    };
    setTimeout(()=> toast(`Someone shared how <em>they</em> perceive <b>${escHtml(sc.name)}</b> — a personal painting, not data.${note}`,
      { ms: 0, actions: [{ label: "View it", fn: ()=> view(false) }, { label: "Save to mine", fn: ()=> view(true) }, { label: "Not now", fn: ()=>{} }] }), 600);
  }
  let sugItems = [], sugSel = -1;
  function renderSuggest(){
    const q = searchInput.value;
    if(!q.trim()){ suggestEl.classList.remove("show"); sugItems = []; return; }
    const res = searchScents(q, 6);
    sugItems = res.map(r=> ({ type:"scent", s: r.s }));
    const reading = descriptorReading(q);
    if(!res.length || res[0].score < 60){ if(reading) sugItems.push({ type:"reading", s: reading }); }
    if(!sugItems.length){ suggestEl.innerHTML = `<div class="sg desc">Not in the library yet — press Enter for the closest matches.</div>`; suggestEl.classList.add("show"); return; }
    sugSel = Math.min(sugSel, sugItems.length-1);
    suggestEl.innerHTML = sugItems.map((it,i)=> it.type === "scent"
      ? `<button class="sg${i===sugSel?" sel":""}" data-i="${i}" role="option">${glyph(it.s, 20)}<span>${escHtml(it.s.name)}</span><span class="c">${escHtml(CAT_NAME[it.s.cat])}</span></button>`
      : `<button class="sg desc${i===sugSel?" sel":""}" data-i="${i}" role="option">${glyph(it.s, 20)}<span>Descriptor-only reading: <em>${escHtml(it.s.hits.join(", "))}</em></span></button>`).join("");
    suggestEl.classList.add("show");
    suggestEl.querySelectorAll(".sg[data-i]").forEach(b=> b.addEventListener("mousedown", (e)=>{ e.preventDefault(); pickSuggestion(+b.dataset.i); }));
  }
  function pickSuggestion(i){
    const it = sugItems[i]; if(!it) return;
    if(it.s.custom) CUSTOM[it.s.id] = it.s;
    if(!activeScents.some(a=> a.id === it.s.id)) toggleScent(it.s);
    searchInput.value = ""; suggestEl.classList.remove("show"); sugSel = -1;
  }
  function submitSearch(){
    const q = searchInput.value; if(!q.trim()) return;
    if(sugSel >= 0) return pickSuggestion(sugSel);
    const res = searchScents(q, 6);
    if(res.length && res[0].score >= 40){ sugItems = [{ type:"scent", s: res[0].s }]; return pickSuggestion(0); }
    const reading = descriptorReading(q);
    if(reading){ sugItems = [{ type:"reading", s: reading }]; return pickSuggestion(0); }
    const near = res.length ? res.map(r=> r.s).slice(0,3) : SCENTS.slice().sort(()=> Math.random()-.5).slice(0,3);
    toast(`<b>“${escHtml(q.trim())}”</b> isn't in the library, and OSMOS won't invent a reading for it. ${res.length ? "Closest matches:" : "Try one of these:"}`,
      { ms: 6000, actions: near.map(s=> ({ label: `${glyph(s,14)} ${escHtml(s.name)}`, fn: ()=> { if(!activeScents.some(a=> a.id === s.id)) toggleScent(s); } })) });
    searchInput.value = ""; suggestEl.classList.remove("show");
  }
  searchInput.addEventListener("input", ()=>{ sugSel = -1; renderSuggest(); });
  searchInput.addEventListener("focus", renderSuggest);
  searchInput.addEventListener("blur", ()=> setTimeout(()=> suggestEl.classList.remove("show"), 120));
  searchInput.addEventListener("keydown", (e)=>{
    if(e.key === "ArrowDown" && sugItems.length){ e.preventDefault(); sugSel = (sugSel+1) % sugItems.length; renderSuggest(); }
    else if(e.key === "ArrowUp" && sugItems.length){ e.preventDefault(); sugSel = (sugSel-1+sugItems.length) % sugItems.length; renderSuggest(); }
    else if(e.key === "Enter"){ e.preventDefault(); submitSearch(); }
    else if(e.key === "Escape"){ suggestEl.classList.remove("show"); searchInput.blur(); }
  });
  $("surpriseBtn").addEventListener("click", ()=>{
    if(activeScents.length >= MAX_ACTIVE){ toggleScent(activeScents[0]); }
    const pool = SCENTS.filter(s=> !activeScents.some(a=> a.id === s.id) && (sheetCat === "all" || s.cat === sheetCat));
    if(pool.length) toggleScent(pool[(Math.random()*pool.length)|0]);
  });

  // ----- library controls
  catTabs($("libCats"), libCat, (k)=>{ libCat = k; renderLibrary(); });
  $("libSearch").addEventListener("input", (e)=>{ libQuery = e.target.value; renderLibrary(); });
  $("libSort").addEventListener("change", (e)=>{ libSort = e.target.value; renderLibrary(); });
  $("mapAxes").addEventListener("change", (e)=>{ libAxes = e.target.value; renderLibrary(); });
  function setView(vw){
    libView = vw;
    $("viewGrid").classList.toggle("on", vw === "grid"); $("viewMap").classList.toggle("on", vw === "map");
    $("viewGrid").setAttribute("aria-selected", vw === "grid"); $("viewMap").setAttribute("aria-selected", vw === "map");
    $("libSort").hidden = vw === "map"; $("mapAxes").hidden = vw !== "map";
    renderLibrary();
  }
  $("viewGrid").addEventListener("click", ()=> setView("grid"));
  $("viewMap").addEventListener("click", ()=> setView("map"));
  $("libTitle").textContent = `${SCENTS.length} scents, mapped.`;
  $("statScents").textContent = SCENTS.length;

  // ----- sheet categories
  catTabs($("sheetCats"), sheetCat, (k)=>{ sheetCat = k; store.set("sheetCat", k); renderChips(); });

  // ----- settings switches
  const adaptSwitch = $("adaptSwitch"), soundSwitch = $("soundSwitch"), soundBtn = $("soundBtn");
  function reflectSettings(){
    adaptSwitch.setAttribute("aria-checked", settings.adapt);
    soundSwitch.setAttribute("aria-checked", settings.sound);
    soundBtn.classList.toggle("active", settings.sound); soundBtn.setAttribute("aria-pressed", settings.sound);
  }
  adaptSwitch.addEventListener("click", ()=>{ settings.adapt = !settings.adapt; store.set("adapt", settings.adapt); reflectSettings(); updateLive(); });
  async function toggleSound(){
    if(settings.sound){ settings.sound = false; sound.disable(); }
    else { const ok = await sound.enable(); settings.sound = !!ok; if(!ok) toast("Sound isn't supported in this browser."); else if(!activeScents.length) toast("Sound on — add a scent to hear it."); }
    reflectSettings(); sound.sync(emitters);
  }
  soundSwitch.addEventListener("click", toggleSound);
  soundBtn.addEventListener("click", toggleSound);
  reflectSettings();

  // ----- pointer: hold to sniff
  canvas.addEventListener("pointerdown", (e)=>{ pointer.down = true; pointer.used = true; pointer.x = e.clientX; pointer.y = e.clientY; try{ canvas.setPointerCapture(e.pointerId); }catch(_){} });
  canvas.addEventListener("pointermove", (e)=>{ pointer.x = e.clientX; pointer.y = e.clientY; });
  const up = ()=>{ pointer.down = false; };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up); canvas.addEventListener("lostpointercapture", up);

  // ----- keyboard
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape"){ closeAllPanels(); hideToast(); }
    if(e.key === "/" && document.activeElement !== searchInput && !/input|textarea|select/i.test(document.activeElement.tagName)){ e.preventDefault(); searchInput.focus(); }
  });

  /* ======================== OBJECT DETECTION ========================= */
  const camBtn = $("camBtn"), camFeed = $("camFeed"), detectOverlay = $("detectOverlay");
  const DETECT_CONFIDENCE = .55, MAX_BOXES = 4;
  let cocoModel = null, modelFailed = false, modelLoadPromise = null, detectTimer = null;
  function loadScript(src){
    return new Promise((res, rej)=>{ const el = document.createElement("script"); el.src = src; el.async = true; el.onload = ()=> res(); el.onerror = ()=> rej(new Error("failed "+src)); document.head.appendChild(el); });
  }
  function ensureModel(){
    if(cocoModel) return Promise.resolve(cocoModel);
    if(modelLoadPromise) return modelLoadPromise;
    toast("Loading object recognition…", { ms: 0 });
    modelLoadPromise = (async ()=>{
      try{
        if(typeof tf === "undefined") await loadScript("https://cdnjs.cloudflare.com/ajax/libs/tensorflow/4.22.0/tf.min.js");
        if(typeof cocoSsd === "undefined") await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3");
        cocoModel = await cocoSsd.load({ base: "lite_mobilenet_v2" });
        toast("Object recognition on. It sees objects, not smells — tap a box to load that object's <em>typical</em> scent.", { ms: 4200 });
        return cocoModel;
      }catch(err){
        modelFailed = true; modelLoadPromise = null;
        toast("Object recognition couldn't load here — the camera backdrop still works.", { ms: 5000 });
        throw err;
      }
    })();
    return modelLoadPromise;
  }
  function startDetection(){ stopDetection(); detectTimer = setInterval(runDetection, 700); }
  function stopDetection(){ if(detectTimer){ clearInterval(detectTimer); detectTimer = null; } detectOverlay.innerHTML = ""; }
  async function runDetection(){
    if(!cocoModel || !camOn || camFeed.readyState < 2) return;
    try{ renderBoxes(await cocoModel.detect(camFeed)); }catch(e){}
  }
  function renderBoxes(preds){
    const vw = camFeed.videoWidth, vh = camFeed.videoHeight; if(!vw || !vh) return;
    const scale = Math.max(W/vw, H/vh), ox = (vw*scale - W)/2, oy = (vh*scale - H)/2;
    const best = {};
    preds.forEach(p=>{ const sid = COCO_TO_SCENT[p.class]; if(!sid || p.score < DETECT_CONFIDENCE) return; if(!best[sid] || best[sid].score < p.score) best[sid] = p; });
    const top = Object.keys(best).map(sid=> ({ sid, p: best[sid] })).sort((a,b)=> b.p.score - a.p.score).slice(0, MAX_BOXES);
    const keep = new Set(top.map(t=> t.sid));
    Array.from(detectOverlay.children).forEach(el=>{ if(!keep.has(el.dataset.sid)) el.remove(); });
    top.forEach(({ sid, p })=>{
      const s = SCENT_BY_ID[sid]; if(!s) return;
      const [x,y,w,h] = p.bbox;
      let box = detectOverlay.querySelector(`[data-sid="${sid}"]`);
      if(!box){
        box = document.createElement("div"); box.className = "detect-box"; box.dataset.sid = sid;
        box.innerHTML = `<div class="tag"></div>`;
        box.addEventListener("click", ()=> toggleScent(s));
        detectOverlay.appendChild(box);
      }
      box.querySelector(".tag").innerHTML = `${escHtml(p.class)} <small>→ ${escHtml(s.name)}?</small>`;
      box.style.left = Math.max(0, x*scale - ox) + "px"; box.style.top = Math.max(0, y*scale - oy) + "px";
      box.style.width = w*scale + "px"; box.style.height = h*scale + "px";
      box.classList.toggle("active", activeScents.some(a=> a.id === sid));
    });
  }
  function syncBoxActiveStates(){ detectOverlay.querySelectorAll(".detect-box").forEach(el=> el.classList.toggle("active", activeScents.some(a=> a.id === el.dataset.sid))); }
  camBtn.addEventListener("click", async ()=>{
    if(camOn){
      const stream = camFeed.srcObject; if(stream) stream.getTracks().forEach(t=> t.stop());
      camFeed.srcObject = null; camFeed.classList.remove("on"); camOn = false;
      camBtn.classList.remove("active"); document.body.classList.remove("cam"); stopDetection(); hideToast();
      return;
    }
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      camFeed.srcObject = stream; camFeed.classList.add("on"); camOn = true;
      camBtn.classList.add("active"); document.body.classList.add("cam");
      if(!modelFailed) ensureModel().then(()=>{ if(camOn) startDetection(); }).catch(()=>{});
    }catch(err){ toast("Camera unavailable — staying in ambient view."); }
  });

  /* ========================= LANDING + DEMO ========================== */
  const landing = $("landing");
  const DEMO = ["petrichor","coffee","rose","eucalyptus","lemon","lavender","campfire","peach","pine","jasmine","boronia","ocean"];
  let demoTimer = null, demoIdx = (Math.random()*DEMO.length)|0;
  function demoStep(){
    emitters.forEach(e=>{ if(e.demo) e.active = false; });
    const s = SCENT_BY_ID[DEMO[demoIdx++ % DEMO.length]];
    if(s) emitters.push(new Emitter(s, { demo: true }));
  }
  function startDemo(){ if(demoTimer || activeScents.length) return; demoStep(); demoTimer = setInterval(demoStep, 7000); }
  function stopDemo(){ if(demoTimer){ clearInterval(demoTimer); demoTimer = null; } emitters.forEach(e=>{ if(e.demo) e.active = false; }); }
  $("enterBtn").addEventListener("click", ()=>{
    landing.classList.add("hidden"); document.body.classList.remove("landing");
    if(!activeScents.length){
      stopDemo();
      const pick = ["petrichor","coffee","rose","eucalyptus","lemon","lavender"];
      toggleScent(SCENT_BY_ID[pick[(Math.random()*pick.length)|0]]);
    }
  });
  $("brandBtn").addEventListener("click", ()=>{ closeAllPanels(); landing.classList.remove("hidden"); document.body.classList.add("landing"); startDemo(); });

  /* ============================== BOOT =============================== */
  renderChips(); renderPills(); renderReadout(); renderScience(); renderDescribe();
  document.body.classList.add("landing");
  startDemo();
  readShare();
  window.addEventListener("hashchange", readShare);

  window.OSMOS_UI = {
    offerReload(){ toast("OSMOS has been updated.", { ms: 0, actions: [{ label: "Reload", fn: ()=> location.reload() }] }); },
    // exposed for debugging / tests
    _debug: { get emitters(){ return emitters; }, get particles(){ return PART.n; }, renderer: ()=> renderer.kind, toggleScent: (id)=> toggleScent(SCENT_BY_ID[id]), derive: (id)=> derive(SCENT_BY_ID[id]), search: searchScents, openEditor, setViewMode, get mine(){ return mine; } }
  };
})();
