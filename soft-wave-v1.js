(()=>{
'use strict';
const canvas=document.getElementById('canvas'),pipeline=window.__FW_RENDER_PIPELINE,api=window.__FW_MULTI_WAVE,C=window.__FW_WAVE_CONFIG;
if(!canvas||!pipeline||!api||!C)return;
const ctx=canvas.getContext('2d'),clamp=window.__FW_UTILS?.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const SOFT=C.SOFT||new Set(['softBars','mirrorBars','roundedBars','centerBars']);
const smoothState=new Map(),levelState=new Map();
const isSoft=w=>!!w&&SOFT.has(w.style);
function rgba(hex,a){const s=String(hex||'#ffffff').replace('#',''),n=parseInt(s,16)||0xffffff;return`rgba(${n>>16},${n>>8&255},${n&255},${clamp(a,0,1)})`}
function spectrum(q,r){
  const bins=r?.bins;
  if(bins?.length){
    const max=Math.min(bins.length-1,430),u=Math.pow(clamp(q,0,1),1.32),center=Math.round(2+u*(max-2)),rad=4;
    let sum=0,weight=0;
    for(let d=-rad;d<=rad;d++){const i=clamp(center+d,0,bins.length-1),ww=rad+1-Math.abs(d);sum+=bins[i]*ww;weight+=ww}
    return weight?sum/weight/255:0;
  }
  const bass=r?.bass||0,mid=r?.mid||0,treble=r?.treble||0;
  return clamp(bass*Math.pow(1-q,.82)+mid*Math.sin(Math.PI*q)*.80+treble*Math.pow(q,.72)*.62,0,1.3)
}
function barSource(style,q,r){
  if(style==='mirrorBars'||style==='centerBars'){
    const mirrored=Math.abs(q-.5)*2;
    return spectrum(mirrored,r)
  }
  return spectrum(q,r)
}
function roundRect(x,y,w,h,r){r=Math.max(0,Math.min(r,Math.abs(w)/2,Math.abs(h)/2));ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function adaptiveLevel(w,rawAvg){
  const prev=levelState.get(w.id)??Math.max(.12,rawAvg),next=prev+(rawAvg-prev)*(rawAvg>prev?.10:.018);
  levelState.set(w.id,next);
  return clamp(next,.07,.72)
}
function heightsFor(w,r,count){
  let arr=smoothState.get(w.id);if(!arr||arr.length!==count){arr=Array(count).fill(.10);smoothState.set(w.id,arr)}
  const raw=new Array(count);let avg=0;
  for(let i=0;i<count;i++){const q=count<=1?.5:i/(count-1),v=barSource(w.style,q,r);raw[i]=v;avg+=v}
  avg/=Math.max(1,count);
  const level=adaptiveLevel(w,avg),gain=clamp(.34/level,.78,3.25);
  const smoothing=clamp((w.smoothing||0)/95,0,1),attack=.34-smoothing*.19,release=.16-smoothing*.095;
  const reaction=clamp((w.reaction||0)/100,0,4),beatPunch=clamp((w.beatPunch||0)/100,0,3),beat=clamp(r?.beat||0,0,1.8);
  const global=(r?.bass||0)*.42+(r?.mid||0)*.38+(r?.treble||0)*.20;
  const pulse=clamp(beat*(.045+beatPunch*.19)+global*.08*reaction,0,.38);
  for(let i=0;i<count;i++){
    const q=count<=1?.5:i/(count-1),src=clamp(raw[i]*gain,0,1.35);
    const localShape=.88+.12*Math.sin((i+1)*1.71+(r?.time||0)*.72);
    const musical=Math.pow(src,.78)*(.34+reaction*.62)*localShape;
    const focus=w.style==='mirrorBars'||w.style==='centerBars'?.92+Math.cos((q-.5)*Math.PI)*.08:1;
    const target=clamp(.055+musical*focus+pulse,0,1.16),a=target>arr[i]?attack:release;
    arr[i]+=(target-arr[i])*a;
  }
  return arr
}
function softBounds(w){
  const W=canvas.width,H=canvas.height,cx=W*(w.x||50)/100,cy=H*(w.y||50)/100,width=W*(w.size||54)/100,maxH=H*(.026+clamp((w.toothDepth||60)/220,0,1)*.145);
  return{x:cx-width/2,y:cy-maxH*.72,w:width,h:maxH*1.44,cx,cy,maxH}
}
function drawLayer(w,r){
  if(!w.showWave||!isSoft(w))return;
  const b=softBounds(w),count=clamp(Math.round((w.detail||128)/4),12,64),vals=heightsFor(w,r,count),step=b.w/count,barW=clamp((w.thickness||3)*1.8,2,Math.max(2,step*.72));
  const rounded=w.style==='roundedBars'?1:w.style==='centerBars'?.78:w.style==='mirrorBars'?.48:Math.max(.10,1-(w.sharpness||50)/100),maxH=b.maxH,minH=canvas.height*.0045;
  ctx.save();ctx.fillStyle=rgba(w.color,(w.opacity??80)/100);if(w.showGlow&&w.glow){ctx.shadowColor=rgba(w.color,.72);ctx.shadowBlur=(w.glow||0)*.18}
  for(let i=0;i<count;i++){
    const v=vals[i],h=minH+v*(maxH-minH),x=b.x+i*step+(step-barW)/2;let y,height;
    if(w.style==='softBars'){height=h;y=b.cy+maxH*.46-height}
    else{height=h;y=b.cy-height/2}
    const radius=barW*.5*rounded;roundRect(x,y,barW,height,radius);ctx.fill()
  }
  ctx.restore()
}
function draw(frame){const r=frame?.energy||{bass:0,mid:0,treble:0,beat:0,time:performance.now()/1000};api.getLayers?.().forEach(w=>drawLayer(w,r))}
pipeline.register('wave','soft-wave-v1',draw,8);

let drag=null;
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*canvas.width,y:(e.clientY-r.top)/r.height*canvas.height}}
function activeTool(){return document.querySelector('.tool.active')?.dataset.tool||''}
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||activeTool()!=='waveform')return;const p=point(e),layers=api.getLayers?.()||[];
  for(let i=layers.length-1;i>=0;i--){const w=layers[i];if(!isSoft(w)||!w.showWave)continue;const b=softBounds(w);if(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h){api.selectLayer?.(i);drag={i,sx:e.clientX,sy:e.clientY,x:w.x||50,y:w.y||50};canvas.setPointerCapture?.(e.pointerId);e.preventDefault();e.stopImmediatePropagation();break}}
},true);
canvas.addEventListener('pointermove',e=>{if(!drag)return;const r=canvas.getBoundingClientRect(),x=drag.x+(e.clientX-drag.sx)/r.width*100,y=drag.y+(e.clientY-drag.sy)/r.height*100;api.setPosition?.(drag.i,x,y);e.preventDefault();e.stopImmediatePropagation()},true);
const end=e=>{if(!drag)return;drag=null;e?.stopImmediatePropagation?.()};canvas.addEventListener('pointerup',end,true);canvas.addEventListener('pointercancel',end,true);

function syncUI(){
  const w=api.getActiveLayer?.()||api.getLayers?.()?.[api.getActiveIndex?.()||0],soft=isSoft(w),shape=document.getElementById('waveShape'),maxSize=document.getElementById('waveMaxSize'),hint=document.getElementById('waveMoveHint');
  if(soft){if(shape)shape.disabled=true;if(maxSize)maxSize.disabled=true;if(hint)hint.textContent='Soft soundwave reacts to the live spectrum. Reaction = movement · Beat punch = pulse · Detail = bar count · Tooth depth = max height · Smoothing = calmness.'}
  else{if(maxSize)maxSize.disabled=false;if(shape)shape.disabled=C.EDGE?.has(w?.style);if(hint)hint.textContent=C.EDGE?.has(w?.style)?'This edge waveform is locked to the canvas edge.':'Select or drag this waveform directly in the preview.'}
}
document.addEventListener('fw:wave-selection-change',syncUI);document.addEventListener('fw:wave-setting-change',syncUI);document.addEventListener('change',e=>{if(e.target?.id==='waveStyle')queueMicrotask(syncUI)},true);syncUI();
window.__FW_SOFT_WAVE={styles:[...SOFT]};
})();
