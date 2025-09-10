/* ========= CORE WORD POOLS ========= */
const GLOBAL = {
  adjectives: ["veiled","withered","glassy","lunar","spectral","ashen","hollow","brittle","damp","faded","pale","mercurial","echoing","salt-bitten","wirebound","fractured","static-laced","untuned","obsidian","ivory","rime-cold","sable","trembling"],
  nouns: ["sigil","lattice","archive","organ","lantern","crown","seal","spine","husk","choir","key","beacon","filament","reliquary","node","packet","bloom","cipher","reel","housing"],
  senses: ["low hum","faint brine","incense ghost","carrier hiss","cold to touch","salt bloom","wax smell","iron tang","paper-dry air","distant toll"],
  behaviors: ["tightens when unseen","detunes under gaze","weeps at dawn","stalls when named","vibrates on the hour","echoes faintly","drifts off-pattern","refuses warmth","quenches light","ticks irregularly"],
  greek: ["α","β","γ","δ","ε","ζ","η","θ","κ","λ"]
};
const PACKS = {
  flesh:{ adjectives:["ivory","sinewed","stitched","ashen","marrowy","veined","damp","pallid","grafted","scar-lined"], nouns:["suture","graft","cartilage","scalpel","tendon","specimen"], places:["operating dais","cold tray","specimen shelf","drain channel"], details:["linen wrap","bone dust","iodine stain","poultice mark"] },
  sea:{ adjectives:["brined","abyssal","kelp-bound","tidal","brackish","salt-grey"], nouns:["lantern","keel","echobox","barnacle","buoy","brine"], places:["slipway","ballast hold","wet deck","lighthouse vault"], details:["salt crystals","tar rope","driftwood","algae film"] },
  cathedral:{ adjectives:["hallowed","ossified","reliquary","ashen","hollow","liturgical"], nouns:["reliquary","nave","censer","hymn","ossuary","arch"], places:["crypt aisle","side chapel","clerestory","vestry drawer"], details:["incense ash","wax drip","vellum tag","bone dust"] },
  radio:{ adjectives:["spectral","carrier-bound","detuned","static-laced","phased"], nouns:["channel","packet","beacon","lattice","coil","node"], places:["relay bay","dead band","antenna well"], details:["carrier hiss","checksum smear","copper trace"] },
  factory:{ adjectives:["ferric","geared","riveted","soot-stained","foundry-warm"], nouns:["piston","manifold","gantry","press","valve","spar"], places:["catwalk","slag room","tool crib","gantry span"], details:["iron filing","welding bead","grease patina"] }
};
const STATUS = [
  {k:"archived",w:30},{k:"sealed",w:15},{k:"corrupted",w:15},
  {k:"forbidden",w:5},{k:"obsolete",w:10},{k:"redacted",w:10},{k:"",w:15}
];

/* ========= RNG ========= */
function xmur3(str){ let h=1779033703^str.length; for(let i=0;i<str.length;i++){ h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h<<13)|(h>>>19); } return function(){ h = Math.imul(h ^ (h>>>16),2246822507); h = Math.imul(h ^ (h>>>13),3266489909); return (h ^= h>>>16)>>>0; }; }
function sfc32(a,b,c,d){ return function(){ a|=0;b|=0;c|=0;d|=0; let t=(a+b|0)+d|0; d=d+1|0; a=b^b>>>9; b=c+(c<<3)|0; c=(c<<21|c>>>11); c=c+t|0; return (t>>>0)/4294967296; }; }
function rngFrom(seedStr){ const s=xmur3(seedStr); return sfc32(s(),s(),s(),s()); }
function choice(rng, arr){ return arr[(arr.length * rng()) | 0]; }
function weighted(rng, arr){ const sum=arr.reduce((s,a)=>s+a.w,0); let r=rng()*sum; for(const a of arr){ if((r-=a.w)<=0) return a.k; } return arr[arr.length-1].k; }
function pad(n,len=4){ return String(n).padStart(len,"0"); }
function cap(s){ return s ? s[0].toUpperCase()+s.slice(1) : s; }

