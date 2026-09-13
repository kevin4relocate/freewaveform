(()=>{
'use strict';

const canvas=document.querySelector('#canvas');
const stage=document.querySelector('#stageWrap');
if(!canvas||!stage)return;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const EDGE_STYLES=new Set(['bottom','top','dual','left','right','sides']);
const SNAP_THRESHOLD=1.35;

let wavePos={x:50,y:50};
let drag=null;

let guide=stage.querySelector('.smart-guides');
if(!guide){
  guide=document.createElement('div');
  guide.className='smart-guides';
  guide.innerHTML='<i class="guide-v"></i><i class="guide-h"></i><span class="guide-badge"></span>';
  stage.appendChild(guide);
}
const gv=guide.querySelector('.guide-v');
const gh=guide.querySelector('.guide-h');
const badge=guide.querySelector('.guide-badge');

function activeTool(){return document.querySelector('.tool.active')?.dataset.tool||''}
function edgeWave(){return EDGE_STYLES.has(document.querySelector('#waveStyle')?.value||'')}
function pointFromEvent(e){
  const r=canvas.getBoundingClientRect();
  return{
    x:clamp((e.clientX-r.left)/r.width*100,0,100),
    y:clamp((e.clientY-r.top)/r.height*100,0,100)
  };
}
function clientFromPercent(x,y){
  const r=canvas.getBoundingClientRect();
  return{clientX:r.left+r.width*x/100,clientY:r.top+r.height*y/100};
}
function hideGuides(){
  gv?.classList.remove('show');
  gh?.classList.remove('show');
  badge?.classList.remove('show');
}
function showGuide(axis,value,label){
  const r=canvas.getBoundingClientRect();
  const sr=stage.getBoundingClientRect();
  if(axis==='x'&&gv){
    gv.style.left=(r.left-sr.left+r.width*value/100)+'px';
    gv.style.top=(r.top-sr.top)+'px';
    gv.style.height=r.height+'px';
    gv.classList.add('show');
  }
  if(axis==='y'&&gh){
    gh.style.top=(r.top-sr.top+r.height*value/100)+'px';
    gh.style.left=(r.left-sr.left)+'px';
    gh.style.width=r.width+'px';
    gh.classList.add('show');
  }
  if(badge){badge.textContent=label;badge.classList.add('show')}
}
function bestTarget(value,targets){
  let best=null;
  for(const t of targets){
    const d=Math.abs(value-t.value);
    if(d<=SNAP_THRESHOLD&&(!best||d<best.d))best={...t,d};
  }
  return best;
}
function snapPoint(type,p){
  const xTargets=[{value:50,label:'CENTER'}];
  const yTargets=[{value:50,label:'CENTER'}];
  if(type==='text'&&!edgeWave()){
    xTargets.push({value:wavePos.x,label:'ALIGN WAVE'});
    yTargets.push({value:wavePos.y,label:'ALIGN WAVE'});
  }
  const tx=bestTarget(p.x,xTargets);
  const ty=bestTarget(p.y,yTargets);
  const x=tx?tx.value:p.x;
  const y=ty?ty.value:p.y;

  if(tx)showGuide('x',x,tx.label);else gv?.classList.remove('show');
  if(ty)showGuide('y',y,ty.label);else gh?.classList.remove('show');
  if(!tx&&!ty)badge?.classList.remove('show');
  else if(badge){
    const labels=[tx?.label,ty?.label].filter(Boolean);
    badge.textContent=[...new Set(labels)].join(' · ');
    badge.classList.add('show');
  }
  return{x,y,snapped:!!(tx||ty)};
}

canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.__fwSmartAlign)return;
  const tool=activeTool();
  if(tool==='text')drag={type:'text'};
  else if(tool==='waveform'&&!edgeWave())drag={type:'wave'};
  else drag=null;
},true);

canvas.addEventListener('pointermove',e=>{
  if(e.__fwSmartAlign||!drag||!(e.buttons&1))return;
  const p=pointFromEvent(e);
  const sn=snapPoint(drag.type,p);
  if(drag.type==='wave')wavePos={x:sn.x,y:sn.y};
  if(!sn.snapped)return;

  const c=clientFromPercent(sn.x,sn.y);
  const ev=new PointerEvent('pointermove',{
    bubbles:true,cancelable:true,composed:true,
    clientX:c.clientX,clientY:c.clientY,
    pointerId:e.pointerId,pointerType:e.pointerType||'mouse',isPrimary:e.isPrimary,
    buttons:e.buttons,button:e.button,pressure:e.pressure
  });
  try{Object.defineProperty(ev,'__fwSmartAlign',{value:true})}catch{}
  e.preventDefault();
  e.stopImmediatePropagation();
  canvas.dispatchEvent(ev);
},true);

function endDrag(){drag=null;setTimeout(hideGuides,90)}
canvas.addEventListener('pointerup',endDrag,true);
canvas.addEventListener('pointercancel',endDrag,true);
canvas.addEventListener('pointerleave',e=>{if(!e.buttons)endDrag()},true);

// Keep guide geometry correct after ratio/layout changes.
window.addEventListener('resize',hideGuides);
document.querySelectorAll('[data-ratio],.tool').forEach(el=>el.addEventListener('click',hideGuides));

})();
