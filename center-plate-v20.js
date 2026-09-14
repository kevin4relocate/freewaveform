(()=>{
'use strict';

const EDGE=new Set(['bottom','top','dual','left','right','sides']);
const DEFAULT_PLATE={enabled:false,shape:'blob',tone:'dark',size:82,opacity:88,softness:4,shadow:18,color:'#17191c'};
const configs=new Map();
const el=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let ui=null,lastActiveId='',plateDrawn=false;

function api(){return window.__FW_MULTI_WAVE}
function activeInfo(){
  const a=api();if(!a)return null;
  const layers=a.getLayers?.()||[],index=a.getActiveIndex?.()||0,layer=layers[index];
  return layer?{layer,index,layers}:null;
}
function cfgFor(layer){
  if(!layer)return{...DEFAULT_PLATE};
  if(!configs.has(layer.id))configs.set(layer.id,{...DEFAULT_PLATE});
  return configs.get(layer.id);
}
function notify(text){
  const t=el('toast');if(!t)return;
  t.textContent=text;t.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>t.classList.remove('show'),1600);
}

function mountUI(){
  if(el('centerPlateEnabled'))return true;
  const styleSelect=el('waveStyle'),card=styleSelect?.closest('.card');
  if(!card)return false;
  const colorRow=card.querySelector('.color-row');
  if(!colorRow)return false;

  const block=document.createElement('div');
  block.className='center-plate-block';
  block.innerHTML=`
    <div class="section-label center-plate-title">CENTER PLATE</div>
    <label class="center-plate-enable"><input id="centerPlateEnabled" type="checkbox" /> Enable Center Plate <span class="badge">HERO</span></label>
    <div class="control-grid two center-plate-grid">
      <label>Shape
        <select id="centerPlateShape">
          <option value="blob">Organic Blob</option>
          <option value="circle">Circle</option>
          <option value="rounded">Soft Square</option>
          <option value="diamond">Diamond</option>
          <option value="follow">Follow Wave Shape</option>
        </select>
      </label>
      <label>Tone
        <select id="centerPlateTone">
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="auto">Auto</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <label>Size <span id="centerPlateSizeValue">82%</span><input id="centerPlateSize" class="range" type="range" min="55" max="120" value="82" /></label>
      <label>Opacity <span id="centerPlateOpacityValue">88%</span><input id="centerPlateOpacity" class="range" type="range" min="20" max="100" value="88" /></label>
      <label>Soft edge <span id="centerPlateSoftnessValue">4px</span><input id="centerPlateSoftness" class="range" type="range" min="0" max="30" value="4" /></label>
      <label>Shadow <span id="centerPlateShadowValue">18px</span><input id="centerPlateShadow" class="range" type="range" min="0" max="40" value="18" /></label>
    </div>
    <div class="color-row center-plate-color-row">
      <input id="centerPlateColor" type="color" value="#17191c" />
      <button class="button" id="centerPlateUseWaveColor" type="button">Use Wave Color</button>
    </div>
    <p class="hint center-plate-hint">A real center anchor behind the waveform and text. It follows the selected free waveform; edge waveforms use the canvas center.</p>
  `;
  card.insertBefore(block,colorRow);

  const st=document.createElement('style');
  st.id='center-plate-v20-style';
  st.textContent=`
    .center-plate-block{margin:12px 0;padding:10px;border:1px solid #2b3033;border-radius:10px;background:rgba(8,12,14,.58)}
    .center-plate-title{margin:0 0 8px}.center-plate-enable{display:flex;align-items:center;gap:7px;font-size:10px;font-weight:600;color:#ddd3c5;margin-bottom:9px}
    .center-plate-enable .badge{margin-left:auto}.center-plate-grid{margin-bottom:8px}.center-plate-color-row{margin:2px 0 6px}
    .center-plate-color-row input[type="color"]{flex:0 0 44px}.center-plate-hint{margin:5px 0 0!important}
    .center-plate-legacy-hidden{display:none!important}
  `;
  document.head.appendChild(st);

  ui={
    enabled:el('centerPlateEnabled'),shape:el('centerPlateShape'),tone:el('centerPlateTone'),size:el('centerPlateSize'),opacity:el('centerPlateOpacity'),
    softness:el('centerPlateSoftness'),shadow:el('centerPlateShadow'),color:el('centerPlateColor'),useWave:el('centerPlateUseWaveColor')
  };
  bindUI();syncUI(true);hideLegacyControl();
  return true;
}

function bindUI(){
  if(!ui)return;
  const update=(key,value)=>{const info=activeInfo();if(!info)return;cfgFor(info.layer)[key]=value;syncLabels();};
  ui.enabled.addEventListener('change',()=>update('enabled',ui.enabled.checked));
  ui.shape.addEventListener('change',()=>update('shape',ui.shape.value));
  ui.tone.addEventListener('change',()=>{update('tone',ui.tone.value);syncToneState()});
  ui.size.addEventListener('input',()=>update('size',+ui.size.value));
  ui.opacity.addEventListener('input',()=>update('opacity',+ui.opacity.value));
  ui.softness.addEventListener('input',()=>update('softness',+ui.softness.value));
  ui.shadow.addEventListener('input',()=>update('shadow',+ui.shadow.value));
  ui.color.addEventListener('input',()=>update('color',ui.color.value));
  ui.useWave.addEventListener('click',()=>{
    const info=activeInfo();if(!info)return;
    const cfg=cfgFor(info.layer);cfg.color=info.layer.color||'#17191c';cfg.tone='custom';syncUI(true);notify('Center Plate matched to wave color');
  });
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
  ui.color.disabled=!custom;ui.color.style.opacity=custom?'1':'.5';
}
function syncUI(force=false){
  const info=activeInfo();if(!info||!ui)return;
  if(!force&&lastActiveId===info.layer.id)return;
  lastActiveId=info.layer.id;
  const c=cfgFor(info.layer);
  ui.enabled.checked=!!c.enabled;ui.shape.value=c.shape;ui.tone.value=c.tone;ui.size.value=c.size;ui.opacity.value=c.opacity;ui.softness.value=c.softness;ui.shadow.value=c.shadow;ui.color.value=c.color;
  syncLabels();syncToneState();
}

function hideLegacyControl(){
  const legacy=el('showPlate');if(!legacy)return;
  const label=legacy.closest('label');if(label)label.classList.add('center-plate-legacy-hidden');
  if(legacy.checked){
    const info=activeInfo();if(info)cfgFor(info.layer).enabled=true;
    legacy.checked=false;legacy.dispatchEvent(new Event('change',{bubbles:true}));syncUI(true);
  }
}

function rgb(hex){
  const s=String(hex||'').replace('#','');
  if(s.length!==6)return[23,25,28];
  return[parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)];
}
function rgba(hex,a){const c=rgb(hex);return`rgba(${c[0]},${c[1]},${c[2]},${clamp(a,0,1)})`}
function lin(v){v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}
function lum(c){return .2126*lin(c[0])+.7152*lin(c[1])+.0722*lin(c[2])}
function sampleLum(ctx,cx,cy,rad){
  const pts=[[cx,cy],[cx-rad*.45,cy],[cx+rad*.45,cy],[cx,cy-rad*.35],[cx,cy+rad*.35]];
  let sum=0,n=0;
  for(const p of pts){
    try{const d=ctx.getImageData(clamp(Math.round(p[0]),0,ctx.canvas.width-1),clamp(Math.round(p[1]),0,ctx.canvas.height-1),1,1).data;sum+=lum([d[0],d[1],d[2]]);n++}catch{}
  }
  return n?sum/n:.5;
}
function toneColor(cfg,ctx,cx,cy,rad){
  if(cfg.tone==='custom')return cfg.color;
  if(cfg.tone==='light')return'#f2eee5';
  if(cfg.tone==='dark')return'#17191c';
  return sampleLum(ctx,cx,cy,rad)>.46?'#17191c':'#f2eee5';
}
function hashSeed(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0)/4294967295}
function roundedRectPath(ctx,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
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
    if(s==='lotus'){
      ctx.beginPath();for(let i=0;i<=72;i++){const a=i/72*Math.PI*2-Math.PI/2,rr=rad*(.79+.21*Math.abs(Math.sin(a*4))),x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();return;
    }
    if(s!=='blob'){ctx.beginPath();ctx.arc(cx,cy,rad,0,Math.PI*2);ctx.closePath();return}
  }
  const p1=seed*Math.PI*2,p2=(seed*.73+.17)*Math.PI*2,p3=(seed*.41+.39)*Math.PI*2,N=80;
  ctx.beginPath();for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,rr=1+.055*Math.sin(a*3+p1)+.035*Math.sin(a*5+p2)+.02*Math.sin(a*8+p3),x=cx+Math.cos(a)*rad*1.08*rr,y=cy+Math.sin(a)*rad*.92*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();
}

