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
  snow:{name:'Snow',icon:'❄',amount:48,speed:45,size:40,opacity:38,color:'#f7f4ec',reaction:'ambient',strength:24,blend:'screen'},
  dust:{name:'Dust',icon:'✦',amount:36,speed:24,size:30,opacity:24,color:'#e8c98f',reaction:'ambient',strength:18,blend:'screen'},
  smoke:{name:'Smoke',icon:'≈',amount:24,speed:18,size:92,opacity:18,color:'#d9dde0',reaction:'ambient',strength:22,blend:'screen'},
  stars:{name:'Stars',icon:'★',amount:42,speed:12,size:24,opacity:34,color:'#f7f1dc',reaction:'ambient',strength:28,blend:'screen'},
  rays:{name:'Light Rays',icon:'☀',amount:28,speed:16,size:100,opacity:20,color:'#f2d6a0',reaction:'beat',strength:32,blend:'screen'},
  club:{name:'Club Bars',icon:'▥',amount:34,speed:80,size:70,opacity:28,color:'#d45cff',reaction:'beat',strength:68,blend:'lighter'}
};
const TYPE_KEYS=Object.keys(TYPES);
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
    amount:d.amount,speed:d.speed,size:d.size,opacity:d.opacity,color:d.color,
    reaction:d.reaction,strength:d.strength,blend:d.blend,
    ...(source||{}),id:id(),type,name:d.name,seed:Math.floor(Math.random()*1000000)
  };
}
function active(){return activeIndex>=0?layers[activeIndex]:null}
function qualityCountScale(){return drawQuality==='performance'?.46:1}
function countFor(l){
  const q=clamp(l.amount,0,100)/100;
  let n;
  if(l.type==='smoke')n=3+q*13;
  else if(l.type==='rays')n=2+q*8;
  else if(l.type==='club')n=4+q*20;
  else n=8+q*92;
  return Math.max(1,Math.round(n*qualityCountScale()));
}
function px(v){return v*(drawCanvas.width/(canvas.width||1))}
function blurScale(){return drawQuality==='performance'?.38:1}
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
  const b=document.getElementById('exportBtn');
  return !!b?.disabled&&String(b.textContent||'').toLowerCase().includes('export');
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
function styleMount(){
  if(document.getElementById('fw-fx-style'))return;
  const s=document.createElement('style');s.id='fw-fx-style';s.textContent=`
.fx-card{margin-bottom:10px}.fx-quality-row{display:grid;grid-template-columns:1fr;gap:4px;margin:0 0 9px}.fx-quality-row label{margin:0!important}.fx-quality-note{margin:0!important}.fx-template-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.fx-template{min-height:48px;border:1px solid #293034;border-radius:9px;background:#0c1113;color:#cec5b8;display:flex;align-items:center;gap:6px;padding:6px 7px;cursor:pointer;text-align:left}.fx-template:hover{border-color:#946a3b;background:#18130e}.fx-template b{width:20px;text-align:center;color:#e1b367;font-size:15px}.fx-template span{font-size:8px;line-height:1.15}.fx-actions{display:flex;gap:6px;margin-bottom:8px}.fx-actions .button{width:auto!important}.fx-list{display:grid;gap:6px}.fx-item{display:grid;grid-template-columns:minmax(0,1fr) 32px 32px;gap:5px}.fx-select{height:42px;border:1px solid #293034;border-radius:9px;background:#0c1113;color:#d8d0c4;display:flex;align-items:center;gap:8px;padding:0 9px;cursor:pointer;text-align:left;min-width:0}.fx-item.active .fx-select{border-color:#956a39;background:#18130e}.fx-icon{width:22px;height:22px;border:1px solid #564126;border-radius:7px;background:#1b1710;color:#dda95d;display:grid;place-items:center;flex:none;font-size:10px}.fx-copy{min-width:0;display:flex;flex-direction:column;gap:2px}.fx-copy b{font-size:9px}.fx-copy small{font-size:8px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fx-eye,.fx-delete{height:42px;border:1px solid #293034;border-radius:9px;background:#0c1113;color:#777;cursor:pointer}.fx-eye.on{color:#e0ae61}.fx-delete:hover{color:#f1b8a7;border-color:#71443a}.fx-settings[hidden]{display:none!important}.fx-empty{padding:10px;border:1px dashed #2c3236;border-radius:9px;color:#777;font-size:9px;text-align:center}.fx-color-row{display:grid;grid-template-columns:46px minmax(0,1fr);gap:7px;align-items:center;margin-top:8px}.fx-color-row input[type=color]{width:46px;height:32px;padding:3px;border:1px solid #30363a;border-radius:8px;background:#0b0f11}.fx-color-row small{color:#817b73;font-size:8px;line-height:1.35}.fx-note{margin-top:7px!important}@media(max-width:820px){.tool-rail{grid-template-columns:repeat(6,1fr)!important}.fx-template-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
  document.head.appendChild(s);
}
function mount(){
  styleMount();
  root=document.createElement('div');root.innerHTML=`
    <div class="card fx-card">
      <div class="card-title"><div><strong>FX Templates</strong><small>Add atmosphere behind waveform + text</small></div><span class="badge fx-quality-badge">PERFORMANCE</span></div>
      <div class="fx-quality-row">
        <label>Preview quality<select class="fx-quality"><option value="performance">Performance</option><option value="full">Full</option></select></label>
        <p class="hint fx-quality-note">Performance uses a lighter 30 FPS FX buffer. Export automatically uses Full quality.</p>
      </div>
      <div class="fx-template-grid">${TYPE_KEYS.map(k=>`<button class="fx-template" type="button" data-fx-template="${k}"><b>${TYPES[k].icon}</b><span>${TYPES[k].name}</span></button>`).join('')}</div>
    </div>
    <div class="card fx-card">
      <div class="card-title"><div><strong>FX Layers</strong><small>Stack up to ${MAX_FX} effects</small></div><span class="badge fx-count">0 / ${MAX_FX}</span></div>
      <div class="fx-actions"><button class="button accent fx-add" type="button">+ Add FX</button><button class="button fx-duplicate" type="button">Duplicate</button></div>
      <div class="fx-list"></div>
      <p class="hint">Effects render over the background and stay behind waveform + Free Text.</p>
    </div>
    <div class="card fx-settings" hidden>
      <div class="card-title"><div><strong>Selected FX</strong><small class="fx-selected-name">—</small></div></div>
      <label>Type<select class="fx-type">${TYPE_KEYS.map(k=>`<option value="${k}">${TYPES[k].name}</option>`).join('')}</select></label>
      <div class="control-grid two">
        <label>Amount <span class="fx-amount-v">0%</span><input class="range fx-amount" type="range" min="0" max="100" value="40"></label>
        <label>Speed <span class="fx-speed-v">0%</span><input class="range fx-speed" type="range" min="0" max="200" value="50"></label>
        <label>Size <span class="fx-size-v">0%</span><input class="range fx-size" type="range" min="10" max="200" value="50"></label>
        <label>Opacity <span class="fx-opacity-v">0%</span><input class="range fx-opacity" type="range" min="0" max="100" value="30"></label>
      </div>
      <div class="fx-color-row"><input class="fx-color" type="color" value="#ffffff"><small>Effect color. Club Bars uses this as the base light color.</small></div>
      <label>Audio reaction<select class="fx-reaction"><option value="off">Off</option><option value="ambient">Ambient</option><option value="beat">Beat Sync</option></select></label>
      <label>Reaction strength <span class="fx-strength-v">0%</span><input class="range fx-strength" type="range" min="0" max="100" value="25"></label>
      <p class="hint fx-note">Use 1–3 layers for a cleaner look. Multiple FX are supported up to 5 layers.</p>
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
  bindRange('.fx-amount','amount');bindRange('.fx-speed','speed');bindRange('.fx-size','size');bindRange('.fx-opacity','opacity');bindRange('.fx-strength','strength');
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
  Object.assign(l,{type,name:d.name,amount:d.amount,speed:d.speed,size:d.size,opacity:d.opacity,color:d.color,reaction:d.reaction,strength:d.strength,blend:d.blend});
  renderList();syncSettings();emit();
}
function renderList(){
  if(!root)return;
  root.querySelector('.fx-count').textContent=`${layers.length} / ${MAX_FX}`;
  root.querySelector('.fx-add').disabled=layers.length>=MAX_FX;
  root.querySelector('.fx-duplicate').disabled=layers.length>=MAX_FX||!layers.length;
  root.querySelector('.fx-list').innerHTML=layers.length?layers.map((l,i)=>`<div class="fx-item ${i===activeIndex?'active':''}" data-i="${i}"><button class="fx-select" type="button"><span class="fx-icon">${TYPES[l.type].icon}</span><span class="fx-copy"><b>${esc(TYPES[l.type].name)}</b><small>${l.reaction==='beat'?'Beat Sync':l.reaction==='ambient'?'Ambient reaction':'No audio reaction'}</small></span></button><button class="fx-eye ${l.enabled?'on':''}" type="button" title="Show / hide">${l.enabled?'●':'○'}</button><button class="fx-delete" type="button" title="Delete">×</button></div>`).join(''):'<div class="fx-empty">No FX yet. Choose a template or press + Add FX.</div>';
}
function syncSettings(){
  if(!root)return;const l=active(),card=root.querySelector('.fx-settings');card.hidden=!l;if(!l)return;
  root.querySelector('.fx-selected-name').textContent=TYPES[l.type].name;
  root.querySelector('.fx-type').value=l.type;root.querySelector('.fx-color').value=l.color;root.querySelector('.fx-reaction').value=l.reaction;
  for(const [cls,key] of [['.fx-amount','amount'],['.fx-speed','speed'],['.fx-size','size'],['.fx-opacity','opacity'],['.fx-strength','strength']]){root.querySelector(cls).value=l[key];root.querySelector(cls+'-v').textContent=Math.round(l[key])+'%'}
}

