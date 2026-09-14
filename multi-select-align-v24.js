(()=>{
'use strict';

const canvas=document.getElementById('canvas');
if(!canvas)return;

const selected=new Set();
const boxes=new Map();
const EDGE=new Set(['bottom','top','dual','left','right','sides']);
const ROUNDISH=new Set(['brushRing','smoothRing','radial','orbit']);
const FONT_MAP={
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
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ctx=canvas.getContext('2d');

let overlayRaf=0;
let pointerState=null;
let dragPreview=null;

function activeTool(){return document.querySelector('.tool.active')?.dataset.tool||''}
function modifier(e){return !!(e.shiftKey||e.ctrlKey||e.metaKey)}
function canvasPoint(e){
  const r=canvas.getBoundingClientRect();
  return{x:(e.clientX-r.left)/r.width*canvas.width,y:(e.clientY-r.top)/r.height*canvas.height};
}
function textCards(){return [...document.querySelectorAll('#textList .text-card')]}
function textItem(index,cards,positions){
  const card=cards[index],p=positions[index];
  if(!card||!p)return null;
  const get=k=>card.querySelector(`[data-k="${k}"]`);
  const show=get('show'),text=String(get('text')?.value||'');
  if(!text||show?.checked===false)return null;
  const base=Math.min(canvas.width,canvas.height);
  const size=base*((+get('size')?.value||42)/1000);
  const font=get('font')?.value||'sans';
  ctx.save();ctx.font=`600 ${size}px ${FONT_MAP[font]||FONT_MAP.sans}`;
  const width=Math.max(size*.8,ctx.measureText(text).width);ctx.restore();
  const height=size*1.28,cx=canvas.width*p.x/100,cy=canvas.height*p.y/100;
  return{id:`text:${index}`,type:'text',index,label:String(card.querySelector('header strong')?.textContent||`Text ${index+1}`),xPct:p.x,yPct:p.y,movable:true,bounds:{x:cx-width/2,y:cy-height/2,w:width,h:height},center:{x:cx,y:cy}};
}
function waveItem(index,layers){
  const w=layers[index];if(!w)return null;
  const style=w.style||'brushRing';
  const m=Math.min(canvas.width,canvas.height);
  const xPct=Number.isFinite(+w.x)?+w.x:50,yPct=Number.isFinite(+w.y)?+w.y:50;
  const cx=canvas.width*xPct/100,cy=canvas.height*yPct/100;
  let bounds;
  if(style==='centerLine'||style==='mountain'){
    const ww=canvas.width*(+w.size||46)/100,hh=canvas.height*.24;
    bounds={x:cx-ww/2,y:cy-hh/2,w:ww,h:hh};
  }else if(style==='top')bounds={x:canvas.width*.04,y:0,w:canvas.width*.92,h:canvas.height*.18};
  else if(style==='bottom')bounds={x:canvas.width*.04,y:canvas.height*.82,w:canvas.width*.92,h:canvas.height*.18};
  else if(style==='left')bounds={x:0,y:canvas.height*.16,w:canvas.width*.16,h:canvas.height*.68};
  else if(style==='right')bounds={x:canvas.width*.84,y:canvas.height*.16,w:canvas.width*.16,h:canvas.height*.68};
  else if(style==='dual')bounds={x:canvas.width*.04,y:0,w:canvas.width*.92,h:canvas.height};
  else if(style==='sides')bounds={x:0,y:canvas.height*.16,w:canvas.width,h:canvas.height*.68};
  else{
    const rr=m*(+w.size||46)/100*.5*1.18;
    bounds={x:cx-rr,y:cy-rr,w:rr*2,h:rr*2};
  }
  return{id:`wave:${index}`,type:'wave',index,label:w.name||`Wave ${index+1}`,style,xPct,yPct,movable:!EDGE.has(style),bounds,center:{x:bounds.x+bounds.w/2,y:bounds.y+bounds.h/2}};
}
function allItems(){
  const cards=textCards();
  const positions=window.__FW_TEXT_BRIDGE?.getPositions?.()||[];
  const layers=window.__FW_MULTI_WAVE?.getLayers?.()||[];
  const out=[];
  for(let i=0;i<cards.length;i++){const item=textItem(i,cards,positions);if(item)out.push(item)}
  for(let i=0;i<layers.length;i++){const item=waveItem(i,layers);if(item)out.push(item)}
  return out;
}
function itemMap(){return new Map(allItems().map(x=>[x.id,x]))}
function snapshotSelected(){const map=itemMap();return [...selected].map(id=>map.get(id)).filter(Boolean)}
function hitItem(p){
  const all=allItems();
  const texts=all.filter(x=>x.type==='text');
  const waves=all.filter(x=>x.type==='wave');
  for(let i=texts.length-1;i>=0;i--){
    const b=texts[i].bounds;
    if(p.x>=b.x-12&&p.x<=b.x+b.w+12&&p.y>=b.y-10&&p.y<=b.y+b.h+10)return texts[i];
  }
  for(let i=waves.length-1;i>=0;i--){
    const q=waves[i],b=q.bounds;
    if(ROUNDISH.has(q.style)){
      const rx=b.w/2,ry=b.h/2,nx=(p.x-q.center.x)/(rx||1),ny=(p.y-q.center.y)/(ry||1),d=Math.hypot(nx,ny);
      if(d>=.45&&d<=1.22)return q;
    }else if(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)return q;
  }
  return null;
}
function intersects(a,b){return a.x<=b.x+b.w&&a.x+a.w>=b.x&&a.y<=b.y+b.h&&a.y+a.h>=b.y}

const overlay=document.createElement('div');overlay.className='fw24-overlay';document.body.appendChild(overlay);
const badge=document.createElement('div');badge.className='fw24-badge';badge.hidden=true;document.body.appendChild(badge);
const marquee=document.createElement('div');marquee.className='fw24-marquee';marquee.hidden=true;document.body.appendChild(marquee);
const menu=document.createElement('div');menu.className='fw24-menu';menu.hidden=true;
menu.innerHTML=`
  <div class="fw24-menu-head"><b>Align selected</b><span class="fw24-count"></span></div>
  <div class="fw24-grid">
    <button data-cmd="left">⇤<span>Left</span></button>
    <button data-cmd="hcenter">↔<span>Same X</span></button>
    <button data-cmd="right">⇥<span>Right</span></button>
    <button data-cmd="top">⇡<span>Top</span></button>
    <button data-cmd="vcenter">↕<span>Same Y</span></button>
    <button data-cmd="bottom">⇣<span>Bottom</span></button>
  </div>
  <div class="fw24-sep"></div>
  <button class="fw24-wide" data-cmd="distH">Distribute horizontally</button>
  <button class="fw24-wide" data-cmd="distV">Distribute vertically</button>
  <button class="fw24-wide" data-cmd="canvasH">Center group horizontally</button>
  <button class="fw24-wide" data-cmd="canvasV">Center group vertically</button>
  <div class="fw24-sep"></div>
  <button class="fw24-wide muted" data-cmd="clear">Clear selection</button>`;
document.body.appendChild(menu);

const style=document.createElement('style');style.id='fw24-style';style.textContent=`
.fw24-overlay{position:fixed;inset:0;pointer-events:none;z-index:80;contain:layout style paint}
.fw24-box{position:fixed;border:1.5px solid #e0a956;border-radius:7px;box-shadow:0 0 0 1px rgba(0,0,0,.45),0 0 0 3px rgba(224,169,86,.10);pointer-events:none;will-change:transform,width,height}
.fw24-box.wave{border-style:dashed;border-color:#79b9ff}.fw24-tag{position:absolute;left:4px;top:-20px;height:17px;padding:0 6px;border-radius:5px;background:#0c1113;border:1px solid #4a3b27;color:#ebbd72;font:700 9px/15px Inter,system-ui,sans-serif;white-space:nowrap}.fw24-box.wave .fw24-tag{color:#9fd0ff;border-color:#294c68}
.fw24-badge{position:fixed;z-index:82;padding:6px 9px;border:1px solid #554126;border-radius:8px;background:rgba(9,13,15,.94);color:#d9c9b4;font:600 9px Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.26);pointer-events:none}
.fw24-marquee{position:fixed;z-index:84;border:1px solid #79b9ff;background:rgba(121,185,255,.10);box-shadow:0 0 0 1px rgba(121,185,255,.12) inset;pointer-events:none}
.fw24-menu{position:fixed;z-index:120;width:228px;padding:8px;border:1px solid #333b40;border-radius:10px;background:#0c1113;color:#ded7cc;box-shadow:0 18px 44px rgba(0,0,0,.48);font-family:Inter,system-ui,sans-serif}
.fw24-menu-head{display:flex;justify-content:space-between;align-items:center;padding:3px 4px 8px;font-size:10px}.fw24-menu-head span{font-size:8px;color:#888}
.fw24-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.fw24-menu button{border:1px solid #293136;background:#11171a;color:#cfc7bb;border-radius:7px;cursor:pointer}.fw24-grid button{height:42px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:15px}.fw24-grid button span{font-size:8px}.fw24-menu button:hover{border-color:#765733;background:#1b1711;color:#f0c57f}.fw24-wide{width:100%;height:30px;margin-top:4px;padding:0 8px;text-align:left;font-size:9px}.fw24-menu button:disabled{opacity:.35;cursor:not-allowed}.fw24-sep{height:1px;background:#252c30;margin:7px 1px 3px}.fw24-wide.muted{color:#8e8981}
`;
document.head.appendChild(style);

function ensureBox(item){
  let box=boxes.get(item.id);if(box)return box;
  box=document.createElement('div');box.className='fw24-box '+item.type;
  const tag=document.createElement('span');tag.className='fw24-tag';box.appendChild(tag);overlay.appendChild(box);boxes.set(item.id,box);return box;
}
function previewDelta(item){
  if(!dragPreview||!dragPreview.ids.has(item.id)||!item.movable)return{x:0,y:0};
  return{x:dragPreview.dx,y:dragPreview.dy};
}
function updateOverlay(){
  const active=snapshotSelected(),keep=new Set(active.map(x=>x.id));
  for(const [id,box] of boxes){if(!keep.has(id)){box.remove();boxes.delete(id)}}
  if(!active.length){badge.hidden=true;return}
  const r=canvas.getBoundingClientRect(),sx=r.width/canvas.width,sy=r.height/canvas.height;
  for(const item of active){
    const b=item.bounds,d=previewDelta(item),box=ensureBox(item);
    box.className='fw24-box '+item.type;
    box.style.transform=`translate3d(${r.left+(b.x+d.x)*sx}px,${r.top+(b.y+d.y)*sy}px,0)`;
    box.style.width=Math.max(8,b.w*sx)+'px';box.style.height=Math.max(8,b.h*sy)+'px';
    box.firstElementChild.textContent=item.label;
  }
  badge.hidden=false;
  badge.textContent=active.length===1?'1 selected · click outside to clear · Shift/Ctrl/Cmd to add':`${active.length} selected · drag one selected item to move group · right-click to align`;
  badge.style.left=(r.left+10)+'px';badge.style.top=(r.top+10)+'px';
}
function scheduleOverlay(){if(overlayRaf)return;overlayRaf=requestAnimationFrame(()=>{overlayRaf=0;updateOverlay()})}
function hideMenu(){menu.hidden=true}
function clearSelection(){selected.clear();dragPreview=null;hideMenu();scheduleOverlay()}
function setSingle(item){selected.clear();if(item)selected.add(item.id);hideMenu();scheduleOverlay()}
function toggle(item){if(!item)return;if(selected.has(item.id))selected.delete(item.id);else selected.add(item.id);hideMenu();scheduleOverlay()}
function setToolFor(item){
  if(!item)return;
  const tool=item.type==='text'?'text':'waveform';
  if(activeTool()!==tool)document.querySelector(`.tool[data-tool="${tool}"]`)?.click();
  if(item.type==='wave')document.querySelector(`.mw-item[data-i="${item.index}"] .mw-select`)?.click();
}

function syntheticPointer(type,clientX,clientY,pointerId,buttons){
  const E=window.PointerEvent||window.MouseEvent;
  const ev=new E(type,{bubbles:true,cancelable:true,composed:true,clientX,clientY,button:0,buttons,pointerId,pointerType:'mouse',isPrimary:true});
  try{Object.defineProperty(ev,'__fwSmartAlign',{value:true})}catch{}
  try{Object.defineProperty(ev,'__fwMultiAlignCommit',{value:true})}catch{}
  return ev;
}
function selectWaveLayer(index){document.querySelector(`.mw-item[data-i="${index}"] .mw-select`)?.click()}
function commitTargets(targets){
  if(!targets.length)return;
  const prevTool=activeTool(),prevWave=Number(window.__FW_MULTI_WAVE?.getActiveIndex?.()||0),r=canvas.getBoundingClientRect();
  const toClient=(cx,cy)=>({x:r.left+r.width*cx/canvas.width,y:r.top+r.height*cy/canvas.height});
  const texts=targets.filter(t=>t.item.type==='text');
  const waves=targets.filter(t=>t.item.type==='wave'&&t.item.movable);

  if(texts.length){
    document.querySelector('.tool[data-tool="text"]')?.click();
    texts.forEach((t,n)=>{
      const x=clamp(t.cx/canvas.width*100,2,98),y=clamp(t.cy/canvas.height*100,2,98);
      if(window.__FW_TEXT_BRIDGE?.moveTextTo){window.__FW_TEXT_BRIDGE.moveTextTo(t.item.index,x,y);return}
      const from=toClient(t.item.center.x,t.item.center.y),to=toClient(t.cx,t.cy),pid=430+n;
      canvas.dispatchEvent(syntheticPointer('pointerdown',from.x,from.y,pid,1));
      canvas.dispatchEvent(syntheticPointer('pointermove',to.x,to.y,pid,1));
      canvas.dispatchEvent(syntheticPointer('pointerup',to.x,to.y,pid,0));
    });
  }
  if(waves.length){
    document.querySelector('.tool[data-tool="waveform"]')?.click();
    waves.forEach((t,n)=>{
      selectWaveLayer(t.item.index);
      const to=toClient(t.cx,t.cy),pid=480+n;
      canvas.dispatchEvent(syntheticPointer('pointerdown',to.x,to.y,pid,1));
      canvas.dispatchEvent(syntheticPointer('pointerup',to.x,to.y,pid,0));
    });
    selectWaveLayer(prevWave);
  }
  if(prevTool&&activeTool()!==prevTool)document.querySelector(`.tool[data-tool="${prevTool}"]`)?.click();
  dragPreview=null;
  requestAnimationFrame(()=>requestAnimationFrame(scheduleOverlay));
}

function beginGroupDrag(e,hit){
  const arr=snapshotSelected().filter(x=>x.movable);
  if(arr.length<2||!arr.some(x=>x.id===hit.id))return false;
  const p=canvasPoint(e);
  pointerState={mode:'group',pointerId:e.pointerId,start:p,items:arr};
  dragPreview={ids:new Set(arr.map(x=>x.id)),dx:0,dy:0};
  try{canvas.setPointerCapture(e.pointerId)}catch{}
  e.preventDefault();e.stopImmediatePropagation();
  return true;
}
function beginMarquee(e){
  const p=canvasPoint(e),base=modifier(e)?new Set(selected):new Set();
  pointerState={mode:'marquee',pointerId:e.pointerId,start:p,current:p,base,started:false};
  if(!modifier(e))selected.clear();
  try{canvas.setPointerCapture(e.pointerId)}catch{}
  e.preventDefault();e.stopImmediatePropagation();
  scheduleOverlay();
}
function updateMarqueeSelection(){
  if(!pointerState||pointerState.mode!=='marquee')return;
  const a=pointerState.start,b=pointerState.current;
  const rect={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(b.x-a.x),h:Math.abs(b.y-a.y)};
  selected.clear();pointerState.base.forEach(id=>selected.add(id));
  allItems().forEach(item=>{if(intersects(rect,item.bounds))selected.add(item.id)});
  scheduleOverlay();
}
function showMarquee(){
  const a=pointerState.start,b=pointerState.current,r=canvas.getBoundingClientRect();
  const x1=r.left+Math.min(a.x,b.x)/canvas.width*r.width,y1=r.top+Math.min(a.y,b.y)/canvas.height*r.height;
  const x2=r.left+Math.max(a.x,b.x)/canvas.width*r.width,y2=r.top+Math.max(a.y,b.y)/canvas.height*r.height;
  marquee.hidden=false;marquee.style.left=x1+'px';marquee.style.top=y1+'px';marquee.style.width=Math.max(1,x2-x1)+'px';marquee.style.height=Math.max(1,y2-y1)+'px';
}

canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.__fwMultiAlignCommit)return;
  hideMenu();
  const hit=hitItem(canvasPoint(e));
  if(hit){
    if(modifier(e)){
      e.preventDefault();e.stopImmediatePropagation();toggle(hit);return;
    }
    if(!selected.has(hit.id))setSingle(hit);
    setToolFor(hit);
    if(selected.size>=2&&selected.has(hit.id)&&hit.movable){beginGroupDrag(e,hit);return}
    return;
  }

  const editorMode=activeTool()==='text'||activeTool()==='waveform'||selected.size>0;
  if(!modifier(e))clearSelection();
  if(editorMode)beginMarquee(e);
},true);

