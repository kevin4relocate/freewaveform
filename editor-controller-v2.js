(()=>{
'use strict';

const canvas=document.getElementById('canvas');
const stage=document.getElementById('stageWrap');
if(!canvas||!stage)return;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const selection=new Set();
let gesture=null;
let marqueeRect=null;
let guideX=null,guideY=null;
let raf=0;

function textApi(){return window.__FW_TEXT_BRIDGE}
function waveApi(){return window.__FW_MULTI_WAVE}
function activeTool(){return document.querySelector('.tool.active')?.dataset.tool||''}
function imageLoaded(){const n=document.getElementById('imageName')?.textContent?.trim();return!!n&&n!=='Optional'}
function switchTool(tool){document.querySelector(`.tool[data-tool="${tool}"]`)?.click()}
function canvasPointFromClient(clientX,clientY){
  const r=canvas.getBoundingClientRect();
  return{x:(clientX-r.left)/r.width*canvas.width,y:(clientY-r.top)/r.height*canvas.height};
}
function clientDeltaToCanvas(dx,dy){const r=canvas.getBoundingClientRect();return{x:dx/r.width*canvas.width,y:dy/r.height*canvas.height}}

function textItems(){return textApi()?.getItems?.()||[]}
function waveItems(){return waveApi()?.getItems?.()||[]}
function allItems(){return[...textItems(),...waveItems()]}
function itemById(id){if(id==='image')return{id:'image',type:'image',index:-1,movable:false,bounds:{x:0,y:0,w:canvas.width,h:canvas.height,cx:canvas.width/2,cy:canvas.height/2}};return allItems().find(x=>x.id===id)||null}
function selectedItems(){return[...selection].map(itemById).filter(Boolean)}
function movableSelected(){return selectedItems().filter(x=>x.movable)}

function hitTest(p){
  const texts=textItems();
  for(let i=texts.length-1;i>=0;i--){const b=texts[i].bounds;if(p.x>=b.x-10&&p.x<=b.x+b.w+10&&p.y>=b.y-8&&p.y<=b.y+b.h+8)return texts[i]}
  const wi=waveApi()?.hitTest?.(p.x,p.y);
  if(Number.isInteger(wi)&&wi>=0)return waveItems().find(x=>x.index===wi)||null;
  return null;
}

stage.style.position=stage.style.position||'relative';
const overlay=document.createElement('div');
overlay.className='fw-editor-overlay';
overlay.innerHTML='<div class="fw-guide fw-guide-v"></div><div class="fw-guide fw-guide-h"></div><div class="fw-marquee"></div><div class="fw-selection-layer"></div>';
stage.appendChild(overlay);
const selectionLayer=overlay.querySelector('.fw-selection-layer');
const marqueeEl=overlay.querySelector('.fw-marquee');
const guideV=overlay.querySelector('.fw-guide-v');
const guideH=overlay.querySelector('.fw-guide-h');
const menu=document.createElement('div');menu.className='fw-align-menu';menu.hidden=true;
menu.innerHTML=`<div class="fw-align-title">Align selection</div><div class="fw-align-grid"><button data-align="left">Left</button><button data-align="centerX">Center</button><button data-align="right">Right</button><button data-align="top">Top</button><button data-align="middleY">Middle</button><button data-align="bottom">Bottom</button></div><div class="fw-align-sep"></div><button class="fw-align-wide" data-align="distributeX">Distribute horizontally</button><button class="fw-align-wide" data-align="distributeY">Distribute vertically</button>`;
document.body.appendChild(menu);
const style=document.createElement('style');style.textContent=`
.fw-editor-overlay{position:absolute;inset:0;pointer-events:none;z-index:8}.fw-selection-layer{position:absolute;inset:0}.fw-select-box,.fw-group-box{position:absolute;border:1px solid #55c8da;box-sizing:border-box;border-radius:3px}.fw-select-box{background:rgba(85,200,218,.025)}.fw-select-box::before{content:attr(data-label);position:absolute;left:-1px;top:-20px;padding:2px 5px;border-radius:4px;background:#102126;color:#bdebf1;font:600 9px/14px Inter,system-ui,sans-serif;white-space:nowrap}.fw-group-box{border:1px dashed #e0ad60;box-shadow:0 0 0 1px rgba(224,173,96,.08)}.fw-group-box::before{content:attr(data-count) ' selected';position:absolute;left:0;top:-21px;padding:2px 6px;border-radius:4px;background:#21190f;color:#f1cd8c;font:600 9px/14px Inter,system-ui,sans-serif;white-space:nowrap}.fw-marquee{position:absolute;display:none;border:1px solid #5bc9db;background:rgba(91,201,219,.09);box-sizing:border-box}.fw-guide{position:absolute;display:none;z-index:4;border-color:#d6b65e;opacity:.9}.fw-guide-v{top:0;width:0;border-left:1px dashed #d6b65e}.fw-guide-h{left:0;height:0;border-top:1px dashed #d6b65e}.fw-align-menu{position:fixed;z-index:99999;width:214px;padding:8px;border:1px solid #343b3f;border-radius:10px;background:#101517;box-shadow:0 12px 38px rgba(0,0,0,.45);color:#eee;font:500 12px Inter,system-ui,sans-serif}.fw-align-title{padding:5px 7px 8px;color:#a9a39b;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.fw-align-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.fw-align-menu button{border:1px solid #2b3236;border-radius:7px;background:#151b1e;color:#ddd;padding:8px 6px;cursor:pointer;font:500 11px Inter,system-ui,sans-serif}.fw-align-menu button:hover{border-color:#8a673b;background:#211a12;color:#f1c77f}.fw-align-sep{height:1px;background:#293034;margin:7px 0}.fw-align-wide{display:block;width:100%;margin-top:5px;text-align:left}.text-card.fw-inspector-selected{outline:1px solid rgba(85,200,218,.5);outline-offset:2px}.mw-item.fw-inspector-selected .mw-select{border-color:#55c8da!important}
`;
document.head.appendChild(style);

function canvasCssRect(){const c=canvas.getBoundingClientRect(),s=stage.getBoundingClientRect();return{left:c.left-s.left,top:c.top-s.top,width:c.width,height:c.height}}
function boxToStage(b){const c=canvasCssRect();return{left:c.left+b.x/canvas.width*c.width,top:c.top+b.y/canvas.height*c.height,width:b.w/canvas.width*c.width,height:b.h/canvas.height*c.height}}
function unionBounds(items){
  if(!items.length)return null;let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
  items.forEach(i=>{const b=i.bounds;if(!b)return;x1=Math.min(x1,b.x);y1=Math.min(y1,b.y);x2=Math.max(x2,b.x+b.w);y2=Math.max(y2,b.y+b.h)});
  return Number.isFinite(x1)?{x:x1,y:y1,w:x2-x1,h:y2-y1,cx:(x1+x2)/2,cy:(y1+y2)/2}:null;
}
function labelFor(item){if(item.type==='text')return item.label||`Text ${item.index+1}`;if(item.type==='wave')return item.name||`Wave ${item.index+1}`;return'Image'}
function renderOverlay(){
  raf=0;selectionLayer.innerHTML='';
  const items=selectedItems();
  items.forEach(item=>{if(!item.bounds)return;const q=boxToStage(item.bounds),d=document.createElement('div');d.className='fw-select-box';d.dataset.label=labelFor(item);Object.assign(d.style,{left:q.left+'px',top:q.top+'px',width:q.width+'px',height:q.height+'px'});selectionLayer.appendChild(d)});
  if(items.length>1){const b=unionBounds(items.filter(x=>x.bounds));if(b){const q=boxToStage(b),d=document.createElement('div');d.className='fw-group-box';d.dataset.count=items.length;Object.assign(d.style,{left:q.left+'px',top:q.top+'px',width:q.width+'px',height:q.height+'px'});selectionLayer.appendChild(d)}}
  document.querySelectorAll('#textList .text-card').forEach((c,i)=>c.classList.toggle('fw-inspector-selected',selection.has(`text:${i}`)));
  document.querySelectorAll('.mw-item').forEach((c,i)=>c.classList.toggle('fw-inspector-selected',selection.has(`wave:${i}`)));
}
function scheduleOverlay(){if(!raf)raf=requestAnimationFrame(renderOverlay)}
function clearGuides(){guideX=guideY=null;guideV.style.display=guideH.style.display='none'}
function showGuides(){
  const c=canvasCssRect();
  if(guideX!==null){guideV.style.display='block';guideV.style.left=(c.left+guideX/canvas.width*c.width)+'px';guideV.style.top=c.top+'px';guideV.style.height=c.height+'px'}else guideV.style.display='none';
  if(guideY!==null){guideH.style.display='block';guideH.style.top=(c.top+guideY/canvas.height*c.height)+'px';guideH.style.left=c.left+'px';guideH.style.width=c.width+'px'}else guideH.style.display='none';
}
function showMarquee(a,b){const c=canvasCssRect(),x1=Math.min(a.x,b.x),y1=Math.min(a.y,b.y),x2=Math.max(a.x,b.x),y2=Math.max(a.y,b.y);marqueeRect={x:x1,y:y1,w:x2-x1,h:y2-y1};const q=boxToStage(marqueeRect);marqueeEl.style.display='block';Object.assign(marqueeEl.style,{left:q.left+'px',top:q.top+'px',width:q.width+'px',height:q.height+'px'})}
function hideMarquee(){marqueeRect=null;marqueeEl.style.display='none'}

function setSelection(ids,{sync=true}={}){selection.clear();ids.forEach(id=>selection.add(id));hideMenu();scheduleOverlay();if(sync&&selection.size===1)syncInspector()}
function toggleSelection(id){if(selection.has(id))selection.delete(id);else selection.add(id);hideMenu();scheduleOverlay();if(selection.size===1)syncInspector()}
function clearSelection(){selection.clear();hideMenu();clearGuides();hideMarquee();scheduleOverlay()}
function syncInspector(){
  if(selection.size!==1)return;const item=itemById([...selection][0]);if(!item)return;
  if(item.type==='text'){switchTool('text');setTimeout(()=>document.querySelector(`#textList .text-card[data-index="${item.index}"]`)?.scrollIntoView({block:'nearest'}),20)}
  else if(item.type==='wave'){switchTool('waveform');waveApi()?.selectLayer?.(item.index);}
  else if(item.type==='image')switchTool('image');
}

function snapshotMovable(){
  const pos=textApi()?.getPositions?.()||[],layers=waveApi()?.getLayers?.()||[];
  return movableSelected().map(item=>{
    const p=item.type==='text'?pos[item.index]:layers[item.index];if(!p)return null;
    return{...item,startX:+p.x,startY:+p.y,startBounds:{...item.bounds}};
  }).filter(Boolean);
}
function applySnapshot(items,dx,dy){
  const dxPct=dx/canvas.width*100,dyPct=dy/canvas.height*100;
  items.forEach(item=>{
    if(item.type==='text')textApi()?.setPosition?.(item.index,item.startX+dxPct,item.startY+dyPct);
    else if(item.type==='wave')waveApi()?.setPosition?.(item.index,item.startX+dxPct,item.startY+dyPct);
  });
  scheduleOverlay();
}
function stationaryGuideTargets(excluded){
  const xs=[0,canvas.width/2,canvas.width],ys=[0,canvas.height/2,canvas.height];
  allItems().forEach(item=>{if(excluded.has(item.id)||!item.bounds)return;const b=item.bounds;xs.push(b.x,b.x+b.w/2,b.x+b.w);ys.push(b.y,b.y+b.h/2,b.y+b.h)});
  return{xs,ys};
}
function bestSnap(values,targets,threshold){let best=null;values.forEach(v=>targets.forEach(t=>{const d=t-v,a=Math.abs(d);if(a<=threshold&&(!best||a<best.a))best={delta:d,target:t,a}}));return best}
function snapDelta(items,rawDx,rawDy,altKey){
  const startGroup=unionBounds(items.map(i=>({...i,bounds:i.startBounds})));if(!startGroup)return{dx:rawDx,dy:rawDy};
  let dx=rawDx,dy=rawDy;guideX=guideY=null;
  if(!altKey){
    const cr=canvas.getBoundingClientRect(),tx=6/canvas.width*canvas.width*(canvas.width/cr.width),ty=6/canvas.height*canvas.height*(canvas.height/cr.height);
    const targets=stationaryGuideTargets(new Set(items.map(i=>i.id)));
    const sx=[startGroup.x+dx,startGroup.x+startGroup.w/2+dx,startGroup.x+startGroup.w+dx];
    const sy=[startGroup.y+dy,startGroup.y+startGroup.h/2+dy,startGroup.y+startGroup.h+dy];
    const bx=bestSnap(sx,targets.xs,tx),by=bestSnap(sy,targets.ys,ty);if(bx){dx+=bx.delta;guideX=bx.target}if(by){dy+=by.delta;guideY=by.target}
  }
  let minDx=-Infinity,maxDx=Infinity,minDy=-Infinity,maxDy=Infinity;
  items.forEach(item=>{const min=item.type==='text'?2:3,max=item.type==='text'?98:97;minDx=Math.max(minDx,canvas.width*(min-item.startX)/100);maxDx=Math.min(maxDx,canvas.width*(max-item.startX)/100);minDy=Math.max(minDy,canvas.height*(min-item.startY)/100);maxDy=Math.min(maxDy,canvas.height*(max-item.startY)/100)});
  dx=clamp(dx,minDx,maxDx);dy=clamp(dy,minDy,maxDy);showGuides();return{dx,dy};
}

function isModifier(e){return e.shiftKey||e.ctrlKey||e.metaKey}
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||!e.isTrusted)return;
  const p=canvasPointFromClient(e.clientX,e.clientY),hit=hitTest(p),mod=isModifier(e);
  if(hit){
    if(mod)toggleSelection(hit.id);else if(!selection.has(hit.id))setSelection([hit.id]);
    else if(selection.size===1)syncInspector();
    const movable=selection.has(hit.id)&&hit.movable?snapshotMovable():[];
    gesture={type:'object',pointerId:e.pointerId,startClient:{x:e.clientX,y:e.clientY},startCanvas:p,items:movable,moved:false};
    e.preventDefault();e.stopImmediatePropagation();return;
  }
  // Once Image is explicitly selected, dragging the background pans it using the core image engine.
  if(!mod&&selection.size===1&&selection.has('image')&&activeTool()==='image'){return}
  gesture={type:'background',pointerId:e.pointerId,startClient:{x:e.clientX,y:e.clientY},startCanvas:p,additive:mod,moved:false,base:new Set(selection)};
  e.preventDefault();e.stopImmediatePropagation();
},true);

