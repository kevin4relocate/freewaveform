(()=>{
'use strict';

const wrap=document.getElementById('stageWrap');
const canvas=document.getElementById('canvas');
const api=window.__FW_MULTI_WAVE;
const C=window.__FW_WAVE_CONFIG;
const pipeline=window.__FW_RENDER_PIPELINE;
if(!wrap)return;
let box=null;

function syncOffset(){
  if(!box||!box.isConnected)return;
  const r=wrap.getBoundingClientRect();
  box.style.setProperty('--fw-stage-left',r.left+'px');
  box.style.setProperty('--fw-stage-top',r.top+'px');
}
function portalEditor(){
  const next=document.getElementById('waveCenterTextEditor');
  if(!next)return false;
  box=next;
  if(box.parentElement!==document.body){
    syncOffset();
    document.body.appendChild(box);
    box.classList.add('wave-center-editor-portal');
    syncOffset();
  }
  return true;
}

const observer=new MutationObserver(()=>portalEditor());
observer.observe(wrap,{childList:true,subtree:true});
portalEditor();
window.addEventListener('resize',syncOffset);
window.addEventListener('scroll',syncOffset,true);
document.addEventListener('fw:ratio-change',()=>requestAnimationFrame(syncOffset));

// Built-in waveform text is part of the waveform itself. Re-register the same
// pipeline id after center-text-v1.js so this renderer replaces the static one
// and applies the waveform's own audio-reactive scale. Free Text is untouched.
if(canvas&&api&&C&&pipeline){
  const ctx=canvas.getContext('2d');
  const clamp=window.__FW_UTILS?.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
  const lerp=window.__FW_UTILS?.lerp||((a,b,t)=>a+(b-a)*t);
  const CLOSED=C.ROUNDISH||new Set(['brushRing','smoothRing','radial','orbit']);
  const FONT_FAMILY={
    serifCN:'"Noto Serif SC","Songti SC","STSong",serif',
    calligraphy:'"Ma Shan Zheng","Kaiti SC","STKaiti",cursive',
    sansCN:'"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif',
    serifEN:'"Playfair Display",Georgia,serif',
    sans:'Inter,system-ui,sans-serif',
    fwZcoolXiaoWei:'"ZCOOL XiaoWei","Noto Serif SC",serif',
    fwZcoolQingKe:'"ZCOOL QingKe HuangYou","Noto Sans SC",sans-serif',
    fwLiuJianMaoCao:'"Liu Jian Mao Cao","Ma Shan Zheng",cursive',
    fwLongCang:'"Long Cang","Ma Shan Zheng",cursive'
  };

  function pseudoBin(q,r,w){
    const low=r.bass*Math.pow(1-q,.9),mid=r.mid*Math.pow(Math.sin(Math.PI*q),2),hi=r.treble*Math.pow(q,.8);
    const ripple=.52+.48*Math.abs(Math.sin(q*(29+w.detail*.11)+(r.time||0)*(2.2+r.treble*2)));
    return clamp((low*.8+mid*.65+hi*.55)*ripple+r.beat*.08,0,1.4);
  }
  function punch(r,w){return clamp(r.beat*(w.beatPunch/100),0,3)}
  function waveformPulseScale(w,r){
    if(!r)return 1;
    const p=punch(r,w),sharp=lerp(.72,2.2,(w.sharpness||0)/100),samples=16;
    let total=0;
    for(let i=0;i<samples;i++){
      const q=(i+.5)/samples,b=Math.pow(pseudoBin(q,r,w),sharp);
      total+=1+clamp(b*(w.reaction/100)+p*.25,0,3)*.095;
    }
    return total/samples;
  }
  function fontFamily(value){return FONT_FAMILY[value]||FONT_FAMILY.serifCN}
  function fitText(lines,maxW,maxH,cfg){
    let size=clamp(+cfg.size||64,20,120),min=14;
    for(;size>min;size-=2){
      ctx.font=`600 ${size}px ${fontFamily(cfg.font)}`;
      const widest=Math.max(...lines.map(line=>ctx.measureText(line||' ').width));
      if(widest<=maxW&&lines.length*size*1.25<=maxH)break;
    }
    return Math.max(min,size);
  }
  function drawReactiveCenterText(frame){
    const r=frame?.energy||{bass:0,mid:0,treble:0,beat:0,time:0};
    const layers=api.getLayers?.()||[];
    layers.forEach((w,i)=>{
      if(!w||w.showWave===false||!CLOSED.has(w.style))return;
      const cfg=w.centerText||window.__FW_CENTER_TEXT?.getForWave?.(i);
      const text=String(cfg?.text||'').trim();if(!text)return;
      const b=api.getBounds?.(i);if(!b)return;
      const lines=text.split('\n').slice(0,3),maxW=b.w*((w.shape==='star'||w.shape==='lotus')?.46:.56),maxH=b.h*.44;
      const size=fitText(lines,maxW,maxH,cfg||{}),lineH=size*1.25,startY=-((lines.length-1)*lineH)/2;
      const align=['left','right','center'].includes(cfg?.align)?cfg.align:'center';
      const x=align==='left'?-maxW/2:align==='right'?maxW/2:0;
      const scale=waveformPulseScale(w,r);
      ctx.save();
      ctx.translate(b.cx,b.cy);ctx.scale(scale,scale);
      ctx.textAlign=align;ctx.textBaseline='middle';ctx.font=`600 ${size}px ${fontFamily(cfg?.font)}`;
      ctx.fillStyle=cfg?.colorMode==='custom'?(cfg.color||'#f4ead8'):(w.color||cfg?.color||'#f4ead8');
      ctx.globalAlpha=clamp((+cfg?.opacity||100)/100,.2,1);
      ctx.shadowColor='rgba(0,0,0,.58)';ctx.shadowBlur=Math.max(2,size*.08);
      lines.forEach((line,n)=>ctx.fillText(line,x,startY+n*lineH));
      ctx.restore();
    });
  }

  pipeline.register('overlay','wave-center-text',drawReactiveCenterText,-100);
}

// Independent Free Text should not inherit waveform pulse by default.
const addFreeText=document.getElementById('addText');
addFreeText?.addEventListener('click',()=>{
  const state=window.__FW_APP?.getState?.(),items=state?.texts;
  if(!Array.isArray(items)||!items.length)return;
  const item=items[items.length-1];item.react=false;
  const cards=document.querySelectorAll('#textList .text-card'),card=cards[cards.length-1];
  const react=card?.querySelector('select[data-k="react"]');if(react)react.value='false';
});
})();