/* ========= URL PARAMS ========= */
function getParams(){
  const u = new URL(location.href);
  return {
    seed: u.searchParams.get("seed") || "",
    pack: u.searchParams.get("pack") || "",
    id:   u.searchParams.get("id")   || (u.hash && u.hash.replace("#","")) || "",
    quiet: u.searchParams.get("quiet") || ""
  };
}
function setParams({seed, pack, id, quiet}){
  const u = new URL(location.href);
  if(seed!==undefined)  u.searchParams.set("seed", seed);
  if(pack!==undefined)  u.searchParams.set("pack", pack);
  if(id!==undefined)    u.searchParams.set("id", id);
  if(quiet!==undefined) u.searchParams.set("quiet", quiet ? "1" : "0");
  history.replaceState({}, "", u);
}

/* ========= DOM / STATE ========= */
function q(sel){
  const el = document.querySelector(sel);
  if (!el) { console.warn('Missing element:', sel); return document.createElement('div'); }
  return el;
}
const els = {
  card: q("#card"), cardId: q("#cardId"), badges: q("#badges"),
  title: q("#title"), note1: q("#note1"), note2: q("#note2"), meta: q("#meta"),
  stamp: q("#stamp"), scribble: q("#scribble"),
  inspect: q("#inspect"), inspCode: q("#inspCode"), inspPlace: q("#inspPlace"), inspExtra: q("#inspExtra"),
  prev: q("#prev"), next: q("#next"), copy: q("#copy"), share: q("#share"), permalink: q("#permalink"),
  toast: q("#toast"), hintbar: q("#hintbar"),
  menuBtn: q("#menuBtn"), menu: q("#menuPanel"), menuClose: q("#menuClose"), overlay: q("#overlay"),
  seedForm: q("#seedForm"), seedInput: q("#seedInput"), packInput: q("#packInput"), remix: q("#remix"), quietToggle: q("#quietToggle"),
  notesBtn: q("#notesBtn"), notes: q("#notesPanel"), notesClose: q("#notesClose"),
  entityKey: q("#entityKey"), entityCard: q("#entityCard"), entityKeyLabel: q("#entityKeyLabel"),
  entitySketch: q("#entitySketch"),
  attachEntity: q("#attachEntity"), noteTitle: q("#noteTitle"), noteBody: q("#noteBody"),
  saveNote: q("#saveNote"), clearEditor: q("#clearEditor"),
  notesList: q("#notesList"), entityList: q("#entityList"),
  // Illustration Post-it
  illusTab: q("#illusTab"), illusPanel: q("#illusPanel"), illusCanvas: q("#illusCanvas"), illusClose: q("#illusClose"),
};

let state = {
  seed: "", index: 1, packs: [], quiet:false,
  echoMap: new Map(),
  entitySketchMap: loadJSON("cosmic_entity_sketches", {}), // entityKey -> {kind:'concrete'|'abstract', motif:number}
  notesDB: loadJSON("cosmic_notes", {}), // entityKey -> [{id,title,body,ts,cardId}]
  ledgerMap: new Map(),
  lastEntity: null
};
function loadJSON(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)||"null") ?? fallback; }catch{ return fallback; } }
function saveJSON(key, obj){ try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{} }

/* ========= INIT ========= */
function init(){
  const p = getParams();
  state.seed = p.seed || randomSeed();
  state.packs = parsePacks(p.pack);
  state.index = parseIdToIndex(p.id) || 1;
  state.quiet = p.quiet === "1";

  els.seedInput.value = state.seed;
  els.packInput.value = state.packs.join(",");
  els.quietToggle.checked = state.quiet;

  bindMenu(); bindControls(); bindNotes(); bindFocusLens(); bindIllustrationPostit();
  render();
}

