/* Bold, NCS-inspired circular waveform renderer.
   Isolated from the original wave engine, which remains unchanged. */
(()=>{
'use strict';
const canvas=document.getElementById('canvas');
const pipeline=window.__FW_RENDER_PIPELINE;
const waves=window.__FW_MULTI_WAVE;
if(!canvas||!pipeline||!waves)return;
const ctx=canvas.getContext('2d');
const TAU=Math.PI*2;
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const smoothed=new Map();
const isNcs=style=>style==='ncsContour'||style==='ncsBars';

function color(hex,a=1){
  const n=parseInt(/^#[a-f0-9]{6}$/i.test(hex||'')?hex.slice(1):'ffffff',16);
  return 'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+clamp(a,0,1)+')';
}

function fftEnergy(r,q){
  const bins=r.bins;
  const u=2*Math.min(q,1-q); // symmetrical logarithmic sweep around the ring
  if(!bins||!bins.length){
    return clamp((r.bass||0)*(1-u)+(r.mid||0)*Math.sin(Math.PI*u)+(r.treble||0)*u,0,1);
  }
  const sampleRate=Number(r.sampleRate)||44100;
  const fftSize=bins.length*2;
  const hz=50*Math.pow(150,Math.pow(u,1.05)); // 50 Hz to 7.5 kHz
  const center=clamp(hz*fftSize/sampleRate,1,bins.length-2);
  const index=Math.floor(center);
  let sum=0,weight=0;
  for(let offset=-2;offset<=3;offset++){
    const bin=clamp(index+offset,0,bins.length-1);
    const w=Math.max(0,3-Math.abs(bin-center));
    sum+=bins[bin]*w;
    weight+=w;
  }
  return weight?clamp(sum/(weight*255),0,1):0;
}

function levels(w,r,n){
  let entry=smoothed.get(w.id);
  if(!entry||entry.values.length!==n){
    entry={values:new Float32Array(n),time:null};
    smoothed.set(w.id,entry);
  }
  const t=Number.isFinite(r.time)?r.time:0;
  if(entry.time!==null&&t<entry.time-.06)entry.values.fill(0);
  const dt=entry.time===null||t<=entry.time?1/30:clamp(t-entry.time,1/120,.15);
  entry.time=t;
  const calm=clamp((w.smoothing||0)/95,0,1);
  const attack=21-calm*13,release=12-calm*8;
  const gain=clamp((w.reaction||100)/100,0,4);
  const beat=clamp((r.beat||0)*((w.beatPunch||0)/100),0,3);
  const bass=clamp(r.bass||0,0,1.5);
  const output=entry.values;
  for(let i=0;i<n;i++){
    const q=i/n,raw=fftEnergy(r,q);
    const focus=Math.pow(raw,.83+clamp((w.sharpness||50)/100,0,1)*.32);
    const target=clamp(focus*gain*(.95+bass*.12)+beat*(.06+raw*.20),0,3.6);
    const previous=output[i];
    const response=target>previous?attack:release;
    output[i]=previous+(target-previous)*(1-Math.exp(-dt*response));
  }
  return output;
}

function strokeContrast(w,width){
  const opacity=clamp((w.opacity??100)/100,.05,1);
  const paint=color(w.color,opacity);
  ctx.lineJoin='round';
  ctx.lineCap='round';
  // A dark under-stroke makes bright colors readable even over snow / daylight.
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(4,9,18,0.90)';
  ctx.lineWidth=width+6;
  ctx.stroke();
  if(w.showGlow&&w.glow>0){
    ctx.save();
    ctx.strokeStyle=color(w.color,opacity*.42);
    ctx.lineWidth=width+4;
    ctx.shadowColor=color(w.color,.98);
    ctx.shadowBlur=clamp(w.glow*.85,2,95);
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle=paint;
  ctx.shadowBlur=0;
  ctx.lineWidth=width;
  ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.17)';
  ctx.lineWidth=Math.max(1,width*.24);
  ctx.stroke();
}

function drawWave(w,r){
  if(!w.showWave||!isNcs(w.style))return;
  const W=canvas.width,H=canvas.height;
  const cx=W*w.x/100,cy=H*w.y/100;
  const rad=Math.min(W,H)*w.size/200;
  const maxExpand=clamp((w.maxSize||76)/Math.max(1,w.size)-1,0,2);
  const n=clamp(Math.round(w.detail||160),48,256);
  const v=levels(w,r,n);
  const thickness=clamp(w.thickness||7,1,16);
  const depth=clamp((w.toothDepth||150)/150,0,1.47);
  const beat=clamp((r.beat||0)*((w.beatPunch||0)/100),0,3);
  const bass=clamp(r.bass||0,0,1.3);
  const base=rad*(1+Math.min(.023,bass*.008+beat*.005));
  ctx.save();
  // Persistent rim: circle stays readable between beats and during quiet intros.
  ctx.beginPath();
  ctx.arc(cx,cy,base,0,TAU);
  ctx.lineWidth=thickness+5;
  ctx.strokeStyle='rgba(0,5,15,0.78)';
  ctx.stroke();
  ctx.lineWidth=thickness*.9;
  ctx.strokeStyle=color(w.color,.88);
  ctx.shadowColor=color(w.color,.9);
  ctx.shadowBlur=w.showGlow?Math.min(30,(w.glow||0)*.55):0;
  ctx.stroke();
  ctx.shadowBlur=0;
  if(w.style==='ncsContour'){
    ctx.beginPath();
    for(let i=0;i<=n;i++){
      const q=(i%n)/n;
      const a=-Math.PI/2+(i/n)*TAU;
      const rise=clamp(.017+v[i%n]*.25*depth,0,maxExpand);
      const radius=base*(1+rise);
      const x=cx+Math.cos(a)*radius,y=cy+Math.sin(a)*radius;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.closePath();
    strokeContrast(w,thickness);
  }else{
    ctx.beginPath();
    const barWidth=Math.min(thickness,Math.max(1,(TAU*rad/n)*.75));
    for(let i=0;i<n;i++){
      const q=i/n,a=-Math.PI/2+q*TAU;
      const rise=clamp(.029+v[i]*.30*depth,0,maxExpand);
      const r2=base*(1+rise);
      const cs=Math.cos(a),sn=Math.sin(a);
      ctx.moveTo(cx+cs*base,cy+sn*base);
      ctx.lineTo(cx+cs*r2,cy+sn*r2);
    }
    strokeContrast(w,barWidth);
  }
  if(w.showSecondary){
    ctx.beginPath();
    ctx.arc(cx,cy,base*.92,0,TAU);
    ctx.strokeStyle=color(w.color,.55);
    ctx.lineWidth=Math.max(2,thickness*.52);
    ctx.shadowBlur=0;
    ctx.stroke();
  }
  ctx.restore();
}

pipeline.register('wave','ncs-bold-wave',frame=>{
  const config=window.__FW_AUDIO_REACTION?.getConfig?.();
  const enabled=!config||config.enabled!==false&&config.targets?.wave!==false;
  const energy=enabled?frame.energy||{}:{
    bass:0,mid:0,treble:0,beat:0,bins:null,time:frame.energy?.time||0
  };
  for(const layer of waves.getLayers())drawWave(layer,energy);
},10);
document.addEventListener('fw:project-reset',()=>smoothed.clear());
const setShapeControl=()=>{
  const active=waves.getActiveLayer?.();
  const select=document.getElementById('waveShape');
  if(!select||!active)return;
  if(isNcs(active.style)){
    select.disabled=true;
    const hint=document.getElementById('waveMoveHint');
    if(hint)hint.textContent='NCS circular spectrum: drag the ring to one side; place your track title using Free Text. Thickness, reaction, depth, glow and color are adjustable.';
  }else{
    select.disabled=!!window.__FW_WAVE_CONFIG?.EDGE?.has(active.style)||!!window.__FW_WAVE_CONFIG?.SOFT?.has(active.style);
  }
};
document.addEventListener('fw:wave-selection-change',()=>queueMicrotask(setShapeControl));
document.addEventListener('fw:wave-setting-change',()=>queueMicrotask(setShapeControl));
document.addEventListener('change',e=>{
  if(e.target?.id==='waveStyle')queueMicrotask(setShapeControl);
},true);
setShapeControl();
window.__FW_NCS_WAVE={fftEnergy};
})();