canvas.addEventListener('pointermove',e=>{
  if(!pointerState||e.pointerId!==pointerState.pointerId)return;
  if(pointerState.mode==='group'){
    const p=canvasPoint(e),rawDx=p.x-pointerState.start.x,rawDy=p.y-pointerState.start.y;
    let minDx=-Infinity,maxDx=Infinity,minDy=-Infinity,maxDy=Infinity;
    for(const item of pointerState.items){
      const minPct=item.type==='text'?2:3,maxPct=item.type==='text'?98:97;
      minDx=Math.max(minDx,canvas.width*(minPct-item.xPct)/100);
      maxDx=Math.min(maxDx,canvas.width*(maxPct-item.xPct)/100);
      minDy=Math.max(minDy,canvas.height*(minPct-item.yPct)/100);
      maxDy=Math.min(maxDy,canvas.height*(maxPct-item.yPct)/100);
    }
    dragPreview.dx=clamp(rawDx,minDx,maxDx);dragPreview.dy=clamp(rawDy,minDy,maxDy);scheduleOverlay();
    e.preventDefault();e.stopImmediatePropagation();return;
  }
  if(pointerState.mode==='marquee'){
    pointerState.current=canvasPoint(e);
    const dx=pointerState.current.x-pointerState.start.x,dy=pointerState.current.y-pointerState.start.y;
    if(!pointerState.started&&Math.hypot(dx,dy)>5)pointerState.started=true;
    if(pointerState.started){showMarquee();updateMarqueeSelection()}
    e.preventDefault();e.stopImmediatePropagation();
  }
},true);