function setBlend(l){drawCtx.globalCompositeOperation=l.blend||'screen'}
function drawSnow(l,r,t){
  const n=countFor(l),p=pulse(l,r),speed=(18+l.speed*.9),size=px((1.5+l.size*.075)*(1+p*.18)),alpha=l.opacity/100*(1+p*.35);
  drawCtx.fillStyle=rgba(l.color,alpha);drawCtx.shadowColor=rgba(l.color,alpha*.8);drawCtx.shadowBlur=size*1.8*blurScale();
  for(let i=0;i<n;i++){
    const y=frac(rnd(l.seed,i*5+1)+t*speed/canvas.height*(.55+rnd(l.seed,i*5+2)*.9))*drawCanvas.height;
    const x=frac(rnd(l.seed,i*5+3)+Math.sin(t*.35+i)*.015*(l.speed/100)+rnd(l.seed,i)*.01)*drawCanvas.width;
    const s=size*(.45+rnd(l.seed,i*5+4)*1.25);drawCtx.beginPath();drawCtx.arc(x,y,s,0,Math.PI*2);drawCtx.fill();
  }
}
function drawDust(l,r,t){
  const n=countFor(l),p=pulse(l,r),speed=(4+l.speed*.18),size=px((.7+l.size*.045)*(1+p*.2)),alpha=l.opacity/100*(1+p*.45);
  drawCtx.fillStyle=rgba(l.color,alpha);drawCtx.shadowColor=rgba(l.color,alpha);drawCtx.shadowBlur=size*3*blurScale();
  for(let i=0;i<n;i++){
    const y=frac(rnd(l.seed,i*7+1)-t*speed/canvas.height*(.35+rnd(l.seed,i*7+2)))*drawCanvas.height;
    const x=frac(rnd(l.seed,i*7+3)+Math.sin(t*(.15+rnd(l.seed,i)*.2)+i)*.025)*drawCanvas.width;
    const s=size*(.35+rnd(l.seed,i*7+4)*1.5);drawCtx.beginPath();drawCtx.arc(x,y,s,0,Math.PI*2);drawCtx.fill();
  }
}
function drawStars(l,r,t){
  const n=countFor(l),p=pulse(l,r),base=px(.8+l.size*.04),alpha=l.opacity/100;
  for(let i=0;i<n;i++){
    const x=rnd(l.seed,i*5+1)*drawCanvas.width,y=rnd(l.seed,i*5+2)*drawCanvas.height;
    const tw=.35+.65*Math.abs(Math.sin(t*(.5+l.speed*.018)*(.45+rnd(l.seed,i*5+3))+rnd(l.seed,i)*12));
    const a=alpha*tw*(1+p*.65),s=base*(.45+rnd(l.seed,i*5+4)*1.25)*(1+p*.12);
    drawCtx.fillStyle=rgba(l.color,a);drawCtx.shadowColor=rgba(l.color,a);drawCtx.shadowBlur=s*3*blurScale();drawCtx.beginPath();drawCtx.arc(x,y,s,0,Math.PI*2);drawCtx.fill();
  }
}
function drawSmoke(l,r,t){
  const n=countFor(l),p=pulse(l,r),alpha=l.opacity/100*(1+p*.25),speed=(.006+l.speed*.0007),size=(.10+l.size*.0021)*(1+p*.12);
  for(let i=0;i<n;i++){
    const x=frac(rnd(l.seed,i*6+1)+t*speed*(.25+rnd(l.seed,i*6+2)))*drawCanvas.width;
    const y=(.12+rnd(l.seed,i*6+3)*.78)*drawCanvas.height+Math.sin(t*.12+i)*drawCanvas.height*.02;
    const radius=Math.min(drawCanvas.width,drawCanvas.height)*size*(.55+rnd(l.seed,i*6+4)*.8);
    const g=drawCtx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,rgba(l.color,alpha*.22));g.addColorStop(.45,rgba(l.color,alpha*.11));g.addColorStop(1,rgba(l.color,0));drawCtx.fillStyle=g;drawCtx.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
}
function drawRays(l,r,t){
  const n=countFor(l),p=pulse(l,r),alpha=l.opacity/100*(1+p*.8),speed=.02+l.speed*.0008,span=.035+l.size*.0012;
  const ox=drawCanvas.width*.5,oy=-drawCanvas.height*.08;
  for(let i=0;i<n;i++){
    const phase=rnd(l.seed,i*4+1)*Math.PI*2+t*speed*(.4+rnd(l.seed,i*4+2));
    const center=(-.75+rnd(l.seed,i*4+3)*1.5)+Math.sin(phase)*.16;
    const half=span*(.45+rnd(l.seed,i*4+4)*.9),x1=ox+Math.tan(center-half)*drawCanvas.height*1.25,x2=ox+Math.tan(center+half)*drawCanvas.height*1.25;
    const g=drawCtx.createLinearGradient(ox,oy,(x1+x2)/2,drawCanvas.height);g.addColorStop(0,rgba(l.color,alpha*.78));g.addColorStop(.55,rgba(l.color,alpha*.18));g.addColorStop(1,rgba(l.color,0));drawCtx.fillStyle=g;drawCtx.beginPath();drawCtx.moveTo(ox,oy);drawCtx.lineTo(x1,drawCanvas.height);drawCtx.lineTo(x2,drawCanvas.height);drawCtx.closePath();drawCtx.fill();
  }
}
function drawClub(l,r,t){
  const n=countFor(l),p=pulse(l,r),alpha=l.opacity/100*(1+p*1.15),speed=.15+l.speed*.006,width=px((4+l.size*.22)*(1+p*.22));
  drawCtx.lineCap='round';
  for(let i=0;i<n;i++){
    const q=i/Math.max(1,n-1),vertical=i%2===0,phase=t*speed+rnd(l.seed,i*4+1)*Math.PI*2,shift=Math.sin(phase)*(vertical?drawCanvas.width:drawCanvas.height)*.13;
    drawCtx.strokeStyle=rgba(l.color,alpha*(.28+rnd(l.seed,i*4+2)*.6));drawCtx.shadowColor=rgba(l.color,alpha);drawCtx.shadowBlur=width*2*blurScale();drawCtx.lineWidth=width*(.45+rnd(l.seed,i*4+3)*1.1);drawCtx.beginPath();
    if(vertical){const x=q*drawCanvas.width+shift;drawCtx.moveTo(x,-drawCanvas.height*.1);drawCtx.lineTo(x+Math.sin(phase*.7)*drawCanvas.width*.08,drawCanvas.height*1.1)}
    else{const y=q*drawCanvas.height+shift;drawCtx.moveTo(-drawCanvas.width*.1,y);drawCtx.lineTo(drawCanvas.width*1.1,y+Math.sin(phase*.7)*drawCanvas.height*.08)}
    drawCtx.stroke();
  }
  if(p>.18){drawCtx.fillStyle=rgba(l.color,clamp(alpha*p*.055,0,.07));drawCtx.fillRect(0,0,drawCanvas.width,drawCanvas.height)}
}
function drawLayer(l,frame){
  if(!l.enabled||l.opacity<=0||l.amount<=0)return;
  const r=frame.energy||{bass:0,mid:0,treble:0,beat:0,time:performance.now()/1000},t=Number.isFinite(+frame.time)?+frame.time:(r.time||performance.now()/1000);
  drawCtx.save();setBlend(l);drawCtx.globalAlpha=1;
  if(l.type==='snow')drawSnow(l,r,t);else if(l.type==='dust')drawDust(l,r,t);else if(l.type==='smoke')drawSmoke(l,r,t);else if(l.type==='stars')drawStars(l,r,t);else if(l.type==='rays')drawRays(l,r,t);else if(l.type==='club')drawClub(l,r,t);
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
  mainCtx.save();mainCtx.globalCompositeOperation='screen';mainCtx.globalAlpha=1;mainCtx.imageSmoothingEnabled=true;mainCtx.drawImage(perfCanvas,0,0,canvas.width,canvas.height);mainCtx.restore();
}
pipeline.register('ambient','fx-engine-v1',drawFX,0);

