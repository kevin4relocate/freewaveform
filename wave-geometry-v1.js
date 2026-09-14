(()=>{
'use strict';
const U=window.__FW_UTILS||{};
const clamp=U.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const lerp=U.lerp||((a,b,t)=>a+(b-a)*t);

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
function pseudoBin(q,r,w){
  const low=r.bass*Math.pow(1-q,.9),mid=r.mid*Math.pow(Math.sin(Math.PI*q),2),hi=r.treble*Math.pow(q,.8),ripple=.52+.48*Math.abs(Math.sin(q*(29+w.detail*.11)+(r.time||0)*(2.2+r.treble*2)));
  return clamp((low*.8+mid*.65+hi*.55)*ripple+r.beat*.08,0,1.4);
}
function punch(r,w){return clamp(r.beat*(w.beatPunch/100),0,3)}
function ringScale(w,r,t,i=0,rough=0){
  const dep=w.toothDepth/100,p=punch(r,w),b=Math.pow(pseudoBin(t,r,w),lerp(.72,2.2,w.sharpness/100)),tri=1-Math.abs(((t*w.detail)%1)*2-1),tooth=(Math.pow(clamp(tri,0,1),lerp(.7,5.4,w.sharpness/100))-.28)*dep*.06;
  return 1+clamp(b*(w.reaction/100)+p*.25,0,3)*.095+tooth+(rough?Math.sin(i*2.31)*rough*.01:0);
}
function beginRingPath(ctx,w,r,cx,cy,rad,rough=0){
  const N=Math.max(160,Math.round(w.detail*2.5));ctx.beginPath();
  for(let i=0;i<=N;i++){const t=(i%N)/N,sp=shapePoint(w.shape,t,rad),m=ringScale(w,r,t,i,rough),x=cx+sp.x*m,y=cy+sp.y*m;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
  ctx.closePath();return ctx;
}
function radialExtension(w,r,t){
  const depth=w.toothDepth/100,p=punch(r,w),b=pseudoBin(t,r,w);
  return clamp(b*(.10+depth*.15)*(w.reaction/100)+p*(.045+depth*.055),0,.9);
}
function beginRadialEnvelopePath(ctx,w,r,cx,cy,rad){
  const N=clamp(Math.round(w.detail),24,256);ctx.beginPath();
  for(let i=0;i<=N;i++){const t=(i%N)/N,sp=shapePoint(w.shape,t,rad),len=rad*(.018+radialExtension(w,r,t)),mag=Math.hypot(sp.x,sp.y)||1,x=cx+sp.x+sp.x/mag*len,y=cy+sp.y+sp.y/mag*len;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
  ctx.closePath();return ctx;
}
function beginFillPath(ctx,w,r,cx,cy,rad){return w.style==='brushRing'||w.style==='smoothRing'?beginRingPath(ctx,w,r,cx,cy,rad,w.style==='brushRing'?1.25:0):beginRadialEnvelopePath(ctx,w,r,cx,cy,rad)}
function imagePulseScale(w,r){
  const N=24,p=punch(r,w),depth=w.toothDepth/100;let total=0;
  for(let i=0;i<N;i++){const q=(i+.5)/N;if(w.style==='brushRing'||w.style==='smoothRing'){const b=Math.pow(pseudoBin(q,r,w),lerp(.72,2.2,w.sharpness/100));total+=1+clamp(b*(w.reaction/100)+p*.25,0,3)*.095}else{const b=pseudoBin(q,r,w),react=clamp(b*(.10+depth*.15)*(w.reaction/100)+p*(.045+depth*.055),0,.9);total+=1+react}}
  return clamp(total/N,1,1.45);
}
window.__FW_WAVE_GEOMETRY={poly,shapePoint,pseudoBin,punch,ringScale,beginRingPath,radialExtension,beginRadialEnvelopePath,beginFillPath,imagePulseScale};
})();