function finishPointer(e){
  if(!pointerState||e.pointerId!==pointerState.pointerId)return;
  if(pointerState.mode==='group'){
    const d=dragPreview||{dx:0,dy:0};
    const targets=pointerState.items.map(item=>({item,cx:item.center.x+d.dx,cy:item.center.y+d.dy}));
    pointerState=null;commitTargets(targets);e.preventDefault();e.stopImmediatePropagation();return;
  }
  if(pointerState.mode==='marquee'){
    marquee.hidden=true;
    pointerState=null;scheduleOverlay();e.preventDefault();e.stopImmediatePropagation();
  }
}
canvas.addEventListener('pointerup',finishPointer,true);
canvas.addEventListener('pointercancel',()=>{marquee.hidden=true;dragPreview=null;pointerState=null;scheduleOverlay()},true);

canvas.addEventListener('pointermove',e=>{if(!pointerState&&selected.size&&e.buttons&1)scheduleOverlay()},{passive:true});
canvas.addEventListener('pointerup',()=>{if(!pointerState&&selected.size)requestAnimationFrame(scheduleOverlay)},{passive:true});
window.addEventListener('resize',scheduleOverlay,{passive:true});
window.addEventListener('scroll',scheduleOverlay,{passive:true,capture:true});
document.addEventListener('input',()=>{if(selected.size)scheduleOverlay()},{passive:true});
document.addEventListener('change',()=>{if(selected.size)scheduleOverlay()},{passive:true});

