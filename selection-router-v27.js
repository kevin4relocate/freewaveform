(()=>{
'use strict';

const canvas=document.getElementById('canvas');
if(!canvas)return;

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
const ctx=canvas.getContext('2d');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

let singleDrag=null;
let marqueeDrag=null;
let refreshRaf=0;

function selectionApi(){return window.__FW_MULTI_SELECT}
function selectedIds(){return new Set(selectionApi()?.getSelection?.()||[])}
function activeTool(){return document.querySelector('.tool.active')?.dataset.tool||''}
function modifier(e){return !!(e.shiftKey||e.ctrlKey||e.metaKey)}
function canvasPoint(e){
  const r=canvas.getBoundingClientRect();
  return{x:(e.clientX-r.left)/r.width*canvas.width,y:(e.clientY-r.top)/r.height*canvas.height};
}
function clientPoint(x,y){
  const r=canvas.getBoundingClientRect();
  return{x:r.left+r.width*x/canvas.width,y:r.top+r.height*y/canvas.height};
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
  const height=size*1.28,cx=canvas.width*(+p.x||50)/100,cy=canvas.height*(+p.y||50)/100;
  return{id:`text:${index}`,type:'text',index,label:String(card.querySelector('header strong')?.textContent||`Text ${index+1}`),xPct:+p.x||50,yPct:+p.y||50,movable:true,bounds:{x:cx-width/2,y:cy-height/2,w:width,h:height},center:{x:cx,y:cy}};
}
function waveItem(index,layers){
  const w=layers[index];if(!w||w.showWave===false)return null;
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
  const cards=textCards(),positions=window.__FW_TEXT_BRIDGE?.getPositions?.()||[],layers=window.__FW_MULTI_WAVE?.getLayers?.()||[],out=[];
  for(let i=0;i<cards.length;i++){const item=textItem(i,cards,positions);if(item)out.push(item)}
  for(let i=0;i<layers.length;i++){const item=waveItem(i,layers);if(item)out.push(item)}
  return out;
}
function hitItem(p){
  const all=allItems(),texts=all.filter(x=>x.type==='text'),waves=all.filter(x=>x.type==='wave');
  for(let i=texts.length-1;i>=0;i--){
    const q=texts[i],b=q.bounds;
    if(p.x>=b.x-12&&p.x<=b.x+b.w+12&&p.y>=b.y-10&&p.y<=b.y+b.h+10)return q;
  }
  for(let i=waves.length-1;i>=0;i--){
    const q=waves[i],b=q.bounds;
    if(ROUNDISH.has(q.style)){
      const rx=b.w/2,ry=b.h/2,nx=(p.x-q.center.x)/(rx||1),ny=(p.y-q.center.y)/(ry||1),d=Math.hypot(nx,ny);
      if(d>=.42&&d<=1.24)return q;
    }else if(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)return q;
  }
  return null;
}
function intersects(a,b){return a.x<=b.x+b.w&&a.x+a.w>=b.x&&a.y<=b.y+b.h&&a.y+a.h>=b.y}
function scheduleRefresh(){
  if(refreshRaf)return;
  refreshRaf=requestAnimationFrame(()=>{refreshRaf=0;selectionApi()?.refresh?.()});
}

function toggleViaUi(item){
  let target=null;
  if(item.type==='wave')target=document.querySelector(`.mw-item[data-i="${item.index}"] .mw-select`);
  else target=textCards()[item.index]?.querySelector('header');
  if(!target)return false;
  target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:true,view:window}));
  return true;
}
function setSelection(items){
  const api=selectionApi();if(!api)return;
  api.clear?.();
  for(const item of items)toggleViaUi(item);
  scheduleRefresh();
}
function focusSingle(item){
  if(!item)return;
  if(item.type==='text'){
    if(activeTool()!=='text')document.querySelector('.tool[data-tool="text"]')?.click();
    return;
  }
  if(activeTool()!=='waveform')document.querySelector('.tool[data-tool="waveform"]')?.click();
  document.querySelector(`.mw-item[data-i="${item.index}"] .mw-select`)?.click();
}

function internalPointer(type,clientX,clientY,pointerId,buttons){
  const E=window.PointerEvent||window.MouseEvent;
  const ev=new E(type,{bubbles:true,cancelable:true,composed:true,clientX,clientY,button:0,buttons,pointerId,pointerType:'mouse',isPrimary:true});
  try{Object.defineProperty(ev,'__fwSmartAlign',{value:true})}catch{}
  try{Object.defineProperty(ev,'__fwMultiAlignCommit',{value:true})}catch{}
  try{Object.defineProperty(ev,'__fwSelectionRouterInternal',{value:true})}catch{}
  return ev;
}
function startSingleDrag(e,item){
  if(!item.movable)return;
  const start=canvasPoint(e),center=clientPoint(item.center.x,item.center.y);
  singleDrag={pointerId:e.pointerId,item,start,moved:false,lastCenter:{x:item.center.x,y:item.center.y}};
  canvas.dispatchEvent(internalPointer('pointerdown',center.x,center.y,e.pointerId,1));
}
function moveSingleDrag(e){
  const d=singleDrag;if(!d||e.pointerId!==d.pointerId)return false;
  const p=canvasPoint(e),dx=p.x-d.start.x,dy=p.y-d.start.y;
  if(!d.moved&&Math.hypot(dx,dy)<2)return true;
  d.moved=true;
  const minPct=d.item.type==='text'?2:3,maxPct=d.item.type==='text'?98:97;
  const cx=clamp(d.item.center.x+dx,canvas.width*minPct/100,canvas.width*maxPct/100);
  const cy=clamp(d.item.center.y+dy,canvas.height*minPct/100,canvas.height*maxPct/100);
  d.lastCenter={x:cx,y:cy};
  const c=clientPoint(cx,cy);
  canvas.dispatchEvent(internalPointer('pointermove',c.x,c.y,e.pointerId,1));
  scheduleRefresh();
  return true;
}
function endSingleDrag(e){
  const d=singleDrag;if(!d||e.pointerId!==d.pointerId)return false;
  const c=clientPoint(d.lastCenter.x,d.lastCenter.y);
  canvas.dispatchEvent(internalPointer('pointerup',c.x,c.y,e.pointerId,0));
  singleDrag=null;requestAnimationFrame(scheduleRefresh);return true;
}