stage.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target===canvas)return;
  const p=canvasPointFromClient(e.clientX,e.clientY);gesture={type:'background',pointerId:e.pointerId,startClient:{x:e.clientX,y:e.clientY},startCanvas:p,additive:isModifier(e),moved:false,base:new Set(selection)};e.preventDefault();
},true);

document.addEventListener('pointermove',e=>{
  if(!gesture||e.pointerId!==gesture.pointerId)return;
  const dist=Math.hypot(e.clientX-gesture.startClient.x,e.clientY-gesture.startClient.y);
  if(gesture.type==='object'){
    if(!gesture.items.length)return;if(dist<2&&!gesture.moved)return;gesture.moved=true;
    const d=clientDeltaToCanvas(e.clientX-gesture.startClient.x,e.clientY-gesture.startClient.y),sn=snapDelta(gesture.items,d.x,d.y,e.altKey);applySnapshot(gesture.items,sn.dx,sn.dy);e.preventDefault();
  }else{
    if(dist<4&&!gesture.moved)return;gesture.moved=true;const p=canvasPointFromClient(e.clientX,e.clientY);showMarquee(gesture.startCanvas,p);
    const hits=allItems().filter(item=>{const b=item.bounds,r=marqueeRect;return b&&r&&b.x<r.x+r.w&&b.x+b.w>r.x&&b.y<r.y+r.h&&b.y+b.h>r.y}).map(x=>x.id);
    const ids=gesture.additive?new Set([...gesture.base,...hits]):new Set(hits);selection.clear();ids.forEach(id=>selection.add(id));scheduleOverlay();e.preventDefault();
  }
},true);