function installRenderer(){
  const canvas=el('canvas'),a=api();if(!canvas||!a||canvas.__centerPlateInstalled)return false;
  const ctx=canvas.getContext('2d');
  const prevClear=ctx.clearRect.bind(ctx),prevFillText=ctx.fillText.bind(ctx),rawFill=ctx.fill.bind(ctx),rawStroke=ctx.stroke.bind(ctx);
  canvas.__centerPlateInstalled=true;

  function drawOne(layer,index){
    const cfg=cfgFor(layer);if(!cfg.enabled)return;
    const W=canvas.width,H=canvas.height,m=Math.min(W,H),edge=EDGE.has(layer.style);
    const cx=edge?W*.5:W*clamp(+layer.x||50,0,100)/100,cy=edge?H*.5:H*clamp(+layer.y||50,0,100)/100;
    const waveRad=m*clamp(+layer.size||46,12,85)/100*.5;
    const base=edge?m*.27:waveRad,rad=base*clamp(cfg.size,55,120)/100;
    const color=toneColor(cfg,ctx,cx,cy,rad),alpha=clamp(cfg.opacity/100,.05,1),seed=hashSeed(layer.id);
    ctx.save();
    if(cfg.softness>0){
      ctx.save();ctx.filter=`blur(${cfg.softness}px)`;ctx.fillStyle=rgba(color,alpha*.36);platePath(ctx,cfg.shape,layer,cx,cy,rad*1.015,seed);rawFill();ctx.restore();
    }
    ctx.fillStyle=rgba(color,alpha);ctx.shadowColor='rgba(0,0,0,.42)';ctx.shadowBlur=cfg.shadow;ctx.shadowOffsetY=Math.min(8,cfg.shadow*.18);
    platePath(ctx,cfg.shape,layer,cx,cy,rad,seed);rawFill();
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle=color==='#f2eee5'?'rgba(20,20,20,.16)':'rgba(255,255,255,.10)';ctx.lineWidth=Math.max(1,m*.0014);rawStroke();
    ctx.restore();
  }
  function drawPlates(){const layers=a.getLayers?.()||[];layers.forEach((layer,index)=>drawOne(layer,index))}

  ctx.clearRect=function(...args){plateDrawn=false;return prevClear(...args)};
  ctx.fillText=function(...args){if(!plateDrawn){drawPlates();plateDrawn=true}return prevFillText(...args)};
  return true;
}

function boot(){
  if(!mountUI())return false;
  if(!installRenderer())return false;
  hideLegacyControl();
  return true;
}

let tries=0;
const bootTimer=setInterval(()=>{tries++;if(boot()||tries>40)clearInterval(bootTimer)},80);

setInterval(()=>{
  if(!ui)mountUI();
  hideLegacyControl();
  syncUI();
},120);

document.addEventListener('pointerdown',e=>{
  if(!e.target.closest?.('[data-template]'))return;
  setTimeout(()=>{hideLegacyControl();syncUI(true)},0);
},true);

document.getElementById('resetProject')?.addEventListener('click',()=>setTimeout(()=>{
  configs.clear();lastActiveId='';hideLegacyControl();syncUI(true);
},20));

window.__FW_CENTER_PLATE={
  getConfig(){const info=activeInfo();return info?{...cfgFor(info.layer)}:{...DEFAULT_PLATE}},
  setConfig(patch={}){const info=activeInfo();if(!info)return false;Object.assign(cfgFor(info.layer),patch);syncUI(true);return true},
  reset(){configs.clear();lastActiveId='';syncUI(true)}
};

})();
