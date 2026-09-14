(()=>{
'use strict';

const canvas=document.getElementById('canvas');
const audio=document.getElementById('audio');
const rail=document.querySelector('.tool-rail');
const inspector=document.querySelector('.inspector');
if(!canvas||!rail||!inspector)return;
const ctx=canvas.getContext('2d');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const DEFAULTS={
  sceneMotion:'off',
  beatFlash:0,
  lightLeak:0,
  particles:'off',
  particleAmount:36,
  vignette:0,
  fxDepth:82,
  textPlate:false,
  textPlateOpacity:38,
  textPlatePadding:18,
  textPlateColor:'#111111',
  textGlow:0,
  waveUnderGlow:0,
  waveHalo:0,
  waveEcho:0
};
let state={...DEFAULTS};
let panel=null;
let frameOpen=false;
let backgroundFxDrawn=false;
let drawingFx=false;

function meter(id){
  const el=document.getElementById(id);if(!el)return 0;
  const v=parseFloat(el.style.width||'0');return Number.isFinite(v)?clamp(v/100,0,1):0;
}
function beat(){return meter('meterBeat')}
function bass(){return meter('meterBass')}
function clock(){return audio&&!audio.paused&&Number.isFinite(audio.currentTime)?audio.currentTime:performance.now()/1000}
function fireToast(msg){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(fireToast.t);fireToast.t=setTimeout(()=>t.classList.remove('show'),1800)}
function hex6(v,fallback='111111'){v=String(v||'').replace('#','').trim().toUpperCase();return /^[0-9A-F]{6}$/.test(v)?v:fallback}
function rgba(hex,a){const s=String(hex||'#ffffff').replace('#','');const n=parseInt(s,16);return `rgba(${n>>16},${n>>8&255},${n&255},${clamp(a,0,1)})`}
function waveLayers(){return window.__FW_MULTI_WAVE?.getLayers?.()||[]}
function isEdge(style){return['bottom','top','dual','left','right','sides'].includes(style)}

function mount(){
  document.querySelector('.tool[data-tool="fx"]')?.remove();
  inspector.querySelector('[data-panel="fx"]')?.remove();
  ['fx26-style','fx27-style','fx28-style'].forEach(id=>document.getElementById(id)?.remove());

  const presets=rail.querySelector('.tool[data-tool="presets"]');
  const btn=document.createElement('button');btn.className='tool';btn.dataset.tool='fx';btn.type='button';btn.innerHTML='<span>✦</span><b>FX</b>';
  rail.insertBefore(btn,presets||null);

  panel=document.createElement('section');panel.className='panel';panel.dataset.panel='fx';
  panel.innerHTML=`
    <div class="card fx28-card">
      <div class="card-title"><div><strong>Visual FX</strong><small>Deep scene FX behind waveform</small></div><span class="badge">DEPTH</span></div>
      <div class="fx28-presets"><button type="button" class="button accent" data-fx-preset="remix">Deep Remix</button><button type="button" class="button" data-fx-preset="clean">Clean</button></div>
    </div>

    <div class="card fx28-card">
      <div class="section-label">BACKGROUND DEPTH</div>
      <label>Image motion<select data-fx="sceneMotion"><option value="off">Off</option><option value="zoom">Slow Zoom</option><option value="drift">Gentle Drift</option></select></label>
      <div class="control-grid two">
        <label>Depth <span data-out="fxDepth">82%</span><input class="range" data-fx="fxDepth" type="range" min="0" max="100" value="82"></label>
        <label>Beat bloom <span data-out="beatFlash">0%</span><input class="range" data-fx="beatFlash" type="range" min="0" max="40" value="0"></label>
        <label>Light leak <span data-out="lightLeak">0%</span><input class="range" data-fx="lightLeak" type="range" min="0" max="100" value="0"></label>
        <label>Vignette <span data-out="vignette">0%</span><input class="range" data-fx="vignette" type="range" min="0" max="100" value="0"></label>
        <label>Particles<select data-fx="particles"><option value="off">Off</option><option value="dust">Deep Dust</option><option value="snow">Deep Snow</option></select></label>
        <label>Particle amount <span data-out="particleAmount">36</span><input class="range" data-fx="particleAmount" type="range" min="8" max="90" value="36"></label>
      </div>
      <p class="hint">These are background-depth effects. Beat bloom is centered behind the waveform instead of flashing across the whole frame.</p>
    </div>

    <div class="card fx28-card">
      <div class="section-label">TEXT FX</div>
      <div class="toggle-grid"><label><input data-fx="textPlate" type="checkbox"> Backplate behind each text</label></div>
      <div class="control-grid two">
        <label>Plate opacity <span data-out="textPlateOpacity">38%</span><input class="range" data-fx="textPlateOpacity" type="range" min="0" max="90" value="38"></label>
        <label>Plate padding <span data-out="textPlatePadding">18</span><input class="range" data-fx="textPlatePadding" type="range" min="4" max="60" value="18"></label>
        <label>Text glow <span data-out="textGlow">0%</span><input class="range" data-fx="textGlow" type="range" min="0" max="100" value="0"></label>
      </div>
      <div class="fx28-color-row"><input data-fx="textPlateColor" type="color" value="#111111"><input class="fx28-hex" data-fx-hex="textPlateColor" maxlength="6" value="111111" spellcheck="false"><button class="button mini" type="button" data-copy-hex="textPlateColor">⧉</button></div>
    </div>

    <div class="card fx28-card">
      <div class="section-label">WAVEFORM DEPTH FX</div>
      <div class="control-grid two">
        <label>Depth glow <span data-out="waveUnderGlow">0%</span><input class="range" data-fx="waveUnderGlow" type="range" min="0" max="100" value="0"></label>
        <label>Deep aura <span data-out="waveHalo">0%</span><input class="range" data-fx="waveHalo" type="range" min="0" max="100" value="0"></label>
        <label>Soft echo <span data-out="waveEcho">0%</span><input class="range" data-fx="waveEcho" type="range" min="0" max="100" value="0"></label>
      </div>
      <p class="hint">These render underneath the waveform. The visible waveform remains sharp while the reactive energy stays deeper in the scene.</p>
    </div>`;
  const presetPanel=inspector.querySelector('[data-panel="presets"]');inspector.insertBefore(panel,presetPanel||null);

  const st=document.createElement('style');st.id='fx28-style';st.textContent=`
    .fx28-card{margin-bottom:10px}.fx28-card>label{display:grid;gap:5px;font-size:10px;color:#aaa;margin:8px 0}.fx28-presets{display:flex;gap:6px}.fx28-presets .button{height:31px;padding:0 12px}.fx28-color-row{display:grid;grid-template-columns:42px minmax(0,1fr) 38px;gap:6px;align-items:center;margin-top:8px}.fx28-color-row input[type=color]{width:42px;height:34px;padding:3px;border:1px solid #2a3034;border-radius:8px;background:#0a0f11}.fx28-hex{height:34px;border:1px solid #2a3034;border-radius:8px;background:#0a0f11;color:#ddd3c5;padding:0 10px;font:700 10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}.fx28-color-row .mini{height:34px;padding:0}
  `;document.head.appendChild(st);

  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tool').forEach(x=>x.classList.toggle('active',x===btn));
    document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active',x===panel));
    const title=document.getElementById('panelTitle');if(title)title.textContent='FX';
    canvas.style.cursor='default';
  });
  panel.addEventListener('input',onInput,true);
  panel.addEventListener('change',onInput,true);
  panel.addEventListener('click',e=>{
    const p=e.target.closest('[data-fx-preset]');if(p){applyPreset(p.dataset.fxPreset);return}
    const c=e.target.closest('[data-copy-hex]');if(c){const key=c.dataset.copyHex,val=hex6(state[key],'111111');navigator.clipboard?.writeText(val);fireToast('Copied '+val)}
  });
  syncUI();
}