function showMenu(x,y){
  const arr=snapshotSelected();if(arr.length<2)return false;
  menu.hidden=false;menu.querySelector('.fw24-count').textContent=arr.length+' selected';
  const movable=arr.filter(x=>x.movable);
  menu.querySelectorAll('[data-cmd]:not([data-cmd="clear"])').forEach(b=>b.disabled=movable.length<2);
  menu.querySelector('[data-cmd="distH"]').disabled=movable.length<3;
  menu.querySelector('[data-cmd="distV"]').disabled=movable.length<3;
  const mw=240,mh=menu.offsetHeight||300;
  menu.style.left=Math.max(8,Math.min(x,window.innerWidth-mw-8))+'px';
  menu.style.top=Math.max(8,Math.min(y,window.innerHeight-mh-8))+'px';
  return true;
}
canvas.addEventListener('contextmenu',e=>{
  const hit=hitItem(canvasPoint(e));
  if(hit&&!selected.has(hit.id)){setSingle(hit)}
  if(selected.size<2)return;
  e.preventDefault();showMenu(e.clientX,e.clientY);
});
document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!e.target.closest('.fw24-menu'))hideMenu()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')clearSelection()});

function align(cmd){
  let arr=snapshotSelected().filter(x=>x.movable);if(arr.length<2)return;
  if(cmd==='distH'||cmd==='distV'){
    if(arr.length<3)return;
    const horizontal=cmd==='distH';
    arr=[...arr].sort((a,b)=>(horizontal?a.center.x-b.center.x:a.center.y-b.center.y));
    const first=horizontal?arr[0].center.x:arr[0].center.y,last=horizontal?arr.at(-1).center.x:arr.at(-1).center.y,step=(last-first)/(arr.length-1);
    const targets=arr.map((item,i)=>({item,cx:horizontal?first+step*i:item.center.x,cy:horizontal?item.center.y:first+step*i}));
    commitTargets(targets);return;
  }
  const left=Math.min(...arr.map(i=>i.bounds.x)),right=Math.max(...arr.map(i=>i.bounds.x+i.bounds.w));
  const top=Math.min(...arr.map(i=>i.bounds.y)),bottom=Math.max(...arr.map(i=>i.bounds.y+i.bounds.h));
  const centerX=(left+right)/2,centerY=(top+bottom)/2;
  let targets=arr.map(item=>{
    let cx=item.center.x,cy=item.center.y;
    if(cmd==='left')cx=left+item.bounds.w/2;
    else if(cmd==='hcenter')cx=centerX;
    else if(cmd==='right')cx=right-item.bounds.w/2;
    else if(cmd==='top')cy=top+item.bounds.h/2;
    else if(cmd==='vcenter')cy=centerY;
    else if(cmd==='bottom')cy=bottom-item.bounds.h/2;
    return{item,cx,cy};
  });
  if(cmd==='canvasH'){
    const groupCenter=(left+right)/2,dx=canvas.width/2-groupCenter;
    targets=arr.map(item=>({item,cx:item.center.x+dx,cy:item.center.y}));
  }else if(cmd==='canvasV'){
    const groupCenter=(top+bottom)/2,dy=canvas.height/2-groupCenter;
    targets=arr.map(item=>({item,cx:item.center.x,cy:item.center.y+dy}));
  }
  commitTargets(targets);
}
menu.addEventListener('click',e=>{
  const b=e.target.closest('[data-cmd]');if(!b||b.disabled)return;
  const cmd=b.dataset.cmd;if(cmd==='clear')clearSelection();else{align(cmd);hideMenu()}
});

document.addEventListener('click',e=>{
  if(!modifier(e))return;
  const wave=e.target.closest?.('.mw-item .mw-select');
  if(wave){const i=Number(wave.closest('.mw-item')?.dataset.i),item=allItems().find(x=>x.type==='wave'&&x.index===i);if(item){e.preventDefault();e.stopImmediatePropagation();toggle(item)}return}
  const card=e.target.closest?.('#textList .text-card');
  if(card&&e.target.closest('header')){const i=Number(card.dataset.index),item=allItems().find(x=>x.type==='text'&&x.index===i);if(item){e.preventDefault();e.stopImmediatePropagation();toggle(item)}}
},true);

window.__FW_MULTI_SELECT={
  clear:clearSelection,
  getSelection:()=>[...selected],
  refresh:scheduleOverlay,
  selectAll:()=>{selected.clear();allItems().forEach(x=>selected.add(x.id));scheduleOverlay()}
};
})();