function finishGesture(e){
  if(!gesture||e.pointerId!==gesture.pointerId)return;
  const g=gesture;gesture=null;clearGuides();hideMarquee();
  if(g.type==='background'&&!g.moved){if(imageLoaded()){setSelection(['image']);}else clearSelection()}
  else scheduleOverlay();
}
document.addEventListener('pointerup',finishGesture,true);document.addEventListener('pointercancel',finishGesture,true);

canvas.addEventListener('wheel',e=>{
  if(selection.size!==1)return;const item=itemById([...selection][0]);if(!item)return;
  if(item.type==='wave'&&item.movable){e.preventDefault();e.stopImmediatePropagation();const layer=waveApi()?.getLayers?.()[item.index];if(!layer)return;waveApi()?.setSize?.(item.index,(+layer.size||46)+(e.deltaY<0?2:-2));scheduleOverlay()}
  // Image wheel is deliberately left to the existing image zoom handler.
},{capture:true,passive:false});

function hideMenu(){menu.hidden=true}
function showMenu(x,y){menu.hidden=false;const w=214,h=250;menu.style.left=Math.min(x+4,window.innerWidth-w-8)+'px';menu.style.top=Math.min(y+4,window.innerHeight-h-8)+'px'}
canvas.addEventListener('contextmenu',e=>{
  const p=canvasPointFromClient(e.clientX,e.clientY),hit=hitTest(p);
  if(hit&&!selection.has(hit.id))setSelection([hit.id]);
  if(movableSelected().length<2){hideMenu();return}
  e.preventDefault();e.stopImmediatePropagation();showMenu(e.clientX,e.clientY);
},true);
document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!e.target.closest('.fw-align-menu'))hideMenu()},true);

