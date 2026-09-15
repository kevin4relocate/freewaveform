(()=>{
'use strict';

const pipeline=window.__FW_RENDER_PIPELINE;
const canvas=document.getElementById('canvas');
const host=document.getElementById('fxHost');
if(!pipeline||!canvas||!host)return;

const mainCtx=canvas.getContext('2d');
const perfCanvas=document.createElement('canvas');
const perfCtx=perfCanvas.getContext('2d',{alpha:true});
const U=window.__FW_UTILS||{};
const clamp=U.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const toast=window.__FW_TOAST||(()=>{});
const MAX_FX=5;
const PERFORMANCE_SCALE=.5;
const PERFORMANCE_FRAME_MS=1000/30;

const TYPES={
  snow:{name:'Snow',icon:'❄',amount:54,speed:45,size:44,opacity:52,intensity:125,color:'#fffdf7',reaction:'ambient',strength:30,blend:'screen'},
  dust:{name:'Dust',icon:'✦',amount:42,speed:24,size:34,opacity:38,intensity:120,color:'#f1d39a',reaction:'ambient',strength:22,blend:'screen'},
  firefly:{name:'Firefly',icon:'●',amount:38,speed:28,size:42,opacity:62,intensity:135,color:'#ffe36f',reaction:'ambient',strength:44,blend:'screen'},
  petals:{name:'Petals',icon:'❀',amount:38,speed:44,size:54,opacity:58,intensity:125,color:'#f5a8bd',reaction:'ambient',strength:26,blend:'source-over'},
  mist:{name:'Mist',icon:'≋',amount:34,speed:16,size:122,opacity:30,intensity:135,color:'#d7e2e7',reaction:'ambient',strength:22,blend:'screen'},
  smoke:{name:'Smoke',icon:'≈',amount:30,speed:18,size:104,opacity:30,intensity:145,color:'#d9dde0',reaction:'ambient',strength:28,blend:'source-over'},
  sparkle:{name:'Sparkle',icon:'✧',amount:45,speed:20,size:40,opacity:58,intensity:140,color:'#fff4d2',reaction:'beat',strength:46,blend:'screen'},
  lightleak:{name:'Light Leak',icon:'◒',amount:36,speed:18,size:132,opacity:34,intensity:145,color:'#ff9a68',reaction:'ambient',strength:32,blend:'screen'},
  bokeh:{name:'Bokeh',icon:'○',amount:42,speed:18,size:86,opacity:34,intensity:130,color:'#ffd7a5',reaction:'ambient',strength:28,blend:'screen'},
  frame:{name:'Magic Frame',icon:'▣',amount:36,speed:26,size:58,opacity:48,intensity:145,color:'#8fe7ff',reaction:'beat',strength:48,blend:'screen'},
  stars:{name:'Stars',icon:'★',amount:48,speed:12,size:30,opacity:48,intensity:135,color:'#fff6da',reaction:'ambient',strength:34,blend:'screen',legacy:true},
  rays:{name:'Light Rays',icon:'☀',amount:34,speed:16,size:112,opacity:34,intensity:145,color:'#f5d69b',reaction:'beat',strength:42,blend:'screen',legacy:true},
  club:{name:'Club Bars',icon:'▥',amount:40,speed:80,size:76,opacity:42,intensity:140,color:'#d45cff',reaction:'beat',strength:76,blend:'lighter',legacy:true}
};
const TYPE_KEYS=Object.keys(TYPES);
const TEMPLATE_GROUPS=[
  {name:'Atmosphere',keys:['snow','dust','firefly','petals','mist','smoke']},
  {name:'Light',keys:['sparkle','lightleak','bokeh','frame']}
];
let layers=[];
let activeIndex=-1;
let root=null;
let previewQuality='performance';
let drawCtx=mainCtx;
let drawCanvas=canvas;
let drawQuality='full';
let perfDirty=true;
let perfLastRender=0;

try{if(localStorage.getItem('fwFxPreviewQuality')==='full')previewQuality='full'}catch{}

const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const id=()=>`fx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const frac=v=>v-Math.floor(v);
const rnd=(seed,n=0)=>frac(Math.sin((seed+1)*12.9898+(n+1)*78.233)*43758.5453123);
function safeType(type){return TYPES[type]?type:'dust'}
function makeLayer(type='dust',source=null){
  type=safeType(type);
  const d=TYPES[type];
  return{
    id:id(),type,name:d.name,enabled:true,seed:Math.floor(Math.random()*1000000),
    amount:d.amount,speed:d.speed,size:d.size,opacity:d.opacity,intensity:d.intensity,color:d.color,
    reaction:d.reaction,strength:d.strength,blend:d.blend,
    ...(source||{}),id:id(),type,name:d.name,seed:Math.floor(Math.random()*1000000)
  };
}
function active(){return activeIndex>=0?layers[activeIndex]:null}
function qualityCountScale(){return drawQuality==='performance'?.46:1}
function countFor(l){
  const q=clamp(l.amount,0,100)/100;
  let n;
  if(l.type==='smoke'||l.type==='mist')n=3+q*13;
  else if(l.type==='lightleak')n=1+q*5;
  else if(l.type==='frame')n=3+q*12;
  else if(l.type==='rays')n=2+q*8;
  else if(l.type==='club')n=4+q*20;
  else if(l.type==='bokeh')n=6+q*40;
  else n=8+q*92;
  return Math.max(1,Math.round(n*qualityCountScale()));
}
function px(v){return v*(drawCanvas.width/(canvas.width||1))}
function blurScale(){return drawQuality==='performance'?.38:1}
function presence(l){return clamp((Number.isFinite(+l.intensity)?+l.intensity:120)/100,.35,2)}
function alphaFor(l,mult=1){return clamp((l.opacity/100)*presence(l)*mult,0,1)}
function hexRgb(hex){
  const s=/^#[0-9a-f]{6}$/i.test(String(hex||''))?hex:'#ffffff';
  const n=parseInt(s.slice(1),16);return[n>>16,n>>8&255,n&255];
}
function rgba(hex,a){const c=hexRgb(hex);return`rgba(${c[0]},${c[1]},${c[2]},${clamp(a,0,1)})`}
function pulse(l,r){
  const strength=clamp(l.strength,0,100)/100;
  if(l.reaction==='off')return 0;
  if(l.reaction==='beat')return clamp((r.beat||0)*strength,0,1.4);
  return clamp(((r.bass||0)*.52+(r.mid||0)*.23+(r.beat||0)*.18)*strength,0,1);
}
function isExporting(){
  try{if(new URLSearchParams(location.search).get('hq-render')==='1')return true}catch{}
  if(window.__FW_APP?.isExporting?.())return true;
  const b=document.getElementById('exportBtn'),text=String(b?.textContent||'').toLowerCase();
  return !!b?.disabled&&(text.includes('export')||text.includes('render'));
}
function effectiveQuality(){return isExporting()?'full':previewQuality}
function setPreviewQuality(value,silent=false){
  previewQuality=value==='full'?'full':'performance';
  try{localStorage.setItem('fwFxPreviewQuality',previewQuality)}catch{}
  perfDirty=true;syncQualityUI();
  if(!silent)toast(previewQuality==='performance'?'FX preview set to Performance':'FX preview set to Full quality');
}
function syncQualityUI(){
  if(!root)return;
  const select=root.querySelector('.fx-quality');if(select)select.value=previewQuality;
  const badge=root.querySelector('.fx-quality-badge');if(badge)badge.textContent=previewQuality==='performance'?'PERFORMANCE':'FULL';
}
function templateMarkup(){
  return TEMPLATE_GROUPS.map(group=>`<div class="fx-template-section"><div class="fx-template-section-title">${group.name}</div><div class="fx-template-grid">${group.keys.map(k=>`<button class="fx-template" type="button" data-fx-template="${k}"><b>${TYPES[k].icon}</b><span>${TYPES[k].name}</span></button>`).join('')}</div></div>`).join('');
}
function styleMount(){
  if(document.getElementById('fw-fx-style'))return;
  const s=document.createElement('style');s.id='fw-fx-style';s.textContent=`
.fx-card{margin-bottom:10px}.fx-quality-row{display:grid;grid-template-columns:1fr;gap:4px;margin:0 0 9px}.fx-quality-row label{margin:0!important}.fx-quality-note{margin:0!important}.fx-template-section+.fx-template-section{margin-top:10px}.fx-template-section-title{margin:0 0 6px;color:#b78a50;font-size:8px;font-weight:700;letter-spacing:.11em;text-transform:uppercase}.fx-template-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.fx-template{min-height:48px;border:1px solid #293034;border-radius:9px;background:#0c1113;color:#cec5b8;display:flex;align-items:center;gap:6px;padding:6px 7px;cursor:pointer;text-align:left}.fx-template:hover{border-color:#946a3b;background:#18130e}.fx-template b{width:20px;text-align:center;color:#e1b367;font-size:15px}.fx-template span{font-size:8px;line-height:1.15}.fx-actions{display:flex;gap:6px;margin-bottom:8px}.fx-actions .button{width:auto!important}.fx-list{display:grid;gap:6px}.fx-item{display:grid;grid-template-columns:minmax(0,1fr) 32px 32px;gap:5px}.fx-select{height:42px;border:1px solid #293034;border-radius:9px;background:#0c1113;color:#d8d0c4;display:flex;align-items:center;gap:8px;padding:0 9px;cursor:pointer;text-align:left;min-width:0}.fx-item.active .fx-select{border-color:#956a39;background:#18130e}.fx-icon{width:22px;height:22px;border:1px solid #564126;border-radius:7px;background:#1b1710;color:#dda95d;display:grid;place-items:center;flex:none;font-size:10px}.fx-copy{min-width:0;display:flex;flex-direction:column;gap:2px}.fx-copy b{font-size:9px}.fx-copy small{font-size:8px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fx-eye,.fx-delete{height:42px;border:1px solid #293034;border-radius:9px;background:#0c1113;color:#777;cursor:pointer}.fx-eye.on{color:#e0ae61}.fx-delete:hover{color:#f1b8a7;border-color:#71443a}.fx-settings[hidden]{display:none!important}.fx-empty{padding:10px;border:1px dashed #2c3236;border-radius:9px;color:#777;font-size:9px;text-align:center}.fx-color-row{display:grid;grid-template-columns:46px minmax(0,1fr);gap:7px;align-items:center;margin-top:8px}.fx-color-row input[type=color]{width:46px;height:32px;padding:3px;border:1px solid #30363a;border-radius:8px;background:#0b0f11}.fx-color-row small{color:#817b73;font-size:8px;line-height:1.35}.fx-intensity-label{margin-top:10px!important;padding-top:8px;border-top:1px solid #242a2e}.fx-intensity-label span{color:#e2b76e!important}.fx-note{margin-top:7px!important}@media(max-width:820px){.tool-rail{grid-template-columns:repeat(6,1fr)!important}.fx-template-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
  document.head.appendChild(s);
}
function mount(){
  styleMount();
  root=document.createElement('div');root.innerHTML=`
    <div class="card fx-card">
      <div class="card-title"><div><strong>FX Templates</strong><small>Atmosphere + light effects for music backgrounds</small></div><span class="badge fx-quality-badge">PERFORMANCE</span></div>
      <div class="fx-quality-row">
        <label>Preview quality<select class="fx-quality"><option value="performance">Performance</option><option value="full">Full</option></select></label>
        <p class="hint fx-quality-note">Performance keeps editing light. WebM and HQ MP4 export use Full quality.</p>
      </div>
      ${templateMarkup()}
    </div>
    <div class="card fx-card">
      <div class="card-title"><div><strong>FX Layers</strong><small>Stack up to ${MAX_FX} effects</small></div><span class="badge fx-count">0 / ${MAX_FX}</span></div>
      <div class="fx-actions"><button class="button accent fx-add" type="button">+ Add FX</button><button class="button fx-duplicate" type="button">Duplicate</button></div>
      <div class="fx-list"></div>
      <p class="hint">Effects render over the background and stay behind waveform + Free Text.</p>
    </div>
    <div class="card fx-settings" hidden>
      <div class="card-title"><div><strong>Selected FX</strong><small class="fx-selected-name">—</small></div></div>
      <label>Type<select class="fx-type">${TYPE_KEYS.map(k=>`<option value="${k}">${TYPES[k].name}${TYPES[k].legacy?' · Legacy':''}</option>`).join('')}</select></label>
      <label class="fx-intensity-label">Intensity <span class="fx-intensity-v">120%</span><input class="range fx-intensity" type="range" min="40" max="200" value="120"></label>
      <div class="control-grid two">
        <label>Amount <span class="fx-amount-v">0%</span><input class="range fx-amount" type="range" min="0" max="100" value="40"></label>
        <label>Speed <span class="fx-speed-v">0%</span><input class="range fx-speed" type="range" min="0" max="200" value="50"></label>
        <label>Size <span class="fx-size-v">0%</span><input class="range fx-size" type="range" min="10" max="200" value="50"></label>
        <label>Opacity <span class="fx-opacity-v">0%</span><input class="range fx-opacity" type="range" min="0" max="100" value="30"></label>
      </div>
      <div class="fx-color-row"><input class="fx-color" type="color" value="#ffffff"><small>Color changes the FX tint. Intensity controls separation from the background.</small></div>
      <label>Audio reaction<select class="fx-reaction"><option value="off">Off</option><option value="ambient">Ambient</option><option value="beat">Beat Sync</option></select></label>
      <label>Reaction strength <span class="fx-strength-v">0%</span><input class="range fx-strength" type="range" min="0" max="100" value="25"></label>
      <p class="hint fx-note">Start with 1–3 layers. Firefly + Mist or Sparkle + Light Leak work well for music videos.</p>
    </div>`;
  host.appendChild(root);

  root.addEventListener('click',e=>{
    const template=e.target.closest('[data-fx-template]');if(template)return addLayer(template.dataset.fxTemplate);
    if(e.target.closest('.fx-add'))return addLayer('dust');
    if(e.target.closest('.fx-duplicate'))return duplicateActive();
    const item=e.target.closest('.fx-item');if(!item)return;
    const i=+item.dataset.i;
    if(e.target.closest('.fx-delete'))return deleteLayer(i);
    if(e.target.closest('.fx-eye')){layers[i].enabled=!layers[i].enabled;renderList();emit();return}
    if(e.target.closest('.fx-select'))selectLayer(i);
  });
  root.querySelector('.fx-quality').addEventListener('change',e=>setPreviewQuality(e.target.value));
  const bindRange=(cls,key)=>root.querySelector(cls).addEventListener('input',e=>{const l=active();if(!l)return;l[key]=+e.target.value;syncSettings();emit()});
  bindRange('.fx-intensity','intensity');bindRange('.fx-amount','amount');bindRange('.fx-speed','speed');bindRange('.fx-size','size');bindRange('.fx-opacity','opacity');bindRange('.fx-strength','strength');
  root.querySelector('.fx-color').addEventListener('input',e=>{const l=active();if(!l)return;l.color=e.target.value;emit()});
  root.querySelector('.fx-reaction').addEventListener('change',e=>{const l=active();if(!l)return;l.reaction=e.target.value;syncSettings();emit()});
  root.querySelector('.fx-type').addEventListener('change',e=>changeType(e.target.value));
  renderList();syncSettings();syncQualityUI();
}
function emit(){perfDirty=true;document.dispatchEvent(new CustomEvent('fw:fx-change',{detail:{layers:getLayers(),activeIndex,previewQuality}}))}
function addLayer(type){
  type=safeType(type);
  if(layers.length>=MAX_FX){toast(`Maximum ${MAX_FX} FX layers`);return false}
  layers.push(makeLayer(type));activeIndex=layers.length-1;renderList();syncSettings();emit();toast(`${TYPES[type].name} FX added`);return true;
}
function duplicateActive(){
  const l=active();if(!l)return addLayer('dust');
  if(layers.length>=MAX_FX){toast(`Maximum ${MAX_FX} FX layers`);return false}
  layers.push(makeLayer(l.type,{...l}));activeIndex=layers.length-1;renderList();syncSettings();emit();toast('FX duplicated');return true;
}
function deleteLayer(i){
  if(i<0||i>=layers.length)return;
  layers.splice(i,1);if(!layers.length)activeIndex=-1;else activeIndex=clamp(activeIndex>i?activeIndex-1:activeIndex,0,layers.length-1);renderList();syncSettings();emit();
}
function selectLayer(i){activeIndex=clamp(i,0,layers.length-1);renderList();syncSettings()}
function changeType(type){
  const l=active();if(!l)return;type=safeType(type);const d=TYPES[type];
  Object.assign(l,{type,name:d.name,amount:d.amount,speed:d.speed,size:d.size,opacity:d.opacity,intensity:d.intensity,color:d.color,reaction:d.reaction,strength:d.strength,blend:d.blend});
  renderList();syncSettings();emit();
}
function renderList(){
  if(!root)return;
  root.querySelector('.fx-count').textContent=`${layers.length} / ${MAX_FX}`;
  root.querySelector('.fx-add').disabled=layers.length>=MAX_FX;
  root.querySelector('.fx-duplicate').disabled=layers.length>=MAX_FX||!layers.length;
  root.querySelector('.fx-list').innerHTML=layers.length?layers.map((l,i)=>`<div class="fx-item ${i===activeIndex?'active':''}" data-i="${i}"><button class="fx-select" type="button"><span class="fx-icon">${TYPES[l.type].icon}</span><span class="fx-copy"><b>${esc(TYPES[l.type].name)}</b><small>${Math.round(l.intensity||100)}% intensity · ${l.reaction==='beat'?'Beat Sync':l.reaction==='ambient'?'Ambient':'Static'}</small></span></button><button class="fx-eye ${l.enabled?'on':''}" type="button" title="Show / hide">${l.enabled?'●':'○'}</button><button class="fx-delete" type="button" title="Delete">×</button></div>`).join(''):'<div class="fx-empty">No FX yet. Choose a template or press + Add FX.</div>';
}
function syncSettings(){
  if(!root)return;const l=active(),card=root.querySelector('.fx-settings');card.hidden=!l;if(!l)return;
  root.querySelector('.fx-selected-name').textContent=TYPES[l.type].name;
  root.querySelector('.fx-type').value=l.type;root.querySelector('.fx-color').value=l.color;root.querySelector('.fx-reaction').value=l.reaction;
  for(const [cls,key] of [['.fx-intensity','intensity'],['.fx-amount','amount'],['.fx-speed','speed'],['.fx-size','size'],['.fx-opacity','opacity'],['.fx-strength','strength']]){root.querySelector(cls).value=l[key];root.querySelector(cls+'-v').textContent=Math.round(l[key])+'%'}
}

function setBlend(l){drawCtx.globalCompositeOperation=l.blend||'screen'}
function drawSnow(l,r,t){
  const n=countFor(l),p=pulse(l,r),speed=(18+l.speed*.9),size=px((1.7+l.size*.078)*(1+p*.2)),alpha=alphaFor(l)*(1+p*.42);
  drawCtx.shadowColor=rgba(l.color,alpha*.9);drawCtx.shadowBlur=size*2.3*blurScale();
  for(let i=0;i<n;i++){
    const y=frac(rnd(l.seed,i*5+1)+t*speed/(drawCanvas.height||1)*(.55+rnd(l.seed,i*5+2)*.9))*drawCanvas.height;
    const x=frac(rnd(l.seed,i*5+3)+Math.sin(t*.35+i)*.015*(l.speed/100)+rnd(l.seed,i)*.01)*drawCanvas.width;
    const s=size*(.45+rnd(l.seed,i*5+4)*1.25);
    drawCtx.fillStyle=rgba(l.color,alpha*(.72+rnd(l.seed,i*5+5)*.28));drawCtx.beginPath();drawCtx.arc(x,y,s,0,Math.PI*2);drawCtx.fill();
    if(i%4===0){drawCtx.fillStyle=rgba('#ffffff',alpha*.68);drawCtx.beginPath();drawCtx.arc(x,y,Math.max(px(.6),s*.33),0,Math.PI*2);drawCtx.fill()}
  }
}
function drawDust(l,r,t){
  const n=countFor(l),p=pulse(l,r),speed=(4+l.speed*.18),size=px((.8+l.size*.05)*(1+p*.22)),alpha=alphaFor(l)*(1+p*.5);
  drawCtx.shadowColor=rgba(l.color,alpha);drawCtx.shadowBlur=size*3.5*blurScale();
  for(let i=0;i<n;i++){
    const y=frac(rnd(l.seed,i*7+1)-t*speed/(drawCanvas.height||1)*(.35+rnd(l.seed,i*7+2)))*drawCanvas.height;
    const x=frac(rnd(l.seed,i*7+3)+Math.sin(t*(.15+rnd(l.seed,i)*.2)+i)*.025)*drawCanvas.width;
    const s=size*(.35+rnd(l.seed,i*7+4)*1.5);drawCtx.fillStyle=rgba(l.color,alpha*(.48+rnd(l.seed,i*7+5)*.52));drawCtx.beginPath();drawCtx.arc(x,y,s,0,Math.PI*2);drawCtx.fill();
  }
}
function drawFirefly(l,r,t){
  const n=countFor(l),p=pulse(l,r),alpha=alphaFor(l)*(1+p*.75),base=px(1.2+l.size*.052),speed=.10+l.speed*.004;
  for(let i=0;i<n;i++){
    const phase=t*speed*(.35+rnd(l.seed,i*8+1))+rnd(l.seed,i*8+2)*Math.PI*2;
    const x=frac(rnd(l.seed,i*8+3)+Math.sin(phase+i)*(.018+.025*rnd(l.seed,i*8+4)))*drawCanvas.width;
    const y=frac(rnd(l.seed,i*8+5)+Math.cos(phase*.73+i*.7)*(.014+.022*rnd(l.seed,i*8+6)))*drawCanvas.height;
    const tw=.35+.65*Math.pow(.5+.5*Math.sin(phase*2.4+rnd(l.seed,i*8+7)*6),2);
    const s=base*(.55+rnd(l.seed,i*8+8)*1.45)*(1+p*.15),a=alpha*tw;
    const radius=s*(3.5+rnd(l.seed,i)*3);
    const g=drawCtx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,rgba('#fffbd5',a));g.addColorStop(.18,rgba(l.color,a*.9));g.addColorStop(.55,rgba(l.color,a*.24));g.addColorStop(1,rgba(l.color,0));drawCtx.fillStyle=g;drawCtx.fillRect(x-radius,y-radius,radius*2,radius*2);
    drawCtx.fillStyle=rgba('#fffef0',a*.95);drawCtx.beginPath();drawCtx.arc(x,y,Math.max(px(.7),s*.42),0,Math.PI*2);drawCtx.fill();
  }
}
function drawPetals(l,r,t){
  const n=countFor(l),p=pulse(l,r),alpha=alphaFor(l)*(1+p*.3),speed=10+l.speed*.55,base=px(4+l.size*.11)*(1+p*.08);
  for(let i=0;i<n;i++){
    const fall=frac(rnd(l.seed,i*9+1)+t*speed/(drawCanvas.height||1)*(.55+rnd(l.seed,i*9+2)*.8));
    const y=fall*drawCanvas.height;
    const sway=Math.sin(t*(.28+rnd(l.seed,i*9+3)*.45)+i)*drawCanvas.width*(.012+.025*rnd(l.seed,i*9+4));
    const x=frac(rnd(l.seed,i*9+5)+sway/(drawCanvas.width||1))*drawCanvas.width;
    const s=base*(.55+rnd(l.seed,i*9+6)*1.15),angle=t*(.35+l.speed*.006)*(rnd(l.seed,i*9+7)>.5?1:-1)+rnd(l.seed,i*9+8)*Math.PI*2;
    drawCtx.save();drawCtx.translate(x,y);drawCtx.rotate(angle);drawCtx.scale(1,.58+.28*rnd(l.seed,i*9+9));
    drawCtx.fillStyle=rgba(l.color,alpha*(.52+.45*rnd(l.seed,i)));
    drawCtx.beginPath();drawCtx.moveTo(-s,0);drawCtx.bezierCurveTo(-s*.25,-s*.72,s*.55,-s*.52,s,0);drawCtx.bezierCurveTo(s*.35,s*.55,-s*.42,s*.65,-s,0);drawCtx.closePath();drawCtx.fill();
    drawCtx.strokeStyle=rgba('#ffffff',alpha*.18);drawCtx.lineWidth=Math.max(px(.5),s*.06);drawCtx.beginPath();drawCtx.moveTo(-s*.65,0);drawCtx.lineTo(s*.65,0);drawCtx.stroke();drawCtx.restore();
  }
}
function drawSmoke(l,r,t){
  const n=countFor(l),p=pulse(l,r),alpha=alphaFor(l)*(1+p*.32),speed=(.006+l.speed*.0007),size=(.11+l.size*.0022)*(1+p*.14);
  for(let i=0;i<n;i++){
    const x=frac(rnd(l.seed,i*6+1)+t*speed*(.25+rnd(l.seed,i*6+2)))*drawCanvas.width;
    const y=(.10+rnd(l.seed,i*6+3)*.80)*drawCanvas.height+Math.sin(t*.12+i)*drawCanvas.height*.025;
    const radius=Math.min(drawCanvas.width,drawCanvas.height)*size*(.55+rnd(l.seed,i*6+4)*.8);
    const g=drawCtx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,rgba(l.color,alpha*.48));g.addColorStop(.32,rgba(l.color,alpha*.31));g.addColorStop(.68,rgba(l.color,alpha*.12));g.addColorStop(1,rgba(l.color,0));drawCtx.fillStyle=g;drawCtx.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
}
function drawMist(l,r,t){
  const n=countFor(l),p=pulse(l,r),alpha=alphaFor(l)*(1+p*.28),speed=.003+l.speed*.00045,base=Math.min(drawCanvas.width,drawCanvas.height)*(.16+l.size*.0018);
  for(let i=0;i<n;i++){
    const x=frac(rnd(l.seed,i*7+1)+t*speed*(.3+rnd(l.seed,i*7+2)))*drawCanvas.width;
    const y=(.18+rnd(l.seed,i*7+3)*.68)*drawCanvas.height+Math.sin(t*.09+i)*drawCanvas.height*.018;
    const radius=base*(.55+rnd(l.seed,i*7+4)*.8),stretch=1.8+rnd(l.seed,i*7+5)*2.8;
    drawCtx.save();drawCtx.translate(x,y);drawCtx.scale(stretch,.52+.22*rnd(l.seed,i*7+6));
    const g=drawCtx.createRadialGradient(0,0,0,0,0,radius);g.addColorStop(0,rgba(l.color,alpha*.22));g.addColorStop(.42,rgba(l.color,alpha*.14));g.addColorStop(.76,rgba(l.color,alpha*.06));g.addColorStop(1,rgba(l.color,0));drawCtx.fillStyle=g;drawCtx.fillRect(-radius,-radius,radius*2,radius*2);drawCtx.restore();
  }
}
function drawSparkle(l,r,t){
  const n=countFor(l),p=pulse(l,r),base=px(1.2+l.size*.055),alpha=alphaFor(l);
  for(let i=0;i<n;i++){
    const x=rnd(l.seed,i*6+1)*drawCanvas.width,y=rnd(l.seed,i*6+2)*drawCanvas.height;
    const phase=t*(.45+l.speed*.02)*(.45+rnd(l.seed,i*6+3))+rnd(l.seed,i)*18;
    const tw=Math.pow(.5+.5*Math.sin(phase),3),a=alpha*(.18+.82*tw)*(1+p*.95),s=base*(.5+rnd(l.seed,i*6+4)*1.5)*(1+p*.16);
    drawCtx.save();drawCtx.translate(x,y);drawCtx.rotate((rnd(l.seed,i*6+5)-.5)*.45);
    drawCtx.strokeStyle=rgba(l.color,a);drawCtx.shadowColor=rgba(l.color,a);drawCtx.shadowBlur=s*4.2*blurScale();drawCtx.lineWidth=Math.max(px(.7),s*.18);
    const arm=s*(2.2+rnd(l.seed,i*6+6)*2.8);drawCtx.beginPath();drawCtx.moveTo(-arm,0);drawCtx.lineTo(arm,0);drawCtx.moveTo(0,-arm);drawCtx.lineTo(0,arm);drawCtx.stroke();
    if(i%3===0){drawCtx.rotate(Math.PI/4);drawCtx.globalAlpha=.6;drawCtx.beginPath();drawCtx.moveTo(-arm*.55,0);drawCtx.lineTo(arm*.55,0);drawCtx.moveTo(0,-arm*.55);drawCtx.lineTo(0,arm*.55);drawCtx.stroke()}
    drawCtx.globalAlpha=1;drawCtx.fillStyle=rgba('#ffffff',a*.9);drawCtx.beginPath();drawCtx.arc(0,0,Math.max(px(.6),s*.36),0,Math.PI*2);drawCtx.fill();drawCtx.restore();
  }
}
function drawLightLeak(l,r,t){
  const n=countFor(l),p=pulse(l,r),alpha=alphaFor(l)*(1+p*.55),speed=.025+l.speed*.0008,base=Math.min(drawCanvas.width,drawCanvas.height)*(.18+l.size*.0024);
  for(let i=0;i<n;i++){
    const edge=Math.floor(rnd(l.seed,i*7+1)*4),phase=t*speed*(.5+rnd(l.seed,i*7+2))+rnd(l.seed,i*7+3)*Math.PI*2,jitter=Math.sin(phase)*.14;
    let x,y;
    if(edge===0){x=(.1+rnd(l.seed,i*7+4)*.8+jitter)*drawCanvas.width;y=-drawCanvas.height*.04}
    else if(edge===1){x=drawCanvas.width*1.04;y=(.1+rnd(l.seed,i*7+4)*.8+jitter)*drawCanvas.height}
    else if(edge===2){x=(.1+rnd(l.seed,i*7+4)*.8+jitter)*drawCanvas.width;y=drawCanvas.height*1.04}
    else{x=-drawCanvas.width*.04;y=(.1+rnd(l.seed,i*7+4)*.8+jitter)*drawCanvas.height}
    const radius=base*(.7+rnd(l.seed,i*7+5)*1.3),a=alpha*(.4+rnd(l.seed,i*7+6)*.55);
    const g=drawCtx.createRadialGradient(x,y,radius*.05,x,y,radius);g.addColorStop(0,rgba('#fff0cf',a*.65));g.addColorStop(.24,rgba(l.color,a*.62));g.addColorStop(.58,rgba(l.color,a*.22));g.addColorStop(1,rgba(l.color,0));drawCtx.fillStyle=g;drawCtx.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
}
function drawBokeh(l,r,t){
  const n=countFor(l),p=pulse(l,r),alpha=alphaFor(l)*(1+p*.38),speed=.01+l.speed*.0008,base=px(8+l.size*.26)*(1+p*.08);
  for(let i=0;i<n;i++){
    const phase=t*speed*(.4+rnd(l.seed,i*7+1));
    const x=frac(rnd(l.seed,i*7+2)+phase*.18+Math.sin(phase*2+i)*.018)*drawCanvas.width;
    const y=frac(rnd(l.seed,i*7+3)-phase*.12+Math.cos(phase*1.4+i)*.012)*drawCanvas.height;
    const radius=base*(.45+rnd(l.seed,i*7+4)*1.5),tw=.65+.35*Math.sin(t*(.25+rnd(l.seed,i*7+5)*.45)+i),a=alpha*(.22+.42*rnd(l.seed,i*7+6))*tw;
    const g=drawCtx.createRadialGradient(x-radius*.15,y-radius*.18,0,x,y,radius);g.addColorStop(0,rgba('#ffffff',a*.36));g.addColorStop(.28,rgba(l.color,a*.32));g.addColorStop(.72,rgba(l.color,a*.12));g.addColorStop(1,rgba(l.color,0));drawCtx.fillStyle=g;drawCtx.beginPath();drawCtx.arc(x,y,radius,0,Math.PI*2);drawCtx.fill();
    drawCtx.strokeStyle=rgba(l.color,a*.22);drawCtx.lineWidth=Math.max(px(.6),radius*.035);drawCtx.beginPath();drawCtx.arc(x,y,radius*.78,0,Math.PI*2);drawCtx.stroke();
  }
}
function perimeterPoint(q,w,h,inset){
  const ww=w-inset*2,hh=h-inset*2,per=2*(ww+hh),d=frac(q)*per;
  if(d<ww)return{x:inset+d,y:inset};
  if(d<ww+hh)return{x:w-inset,y:inset+d-ww};
  if(d<ww*2+hh)return{x:w-inset-(d-ww-hh),y:h-inset};
  return{x:inset,y:h-inset-(d-ww*2-hh)};
}
function drawFrame(l,r,t){
  const p=pulse(l,r),alpha=alphaFor(l)*(1+p*.65),edge=px(1.4+l.size*.065)*(1+p*.1),inset=px(10+l.size*.12),glow=edge*(3.5+presence(l));
  drawCtx.save();drawCtx.strokeStyle=rgba(l.color,alpha*.78);drawCtx.lineWidth=edge;drawCtx.shadowColor=rgba(l.color,alpha);drawCtx.shadowBlur=glow*blurScale();drawCtx.strokeRect(inset,inset,drawCanvas.width-inset*2,drawCanvas.height-inset*2);
  const corner=Math.min(drawCanvas.width,drawCanvas.height)*(.08+l.size*.00055);
  drawCtx.strokeStyle=rgba('#ffffff',alpha*.44);drawCtx.lineWidth=Math.max(px(.7),edge*.35);drawCtx.shadowBlur=glow*.45*blurScale();
  for(const [x,y,sx,sy] of [[inset,inset,1,1],[drawCanvas.width-inset,inset,-1,1],[inset,drawCanvas.height-inset,1,-1],[drawCanvas.width-inset,drawCanvas.height-inset,-1,-1]]){
    drawCtx.beginPath();drawCtx.moveTo(x,y+sy*corner);drawCtx.lineTo(x,y);drawCtx.lineTo(x+sx*corner,y);drawCtx.stroke();
  }
  const n=countFor(l),speed=.018+l.speed*.00055;
  for(let i=0;i<n;i++){
    const q=rnd(l.seed,i*4+1)+t*speed*(.55+rnd(l.seed,i*4+2)),pt=perimeterPoint(q,drawCanvas.width,drawCanvas.height,inset),s=edge*(.8+rnd(l.seed,i*4+3)*1.5),a=alpha*(.3+.7*Math.abs(Math.sin(t*(.5+rnd(l.seed,i*4+4))+i)));
    drawCtx.fillStyle=rgba('#ffffff',a);drawCtx.shadowColor=rgba(l.color,a);drawCtx.shadowBlur=s*4.5*blurScale();drawCtx.beginPath();drawCtx.arc(pt.x,pt.y,s,0,Math.PI*2);drawCtx.fill();
  }
  drawCtx.restore();
}
function drawStars(l,r,t){drawSparkle(l,r,t)}
function drawRays(l,r,t){
  const n=countFor(l),p=pulse(l,r),alpha=alphaFor(l)*(1+p*.9),speed=.02+l.speed*.0008,span=.035+l.size*.0012;
  const ox=drawCanvas.width*.5,oy=-drawCanvas.height*.08;
  for(let i=0;i<n;i++){
    const phase=rnd(l.seed,i*4+1)*Math.PI*2+t*speed*(.4+rnd(l.seed,i*4+2));
    const center=(-.75+rnd(l.seed,i*4+3)*1.5)+Math.sin(phase)*.16;
    const half=span*(.45+rnd(l.seed,i*4+4)*.9),x1=ox+Math.tan(center-half)*drawCanvas.height*1.25,x2=ox+Math.tan(center+half)*drawCanvas.height*1.25;
    const g=drawCtx.createLinearGradient(ox,oy,(x1+x2)/2,drawCanvas.height);g.addColorStop(0,rgba(l.color,alpha*.9));g.addColorStop(.40,rgba(l.color,alpha*.38));g.addColorStop(.78,rgba(l.color,alpha*.12));g.addColorStop(1,rgba(l.color,0));drawCtx.fillStyle=g;drawCtx.beginPath();drawCtx.moveTo(ox,oy);drawCtx.lineTo(x1,drawCanvas.height);drawCtx.lineTo(x2,drawCanvas.height);drawCtx.closePath();drawCtx.fill();
  }
}
function drawClub(l,r,t){
  const n=countFor(l),p=pulse(l,r),alpha=alphaFor(l)*(1+p*1.2),speed=.15+l.speed*.006,width=px((4.5+l.size*.24)*(1+p*.25));
  drawCtx.lineCap='round';
  for(let i=0;i<n;i++){
    const q=i/Math.max(1,n-1),vertical=i%2===0,phase=t*speed+rnd(l.seed,i*4+1)*Math.PI*2,shift=Math.sin(phase)*(vertical?drawCanvas.width:drawCanvas.height)*.13;
    let x1,y1,x2,y2;
    if(vertical){const x=q*drawCanvas.width+shift;x1=x;y1=-drawCanvas.height*.1;x2=x+Math.sin(phase*.7)*drawCanvas.width*.08;y2=drawCanvas.height*1.1}
    else{const y=q*drawCanvas.height+shift;x1=-drawCanvas.width*.1;y1=y;x2=drawCanvas.width*1.1;y2=y+Math.sin(phase*.7)*drawCanvas.height*.08}
    const a=alpha*(.38+rnd(l.seed,i*4+2)*.62),w=width*(.45+rnd(l.seed,i*4+3)*1.1);
    drawCtx.strokeStyle=rgba(l.color,a*.42);drawCtx.shadowColor=rgba(l.color,a);drawCtx.shadowBlur=w*2.5*blurScale();drawCtx.lineWidth=w*1.8;drawCtx.beginPath();drawCtx.moveTo(x1,y1);drawCtx.lineTo(x2,y2);drawCtx.stroke();
    drawCtx.strokeStyle=rgba(l.color,a);drawCtx.shadowBlur=w*1.25*blurScale();drawCtx.lineWidth=Math.max(px(1),w*.55);drawCtx.beginPath();drawCtx.moveTo(x1,y1);drawCtx.lineTo(x2,y2);drawCtx.stroke();
  }
}
function drawLayer(l,frame){
  if(!l.enabled||l.opacity<=0||l.amount<=0)return;
  const r=frame.energy||{bass:0,mid:0,treble:0,beat:0,time:performance.now()/1000},t=Number.isFinite(+frame.time)?+frame.time:(r.time||performance.now()/1000);
  drawCtx.save();setBlend(l);drawCtx.globalAlpha=1;
  if(l.type==='snow')drawSnow(l,r,t);
  else if(l.type==='dust')drawDust(l,r,t);
  else if(l.type==='firefly')drawFirefly(l,r,t);
  else if(l.type==='petals')drawPetals(l,r,t);
  else if(l.type==='mist')drawMist(l,r,t);
  else if(l.type==='smoke')drawSmoke(l,r,t);
  else if(l.type==='sparkle')drawSparkle(l,r,t);
  else if(l.type==='lightleak')drawLightLeak(l,r,t);
  else if(l.type==='bokeh')drawBokeh(l,r,t);
  else if(l.type==='frame')drawFrame(l,r,t);
  else if(l.type==='stars')drawStars(l,r,t);
  else if(l.type==='rays')drawRays(l,r,t);
  else if(l.type==='club')drawClub(l,r,t);
  drawCtx.restore();
}
function drawAllLayers(frame){for(const l of layers)drawLayer(l,frame)}
function ensurePerfCanvas(){
  const w=Math.max(1,Math.round(canvas.width*PERFORMANCE_SCALE)),h=Math.max(1,Math.round(canvas.height*PERFORMANCE_SCALE));
  if(perfCanvas.width!==w||perfCanvas.height!==h){perfCanvas.width=w;perfCanvas.height=h;perfDirty=true}
}
function drawFX(frame){
  if(!layers.some(l=>l.enabled&&l.opacity>0&&l.amount>0))return;
  const quality=effectiveQuality();
  if(quality==='full'){
    drawCtx=mainCtx;drawCanvas=canvas;drawQuality='full';drawAllLayers(frame);return;
  }
  ensurePerfCanvas();
  const now=performance.now();
  if(perfDirty||now-perfLastRender>=PERFORMANCE_FRAME_MS){
    perfCtx.setTransform(1,0,0,1,0,0);perfCtx.globalCompositeOperation='source-over';perfCtx.clearRect(0,0,perfCanvas.width,perfCanvas.height);
    drawCtx=perfCtx;drawCanvas=perfCanvas;drawQuality='performance';drawAllLayers(frame);
    perfLastRender=now;perfDirty=false;
  }
  drawCtx=mainCtx;drawCanvas=canvas;drawQuality='full';
  mainCtx.save();mainCtx.globalCompositeOperation='source-over';mainCtx.globalAlpha=1;mainCtx.imageSmoothingEnabled=true;mainCtx.drawImage(perfCanvas,0,0,canvas.width,canvas.height);mainCtx.restore();
}
pipeline.register('ambient','fx-engine-v1',drawFX,0);

function sanitize(raw){
  const type=safeType(raw?.type),d=TYPES[type],num=(v,f,a,b)=>clamp(Number.isFinite(+v)?+v:f,a,b);
  return{id:String(raw?.id||id()),type,name:d.name,enabled:raw?.enabled!==false,seed:Number.isFinite(+raw?.seed)?+raw.seed:Math.floor(Math.random()*1000000),amount:num(raw?.amount,d.amount,0,100),speed:num(raw?.speed,d.speed,0,200),size:num(raw?.size,d.size,10,200),opacity:num(raw?.opacity,d.opacity,0,100),intensity:num(raw?.intensity,d.intensity,40,200),color:/^#[0-9a-f]{6}$/i.test(String(raw?.color||''))?raw.color:d.color,reaction:['off','ambient','beat'].includes(raw?.reaction)?raw.reaction:d.reaction,strength:num(raw?.strength,d.strength,0,100),blend:d.blend};
}
function getLayers(){return layers.map(l=>({...l}))}
function setLayers(values=[],nextActive=0){layers=(Array.isArray(values)?values:[]).slice(0,MAX_FX).map(sanitize);activeIndex=layers.length?clamp(+nextActive||0,0,layers.length-1):-1;renderList();syncSettings();emit();return true}

document.addEventListener('fw:project-reset',()=>setLayers([],0));
document.addEventListener('fw:ratio-change',()=>{perfDirty=true});
mount();
window.__FW_FX={getLayers,setLayers,getActiveIndex:()=>activeIndex,addLayer,types:TYPE_KEYS.slice(),featuredTypes:TEMPLATE_GROUPS.flatMap(g=>g.keys),maxLayers:MAX_FX,getPreviewQuality:()=>previewQuality,setPreviewQuality};
})();