function onInput(e){
  const key=e.target?.dataset?.fx;
  if(key){
    let v=e.target.type==='checkbox'?e.target.checked:e.target.value;
    if(e.target.type==='range')v=+v;
    state[key]=v;
    if(key==='textPlateColor'){const h=panel.querySelector('[data-fx-hex="textPlateColor"]');if(h)h.value=hex6(v)}
    updateOut(key);return;
  }
  const hexKey=e.target?.dataset?.fxHex;
  if(hexKey){
    const raw=String(e.target.value||'').replace(/[^0-9a-f]/gi,'').slice(0,6).toUpperCase();e.target.value=raw;
    if(raw.length===6){state[hexKey]='#'+raw;const picker=panel.querySelector(`[data-fx="${hexKey}"]`);if(picker)picker.value=state[hexKey]}
  }
}
function updateOut(key){const o=panel?.querySelector(`[data-out="${key}"]`);if(!o)return;o.textContent=key==='particleAmount'||key==='textPlatePadding'?state[key]:state[key]+'%'}
function syncUI(){
  if(!panel)return;
  panel.querySelectorAll('[data-fx]').forEach(el=>{const k=el.dataset.fx;if(!(k in state))return;if(el.type==='checkbox')el.checked=!!state[k];else el.value=state[k]});
  panel.querySelectorAll('[data-out]').forEach(el=>updateOut(el.dataset.out));
  const h=panel.querySelector('[data-fx-hex="textPlateColor"]');if(h)h.value=hex6(state.textPlateColor);
}
function applyPreset(name){
  if(name==='clean')state={...DEFAULTS};
  else if(name==='remix')state={...DEFAULTS,sceneMotion:'zoom',fxDepth:88,beatFlash:16,lightLeak:10,particles:'dust',particleAmount:24,vignette:16,textPlate:true,textPlateOpacity:28,textPlatePadding:15,textGlow:12,waveUnderGlow:44,waveHalo:46,waveEcho:10};
  syncUI();fireToast(name==='remix'?'Deep Remix applied':'FX reset');
}