/* ========= GENERATION ========= */
function parsePacks(param){
  const all = Object.keys(PACKS);
  if(!param) return all;
  const wanted = param.split(",").map(s=>s.trim()).filter(Boolean);
  const ok = wanted.filter(w=>Object.keys(PACKS).includes(w));
  return ok.length ? ok : all;
}
function parseIdToIndex(id){ if(!id) return 0; const m = id.match(/^[A-Z]-0*([0-9]+)$/); return m ? (+m[1]) : 0; }
function idFor(type, index, rng){
  const map = {artifact:"A", record:"R", error:"E", broadcast:"B"};
  let prefix = map[type] || "X";
  if(rng()<0.12){ prefix = choice(rng, ["A","B","E","R"]); } // ghost
  return `${prefix}-${pad(index,4)}`;
}
function choiceType(rng){
  const t=rng(); if(t<.55) return "artifact"; if(t<.75) return "record"; if(t<.90) return "error"; return "broadcast";
}
function codeFor(type,rng){
  if(type==="artifact") return `SHELF-${choice(rng, GLOBAL.greek)}/${pad((rng()*99)|0,2)}`;
  if(type==="record")   return `R-${pad((rng()*999)|0,3)}`;
  if(type==="error")    return `SYS-ERR-${((rng()*0xFFF)|0).toString(16).toUpperCase()}`;
  return `CH-${(rng()*9+1).toFixed(2)}kHz`;
}
function pickAdj(rng, pack){ return rng()<.7 ? choice(rng, PACKS[pack].adjectives) : choice(rng, GLOBAL.adjectives); }
function pickNoun(rng, pack){ return rng()<.7 ? choice(rng, PACKS[pack].nouns) : choice(rng, GLOBAL.nouns); }

function buildTitleAndEntity(rng, type, pack, status){
  const adj = pickAdj(rng, pack);
  const n1 = pickNoun(rng, pack);       // <- entity noun
  const n2 = pickNoun(rng, pack);
  const series = choice(rng, GLOBAL.greek);
  const num = pad(1 + ((rng()*999)|0), 3);
  const badge = status ? ` {${status}}` : "";

  let title;
  if(type==="artifact"){
    title = (rng()<0.5) ? `${cap(adj)} ${cap(n1)} [#${num}]${badge}` : `${cap(n1)} of ${cap(n2)} (Series ${series})${badge}`;
  } else if(type==="record"){
    const sector = `${String.fromCharCode(65 + ((rng()*8)|0))}${(rng()*9|0)}`;
    const coord  = `${String.fromCharCode(65 + ((rng()*8)|0))}-${(rng()*99|0)}`;
    title = (rng()<0.5) ? `Field Note ${pad((rng()*9999)|0)}:${pad((rng()*59)|0,2)} — ${choice(rng,["weak ping","hymn residual","checksum smear"])}` : `Transit Log ${sector}-${coord} — ${choice(rng,["signal repeats","barnacles present","coolant smear"])}`;
  } else if(type==="error"){
    const hex = ((rng()*0xFFF)|0).toString(16).toUpperCase();
    const label = `${cap(choice(rng, PACKS[pack].nouns.concat(GLOBAL.nouns)))} ${rng()<0.5? "FILE":"INDEX"}`;
    title = (rng()<0.5) ? `ERR/${hex} — FILE ${label} : corrupted` : `ACCESS DENIED — ${label} LOCK`;
  } else {
    title = `Channel ${(rng()*10+3).toFixed(2)} kHz — “${choice(rng,["stay","count to nine","nothing echoes back","do not unseal"])}”`;
  }
  return { title, entityNoun: n1 };
}
function buildNotes(rng, pack, status){
  const sense = choice(rng, GLOBAL.senses);
  let behavior;
  if(status==="sealed") behavior = choice(rng, ["dormant within","muffled under wrap","stable under seal"]);
  else if(status==="corrupted") behavior = choice(rng, ["checksum smear","carrier drift","glitch when named","████ in log"]);
  else if(status==="forbidden") behavior = choice(rng, ["do not unseal","no direct gaze > 30 s","entry denied"]);
  else behavior = choice(rng, GLOBAL.behaviors);

  const place = choice(rng, PACKS[pack].places);
  const det = choice(rng, PACKS[pack].details);
  const note1 = `${sense}; ${behavior}.`;
  const note2 = rng()<0.5 ? `${det}; near ${place}.` : `stored at ${place}.`;
  return [note1, note2, place];
}
function generateItem(baseSeed, index, enabledPacks){
  const rng = rngFrom(`${baseSeed}|${index}`);
  const type = choiceType(rng);
  const mainPack = choice(rng, enabledPacks);
  const status = weighted(rng, STATUS);
  const { title, entityNoun } = buildTitleAndEntity(rng, type, mainPack, status);
  const [note1, note2, place] = buildNotes(rng, mainPack, status);
  const id = idFor(type, index, rng);
  const code = codeFor(type, rng);
  const stamp = pickStamp(status, mainPack, rng);
  const scribble = pickScribble(rng);
  const entityKey = `${mainPack}:${(entityNoun||"").toLowerCase()}`;
  return { id, type, mainPack, status, title, notes:[note1,note2], place, code, stamp, scribble, entityKey };
}
function pickStamp(status, pack, rng){ const sym=(pack==="radio")?"◎ VOID":(pack==="cathedral"?"△ SECT":"☐ INDEX"); return rng()<.3? sym:""; }
function pickScribble(rng){ const s=["?","→","!","note","ok","Δ","×","…"]; return rng()<.3? s[(rng()*s.length)|0] : ""; }