function sanitize(raw){
  const type=safeType(raw?.type),d=TYPES[type],num=(v,f,a,b)=>clamp(Number.isFinite(+v)?+v:f,a,b);
  return{id:String(raw?.id||id()),type,name:d.name,enabled:raw?.enabled!==false,seed:Number.isFinite(+raw?.seed)?+raw.seed:Math.floor(Math.random()*1000000),amount:num(raw?.amount,d.amount,0,100),speed:num(raw?.speed,d.speed,0,200),size:num(raw?.size,d.size,10,200),opacity:num(raw?.opacity,d.opacity,0,100),color:/^#[0-9a-f]{6}$/i.test(String(raw?.color||''))?raw.color:d.color,reaction:['off','ambient','beat'].includes(raw?.reaction)?raw.reaction:d.reaction,strength:num(raw?.strength,d.strength,0,100),blend:d.blend};
}
function getLayers(){return layers.map(l=>({...l}))}
function setLayers(values=[],nextActive=0){layers=(Array.isArray(values)?values:[]).slice(0,MAX_FX).map(sanitize);activeIndex=layers.length?clamp(+nextActive||0,0,layers.length-1):-1;renderList();syncSettings();emit();return true}

document.addEventListener('fw:project-reset',()=>setLayers([],0));
document.addEventListener('fw:ratio-change',()=>{perfDirty=true});
mount();
window.__FW_FX={getLayers,setLayers,getActiveIndex:()=>activeIndex,addLayer,types:TYPE_KEYS.slice(),maxLayers:MAX_FX,getPreviewQuality:()=>previewQuality,setPreviewQuality};
})();
