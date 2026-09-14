(()=>{
'use strict';

const api=window.__FW_MULTI_WAVE;
const pipeline=window.__FW_RENDER_PIPELINE;
const C=window.__FW_WAVE_CONFIG;
if(!api||!pipeline||!C)return;
const U=window.__FW_UTILS||{};
const clamp=U.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const normalizeHex=U.normalizeHex||(v=>String(v||'').replace(/^#/,'').toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,6));
const toast=window.__FW_TOAST||(()=>{});
const {DEFAULT_PLATE,EDGE}=C;
const el=id=>document.getElementById(id);
let ui=null;

function activeInfo(){const layers=api.getLayers(),index=api.getActiveIndex(),layer=layers[index];return layer?{layers,index,layer}:null}
function current(){return activeInfo()?.layer?.plate||{...DEFAULT_PLATE}}
function patch(value){const info=activeInfo();if(!info)return false;return api.updatePlate(info.index,value)}
function syncLabels(){if(!ui)return;el('centerPlateSizeValue').textContent=ui.size.value+'%';el('centerPlateOpacityValue').textContent=ui.opacity.value+'%';el('centerPlateSoftnessValue').textContent=ui.softness.value+'px';el('centerPlateShadowValue').textContent=ui.shadow.value+'px'}
function syncToneState(){if(!ui)return;const custom=ui.tone.value==='custom';ui.color.disabled=!custom;ui.hex.disabled=!custom;ui.color.style.opacity=custom?'1':'.5';ui.hex.style.opacity=custom?'1':'.5'}
function syncHex(){if(!ui)return;ui.hex.value=normalizeHex(ui.color.value)||'17191C'}
function syncUI(){
  if(!ui)return;const c=current();ui.enabled.checked=!!c.enabled;ui.shape.value=c.shape;ui.tone.value=c.tone;ui.size.value=c.size;ui.opacity.value=c.opacity;ui.softness.value=c.softness;ui.shadow.value=c.shadow;ui.color.value=c.color;syncHex();syncLabels();syncToneState();
}
function applyHex(){const clean=String(ui.hex.value||'').replace(/^#/,'').toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,6);ui.hex.value=clean;if(clean.length!==6)return false;ui.color.value='#'+clean;patch({color:'#'+clean});return true}
function mountUI(){
  const card=el('waveStyle')?.closest('.card'),colorRow=card?.querySelector('.color-row');if(!card||!colorRow)return false;
  if(!el('centerPlateEnabled')){
    const block=document.createElement('div');block.className='center-plate-block';block.innerHTML=`
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
  }
  ui={enabled:el('centerPlateEnabled'),shape:el('centerPlateShape'),tone:el('centerPlateTone'),size:el('centerPlateSize'),opacity:el('centerPlateOpacity'),softness:el('centerPlateSoftness'),shadow:el('centerPlateShadow'),color:el('centerPlateColor'),hex:el('centerPlateHex'),useWave:el('centerPlateUseWaveColor')};
  ui.enabled.addEventListener('change',()=>patch({enabled:ui.enabled.checked}));ui.shape.addEventListener('change',()=>patch({shape:ui.shape.value}));ui.tone.addEventListener('change',()=>{patch({tone:ui.tone.value});syncToneState()});ui.size.addEventListener('input',()=>{patch({size:+ui.size.value});syncLabels()});ui.opacity.addEventListener('input',()=>{patch({opacity:+ui.opacity.value});syncLabels()});ui.softness.addEventListener('input',()=>{patch({softness:+ui.softness.value});syncLabels()});ui.shadow.addEventListener('input',()=>{patch({shadow:+ui.shadow.value});syncLabels()});ui.color.addEventListener('input',()=>{syncHex();patch({color:ui.color.value})});ui.hex.addEventListener('input',()=>{const clean=String(ui.hex.value||'').toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,6);ui.hex.value=clean;if(clean.length===6)applyHex()});ui.hex.addEventListener('blur',()=>{if(!applyHex())syncHex()});ui.hex.addEventListener('focus',()=>setTimeout(()=>ui.hex.select(),0));ui.useWave.addEventListener('click',()=>{const info=activeInfo();if(!info)return;patch({color:info.layer.color,tone:'custom'});syncUI();toast('Center Plate matched to wave color')});syncUI();return true;
}

function rgb(hex){const s=(normalizeHex(hex)||'17191C');return[parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)]}
function rgba(hex,a){const c=rgb(hex);return`rgba(${c[0]},${c[1]},${c[2]},${clamp(a,0,1)})`}
function mix(a,b,t){return a.map((v,i)=>Math.round(v+(b[i]-v)*t))}
function toHex(c){return'#'+c.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('')}
function sampleRgb(ctx,cx,cy,rad){const pts=[[cx,cy],[cx-rad*.42,cy],[cx+rad*.42,cy],[cx,cy-rad*.32],[cx,cy+rad*.32]];let sum=[0,0,0],n=0;for(const [x,y] of pts){try{const d=ctx.getImageData(clamp(Math.round(x),0,ctx.canvas.width-1),clamp(Math.round(y),0,ctx.canvas.height-1),1,1).data;sum[0]+=d[0];sum[1]+=d[1];sum[2]+=d[2];n++}catch{}}return n?sum.map(v=>v/n):[90,90,90]}
function toneColor(cfg,ctx,cx,cy,rad){if(cfg.tone==='custom')return cfg.color;if(cfg.tone==='light')return'#f2eee5';if(cfg.tone==='dark')return'#17191c';return toHex(mix(sampleRgb(ctx,cx,cy,rad),[18,20,22],.74))}
function hashSeed(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0)/4294967295}
function roundedRectPath(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath()}
function polygonPath(ctx,cx,cy,rad,n,rot=-Math.PI/2){ctx.beginPath();for(let i=0;i<n;i++){const a=rot+i*Math.PI*2/n,x=cx+Math.cos(a)*rad,y=cy+Math.sin(a)*rad;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()}
function starPath(ctx,cx,cy,rad){ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2===0?rad:rad*.5,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()}
function platePath(ctx,shape,layer,cx,cy,rad,seed){
  if(shape==='circle'){ctx.beginPath();ctx.ellipse(cx,cy,rad,rad*.94,0,0,Math.PI*2);ctx.closePath();return}if(shape==='rounded'){roundedRectPath(ctx,cx-rad*1.12,cy-rad*.78,rad*2.24,rad*1.56,rad*.28);return}if(shape==='diamond'){polygonPath(ctx,cx,cy,rad*1.02,4,0);return}
  if(shape==='follow'){const s=layer.shape||'circle';if(s==='triangle')return polygonPath(ctx,cx,cy,rad,3);if(s==='square')return roundedRectPath(ctx,cx-rad*.82,cy-rad*.82,rad*1.64,rad*1.64,rad*.08);if(s==='diamond')return polygonPath(ctx,cx,cy,rad,4,0);if(s==='pentagon')return polygonPath(ctx,cx,cy,rad,5);if(s==='hexagon')return polygonPath(ctx,cx,cy,rad,6);if(s==='octagon')return polygonPath(ctx,cx,cy,rad,8);if(s==='star')return starPath(ctx,cx,cy,rad);if(s==='lotus'){ctx.beginPath();for(let i=0;i<=72;i++){const a=i/72*Math.PI*2-Math.PI/2,rr=rad*(.79+.21*Math.abs(Math.sin(a*4))),x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();return}if(s!=='blob'){ctx.beginPath();ctx.arc(cx,cy,rad,0,Math.PI*2);ctx.closePath();return}}
  const p1=seed*Math.PI*2,p2=(seed*.73+.17)*Math.PI*2,p3=(seed*.41+.39)*Math.PI*2,N=80;ctx.beginPath();for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,rr=1+.055*Math.sin(a*3+p1)+.035*Math.sin(a*5+p2)+.02*Math.sin(a*8+p3),x=cx+Math.cos(a)*rad*1.08*rr,y=cy+Math.sin(a)*rad*.92*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();
}
function drawPlate(frame,layer){
  const cfg=layer.plate;if(layer.showWave===false||!cfg?.enabled)return;const {ctx,canvas}=frame,W=canvas.width,H=canvas.height,m=Math.min(W,H),edge=EDGE.has(layer.style),cx=edge?W*.5:W*clamp(+layer.x||50,0,100)/100,cy=edge?H*.5:H*clamp(+layer.y||50,0,100)/100,waveRad=m*clamp(+layer.size||46,12,85)/100*.5,base=edge?m*.27:waveRad,rad=base*clamp(cfg.size,55,105)/100,color=toneColor(cfg,ctx,cx,cy,rad),alpha=clamp(cfg.opacity/100,.05,1),seed=hashSeed(layer.id);
  ctx.save();if(cfg.softness>0){ctx.save();ctx.filter=`blur(${cfg.softness}px)`;ctx.fillStyle=rgba(color,alpha*.30);platePath(ctx,cfg.shape,layer,cx,cy,rad*1.015,seed);ctx.fill();ctx.restore()}ctx.fillStyle=rgba(color,alpha);ctx.shadowColor='rgba(0,0,0,.36)';ctx.shadowBlur=cfg.shadow;ctx.shadowOffsetY=Math.min(6,cfg.shadow*.16);platePath(ctx,cfg.shape,layer,cx,cy,rad,seed);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle=color==='#f2eee5'?'rgba(20,20,20,.14)':'rgba(255,255,255,.08)';ctx.lineWidth=Math.max(1,m*.0012);ctx.stroke();ctx.restore();
}
function drawPlates(frame){api.getLayers().forEach(layer=>drawPlate(frame,layer))}
pipeline.register('plate','center-plate',drawPlates,0);

mountUI();
document.addEventListener('fw:wave-selection-change',syncUI);document.addEventListener('fw:plate-change',syncUI);document.addEventListener('fw:project-reset',()=>requestAnimationFrame(syncUI));

window.__FW_CENTER_PLATE={defaults:{...DEFAULT_PLATE},getConfig:()=>({...current()}),setConfig:(value={})=>{const info=activeInfo();if(!info)return false;api.updatePlate(info.index,value);syncUI();return true},getAllConfigs:()=>api.getLayers().map(w=>({...w.plate})),setAllConfigs:(values=[])=>{api.getLayers().forEach((_,i)=>api.updatePlate(i,values[i]||{}));syncUI();return true},reset:()=>{api.getLayers().forEach((_,i)=>api.updatePlate(i,{...DEFAULT_PLATE}));syncUI()}};
})();
