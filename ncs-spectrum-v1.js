/* FreeWaveform NCS-inspired frequency spectrum renderer.
   Uses actual FFT bins (not a decorative sine wave); deterministic for HQ frame export. */
(()=>{
'use strict';
const canvas=document.getElementById('canvas'),pipe=window.__FW_RENDER_PIPELINE,api=()=>window.__FW_MULTI_WAVE;
if(!canvas||!pipe)return;
const ctx=canvas.getContext('2d'),TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const rgba=(hex,a)=>{const h=/^#[\da-f]{6}$/i.test(hex||'')?hex:'#ffffff',n=parseInt(h.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${clamp(a,0,1)})`};
const state=new Map();
function sampleFFT(r,q){
  const bins=r?.bins;
  if(!bins?.length)return clamp((r.bass||0)*(1-q)+(r.mid||0)*Math.sin(Math.PI*q)+(r.treble||0)*q,0,1);
  // Symmetric frequency sweep on both half-circles. Log frequency allocation gives bass adequate space.
  const mirrored=q<=.5?q*2:2-q*2;
  const hz=44*Math.pow(170,mirrored);
  const binSize=(44100/2048); // normalized bin mapping, adjusted for live audio sample rate below
  const rate=Number(r.sampleRate)||44100;
  const center=clamp(hz/(rate/2048),1,bins.length-2),lo=Math.floor(center),fraction=center-lo;
  let v=0,weight=0;
  for(let d=-2;d<=2;d++){
    const index=clamp(lo+d,0,bins.length-1),w=3-Math.abs(d-fraction);
    if(w>0){v+=bins[index]*w;weight+=w}
  }
  return weight?clamp(v/(weight*255),0,1):0;
}
function signal(w,r,count){
  let holder=state.get(w.id);
  if(!holder||holder.values.length!==count){holder={values:new Float32Array(count),time:-1};state.set(w.id,holder)}
  const time=Number(r.time)||0,dt=holder.time<0||time<holder.time?1/30:Math.min(.16,Math.max(1/120,time-holder.time));
  holder.time=time;
  const smooth=clamp((w.smoothing||0)/95,0,1),attack=lerp(20,7,smooth),release=lerp(12,3,smooth);
  const punch=clamp((r.beat||0)*((w.beatPunch||0)/100),0,2.6);
  const body=clamp((r.bass||0)*.6+(r.mid||0)*.28+(r.treble||0)*.12,0,1.4);
  const gain=clamp((w.reaction||100)/100,0,4);
  const teeth=new Float32Array(count);
  for(let i=0;i<count;i++){
    const q=i/count,source=sampleFFT(r,q),shade=Math.pow(source,lerp(.83,1.52,(w.sharpness||50)/100));
    const musical=clamp((shade*.87+source*.18+body*.07)*gain,0,2.8);
    const accent=clamp(punch*(.08+source*.35),0,.74);
    const target=clamp(musical+accent,0,3);
    const current=holder.values[i];
    const speed=target>current?attack:release;
    teeth[i]=holder.values[i]=current+(target-current)*(1-Math.exp(-dt*speed));
  }
  return teeth;
}
function draw(w,r){
  if(!w.showWave||(w.style!=='ncsClassic'&&w.style!=='ncsBars'))return;
  const cx=canvas.width*(w.x||50)/100,cy=canvas.height*(w.y||50)/100;
  const radius=Math.min(canvas.width,canvas.height)*(w.size||46)/200;
  const limit=Math.min(3,Math.max(1,(w.maxSize||76)/Math.max(1,w.size||46)));
  const count=clamp(Math.round(w.detail||160),48,256),a=signal(w,r,count);
  const depth=clamp((w.toothDepth||120)/150,.12,1.5);
  const stroke=clamp(w.thickness||3,1,16),alpha=clamp((w.opacity||95)/100,0,1);
  const baseRadius=radius*(1+Math.min(.015,(r.bass||0)*.012));
  ctx.save();ctx.lineCap=w.style==='ncsBars'?'round':'round';ctx.lineJoin='round';
  ctx.strokeStyle=rgba(w.color,alpha);
  ctx.lineWidth=stroke;
  if(w.showGlow&&w.glow){ctx.shadowColor=rgba(w.color,.88);ctx.shadowBlur=(w.glow||0)*.46}
  // Stable center rim, allowing logo/center artwork to remain readable.
  ctx.beginPath();ctx.arc(cx,cy,baseRadius,0,TAU);ctx.globalAlpha=.5*alpha;ctx.stroke();ctx.globalAlpha=1;
  if(w.style==='ncsClassic'){
    ctx.beginPath();
    for(let i=0;i<=count;i++){
      const k=i%count,angle=-Math.PI/2+(i/count)*TAU;
      const extension=Math.min(limit-1,a[k]*.21*depth);
      const rr=baseRadius*(1+Math.max(0,extension));
      const x=cx+Math.cos(angle)*rr,y=cy+Math.sin(angle)*rr;
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.closePath();ctx.stroke();
  }else{
    ctx.beginPath();
    for(let i=0;i<count;i++){
      const angle=-Math.PI/2+(i/count)*TAU;
      const length=Math.min(limit-1,.012+a[i]*.29*depth)*baseRadius;
      const nx=Math.cos(angle),ny=Math.sin(angle);
      ctx.moveTo(cx+nx*baseRadius,cy+ny*baseRadius);
      ctx.lineTo(cx+nx*(baseRadius+length),cy+ny*(baseRadius+length));
    }
    ctx.stroke();
  }
  if(w.showSecondary){
    ctx.globalAlpha=.28;
    ctx.shadowBlur=0;ctx.lineWidth=Math.max(1,stroke*.6);
    ctx.beginPath();ctx.arc(cx,cy,baseRadius*.93,0,TAU);ctx.stroke();
  }
  ctx.restore();
}
pipe.register('wave','ncs-frequency-spectrum',frame=>{
  const energy=frame?.energy||{time:0,bass:0,mid:0,treble:0,beat:0};
  api()?.getLayers?.().forEach(w=>draw(w,energy));
},5);
document.addEventListener('fw:project-reset',()=>state.clear());
window.__FW_NCS_SPECTRUM={sampleFFT};
})();