// Use the editor's own render pass. No independent FX animation loop.
const previousClearRect=ctx.clearRect.bind(ctx);
ctx.clearRect=function(...args){frameOpen=true;backgroundFxDrawn=false;return previousClearRect(...args)};

// Motion is applied only to the uploaded image. Foreground objects do not move with it.
const previousDrawImage=ctx.drawImage.bind(ctx);
ctx.drawImage=function(source,...args){
  if(state.sceneMotion!=='off'&&!drawingFx&&source instanceof HTMLImageElement&&args.length===4){
    let [dx,dy,dw,dh]=args;const t=clock();let scale=1,x=0,y=0;
    if(state.sceneMotion==='zoom')scale=1.004+(Math.sin(t*.30)*.5+.5)*.030;
    else if(state.sceneMotion==='drift'){scale=1.024;x=Math.sin(t*.20)*canvas.width*.010;y=Math.cos(t*.17)*canvas.height*.008}
    const nw=dw*scale,nh=dh*scale;
    return previousDrawImage(source,dx-(nw-dw)/2+x,dy-(nh-dh)/2+y,nw,nh);
  }
  return previousDrawImage(source,...args);
};

const particles=Array.from({length:96},(_,i)=>({
  x:Math.abs((Math.sin(i*91.17)*43758.5453)%1),
  y:Math.abs((Math.sin(i*47.73+2)*24634.6345)%1),
  s:.25+((i*37)%100)/100,
  v:.18+((i*53)%100)/100,
  z:.18+((i*29)%100)/100
}));