const marquee=document.createElement('div');
marquee.className='fw27-router-marquee';marquee.hidden=true;document.body.appendChild(marquee);
const style=document.createElement('style');style.id='fw27-router-style';style.textContent=`
.fw27-router-marquee{position:fixed;z-index:90;border:1px solid #79b9ff;background:rgba(121,185,255,.10);box-shadow:0 0 0 1px rgba(121,185,255,.14) inset;pointer-events:none}
`;document.head.appendChild(style);
function startMarquee(e){
  const p=canvasPoint(e);marqueeDrag={pointerId:e.pointerId,start:p,current:p,moved:false};
  marquee.hidden=true;selectionApi()?.clear?.();
}
function moveMarquee(e){
  const d=marqueeDrag;if(!d||e.pointerId!==d.pointerId)return false;
  d.current=canvasPoint(e);
  if(!d.moved&&Math.hypot(d.current.x-d.start.x,d.current.y-d.start.y)<5)return true;
  d.moved=true;
  const r=canvas.getBoundingClientRect(),x1=r.left+Math.min(d.start.x,d.current.x)/canvas.width*r.width,y1=r.top+Math.min(d.start.y,d.current.y)/canvas.height*r.height,x2=r.left+Math.max(d.start.x,d.current.x)/canvas.width*r.width,y2=r.top+Math.max(d.start.y,d.current.y)/canvas.height*r.height;
  marquee.hidden=false;marquee.style.left=x1+'px';marquee.style.top=y1+'px';marquee.style.width=Math.max(1,x2-x1)+'px';marquee.style.height=Math.max(1,y2-y1)+'px';
  return true;
}
function endMarquee(e){
  const d=marqueeDrag;if(!d||e.pointerId!==d.pointerId)return false;
  marquee.hidden=true;marqueeDrag=null;
  if(!d.moved){selectionApi()?.clear?.();return true}
  const rect={x:Math.min(d.start.x,d.current.x),y:Math.min(d.start.y,d.current.y),w:Math.abs(d.current.x-d.start.x),h:Math.abs(d.current.y-d.start.y)};
  const hits=allItems().filter(item=>intersects(rect,item.bounds));
  setSelection(hits);
  if(hits.length===1)focusSingle(hits[0]);
  return true;
}

// This document-level capture listener runs before the legacy canvas handlers.
// It keeps selection independent from the active tab and prevents a waveform
// from jumping to the click point when it is merely being selected.
document.addEventListener('pointerdown',e=>{
  if(e.__fwSelectionRouterInternal||e.button!==0||e.target!==canvas)return;
  if(modifier(e))return; // legacy multi-select toggle behavior is correct
  const p=canvasPoint(e),hit=hitItem(p),sel=selectedIds();

  // Existing multi/group drag already handles this case efficiently.
  if(hit&&sel.size>=2&&sel.has(hit.id))return;

  if(hit){
    e.preventDefault();e.stopImmediatePropagation();
    setSelection([hit]);
    focusSingle(hit);
    startSingleDrag(e,hit);
    return;
  }

  // Keep Image-tab background panning intact. In every other tab an empty
  // drag is a marquee selection, matching a normal canvas editor.
  if(activeTool()==='image')return;
  e.preventDefault();e.stopImmediatePropagation();startMarquee(e);
},true);

document.addEventListener('pointermove',e=>{
  if(e.__fwSelectionRouterInternal)return;
  if(moveSingleDrag(e)||moveMarquee(e)){e.preventDefault();e.stopImmediatePropagation()}
},true);
document.addEventListener('pointerup',e=>{
  if(e.__fwSelectionRouterInternal)return;
  if(endSingleDrag(e)||endMarquee(e)){e.preventDefault();e.stopImmediatePropagation()}
},true);
document.addEventListener('pointercancel',e=>{
  if(singleDrag&&e.pointerId===singleDrag.pointerId)singleDrag=null;
  if(marqueeDrag&&e.pointerId===marqueeDrag.pointerId){marqueeDrag=null;marquee.hidden=true}
},true);

// Editor-style Select All from any tab. Inputs keep their normal Cmd/Ctrl+A.
document.addEventListener('keydown',e=>{
  if(!(e.ctrlKey||e.metaKey)||String(e.key).toLowerCase()!=='a')return;
  const t=e.target;if(t?.matches?.('input,textarea,select,[contenteditable="true"]'))return;
  const items=allItems();if(!items.length)return;
  e.preventDefault();setSelection(items);
  if(items.length===1)focusSingle(items[0]);
});

window.__FW_SELECTION_ROUTER={
  allItems:()=>allItems().map(x=>({...x,bounds:{...x.bounds},center:{...x.center}})),
  focusSingle,
  selectItems:setSelection
};
})();