function moveItemBy(item,dx,dy){
  if(item.type==='text'){const p=textApi()?.getPositions?.()[item.index];if(p)textApi()?.setPosition?.(item.index,p.x+dx/canvas.width*100,p.y+dy/canvas.height*100)}
  else if(item.type==='wave'){const p=waveApi()?.getLayers?.()[item.index];if(p)waveApi()?.setPosition?.(item.index,p.x+dx/canvas.width*100,p.y+dy/canvas.height*100)}
}
function alignSelection(kind){
  const items=movableSelected();if(items.length<2)return;const group=unionBounds(items);if(!group)return;
  if(kind==='distributeX'&&items.length>=3){const sorted=[...items].sort((a,b)=>a.bounds.cx-b.bounds.cx),lo=sorted[0].bounds.cx,hi=sorted.at(-1).bounds.cx,step=(hi-lo)/(sorted.length-1);sorted.forEach((item,i)=>moveItemBy(item,lo+i*step-item.bounds.cx,0));}
  else if(kind==='distributeY'&&items.length>=3){const sorted=[...items].sort((a,b)=>a.bounds.cy-b.bounds.cy),lo=sorted[0].bounds.cy,hi=sorted.at(-1).bounds.cy,step=(hi-lo)/(sorted.length-1);sorted.forEach((item,i)=>moveItemBy(item,0,lo+i*step-item.bounds.cy));}
  else items.forEach(item=>{const b=item.bounds;let dx=0,dy=0;if(kind==='left')dx=group.x-b.x;if(kind==='centerX')dx=group.cx-b.cx;if(kind==='right')dx=group.x+group.w-(b.x+b.w);if(kind==='top')dy=group.y-b.y;if(kind==='middleY')dy=group.cy-b.cy;if(kind==='bottom')dy=group.y+group.h-(b.y+b.h);moveItemBy(item,dx,dy)});
  hideMenu();requestAnimationFrame(()=>{scheduleOverlay()});
}
menu.addEventListener('click',e=>{const b=e.target.closest('[data-align]');if(b)alignSelection(b.dataset.align)});

