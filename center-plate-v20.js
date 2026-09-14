(()=>{
'use strict';

const EDGE=new Set(['bottom','top','dual','left','right','sides']);
const DEFAULT_PLATE={enabled:false,shape:'blob',tone:'dark',size:82,opacity:88,softness:4,shadow:12,color:'#17191c'};
const configs=new Map();
const el=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const normalizeHex=value=>{
  const s=String(value||'').replace(/^#/,'').toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,6);
  return s.length===6?s:'17191C';
};
let ui=null,lastActiveId='',plateDrawn=false,pendingClone=null;

function api(){return window.__FW_MULTI_WAVE}
function activeInfo(){
  const a=api();if(!a)return null;
  const layers=a.getLayers?.()||[],index=a.getActiveIndex?.()||0,layer=layers[index];
  return layer?{layer,index,layers}:null;
}
function normalizedConfig(value={}){
  const out={...DEFAULT_PLATE,...value};
  out.enabled=!!out.enabled;
  if(!['blob','circle','rounded','diamond','follow'].includes(out.shape))out.shape='blob';
  if(!['dark','light','auto','custom'].includes(out.tone))out.tone='dark';
  out.size=clamp(+out.size||82,55,105);
  out.opacity=clamp(+out.opacity||88,20,100);
  out.softness=clamp(+out.softness||0,0,24);
  out.shadow=clamp(+out.shadow||0,0,30);
  out.color='#'+normalizeHex(out.color);
  return out;
}
function cfgFor(layer){
  if(!layer)return normalizedConfig();
  if(!configs.has(layer.id))configs.set(layer.id,normalizedConfig());
  return configs.get(layer.id);
}
function toast(text){
  if(window.__FW_TOAST)return window.__FW_TOAST(text);
  const t=el('toast');if(!t)return;
  t.textContent=text;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2000);
}
function syncLabels(){
  if(!ui)return;
  el('centerPlateSizeValue').textContent=ui.size.value+'%';
  el('centerPlateOpacityValue').textContent=ui.opacity.value+'%';
  el('centerPlateSoftnessValue').textContent=ui.softness.value+'px';
  el('centerPlateShadowValue').textContent=ui.shadow.value+'px';
}
function syncToneState(){
  if(!ui)return;
  const custom=ui.tone.value==='custom';
  ui.color.disabled=!custom;ui.hex.disabled=!custom;
  ui.color.style.opacity=custom?'1':'.5';ui.hex.style.opacity=custom?'1':'.5';
}
function syncHexFromPicker(){if(ui)ui.hex.value=normalizeHex(ui.color.value)}
function applyHex(){
  if(!ui)return false;
  const clean=String(ui.hex.value||'').replace(/^#/,'').toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,6);
  ui.hex.value=clean;if(clean.length!==6)return false;
  ui.color.value='#'+clean;ui.color.dispatchEvent(new Event('input',{bubbles:true}));return true;
}
function syncUI(force=false){
  const info=activeInfo();if(!info||!ui)return;
  if(!force&&lastActiveId===info.layer.id)return;
  if(pendingClone&&!configs.has(info.layer.id)){configs.set(info.layer.id,normalizedConfig(pendingClone));pendingClone=null}
  lastActiveId=info.layer.id;
  const c=cfgFor(info.layer);
  ui.enabled.checked=!!c.enabled;ui.shape.value=c.shape;ui.tone.value=c.tone;ui.size.value=c.size;ui.opacity.value=c.opacity;ui.softness.value=c.softness;ui.shadow.value=c.shadow;ui.color.value=c.color;
  syncHexFromPicker();syncLabels();syncToneState();
}
function updateActive(key,value){
  const info=activeInfo();if(!info)return;
  cfgFor(info.layer)[key]=value;syncLabels();plateDrawn=false;
}

function mountUI(){
  if(el('centerPlateEnabled')){ui=ui||{
    enabled:el('centerPlateEnabled'),shape:el('centerPlateShape'),tone:el('centerPlateTone'),size:el('centerPlateSize'),opacity:el('centerPlateOpacity'),softness:el('centerPlateSoftness'),shadow:el('centerPlateShadow'),color:el('centerPlateColor'),hex:el('centerPlateHex'),useWave:el('centerPlateUseWaveColor')
  };return true}
  const styleSelect=el('waveStyle'),card=styleSelect?.closest('.card'),colorRow=card?.querySelector('.color-row');
  if(!card||!colorRow)return false;

  const block=document.createElement('div');
  block.className='center-plate-block';
  block.innerHTML=`
    <div class="section-label center-plate-title">CENTER PLATE</div>
    <label class="center-plate-enable"><input id="centerPlateEnabled" type="checkbox" /> Enable Center Plate <span class="badge">HERO</span></label>
    <div class="control-grid two center-plate-grid">
      <label>Shape<select id="centerPlateShape"><option value="blob">Organic Blob</option><option value="circle">Circle</option><option value="rounded">Soft Square</option><option value="diamond">Diamond</option><option value="follow">Follow Wave Shape</option></select></label>
      <label>Tone<select id="centerPlateTone"><option value="dark">Dark</option><option value="auto">Auto Dark Tint</option><option value="light">Light</option><option value="custom">Custom</option></select></label>
      <label>Size <span id="centerPlateSizeValue">82%</span><input id="centerPlateSize" class="range" type="range" min="55" max="105" value="82" /></label>
      <label>Opacity <span id="centerPlateOpacityValue">88%</span><input id="centerPlateOpacity" class="range" type="range" min="20" max="100" value="88" /></label>
      <label>Soft halo <span id="centerPlateSoftnessValue">4px</span><input id="centerPlateSoftness" class="range" type="range" min="0" max="24" value="4" /></label>
      <label>Shadow <span id="centerPlateShadowValue">12px</span><input id="centerPlateShadow" class="range" type="range" min="0" max="30" value="12" /></label>
    </div>
    <div class="center-plate-color-row">
      <input id="centerPlateColor" type="color" value="#17191c" aria-label="Center Plate color" />
      <input id="centerPlateHex" type="text" maxlength="6" inputmode="text" autocomplete="off" spellcheck="false" value="17191C" aria-label="Center Plate HEX color" />
      <button class="button" id="centerPlateUseWaveColor" type="button">Use Wave Color</button>
    </div>
    <p class="hint center-plate-hint">A visual anchor behind the waveform and text. Auto uses a dark tint from the artwork so bright text stays readable.</p>`;
  colorRow.insertAdjacentElement('afterend',block);

  ui={enabled:el('centerPlateEnabled'),shape:el('centerPlateShape'),tone:el('centerPlateTone'),size:el('centerPlateSize'),opacity:el('centerPlateOpacity'),softness:el('centerPlateSoftness'),shadow:el('centerPlateShadow'),color:el('centerPlateColor'),hex:el('centerPlateHex'),useWave:el('centerPlateUseWaveColor')};
  ui.enabled.addEventListener('change',()=>updateActive('enabled',ui.enabled.checked));
  ui.shape.addEventListener('change',()=>updateActive('shape',ui.shape.value));
  ui.tone.addEventListener('change',()=>{updateActive('tone',ui.tone.value);syncToneState()});
  ui.size.addEventListener('input',()=>updateActive('size',+ui.size.value));
  ui.opacity.addEventListener('input',()=>updateActive('opacity',+ui.opacity.value));
  ui.softness.addEventListener('input',()=>updateActive('softness',+ui.softness.value));
  ui.shadow.addEventListener('input',()=>updateActive('shadow',+ui.shadow.value));
  ui.color.addEventListener('input',()=>{syncHexFromPicker();updateActive('color',ui.color.value)});
  ui.hex.addEventListener('input',()=>{const clean=String(ui.hex.value||'').toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,6);ui.hex.value=clean;if(clean.length===6)applyHex()});
  ui.hex.addEventListener('blur',()=>{if(!applyHex())syncHexFromPicker()});
  ui.hex.addEventListener('focus',()=>setTimeout(()=>ui.hex.select(),0));
  ui.useWave.addEventListener('click',()=>{
    const info=activeInfo();if(!info)return;
    const c=cfgFor(info.layer);c.color=info.layer.color||'#17191c';c.tone='custom';plateDrawn=false;syncUI(true);toast('Center Plate matched to wave color');
  });
  syncUI(true);bindLegacyMigration();observeLayerUI();return true;
}

function bindLegacyMigration(){
  const legacy=el('showPlate');if(!legacy||legacy.dataset.centerPlateMigrated)return;
  legacy.dataset.centerPlateMigrated='1';
  legacy.closest('label')?.classList.add('center-plate-legacy-hidden');
  const migrate=()=>{
    if(!legacy.checked)return;
    const info=activeInfo();if(info)cfgFor(info.layer).enabled=true;
    legacy.checked=false;plateDrawn=false;syncUI(true);
  };
  legacy.addEventListener('change',migrate);
  migrate();
}
function observeLayerUI(){
  const list=document.querySelector('.mw-list');if(!list||list.dataset.centerPlateObserved)return;
  list.dataset.centerPlateObserved='1';
  new MutationObserver(()=>requestAnimationFrame(()=>syncUI(true))).observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}
document.addEventListener('pointerdown',e=>{
  if(e.target.closest?.('.mw-add,.mw-duplicate')){const info=activeInfo();pendingClone=info?{...cfgFor(info.layer)}:null}
  if(e.target.closest?.('.mw-select')||e.target===el('canvas'))requestAnimationFrame(()=>syncUI(true));
},true);

function rgb(hex){const s=normalizeHex(hex);return[parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)]}
function rgba(hex,a){const c=rgb(hex);return`rgba(${c[0]},${c[1]},${c[2]},${clamp(a,0,1)})`}
function mix(a,b,t){return a.map((v,i)=>Math.round(v+(b[i]-v)*t))}
function toHex(c){return'#'+c.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('')}
function sampleRgb(ctx,cx,cy,rad){
  const pts=[[cx,cy],[cx-rad*.42,cy],[cx+rad*.42,cy],[cx,cy-rad*.32],[cx,cy+rad*.32]];let sum=[0,0,0],n=0;
  for(const [x,y] of pts){try{const d=ctx.getImageData(clamp(Math.round(x),0,ctx.canvas.width-1),clamp(Math.round(y),0,ctx.canvas.height-1),1,1).data;sum[0]+=d[0];sum[1]+=d[1];sum[2]+=d[2];n++}catch{}}
  return n?sum.map(v=>v/n):[90,90,90];
}
function toneColor(cfg,ctx,cx,cy,rad){
  if(cfg.tone==='custom')return cfg.color;
  if(cfg.tone==='light')return'#f2eee5';
  if(cfg.tone==='dark')return'#17191c';
  const sampled=sampleRgb(ctx,cx,cy,rad);
  return toHex(mix(sampled,[18,20,22],.74));
}
function hashSeed(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0)/4294967295}
function roundedRectPath(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath()}
function polygonPath(ctx,cx,cy,rad,n,rot=-Math.PI/2){ctx.beginPath();for(let i=0;i<n;i++){const a=rot+i*Math.PI*2/n,x=cx+Math.cos(a)*rad,y=cy+Math.sin(a)*rad;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()}
function starPath(ctx,cx,cy,rad){ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2===0?rad:rad*.5,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()}
function platePath(ctx,shape,layer,cx,cy,rad,seed){
  if(shape==='circle'){ctx.beginPath();ctx.ellipse(cx,cy,rad,rad*.94,0,0,Math.PI*2);ctx.closePath();return}
  if(shape==='rounded'){roundedRectPath(ctx,cx-rad*1.12,cy-rad*.78,rad*2.24,rad*1.56,rad*.28);return}
  if(shape==='diamond'){polygonPath(ctx,cx,cy,rad*1.02,4,0);return}
  if(shape==='follow'){
    const s=layer.shape||'circle';
    if(s==='triangle')return polygonPath(ctx,cx,cy,rad,3);
    if(s==='square')return roundedRectPath(ctx,cx-rad*.82,cy-rad*.82,rad*1.64,rad*1.64,rad*.08);
    if(s==='diamond')return polygonPath(ctx,cx,cy,rad,4,0);
    if(s==='pentagon')return polygonPath(ctx,cx,cy,rad,5);
    if(s==='hexagon')return polygonPath(ctx,cx,cy,rad,6);
    if(s==='octagon')return polygonPath(ctx,cx,cy,rad,8);
    if(s==='star')return starPath(ctx,cx,cy,rad);
    if(s==='lotus'){ctx.beginPath();for(let i=0;i<=72;i++){const a=i/72*Math.PI*2-Math.PI/2,rr=rad*(.79+.21*Math.abs(Math.sin(a*4))),x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();return}
    if(s!=='blob'){ctx.beginPath();ctx.arc(cx,cy,rad,0,Math.PI*2);ctx.closePath();return}
  }
  const p1=seed*Math.PI*2,p2=(seed*.73+.17)*Math.PI*2,p3=(seed*.41+.39)*Math.PI*2,N=80;ctx.beginPath();
  for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,rr=1+.055*Math.sin(a*3+p1)+.035*Math.sin(a*5+p2)+.02*Math.sin(a*8+p3),x=cx+Math.cos(a)*rad*1.08*rr,y=cy+Math.sin(a)*rad*.92*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();
}
function styleRgb(style){
  if(typeof style!=='string')return null;
  const m=style.match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i);if(m)return[+m[1],+m[2],+m[3]];
  if(style[0]==='#')return rgb(style);return null;
}
function sameRgb(a,b){return!!a&&!!b&&Math.abs(a[0]-b[0])<2&&Math.abs(a[1]-b[1])<2&&Math.abs(a[2]-b[2])<2}
function isVisibleWavePaint(style){
  const c=styleRgb(style),layers=api()?.getLayers?.()||[];if(!c)return false;
  return layers.some(layer=>layer.showWave!==false&&sameRgb(c,rgb(layer.color)));
}

function installRenderer(){
  const canvas=el('canvas'),a=api();if(!canvas||!a||canvas.__centerPlateInstalled)return false;
  const ctx=canvas.getContext('2d');
  const prevClear=ctx.clearRect.bind(ctx),prevFillText=ctx.fillText.bind(ctx),prevStroke=ctx.stroke.bind(ctx),prevFill=ctx.fill.bind(ctx);
  canvas.__centerPlateInstalled=true;

  function drawOne(layer){
    const cfg=cfgFor(layer);if(layer.showWave===false||!cfg.enabled)return;
    const W=canvas.width,H=canvas.height,m=Math.min(W,H),edge=EDGE.has(layer.style);
    const cx=edge?W*.5:W*clamp(+layer.x||50,0,100)/100,cy=edge?H*.5:H*clamp(+layer.y||50,0,100)/100;
    const waveRad=m*clamp(+layer.size||46,12,85)/100*.5,base=edge?m*.27:waveRad,rad=base*clamp(cfg.size,55,105)/100;
    const color=toneColor(cfg,ctx,cx,cy,rad),alpha=clamp(cfg.opacity/100,.05,1),seed=hashSeed(layer.id);
    ctx.save();
    if(cfg.softness>0){ctx.save();ctx.filter=`blur(${cfg.softness}px)`;ctx.fillStyle=rgba(color,alpha*.30);platePath(ctx,cfg.shape,layer,cx,cy,rad*1.015,seed);prevFill();ctx.restore()}
    ctx.fillStyle=rgba(color,alpha);ctx.shadowColor='rgba(0,0,0,.36)';ctx.shadowBlur=cfg.shadow;ctx.shadowOffsetY=Math.min(6,cfg.shadow*.16);platePath(ctx,cfg.shape,layer,cx,cy,rad,seed);prevFill();
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle=color==='#f2eee5'?'rgba(20,20,20,.14)':'rgba(255,255,255,.08)';ctx.lineWidth=Math.max(1,m*.0012);prevStroke();ctx.restore();
  }
  function drawPlates(){if(plateDrawn)return;plateDrawn=true;(a.getLayers?.()||[]).forEach(drawOne)}

  ctx.clearRect=function(...args){plateDrawn=false;return prevClear(...args)};
  ctx.fillText=function(...args){drawPlates();return prevFillText(...args)};
  ctx.stroke=function(...args){if(!plateDrawn&&isVisibleWavePaint(ctx.strokeStyle))drawPlates();return prevStroke(...args)};
  ctx.fill=function(...args){if(!plateDrawn&&isVisibleWavePaint(ctx.fillStyle))drawPlates();return prevFill(...args)};
  return true;
}

function boot(){if(!mountUI())return false;if(!installRenderer())return false;bindLegacyMigration();observeLayerUI();return true}
let tries=0;const bootTimer=setInterval(()=>{tries++;if(boot()||tries>40)clearInterval(bootTimer)},80);

document.getElementById('resetProject')?.addEventListener('click',()=>setTimeout(()=>{configs.clear();lastActiveId='';pendingClone=null;plateDrawn=false;syncUI(true)},20));

window.__FW_CENTER_PLATE={
  defaults:{...DEFAULT_PLATE},
  getConfig(){const info=activeInfo();return info?{...cfgFor(info.layer)}:normalizedConfig()},
  setConfig(patch={}){const info=activeInfo();if(!info)return false;configs.set(info.layer.id,normalizedConfig({...cfgFor(info.layer),...patch}));plateDrawn=false;syncUI(true);return true},
  getAllConfigs(){return(activeInfo()?.layers||api()?.getLayers?.()||[]).map(layer=>({...cfgFor(layer)}))},
  setAllConfigs(values=[]){const layers=api()?.getLayers?.()||[];layers.forEach((layer,i)=>configs.set(layer.id,normalizedConfig(values[i]||{})));plateDrawn=false;lastActiveId='';syncUI(true);return true},
  reset(){configs.clear();lastActiveId='';pendingClone=null;plateDrawn=false;syncUI(true)}
};

})();
