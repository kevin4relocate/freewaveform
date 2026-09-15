(()=>{
'use strict';
const U=window.__FW_UTILS||{};
const clamp=U.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const lerp=U.lerp||((a,b,t)=>a+(b-a)*t);
const frac=v=>v-Math.floor(v);

function poly(shape){
  let n=0,rot=-Math.PI/2;
  if(shape==='triangle')n=3;
  if(shape==='square')n=4;
  if(shape==='diamond'){n=4;rot=0}
  if(shape==='pentagon')n=5;
  if(shape==='hexagon')n=6;
  if(shape==='octagon')n=8;
  if(!n)return null;
  return Array.from({length:n},(_,i)=>({x:Math.cos(rot+i*Math.PI*2/n),y:Math.sin(rot+i*Math.PI*2/n)}));
}
function shapePoint(shape,t,r){
  const a=t*Math.PI*2-Math.PI/2;
  if(shape==='circle')return{x:Math.cos(a)*r,y:Math.sin(a)*r};
  if(shape==='lotus'){const rr=r*(.8+.2*Math.abs(Math.sin(a*4)));return{x:Math.cos(a)*rr,y:Math.sin(a)*rr}}
  if(shape==='blob'){const rr=r*(.9+.055*Math.sin(a*3+1.1)+.045*Math.sin(a*7+2.7)+.025*Math.sin(a*13));return{x:Math.cos(a)*rr,y:Math.sin(a)*rr}}
  if(shape==='star'){
    const count=10,u=(t*count)%1,i=Math.floor(t*count),aa=-Math.PI/2+i*Math.PI*2/count,ab=-Math.PI/2+(i+1)*Math.PI*2/count,ra=i%2===0?r:r*.48,rb=(i+1)%2===0?r:r*.48;
    return{x:lerp(Math.cos(aa)*ra,Math.cos(ab)*rb,u),y:lerp(Math.sin(aa)*ra,Math.sin(ab)*rb,u)};
  }
  const v=poly(shape)||poly('hexagon'),n=v.length,pos=t*n,i=Math.floor(pos)%n,u=pos-i,p=v[i],q=v[(i+1)%n];
  return{x:lerp(p.x,q.x,u)*r,y:lerp(p.y,q.y,u)*r};
}

/* Map real FFT data around the perimeter in four overlapping musical zones.
   The zone orientation drifts slowly, so bass/mid/high accents can push the
   top, bottom or either side instead of making the whole ring breathe evenly. */
function spectralPosition(q,r){
  const phase=frac(.11+(r?.time||0)*.032+((r?.bass||0)-(r?.treble||0))*.055);
  return frac(q+phase);
}
function spectrumSample(q,r){
  const bins=r?.bins;
  if(!bins?.length)return null;
  const u=spectralPosition(q,r),sector=Math.min(3,Math.floor(u*4)),local=frac(u*4);
  const ranges=[[2,34],[18,92],[58,205],[165,430]],range=ranges[sector];
  const shaped=Math.pow(local,sector===0?1.45:sector===3?.72:1.0);
  const center=clamp(Math.round(range[0]+(range[1]-range[0])*shaped),2,bins.length-1);
  const radius=sector===0?2:sector===1?3:4;
  let sum=0,weight=0;
  for(let d=-radius;d<=radius;d++){
    const i=clamp(center+d,0,bins.length-1),w=radius+1-Math.abs(d);sum+=bins[i]*w;weight+=w;
  }
  return weight?sum/weight/255:0;
}
function broadBand(q,r){
  const u=spectralPosition(q,r),sector=Math.min(3,Math.floor(u*4));
  if(sector===0)return r.bass||0;
  if(sector===1)return(r.bass||0)*.42+(r.mid||0)*.58;
  if(sector===2)return r.mid||0;
  return(r.mid||0)*.28+(r.treble||0)*.72;
}
function sectionDrive(r){
  const loud=(r.bass||0)*.50+(r.mid||0)*.34+(r.treble||0)*.16;
  const body=Math.pow(clamp((loud-.055)/.44,0,1.35),1.22);
  return clamp(.34+body*1.12+(r.flux||0)*.10,.32,1.75);
}
function localDrive(q,r){
  const spec=spectrumSample(q,r),band=broadBand(q,r),source=spec==null?band:spec;
  const contrast=Math.max(0,source-band*.30),section=sectionDrive(r);
  return clamp((Math.pow(clamp(source*1.34,0,1.7),1.30)*.90+band*.28+contrast*.34)*section,0,2.75);
}
function pseudoBin(q,r,w){
  const local=localDrive(q,r),micro=.58+.42*Math.abs(Math.sin(q*(25+w.detail*.135)+(r.time||0)*(1.8+(r.treble||0)*2.6)));
  const transient=(r.flux||0)*(.045+.08*local);
  return clamp(local*micro+transient,0,2.8);
}
function punch(r,w){return clamp((r.beat||0)*(w.beatPunch/100),0,3)}
function localPunch(q,r,w){
  const p=punch(r,w),spec=spectrumSample(q,r),band=broadBand(q,r),focus=spec==null?band:Math.max(spec,band*.65);
  return p*clamp(.035+Math.pow(clamp(focus*1.3,0,1.4),1.5)*.68+band*.18,.035,.95);
}
function ringScale(w,r,t,i=0,rough=0){
  const dep=w.toothDepth/100,b=Math.pow(pseudoBin(t,r,w),lerp(.72,2.05,w.sharpness/100)),p=localPunch(t,r,w),tri=1-Math.abs(((t*w.detail)%1)*2-1),tooth=(Math.pow(clamp(tri,0,1),lerp(.7,5.4,w.sharpness/100))-.28)*dep*.06;
  const reactive=clamp(b*(w.reaction/100)*1.08+p,0,4.6),reach=.064+clamp(dep,0,2.2)*.058;
  return 1+reactive*reach+tooth+(rough?Math.sin(i*2.31)*rough*.01:0);
}
function beginRingPath(ctx,w,r,cx,cy,rad,rough=0){
  const N=Math.max(160,Math.round(w.detail*2.5));ctx.beginPath();
  for(let i=0;i<=N;i++){const t=(i%N)/N,sp=shapePoint(w.shape,t,rad),m=ringScale(w,r,t,i,rough),x=cx+sp.x*m,y=cy+sp.y*m;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
  ctx.closePath();return ctx;
}
function radialExtension(w,r,t){
  const depth=w.toothDepth/100,b=pseudoBin(t,r,w),p=localPunch(t,r,w);
  return clamp(b*(.105+depth*.17)*(w.reaction/100)+p*(.07+depth*.075),0,1.25);
}
function beginRadialEnvelopePath(ctx,w,r,cx,cy,rad){
  const N=clamp(Math.round(w.detail),24,256);ctx.beginPath();
  for(let i=0;i<=N;i++){const t=(i%N)/N,sp=shapePoint(w.shape,t,rad),len=rad*(.018+radialExtension(w,r,t)),mag=Math.hypot(sp.x,sp.y)||1,x=cx+sp.x+sp.x/mag*len,y=cy+sp.y+sp.y/mag*len;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
  ctx.closePath();return ctx;
}
function beginFillPath(ctx,w,r,cx,cy,rad){return w.style==='brushRing'||w.style==='smoothRing'?beginRingPath(ctx,w,r,cx,cy,rad,w.style==='brushRing'?1.25:0):beginRadialEnvelopePath(ctx,w,r,cx,cy,rad)}
function imagePulseScale(w,r){
  const N=24,depth=w.toothDepth/100;let total=0;
  for(let i=0;i<N;i++){const q=(i+.5)/N;if(w.style==='brushRing'||w.style==='smoothRing'){const b=Math.pow(pseudoBin(q,r,w),lerp(.72,2.05,w.sharpness/100)),p=localPunch(q,r,w);total+=1+clamp(b*(w.reaction/100)*.72+p*.45,0,2.4)*.07}else{const b=pseudoBin(q,r,w),p=localPunch(q,r,w),react=clamp(b*(.08+depth*.11)*(w.reaction/100)+p*(.035+depth*.045),0,.55);total+=1+react}}
  return clamp(total/N,1,1.34);
}
window.__FW_WAVE_GEOMETRY={poly,shapePoint,spectrumSample,broadBand,sectionDrive,localDrive,pseudoBin,punch,localPunch,ringScale,beginRingPath,radialExtension,beginRadialEnvelopePath,beginFillPath,imagePulseScale};
})();
