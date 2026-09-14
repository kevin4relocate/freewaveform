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
let atmosphereDrawn=false;
let drawingAtmosphere=false;

function meter(id){
  const el=document.getElementById(id);if(!el)return 0;
  const v=parseFloat(el.style.width||'0');return Number.isFinite(v)?clamp(v/100,0,1):0;
}
function beat(){return meter('meterBeat')}
function bass(){return meter('meterBass')}
function clock(){return audio&&!audio.paused&&Number.isFinite(audio.currentTime)?audio.currentTime:performance.now()/1000}
function fireToast(msg){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(fireToast.t);fireToast.t=setTimeout(()=>t.classList.remove('show'),1800)}
function hex6(v,fallback='111111'){v=String(v||'').replace('#','').trim().toUpperCase();return /^[0-9A-F]{6}$/.test(v)?v:fallback}

function mount(){
  const oldTool=document.querySelector('.tool[data-tool="fx"]');
  const oldPanel=inspector.querySelector('[data-panel="fx"]');
  oldTool?.remove();oldPanel?.remove();document.getElementById('fx26-style')?.remove();

  const presets=rail.querySelector('.tool[data-tool="presets"]');
  const btn=document.createElement('button');btn.className='tool';btn.dataset.tool='fx';btn.type='button';btn.innerHTML='<span>✦</span><b>FX</b>';
  rail.insertBefore(btn,presets||null);

  panel=document.createElement('section');panel.className='panel';panel.dataset.panel='fx';
  panel.innerHTML=`
    <div class="card fx27-card">
      <div class="card-title"><div><strong>Visual FX</strong><small>Rendered inside the scene, not over the finished frame</small></div><span class="badge">LAYERED</span></div>
      <div class="fx27-presets"><button type="button" class="button accent" data-fx-preset="remix">Remix Glow</button><button type="button" class="button" data-fx-preset="clean">Clean</button></div>
    </div>

    <div class="card fx27-card">
      <div class="section-label">BACKGROUND / ATMOSPHERE</div>
      <label>Image motion<select data-fx="sceneMotion"><option value="off">Off</option><option value="zoom">Slow Zoom</option><option value="drift">Gentle Drift</option></select></label>
      <div class="control-grid two">
        <label>Beat flash <span data-out="beatFlash">0%</span><input class="range" data-fx="beatFlash" type="range" min="0" max="30" value="0"></label>
        <label>Light leak <span data-out="lightLeak">0%</span><input class="range" data-fx="lightLeak" type="range" min="0" max="100" value="0"></label>
        <label>Vignette <span data-out="vignette">0%</span><input class="range" data-fx="vignette" type="range" min="0" max="100" value="0"></label>
        <label>Particles<select data-fx="particles"><option value="off">Off</option><option value="dust">Dust / Bokeh</option><option value="snow">Snow</option></select></label>
        <label>Particle amount <span data-out="particleAmount">36</span><input class="range" data-fx="particleAmount" type="range" min="8" max="90" value="36"></label>
      </div>
      <p class="hint">Atmosphere is composited after the background and before waveform/text. Image motion moves only the background image.</p>
    </div>

    <div class="card fx27-card">
      <div class="section-label">TEXT FX</div>
      <div class="toggle-grid"><label><input data-fx="textPlate" type="checkbox"> Backplate behind each text</label></div>
      <div class="control-grid two">
        <label>Plate opacity <span data-out="textPlateOpacity">38%</span><input class="range" data-fx="textPlateOpacity" type="range" min="0" max="90" value="38"></label>
        <label>Plate padding <span data-out="textPlatePadding">18</span><input class="range" data-fx="textPlatePadding" type="range" min="4" max="60" value="18"></label>
        <label>Text glow <span data-out="textGlow">0%</span><input class="range" data-fx="textGlow" type="range" min="0" max="100" value="0"></label>
      </div>
      <div class="fx27-color-row"><input data-fx="textPlateColor" type="color" value="#111111"><input class="fx27-hex" data-fx-hex="textPlateColor" maxlength="6" value="111111" spellcheck="false"><button class="button mini" type="button" data-copy-hex="textPlateColor">⧉</button></div>
    </div>

    <div class="card fx27-card">
      <div class="section-label">WAVEFORM FX</div>
      <div class="control-grid two">
        <label>Under glow <span data-out="waveUnderGlow">0%</span><input class="range" data-fx="waveUnderGlow" type="range" min="0" max="100" value="0"></label>
        <label>Reactive halo <span data-out="waveHalo">0%</span><input class="range" data-fx="waveHalo" type="range" min="0" max="100" value="0"></label>
        <label>Echo stroke <span data-out="waveEcho">0%</span><input class="range" data-fx="waveEcho" type="range" min="0" max="100" value="0"></label>
      </div>
      <p class="hint">Wave glow and echo are drawn in the same waveform pass, so they follow the waveform instead of looking like a screen overlay.</p>
    </div>`;
  const presetPanel=inspector.querySelector('[data-panel="presets"]');inspector.insertBefore(panel,presetPanel||null);

  const st=document.createElement('style');st.id='fx27-style';st.textContent=`
    .fx27-card{margin-bottom:10px}.fx27-card>label{display:grid;gap:5px;font-size:10px;color:#aaa;margin:8px 0}.fx27-presets{display:flex;gap:6px}.fx27-presets .button{height:31px;padding:0 12px}.fx27-color-row{display:grid;grid-template-columns:42px minmax(0,1fr) 38px;gap:6px;align-items:center;margin-top:8px}.fx27-color-row input[type=color]{width:42px;height:34px;padding:3px;border:1px solid #2a3034;border-radius:8px;background:#0a0f11}.fx27-hex{height:34px;border:1px solid #2a3034;border-radius:8px;background:#0a0f11;color:#ddd3c5;padding:0 10px;font:700 10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}.fx27-color-row .mini{height:34px;padding:0}
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
  else if(name==='remix')state={...DEFAULTS,sceneMotion:'zoom',beatFlash:6,lightLeak:14,particles:'dust',particleAmount:26,vignette:18,textPlate:true,textPlateOpacity:32,textPlatePadding:16,textGlow:14,waveUnderGlow:36,waveHalo:20,waveEcho:12};
  syncUI();fireToast(name==='remix'?'Remix Glow applied':'FX reset');
}

// Frame boundary: piggy-back on the editor's existing render loop. No second RAF loop.
const previousClearRect=ctx.clearRect.bind(ctx);
ctx.clearRect=function(...args){
  frameOpen=true;atmosphereDrawn=false;
  return previousClearRect(...args);
};

// Move only the uploaded background image. Text and waveform stay in their own scene coordinates.
const previousDrawImage=ctx.drawImage.bind(ctx);
ctx.drawImage=function(source,...args){
  if(state.sceneMotion!=='off'&&!drawingAtmosphere&&source instanceof HTMLImageElement&&args.length===4){
    let [dx,dy,dw,dh]=args;const t=clock();let scale=1,x=0,y=0;
    if(state.sceneMotion==='zoom')scale=1.004+(Math.sin(t*.34)*.5+.5)*.034;
    else if(state.sceneMotion==='drift'){scale=1.026;x=Math.sin(t*.22)*canvas.width*.012;y=Math.cos(t*.18)*canvas.height*.010}
    const nw=dw*scale,nh=dh*scale;
    return previousDrawImage(source,dx-(nw-dw)/2+x,dy-(nh-dh)/2+y,nw,nh);
  }
  return previousDrawImage(source,...args);
};

const particles=Array.from({length:96},(_,i)=>({
  x:Math.abs((Math.sin(i*91.17)*43758.5453)%1),
  y:Math.abs((Math.sin(i*47.73+2)*24634.6345)%1),
  s:.35+((i*37)%100)/100,
  v:.3+((i*53)%100)/100
}));
function drawParticles(t){
  if(state.particles==='off')return;
  const n=Math.min(particles.length,Math.round(state.particleAmount));
  ctx.save();ctx.globalCompositeOperation='screen';
  for(let i=0;i<n;i++){
    const p=particles[i],snow=state.particles==='snow';
    const xx=((p.x+(snow?.008:.0025)*t*p.v)%1)*canvas.width;
    const yy=((p.y+(snow?.022:.004)*t*p.v)%1)*canvas.height;
    const r=(snow?1.4+p.s*2.4:2+p.s*8)*(canvas.width/1920);
    ctx.globalAlpha=snow?.18+p.s*.32:.025+p.s*.065;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(xx,yy,r,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawLightLeak(t){
  if(state.lightLeak<=0)return;
  const w=canvas.width,h=canvas.height,p=(Math.sin(t*.31)+1)/2;
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=state.lightLeak/100*.24;
  const x=w*(.06+p*.88),g=ctx.createRadialGradient(x,h*.18,0,x,h*.18,w*.48);g.addColorStop(0,'rgba(255,125,70,.72)');g.addColorStop(.38,'rgba(255,62,35,.18)');g.addColorStop(1,'rgba(255,20,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.restore();
}
function drawBeatFlash(){
  if(state.beatFlash<=0)return;const b=beat();if(b<.03)return;
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=clamp(b*state.beatFlash/100*.22,0,.10);ctx.fillStyle='#ffe3b1';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
}
function drawVignette(){
  if(state.vignette<=0)return;const w=canvas.width,h=canvas.height;
  ctx.save();ctx.globalAlpha=state.vignette/100*.55;const g=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.22,w/2,h/2,Math.max(w,h)*.72);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.68,'rgba(0,0,0,.035)');g.addColorStop(1,'rgba(0,0,0,.88)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.restore();
}
function drawWaveHalos(){
  if(state.waveHalo<=0)return;
  const layers=window.__FW_MULTI_WAVE?.getLayers?.()||[];if(!layers.length)return;
  const b=beat(),ba=bass();ctx.save();ctx.globalCompositeOperation='screen';
  for(const wv of layers){
    if(wv.showWave===false||['bottom','top','dual','left','right','sides'].includes(wv.style))continue;
    const x=canvas.width*(Number.isFinite(+wv.x)?+wv.x:50)/100,y=canvas.height*(Number.isFinite(+wv.y)?+wv.y:50)/100;
    const base=Math.min(canvas.width,canvas.height)*(+wv.size||46)/100*.58,r=base*(1.22+b*.16),a=clamp(state.waveHalo/100*(.045+b*.065+ba*.025),0,.14);
    const color=wv.color||'#e5d3a6',alpha=Math.round(a*255).toString(16).padStart(2,'0');
    const g=ctx.createRadialGradient(x,y,base*.5,x,y,r);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.5,color+'00');g.addColorStop(.8,color+alpha);g.addColorStop(1,color+'00');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  ctx.restore();
}
function drawAtmosphereOnce(){
  if(!frameOpen||atmosphereDrawn||drawingAtmosphere)return;
  atmosphereDrawn=true;drawingAtmosphere=true;
  const t=clock();
  try{drawWaveHalos();drawParticles(t);drawLightLeak(t);drawBeatFlash();drawVignette()}finally{drawingAtmosphere=false}
}

// Wave paths are the first stroked content after the background in the current renderer.
const previousStroke=ctx.stroke.bind(ctx);
ctx.stroke=function(path){
  if(!drawingAtmosphere)drawAtmosphereOnce();
  if(state.waveUnderGlow>0&&!drawingAtmosphere){
    ctx.save();ctx.globalAlpha*=clamp(state.waveUnderGlow/210,0,.42);ctx.lineWidth=Math.max(ctx.lineWidth*2.25,3);ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=(6+state.waveUnderGlow*.42)*(canvas.width/1920);path?previousStroke(path):previousStroke();ctx.restore();
  }
  if(state.waveEcho>0&&!drawingAtmosphere){
    ctx.save();ctx.globalAlpha*=clamp(state.waveEcho/340,0,.24);ctx.lineWidth=Math.max(ctx.lineWidth*(1.12+state.waveEcho/220),1.5);path?previousStroke(path):previousStroke();ctx.restore();
  }
  return path?previousStroke(path):previousStroke();
};

// Orbit/dot waveforms use arcs instead of strokes; place atmosphere before their first dot.
const previousArc=ctx.arc.bind(ctx);
ctx.arc=function(...args){if(!drawingAtmosphere)drawAtmosphereOnce();return previousArc(...args)};

// Text FX stay attached to each text draw call.
const previousFillText=ctx.fillText.bind(ctx);
ctx.fillText=function(text,x,y,maxWidth){
  drawAtmosphereOnce();
  const fontSize=parseFloat((ctx.font.match(/([\d.]+)px/)||[])[1]||'28');
  if(state.textPlate){
    const m=ctx.measureText(String(text)),pad=state.textPlatePadding*(canvas.width/1920),py=pad*.58;
    let left;if(ctx.textAlign==='left'||ctx.textAlign==='start')left=x-pad;else if(ctx.textAlign==='right'||ctx.textAlign==='end')left=x-m.width-pad;else left=x-m.width/2-pad;
    const top=y-fontSize*.68-py,w=m.width+pad*2,h=fontSize*1.36+py*2,r=Math.min(22*(canvas.width/1920),h*.25);
    ctx.save();ctx.globalAlpha=clamp(state.textPlateOpacity/100,0,.9);ctx.fillStyle=state.textPlateColor;ctx.shadowBlur=0;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(left,top,w,h,r);else ctx.rect(left,top,w,h);ctx.fill();ctx.restore();
  }
  if(state.textGlow>0){
    ctx.save();ctx.globalAlpha*=clamp(.12+state.textGlow/220,0,.58);ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=(6+state.textGlow*.34)*(canvas.width/1920);previousFillText(text,x,y,maxWidth);ctx.restore();
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