function drawDeepParticles(t){
  if(state.particles==='off')return;
  const n=Math.min(particles.length,Math.round(state.particleAmount));
  const depth=state.fxDepth/100;
  ctx.save();
  ctx.globalCompositeOperation='soft-light';
  for(let i=0;i<n;i++){
    const p=particles[i],snow=state.particles==='snow';
    const speed=(snow?.0055:.0016)*(0.45+p.z*.55)*(1-depth*.28);
    const xx=((p.x+speed*t*p.v)%1)*canvas.width;
    const yy=((p.y+(snow?.012:.0022)*t*p.v*(.45+p.z*.55))%1)*canvas.height;
    const r=(snow?1+p.s*1.8:1.5+p.s*5.5)*(canvas.width/1920)*(0.55+p.z*.55);
    const blur=(1.2+depth*5.2+(1-p.z)*3.5)*(canvas.width/1920);
    ctx.filter=`blur(${blur}px)`;
    ctx.globalAlpha=(snow?.045+p.s*.07:.018+p.s*.035)*(1-depth*.22);
    ctx.fillStyle=snow?'#dfe5df':'#d9c9ad';
    ctx.beginPath();ctx.arc(xx,yy,r,0,Math.PI*2);ctx.fill();
  }
  ctx.filter='none';ctx.restore();
}

function drawDeepLightLeak(t){
  if(state.lightLeak<=0)return;
  const w=canvas.width,h=canvas.height,depth=state.fxDepth/100,p=(Math.sin(t*.24)+1)/2;
  ctx.save();ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=state.lightLeak/100*(.10-depth*.035);
  ctx.filter=`blur(${Math.round((18+depth*44)*(w/1920))}px)`;
  const x=w*(.04+p*.92),g=ctx.createRadialGradient(x,h*.2,0,x,h*.2,w*.62);g.addColorStop(0,'rgba(255,126,76,.62)');g.addColorStop(.42,'rgba(193,69,34,.16)');g.addColorStop(1,'rgba(120,20,10,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.filter='none';ctx.restore();
}

function drawVignette(){
  if(state.vignette<=0)return;const w=canvas.width,h=canvas.height;
  ctx.save();ctx.globalAlpha=state.vignette/100*.46;const g=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.25,w/2,h/2,Math.max(w,h)*.76);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.7,'rgba(0,0,0,.03)');g.addColorStop(1,'rgba(0,0,0,.82)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.restore();
}