/* ========= TYPO / ECHO ========= */
function typeNoise(str, rng){
  let out=(str||""), times=(rng()*3)|0;
  for(let t=0;t<times;t++){
    if(out.length<3) break;
    const i=1+((rng()*(out.length-2))|0);
    const c=out[i];
    if(!c||/[\[\]#{}():0-9]/.test(c)) continue;
    if(rng()<.5){ out=out.slice(0,i)+c+out.slice(i);}
    else { const j=Math.min(out.length-1,i+1); out=out.slice(0,i-1)+out[j]+c+out.slice(j+1);}
  }
  if(rng()<.08){ out=out.replace(/([A-Za-z])/,(m)=>m+"\u02D9"); }
  return out;
}
function tokenizeTitle(title){ return (title||"").toLowerCase().replace(/[\[\]{}().,:—"']/g," ").split(/\s+/).filter(Boolean); }
function updateEchoCounts(tokens){
  for(const t of tokens){
    if(["of","the","a","series","err","file","lock","channel","note","log","field","access","denied","ping","sonar"].includes(t)) continue;
    state.echoMap.set(t,(state.echoMap.get(t)||0)+1);
  }
}
function setRichLine(el, text){
  const words = (text||"").split(/(\s+)/);
  el.innerHTML = words.map(w=> /\s+/.test(w) ? w : `<span>${escapeHtml(w)}</span>` ).join("");
}
function safeSet(el, str){
  const s = (typeof str==="string") ? str : "";
  if (!/\S/.test(s)) { el.textContent = "—"; return; }
  try { setRichLine(el, s); } catch { el.textContent = s; }
}
function escapeHtml(s){ return String(s).replace(/[&<>]/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;" }[c])); }

/* ========= ILLUSTRATIONS ========= */
const CONCRETE = {
  cathedral: [
`  .----.
 [      ]
 | [__] |
 '------'`,
`   __
  /  \\
  |  |
  |__|
   ||`],
  flesh: [
`  /‾‾‾\\
  |   |
  \\___/
    ||`,
` |-|--|-|--`],
  sea: [
`   \\_/
  --|--
    |
   / \\`,
`  .-.
 (   )
  '-' 
   |`],
  radio: [
`   |
  -|-
   |
  / \\
 ~~~~~`,
`  @@@@`],
  factory: [
`  (O-O)
 (  O  )
  (O-O)`,
`  [==]
   ||`]
};
const ABSTRACT = {
  cathedral: [
`  +---+
   \\ /
    X
   / \\
  +---+`,
`   @
  @@@
 @@@@@`],
  flesh: [
`  ( • )
 ( • • )
  ( • )`,
` o-o-o-o`],
  sea: [
`  ))   ))
 ))   ))`,
`  ~~~
 < ~ >
  ~~~`],
  radio: [
` ~~~|~~~|~~~`,
`  o---o
   \\ /
    o`],
  factory: [
`  <> <>
 <>   <>
  <> <>`,
` |=|=|`]
};
/* wobble helper */
function seededWobble(entityKey, strength = 1){
  const r = rngFrom(`wobble|${entityKey}`)();
  const rot = (r * 6 - 3) * strength; // -3..+3°
  const dx  = ((r*997)%1) * 6 - 3;    // -3..+3px
  const dy  = ((r*577)%1) * 6 - 3;
  return { rot, dx, dy };
}

function getOrAssignEntitySketch(entityKey){
  if(state.entitySketchMap[entityKey]) return state.entitySketchMap[entityKey];
  const [pack] = entityKey.split(":");
  const kind = Math.random()<0.7 ? "concrete":"abstract";
  const poolBase = (kind==="concrete" ? CONCRETE : ABSTRACT);
  const pool = poolBase[pack] || poolBase["factory"];
  const motif = Math.floor(Math.random()*pool.length);
  const assigned = { kind, motif };
  state.entitySketchMap[entityKey] = assigned;
  saveJSON("cosmic_entity_sketches", state.entitySketchMap);
  return assigned;
}
function renderSketchSVG(entityKey, container, small=false){
  const map = getOrAssignEntitySketch(entityKey);
  if(!map){ container.innerHTML=""; return; }
  const { kind, motif } = map;
  const [pack] = entityKey.split(":");
  const poolBase = (kind==="concrete" ? CONCRETE : ABSTRACT);
  const pool = poolBase[pack] || poolBase["factory"];
  const ascii = pool[motif] || "";
  const lines = String(ascii).split("\n");
  const cols = Math.max(1, ...lines.map(l=>l.length));
  const cell = small ? 6 : 8;
  const w = Math.max(1, cols) * cell;
  const h = Math.max(1, lines.length) * cell;

  const svg = `
<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" role="img" aria-label="sketch ${escapeHtml(entityKey)}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="grain">
      <feTurbulence baseFrequency="0.9" numOctaves="1" />
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0 .06 .1 .06 0" />
      </feComponentTransfer>
    </filter>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="none" />
  ${lines.map((row,y)=> row.split("").map((ch,x)=>{
      if(ch===" "){ return ""; }
      return `<rect x="${x*cell+cell*0.25}" y="${y*cell+cell*0.25}" width="${cell*0.5}" height="${cell*0.5}" rx="${cell*0.12}" ry="${cell*0.12}" fill="currentColor" opacity="0.9" />`;
    }).join("")).join("\n")}
  <rect x="0" y="0" width="${w}" height="${h}" fill="transparent" filter="url(#grain)" opacity=".2"/>
</svg>`;
  container.innerHTML = svg;
}
function renderPostit(entityKey){
  els.illusCanvas.innerHTML = "";
  if (!entityKey) return;
  renderSketchSVG(entityKey, els.illusCanvas, false);
  const { rot, dx, dy } = seededWobble(entityKey, 1);
  els.illusCanvas.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
  els.illusCanvas.style.opacity = ".98";
}

/* ========= RENDER ========= */
function render(){
  try {
    const item = generateItem(state.seed, state.index, state.packs);
    if (!item || !item.title) throw new Error("Item generation returned empty title.");

    // badges
    els.badges.innerHTML = "";
    if(!state.quiet && item.status){
      const b=document.createElement("span"); b.className=`badge ${item.status}`; b.textContent=item.status; els.badges.appendChild(b);
    }

    const rng = rngFrom(`${state.seed}|${state.index}|typo`);
    const baseTokens = tokenizeTitle(item.title);
    updateEchoCounts(baseTokens);

    safeSet(els.title,  typeNoise(item.title, rng));
    safeSet(els.note1,  typeNoise(item.notes?.[0] || "", rng));
    safeSet(els.note2,  typeNoise(item.notes?.[1] || "", rng));

    els.cardId.textContent = item.id || "A-0001";
    els.meta.textContent = `${item.type} • ${item.mainPack} • ${item.code}`;
    els.stamp.textContent = item.stamp || "";
    els.stamp.classList.toggle("hidden", !item.stamp);
    els.scribble.textContent = item.scribble || "";
    els.scribble.classList.toggle("hidden", !item.scribble);

    els.inspCode.textContent = item.code || "—";
    els.inspPlace.textContent = item.place || "—";
    els.inspExtra.textContent = "—";

    // Illustration: 7% Chance → Tab sichtbar, Post-it on-demand
    const showIllus = Math.random() < 0.07;
    if (showIllus) {
      els.illusTab.hidden = false;
      els.illusPanel.hidden = true;
      els.illusTab.setAttribute("aria-expanded","false");
    } else {
      els.illusTab.hidden = true;
      els.illusPanel.hidden = true;
    }

    // Notes-Sidebar aktualisieren
    state.lastEntity = { key: item.entityKey, id:item.id, title:item.title };
    els.entityKey.textContent = item.entityKey || "—";
    els.entityCard.textContent = `${item.id || "—"} — ${item.title || "—"}`;
    els.entityKeyLabel.textContent = item.entityKey || "—";
    renderSketchSVG(item.entityKey, els.entitySketch, false);
    refreshNotesLists();

    // Widerspruch-Hinweis
    const core = item.entityKey;
    const lastStatus = state.ledgerMap.get(core);
    if(lastStatus && lastStatus==="sealed" && (String(item.notes?.[0]) + String(item.notes?.[1])).toLowerCase().includes("weep")){
      showHintOnce("ledger dispute");
    }
    state.ledgerMap.set(core, item.status);

    // Transition + URL sync
    els.card.classList.remove("fade"); void els.card.offsetWidth; els.card.classList.add("fade");
    setParams({seed: state.seed, pack: state.packs.join(","), id: item.id, quiet: state.quiet});
  } catch (err) {
    console.error("Render failed:", err);
    els.title.textContent = "(render fallback)";
    els.note1.textContent = "generator paused due to error.";
    els.note2.textContent = "open console (F12) → errors.";
    els.meta.textContent  = "—";
  }
}

/* ========= NOTES ========= */
function bindNotes(){
  function openNotes(){ els.notes.classList.add("open"); els.notesBtn.setAttribute("aria-expanded","true"); }
  function closeNotes(){ els.notes.classList.remove("open"); els.notesBtn.setAttribute("aria-expanded","false"); }
  els.notesBtn.addEventListener("click", ()=> els.notes.classList.contains("open") ? closeNotes() : openNotes());
  els.notesClose.addEventListener("click", closeNotes);

  els.attachEntity.addEventListener("click", ()=>{
    if(!state.lastEntity) return;
    els.noteTitle.value = `Ref ${state.lastEntity.id}`;
    els.noteBody.value = `@${state.lastEntity.key}\n${state.lastEntity.title}`;
    openNotes();
    els.noteBody.focus();
  });

  els.saveNote.addEventListener("click", ()=>{
    const key = state.lastEntity?.key; if(!key) return;
    const title = els.noteTitle.value.trim();
    const body  = els.noteBody.value.trim();
    if(!title && !body) return;
    const note = { id: `n${Date.now()}`, title, body, ts: Date.now(), cardId: state.lastEntity.id };
    if(!state.notesDB[key]) state.notesDB[key] = [];
    state.notesDB[key].push(note);
    saveJSON("cosmic_notes", state.notesDB);
    els.noteTitle.value=""; els.noteBody.value="";
    refreshNotesLists();
  });

  els.clearEditor.addEventListener("click", ()=>{ els.noteTitle.value=""; els.noteBody.value=""; });

  els.notesList.addEventListener("click", (e)=>{
    const a = e.target.closest("a[data-kind]"); if(!a) return;
    e.preventDefault();
    const kind = a.dataset.kind, val=a.dataset.val;
    if(kind==="entity"){ jumpToEntity(val); }
  });
  els.entityList.addEventListener("click", (e)=>{
    const a = e.target.closest("a[data-entity]"); if(!a) return;
    e.preventDefault(); jumpToEntity(a.dataset.entity);
  });
}
function parseLinks(text){
  return escapeHtml(text)
    .replace(/@([a-z]+:[a-z0-9_-]+)/gi, (m,p1)=> `<a href="#" data-kind="entity" data-val="${p1}">@${p1}</a>`)
    .replace(/#([a-z0-9_-]+)/gi, (m,p1)=> `<a href="#" data-kind="tag" data-val="${p1}">#${p1}</a>`);
}
function refreshNotesLists(){
  const key = state.lastEntity?.key;
  const list = (key && state.notesDB[key]) ? state.notesDB[key] : [];
  els.notesList.innerHTML = list.slice().reverse().map(n=>`
    <li>
      ${n.title ? `<strong>${escapeHtml(n.title)}</strong><br>`:""}
      <div class="note-body">${parseLinks(n.body)}</div>
      <small>${new Date(n.ts).toLocaleString()} — ${escapeHtml(n.cardId)}</small>
    </li>
  `).join("") || `<li><em>Keine Notizen.</em></li>`;

  const allKeys = Object.keys(state.notesDB).sort();
  els.entityList.innerHTML = allKeys.map(k=>{
    const cnt = state.notesDB[k]?.length||0;
    return `<li><a href="#" data-entity="${k}">${k}</a> <small>(${cnt})</small></li>`;
  }).join("") || `<li><em>No entries yet.</em></li>`;
}
function jumpToEntity(entityKey){
  els.entityKey.textContent = entityKey;
  els.entityKeyLabel.textContent = entityKey;
  renderSketchSVG(entityKey, els.entitySketch, false);
}

/* ========= UI BINDINGS ========= */
function bindMenu(){
  const { menuBtn, menu, menuClose, overlay, seedForm, seedInput, packInput, remix, quietToggle } = els;
  if (!menuBtn || !menu || !menuClose || !overlay) { console.warn('Menu UI missing, skip bindMenu'); return; }
  function openMenu(){ menu.classList.add("open"); overlay.hidden=false; menuBtn.setAttribute("aria-expanded","true"); menu.setAttribute("aria-hidden","false"); }
  function closeMenu(){ menu.classList.remove("open"); overlay.hidden=true; menuBtn.setAttribute("aria-expanded","false"); menu.setAttribute("aria-hidden","true"); }
  menuBtn.addEventListener("click", ()=> menu.classList.contains("open") ? closeMenu() : openMenu());
  menuClose.addEventListener("click", closeMenu);
  overlay.addEventListener("click", closeMenu);

  if (!seedForm) { console.warn('seedForm missing, skip seed handlers'); return; }
  seedForm.addEventListener("submit", (e)=>{
    e.preventDefault();
    const seed = (seedInput && seedInput.value.trim()) || randomSeed();
    const packs = parsePacks((packInput && packInput.value.trim()) || "");
    state.seed = seed; state.packs = packs; state.index = 1;
    state.echoMap = new Map();
    render(); closeMenu();
  });
  if (remix) {
    remix.addEventListener("click", ()=>{
      state.seed = randomSeed(); if (seedInput) seedInput.value = state.seed;
      state.index=1; state.echoMap = new Map(); render();
    });
  }
  if (quietToggle) {
    quietToggle.addEventListener("change", ()=>{ state.quiet = !!quietToggle.checked; render(); });
  }
}
function bindControls(){
  els.next.addEventListener("click", next);
  els.prev.addEventListener("click", prev);
  document.addEventListener("keydown", (e)=>{
    if(e.key==="ArrowRight"){ next(); }
    if(e.key==="ArrowLeft"){ prev(); }
    if(e.key===" "){ e.preventDefault(); next(); }
    if(e.key.toLowerCase()==="i"){ showInspect(true); }
  });
  document.addEventListener("keyup", (e)=>{ if(e.key.toLowerCase()==="i"){ showInspect(false); } });

  // Hold to Inspect
  let t=null;
  const startHold = ()=>{ clearTimeout(t); t=setTimeout(()=> showInspect(true), 600); };
  const endHold   = ()=>{ clearTimeout(t); showInspect(false); };
  els.card.addEventListener("mousedown", startHold);
  els.card.addEventListener("mouseup", endHold);
  els.card.addEventListener("mouseleave", endHold);
  els.card.addEventListener("touchstart", ()=> startHold());
  els.card.addEventListener("touchend", ()=> endHold());

  els.copy.addEventListener("click", doCopy);
  els.share.addEventListener("click", doShare);
  els.permalink.addEventListener("click", ()=> doCopyLink());
}
function bindIllustrationPostit(){
  // Tab klick: öffnen/schließen
  els.illusTab.addEventListener("click", ()=>{
    const open = els.illusPanel.hidden;
    if (open) renderPostit(state.lastEntity?.key || "");
    els.illusPanel.hidden = !open;
    els.illusTab.setAttribute("aria-expanded", String(open));
  });
  // Close-Button
  els.illusClose.addEventListener("click", ()=>{
    els.illusPanel.hidden = true;
    els.illusTab.setAttribute("aria-expanded","false");
  });
  // ESC schließt
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && !els.illusPanel.hidden){
      els.illusPanel.hidden = true;
      els.illusTab.setAttribute("aria-expanded","false");
    }
  });
  // Klick auf Sidebar-Skizze => Post-it öffnen
  els.entitySketch.addEventListener("click", ()=>{
    renderPostit(state.lastEntity?.key || "");
    els.illusPanel.hidden = false;
    els.illusTab.hidden = false;
    els.illusTab.setAttribute("aria-expanded","true");
  });
}

/* ========= CLIPBOARD / TOAST ========= */
function next(){ state.index++; render(); }
function prev(){ state.index=Math.max(1,state.index-1); render(); }
function showInspect(on){ els.inspect.hidden=!on; }

function doCopy(){
  const t = [
    document.title,
    els.cardId.textContent,
    stripText(els.title.textContent),
    stripText(els.note1.textContent),
    stripText(els.note2.textContent),
    els.meta.textContent,
    location.href
  ].join("\n");
  navigator.clipboard.writeText(t).then(()=> showToast("Copied")).catch(()=> showToast("Copy failed"));
}
function doCopyLink(){ navigator.clipboard.writeText(location.href).then(()=> showToast("Link copied")).catch(()=> showToast("Copy failed")); }
async function doShare(){ const url=location.href, title=stripText(els.title.textContent); if(navigator.share){ try{ await navigator.share({title,url}); }catch(e){} } else { doCopyLink(); } }
function stripText(s){ return String(s).replace(/\s+/g," ").trim(); }
function showToast(msg){ els.toast.textContent=msg; els.toast.hidden=false; clearTimeout(els.toast._t); els.toast._t=setTimeout(()=> els.toast.hidden=true, 1100); }

/* ========= FOCUS LENS ========= */
function bindFocusLens(){
  [els.title, els.note1, els.note2].forEach(container=>{
    container.addEventListener("mousemove", (e)=>{
      container.classList.add("dim");
      const span = e.target.closest("span");
      container.querySelectorAll("span").forEach(s=> s.classList.remove("focus"));
      if(span) span.classList.add("focus");
    });
    container.addEventListener("mouseleave", ()=>{
      container.classList.remove("dim");
      container.querySelectorAll("span").forEach(s=> s.classList.remove("focus"));
    });
  });
}

/* ========= HELPERS ========= */
function randomSeed(){ return `s${Math.random().toString(36).slice(2)}`; }

/* ========= HINT BAR ========= */
let hintLock=false;
function showHintOnce(msg){
  if(hintLock) return;
  hintLock = true;
  els.hintbar.textContent = msg;
  els.hintbar.hidden = false;
  setTimeout(()=>{ els.hintbar.hidden = true; hintLock=false; }, 1600);
}

/* ========= GLOBAL ERROR GUARD ========= */
window.addEventListener('error', (e)=>{ try { showToast('JS error: ' + e.message); } catch{} console.error(e.error||e); });
window.addEventListener('unhandledrejection', (e)=>{ try { showToast('Promise error'); } catch{} console.error(e.reason||e); });

/* ========= BOOT ========= */
(function boot(){
  const start = ()=>{
    try { init(); }
    catch (err) {
      console.error('init() failed:', err);
      const t = document.querySelector('#title'); if (t) t.textContent = '(init failed)';
      const n1 = document.querySelector('#note1'); if (n1) n1.textContent = 'open console (F12) for errors';
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