// Inspector clicks participate in the same selection model.
document.addEventListener('click',e=>{
  const mw=e.target.closest?.('.mw-item .mw-select');if(mw){const item=mw.closest('.mw-item'),i=+item.dataset.i;setTimeout(()=>setSelection([`wave:${i}`],{sync:false}),0);return}
  const card=e.target.closest?.('#textList .text-card');if(card&&!e.target.closest('input,select,button')){const i=+card.dataset.index;setSelection([`text:${i}`],{sync:false})}
});

document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'&&!e.target.matches('input,textarea,select')){e.preventDefault();setSelection(allItems().map(x=>x.id),{sync:false});return}
  if(e.key==='Escape'){hideMenu();clearSelection()}
});

new ResizeObserver(()=>scheduleOverlay()).observe(canvas);window.addEventListener('resize',()=>scheduleOverlay());
document.querySelectorAll('[data-ratio]').forEach(b=>b.addEventListener('click',()=>setTimeout(scheduleOverlay,30)));
document.getElementById('resetProject')?.addEventListener('click',()=>setTimeout(clearSelection,0));

// Initial bounds become available after the first render frame.
requestAnimationFrame(()=>requestAnimationFrame(scheduleOverlay));
window.__FW_EDITOR_CONTROLLER={getSelection:()=>[...selection],clearSelection,setSelection:(ids)=>setSelection(ids,{sync:false}),align:alignSelection};
})();