function drawDeepWaveField(){
  const layers=waveLayers();if(!layers.length)return;
  const b=beat(),ba=bass(),depth=state.fxDepth/100;
  if(state.waveHalo<=0&&state.beatFlash<=0)return;
  ctx.save();ctx.globalCompositeOperation='soft-light';
  for(const wv of layers){
    if(wv.showWave===false||isEdge(wv.style))continue;
    const x=canvas.width*(Number.isFinite(+wv.x)?+wv.x:50)/100;
    const y=canvas.height*(Number.isFinite(+wv.y)?+wv.y:50)/100;
    const base=Math.min(canvas.width,canvas.height)*(+wv.size||46)/100*.5;
    const pulse=clamp(b*.85+ba*.28,0,1.35);
    const haloStrength=state.waveHalo/100;
    const beatStrength=state.beatFlash/40;
    const radius=base*(1.45+depth*1.7+pulse*.28);
    const alpha=clamp(haloStrength*(.035+pulse*.055)+beatStrength*pulse*.055,0,.13);
    if(alpha<=.002)continue;
    const color=wv.color||'#e5d3a6';
    const g=ctx.createRadialGradient(x,y,base*.15,x,y,radius);
    g.addColorStop(0,rgba(color,alpha*.72));
    g.addColorStop(.30,rgba(color,alpha*.5));
    g.addColorStop(.68,rgba(color,alpha*.16));
    g.addColorStop(1,rgba(color,0));
    ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  ctx.restore();
}

function drawBackgroundFxOnce(){
  if(!frameOpen||backgroundFxDrawn||drawingFx)return;
  backgroundFxDrawn=true;drawingFx=true;
  const t=clock();
  try{
    // Everything here is intentionally deep/background-first.
    drawDeepParticles(t);
    drawDeepLightLeak(t);
    drawDeepWaveField();
    drawVignette();
  }finally{drawingFx=false}
}

// Wave FX are rendered BEFORE the sharp waveform stroke, with heavy blur and low contrast.
const previousStroke=ctx.stroke.bind(ctx);
ctx.stroke=function(path){
  if(!drawingFx)drawBackgroundFxOnce();
  if(!drawingFx&&state.waveUnderGlow>0){
    const depth=state.fxDepth/100;
    ctx.save();
    ctx.globalCompositeOperation='soft-light';
    ctx.globalAlpha*=clamp(state.waveUnderGlow/100*(.16-depth*.035),0,.18);
    ctx.lineWidth=Math.max(ctx.lineWidth*(4.0+depth*2.2),8*(canvas.width/1920));
    ctx.filter=`blur(${Math.round((5+state.waveUnderGlow*.16+depth*12)*(canvas.width/1920))}px)`;
    ctx.shadowBlur=0;
    path?previousStroke(path):previousStroke();
    ctx.filter='none';ctx.restore();
  }
  if(!drawingFx&&state.waveEcho>0){
    ctx.save();
    ctx.globalCompositeOperation='soft-light';
    ctx.globalAlpha*=clamp(state.waveEcho/100*.10,0,.10);
    ctx.lineWidth=Math.max(ctx.lineWidth*2.6,4);
    ctx.filter=`blur(${Math.round((4+state.fxDepth*.10)*(canvas.width/1920))}px)`;
    path?previousStroke(path):previousStroke();
    ctx.filter='none';ctx.restore();
  }
  return path?previousStroke(path):previousStroke();
};

// Dot/orbit waveform may have no stroke before its first point.
const previousArc=ctx.arc.bind(ctx);
ctx.arc=function(...args){if(!drawingFx)drawBackgroundFxOnce();return previousArc(...args)};

// Text effects remain attached to text only, always above waveform/background.
const previousFillText=ctx.fillText.bind(ctx);
ctx.fillText=function(text,x,y,maxWidth){
  drawBackgroundFxOnce();
  const fontSize=parseFloat((ctx.font.match(/([\d.]+)px/)||[])[1]||'28');
  if(state.textPlate){
    const m=ctx.measureText(String(text)),pad=state.textPlatePadding*(canvas.width/1920),py=pad*.58;
    let left;if(ctx.textAlign==='left'||ctx.textAlign==='start')left=x-pad;else if(ctx.textAlign==='right'||ctx.textAlign==='end')left=x-m.width-pad;else left=x-m.width/2-pad;
    const top=y-fontSize*.68-py,w=m.width+pad*2,h=fontSize*1.36+py*2,r=Math.min(22*(canvas.width/1920),h*.25);
    ctx.save();ctx.globalAlpha=clamp(state.textPlateOpacity/100,0,.9);ctx.fillStyle=state.textPlateColor;ctx.shadowBlur=0;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(left,top,w,h,r);else ctx.rect(left,top,w,h);ctx.fill();ctx.restore();
  }
  if(state.textGlow>0){
    ctx.save();ctx.globalAlpha*=clamp(.10+state.textGlow/250,0,.50);ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=(5+state.textGlow*.28)*(canvas.width/1920);previousFillText(text,x,y,maxWidth);ctx.restore();
  }
  return previousFillText(text,x,y,maxWidth);
};

window.__FW_VISUAL_FX={
  getState:()=>({...state}),
  setState:v=>{if(v&&typeof v==='object')state={...DEFAULTS,...v};syncUI()},
  reset:()=>{state={...DEFAULTS};syncUI()}
};
mount();
})();