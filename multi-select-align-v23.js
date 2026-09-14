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
let groupDrag=null;
let previewTargets=new Map();

function canvasPoint(e){
  const r=canvas.getBoundingClientRect();
  return{x:(e.clientX-r.left)/r.width*canvas.width,y:(e.clientY-r.top)/r.height*canvas.height};
}
function textCards(){return [...document.querySelectorAll('#textList .text-card')]}
function textItem(index,cards,positions){
  const card=cards[index],p=positions[index];
  if(!card||!p)return null;
  const get=k=>card.querySelector(`[data-k="${k}"]`),show=get('show'),text=String(get('text')?.value||'');
  if(!text||show?.checked===false)return null;
  const base=Math.min(canvas.width,canvas.height),size=base*((+get('size')?.value||42)/1000),font=get('font')?.value||'sans';
  ctx.save();ctx.font=`600 ${size}px ${FONT_MAP[font]||FONT_MAP.sans}`;const width=Math.max(size*.8,ctx.measureText(text).width);ctx.restore();
  const height=size*1.28,cx=canvas.width*p.x/100,cy=canvas.height*p.y/100;
  return{id:`text:${index}`,type:'text',index,label:String(card.querySelector('header strong')?.textContent||`Text ${index+1}`),xPct:p.x,yPct:p.y,movable:true,bounds:{x:cx-width/2,y:cy-height/2,w:width,h:height},center:{x:cx,y:cy}};
}
function waveItem(index,layers){
  const w=layers[index];if(!w)return null;
  const style=w.style||'brushRing',m=Math.min(canvas.width,canvas.height),xPct=Number.isFinite(+w.x)?+w.x:50,yPct=Number.isFinite(+w.y)?+w.y:50,cx=canvas.width*xPct/100,cy=canvas.height*yPct/100;
  let bounds;
  if(style==='centerLine'||style==='mountain'){
    const ww=canvas.width*(+w.size||46)/100,hh=canvas.height*.24;bounds={x:cx-ww/2,y:cy-hh/2,w:ww,h:hh};
  }else if(style==='top')bounds={x:canvas.width*.04,y:0,w:canvas.width*.92,h:canvas.height*.18};
  else if(style==='bottom')bounds={x:canvas.width*.04,y:canvas.height*.82,w:canvas.width*.92,h:canvas.height*.18};
  else if(style==='left')bounds={x:0,y:canvas.height*.16,w:canvas.width*.16,h:canvas.height*.68};
  else if(style==='right')bounds={x:canvas.width*.84,y:canvas.height*.16,w:canvas.width*.16,h:canvas.height*.68};
  else if(style==='dual')bounds={x:canvas.width*.04,y:0,w:canvas.width*.92,h:canvas.height};
  else if(style==='sides')bounds={x:0,y:canvas.height*.16,w:canvas.width,h:canvas.height*.68};
  else{const rr=m*(+w.size||46)/100*.5*1.18;bounds={x:cx-rr,y:cy-rr,w:rr*2,h:rr*2}}
  return{id:`wave:${index}`,type:'wave',index,label:w.name||`Wave ${index+1}`,style,xPct,yPct,movable:!EDGE.has(style),bounds,center:{x:bounds.x+bounds.w/2,y:bounds.y+bounds.h/2}};
}
function allItems(){
  const cards=textCards(),positions=window.__FW_TEXT_BRIDGE?.getPositions?.()||[],layers=window.__FW_MULTI_WAVE?.getLayers?.()||[],out=[];
  for(let i=0;i<cards.length;i++){const item=textItem(i,cards,positions);if(item)out.push(item)}
  for(let i=0;i<layers.length;i++){const item=waveItem(i,layers);if(item)out.push(item)}
  return out;
}
function snapshotSelected(){
  if(!selected.size)return[];
  const map=new Map(allItems().map(x=>[x.id,x]));return [...selected].map(id=>map.get(id)).filter(Boolean);
}
function hitItem(p){
  const all=allItems(),texts=all.filter(x=>x.type==='text'),waves=all.filter(x=>x.type==='wave');
  for(let i=texts.length-1;i>=0;i--){const b=texts[i].bounds;if(p.x>=b.x-12&&p.x<=b.x+b.w+12&&p.y>=b.y-10&&p.y<=b.y+b.h+10)return texts[i]}
  for(let i=waves.length-1;i>=0;i--){
    const q=waves[i],b=q.bounds;
    if(ROUNDISH.has(q.style)){
      const rx=b.w/2,ry=b.h/2,nx=(p.x-q.center.x)/(rx||1),ny=(p.y-q.center.y)/(ry||1),d=Math.hypot(nx,ny);
      if(d>=.45&&d<=1.2)return q;
    }else if(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)return q;
  }
  return null;
}

const overlay=document.createElement('div');overlay.className='fw-multi-select-overlay';document.body.appendChild(overlay);
const badge=document.createElement('div');badge.className='fw-selection-badge';badge.hidden=true;document.body.appendChild(badge);
const menu=document.createElement('div');menu.className='fw-align-menu';menu.hidden=true;
menu.innerHTML=`
  <div class="fw-align-head"><b>Selection</b><span class="fw-align-count"></span></div>
  <button class="fw-align-wide strong" data-cmd="selectAll">Select all visible <kbd>⌘/Ctrl+A</kbd></button>
  <div class="fw-select-scope"><button data-cmd="selectText">All text</button><button data-cmd="selectWave">All waveforms</button></div>
  <div class="fw-align-sep"></div>
  <div class="fw-align-grid">
    <button data-cmd="left">⇤ <span>Left</span></button><button data-cmd="hcenter">↔ <span>Center</span></button><button data-cmd="right">⇥ <span>Right</span></button>
    <button data-cmd="top">⇡ <span>Top</span></button><button data-cmd="vcenter">↕ <span>Middle</span></button><button data-cmd="bottom">⇣ <span>Bottom</span></button>
  </div>
  <div class="fw-align-sep"></div>
  <button class="fw-align-wide" data-cmd="canvasH">Center horizontally on canvas</button>
  <button class="fw-align-wide" data-cmd="canvasV">Center vertically on canvas</button>
  <button class="fw-align-wide" data-cmd="distH">Distribute horizontally</button>
  <button class="fw-align-wide" data-cmd="distV">Distribute vertically</button>
  <div class="fw-align-sep"></div>
  <button class="fw-align-wide muted" data-cmd="clear">Clear selection</button>`;
document.body.appendChild(menu);

const style=document.createElement('style');style.id='fw-multi-select-align-v23-style';style.textContent=`
.fw-multi-select-overlay{position:fixed;inset:0;pointer-events:none;z-index:80;contain:layout style paint}.fw-select-box{position:fixed;border:1.5px solid #e0a956;border-radius:7px;box-shadow:0 0 0 1px rgba(0,0,0,.45),0 0 0 3px rgba(224,169,86,.10);pointer-events:none;will-change:transform,width,height}.fw-select-box.wave{border-style:dashed;border-color:#79b9ff}.fw-select-tag{position:absolute;left:4px;top:-20px;height:17px;padding:0 6px;border-radius:5px;background:#0c1113;border:1px solid #4a3b27;color:#ebbd72;font:700 9px/15px Inter,system-ui,sans-serif;white-space:nowrap}.fw-select-box.wave .fw-select-tag{color:#9fd0ff;border-color:#294c68}.fw-selection-badge{position:fixed;z-index:82;padding:6px 9px;border:1px solid #554126;border-radius:8px;background:rgba(9,13,15,.94);color:#d9c9b4;font:600 9px Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.26);pointer-events:none}.fw-align-menu{position:fixed;z-index:110;width:232px;padding:8px;border:1px solid #333b40;border-radius:10px;background:#0c1113;color:#ded7cc;box-shadow:0 18px 44px rgba(0,0,0,.48);font-family:Inter,system-ui,sans-serif}.fw-align-head{display:flex;justify-content:space-between;align-items:center;padding:3px 4px 8px;font-size:10px}.fw-align-head span{color:#8f8a82;font-size:8px}.fw-align-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.fw-align-menu button{border:1px solid #293136;background:#11171a;color:#cfc7bb;border-radius:7px;cursor:pointer}.fw-align-grid button{height:42px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:15px}.fw-align-grid button span{font-size:8px}.fw-align-menu button:hover{border-color:#765733;background:#1b1711;color:#f0c57f}.fw-align-wide{width:100%;height:30px;margin-top:4px;padding:0 8px;text-align:left;font-size:9px}.fw-align-wide.strong{display:flex;align-items:center;justify-content:space-between;color:#e8c17e}.fw-align-wide kbd{font:600 8px Inter,system-ui,sans-serif;color:#777}.fw-select-scope{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:5px}.fw-select-scope button{height:28px;font-size:8px}.fw-align-menu button:disabled{opacity:.35;cursor:not-allowed}.fw-align-sep{height:1px;background:#252c30;margin:7px 1px 3px}.fw-align-wide.muted{color:#8e8981}
`;document.head.appendChild(style);

function ensureBox(item){
  let box=boxes.get(item.id);if(box)return box;
  box=document.createElement('div');box.className='fw-select-box '+item.type;const tag=document.createElement('span');tag.className='fw-select-tag';box.appendChild(tag);overlay.appendChild(box);boxes.set(item.id,box);return box;
}
function displayShift(item){
  if(groupDrag&&groupDrag.ids.has(item.id)&&item.movable)return{x:groupDrag.dx,y:groupDrag.dy};
  const target=previewTargets.get(item.id);if(target)return{x:target.cx-item.center.x,y:target.cy-item.center.y};
  return{x:0,y:0};
}
function updateOverlay(){
  const active=snapshotSelected(),keep=new Set(active.map(x=>x.id));for(const [id,box] of boxes){if(!keep.has(id)){box.remove();boxes.delete(id)}}
  if(!active.length){badge.hidden=true;return}
  const r=canvas.getBoundingClientRect(),sx=r.width/canvas.width,sy=r.height/canvas.height;
  for(const item of active){
    const b=item.bounds,d=displayShift(item),box=ensureBox(item);box.className='fw-select-box '+item.type;
    box.style.transform=`translate3d(${r.left+(b.x+d.x)*sx}px,${r.top+(b.y+d.y)*sy}px,0)`;box.style.width=Math.max(8,b.w*sx)+'px';box.style.height=Math.max(8,b.h*sy)+'px';box.firstElementChild.textContent=item.label;
  }
  badge.hidden=false;badge.textContent=groupDrag?`${active.length} selected · moving together`:`${active.length} selected · drag one selected item to move group · right-click to align`;
  badge.style.left=(r.left+10)+'px';badge.style.top=(r.top+10)+'px';
}
let overlayRaf=0;function scheduleOverlay(){if(overlayRaf)return;overlayRaf=requestAnimationFrame(()=>{overlayRaf=0;updateOverlay()})}
function refreshAfterCommit(){requestAnimationFrame(()=>requestAnimationFrame(()=>{previewTargets.clear();groupDrag=null;scheduleOverlay()}))}
function hideMenu(){menu.hidden=true}
function clearSelection(){selected.clear();previewTargets.clear();groupDrag=null;hideMenu();scheduleOverlay()}
function setSelection(arr){selected.clear();arr.forEach(x=>selected.add(x.id));hideMenu();scheduleOverlay()}
function toggle(item){if(!item)return;if(selected.has(item.id))selected.delete(item.id);else selected.add(item.id);hideMenu();scheduleOverlay()}
function selectAll(type){const arr=allItems().filter(x=>!type||x.type===type);setSelection(arr)}

function syntheticPointer(type,clientX,clientY,pointerId,buttons){
  const E=window.PointerEvent||window.MouseEvent,ev=new E(type,{bubbles:true,cancelable:true,composed:true,clientX,clientY,button:0,buttons,pointerId,pointerType:'mouse',isPrimary:true});
  try{Object.defineProperty(ev,'__fwSmartAlign',{value:true})}catch{}
  return ev;
}
function selectWaveLayer(index){document.querySelector(`.mw-item[data-i="${index}"] .mw-select`)?.click()}
function bulkMove(targets){
  if(!targets.length)return;
  const prevTool=document.querySelector('.tool.active')?.dataset.tool||'',prevWave=Number(window.__FW_MULTI_WAVE?.getActiveIndex?.()||0),r=canvas.getBoundingClientRect();
  const toClient=(cx,cy)=>({x:r.left+r.width*cx/canvas.width,y:r.top+r.height*cy/canvas.height});
  const textTargets=targets.filter(t=>t.item.type==='text'),waveTargets=targets.filter(t=>t.item.type==='wave'&&t.item.movable);

  if(textTargets.length){
    if(prevTool!=='text')document.querySelector('.tool[data-tool="text"]')?.click();
    textTargets.forEach((t,n)=>{
      const from=toClient(t.item.center.x,t.item.center.y),to=toClient(t.cx,t.cy),pid=230+n;
      canvas.dispatchEvent(syntheticPointer('pointerdown',from.x,from.y,pid,1));
      canvas.dispatchEvent(syntheticPointer('pointermove',to.x,to.y,pid,1));
      canvas.dispatchEvent(syntheticPointer('pointerup',to.x,to.y,pid,0));
    });
  }
  if(waveTargets.length){
    document.querySelector('.tool[data-tool="waveform"]')?.click();
    waveTargets.forEach((t,n)=>{
      selectWaveLayer(t.item.index);const to=toClient(t.cx,t.cy),pid=280+n;
      canvas.dispatchEvent(syntheticPointer('pointerdown',to.x,to.y,pid,1));
      canvas.dispatchEvent(syntheticPointer('pointerup',to.x,to.y,pid,0));
    });
    selectWaveLayer(prevWave);
  }
  if(prevTool&&document.querySelector('.tool.active')?.dataset.tool!==prevTool)document.querySelector(`.tool[data-tool="${prevTool}"]`)?.click();
  refreshAfterCommit();
}

function beginGroupDrag(e,hit){
  const arr=snapshotSelected().filter(x=>x.movable);if(arr.length<2||!hit||!selected.has(hit.id)||!hit.movable)return false;
  const p=canvasPoint(e),ids=new Set(arr.map(x=>x.id));
  let minDx=-Infinity,maxDx=Infinity,minDy=-Infinity,maxDy=Infinity;
  arr.forEach(i=>{minDx=Math.max(minDx,-i.bounds.x);maxDx=Math.min(maxDx,canvas.width-(i.bounds.x+i.bounds.w));minDy=Math.max(minDy,-i.bounds.y);maxDy=Math.min(maxDy,canvas.height-(i.bounds.y+i.bounds.h))});
  groupDrag={pointerId:e.pointerId,start:p,dx:0,dy:0,items:arr,ids,minDx,maxDx,minDy,maxDy};
  try{canvas.setPointerCapture(e.pointerId)}catch{}
  hideMenu();scheduleOverlay();return true;
}
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;const hit=hitItem(canvasPoint(e)),modifier=e.shiftKey||e.ctrlKey||e.metaKey;
  if(modifier){if(hit){e.preventDefault();e.stopImmediatePropagation();toggle(hit)}return}
  if(selected.size>1&&hit&&selected.has(hit.id)&&beginGroupDrag(e,hit)){e.preventDefault();e.stopImmediatePropagation()}
},true);
canvas.addEventListener('pointermove',e=>{
  if(!groupDrag||e.pointerId!==groupDrag.pointerId)return;
  const p=canvasPoint(e);groupDrag.dx=clamp(p.x-groupDrag.start.x,groupDrag.minDx,groupDrag.maxDx);groupDrag.dy=clamp(p.y-groupDrag.start.y,groupDrag.minDy,groupDrag.maxDy);e.preventDefault();e.stopImmediatePropagation();scheduleOverlay();
},true);
function endGroupDrag(e){
  if(!groupDrag||e.pointerId!==groupDrag.pointerId)return;
  e.preventDefault();e.stopImmediatePropagation();const g=groupDrag,targets=g.items.map(item=>({item,cx:item.center.x+g.dx,cy:item.center.y+g.dy}));
  previewTargets=new Map(targets.map(t=>[t.item.id,{cx:t.cx,cy:t.cy}]));groupDrag=null;bulkMove(targets);
}
canvas.addEventListener('pointerup',endGroupDrag,true);canvas.addEventListener('pointercancel',endGroupDrag,true);
canvas.addEventListener('wheel',()=>{if(selected.size)scheduleOverlay()},{passive:true});window.addEventListener('resize',scheduleOverlay,{passive:true});window.addEventListener('scroll',scheduleOverlay,{passive:true,capture:true});
document.addEventListener('input',e=>{if(selected.size&&(e.target.closest?.('#textList')||e.target.closest?.('[data-panel="waveform"]')))scheduleOverlay()},{passive:true});document.addEventListener('change',e=>{if(selected.size&&(e.target.closest?.('#textList')||e.target.closest?.('[data-panel="waveform"]')))scheduleOverlay()},{passive:true});

document.addEventListener('click',e=>{
  if(!(e.shiftKey||e.ctrlKey||e.metaKey))return;
  const wave=e.target.closest?.('.mw-item .mw-select');if(wave){const i=Number(wave.closest('.mw-item')?.dataset.i),item=waveItem(i,window.__FW_MULTI_WAVE?.getLayers?.()||[]);if(item){e.preventDefault();e.stopImmediatePropagation();toggle(item)}return}
  const card=e.target.closest?.('#textList .text-card');if(card&&e.target.closest('header')){const i=Number(card.dataset.index),item=textItem(i,textCards(),window.__FW_TEXT_BRIDGE?.getPositions?.()||[]);if(item){e.preventDefault();e.stopImmediatePropagation();toggle(item)}}
},true);

function showMenu(x,y){
  const arr=snapshotSelected(),movable=arr.filter(x=>x.movable);menu.hidden=false;menu.querySelector('.fw-align-count').textContent=arr.length?arr.length+' selected':'nothing selected';
  ['left','hcenter','right','top','vcenter','bottom','canvasH','canvasV'].forEach(cmd=>{menu.querySelector(`[data-cmd="${cmd}"]`).disabled=movable.length<1});menu.querySelector('[data-cmd="distH"]').disabled=movable.length<3;menu.querySelector('[data-cmd="distV"]').disabled=movable.length<3;
  const mw=244,mh=menu.offsetHeight||360;menu.style.left=Math.max(8,Math.min(x,window.innerWidth-mw-8))+'px';menu.style.top=Math.max(8,Math.min(y,window.innerHeight-mh-8))+'px';
}
canvas.addEventListener('contextmenu',e=>{
  const hit=hitItem(canvasPoint(e));if(hit&&!selected.has(hit.id)&&selected.size<=1){selected.clear();selected.add(hit.id);scheduleOverlay()}
  e.preventDefault();showMenu(e.clientX,e.clientY);
});
document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!e.target.closest('.fw-align-menu'))hideMenu()});window.addEventListener('blur',hideMenu);

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){clearSelection();return}
  if(!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=='a')return;
  const tag=document.activeElement?.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||document.activeElement?.isContentEditable)return;
  e.preventDefault();selectAll();
});

function align(cmd){
  let arr=snapshotSelected().filter(x=>x.movable);if(!arr.length)return;
  const targets=[];
  if(cmd==='canvasH')arr.forEach(i=>targets.push({item:i,cx:canvas.width/2,cy:i.center.y}));
  else if(cmd==='canvasV')arr.forEach(i=>targets.push({item:i,cx:i.center.x,cy:canvas.height/2}));
  else if(cmd==='distH'||cmd==='distV'){
    if(arr.length<3)return;const h=cmd==='distH';arr=[...arr].sort((a,b)=>(h?a.center.x-b.center.x:a.center.y-b.center.y));const first=h?arr[0].center.x:arr[0].center.y,last=h?arr.at(-1).center.x:arr.at(-1).center.y,step=(last-first)/(arr.length-1);
    arr.forEach((i,n)=>{const pos=first+step*n;targets.push({item:i,cx:h?pos:i.center.x,cy:h?i.center.y:pos})});
  }else{
    const left=Math.min(...arr.map(i=>i.bounds.x)),right=Math.max(...arr.map(i=>i.bounds.x+i.bounds.w)),top=Math.min(...arr.map(i=>i.bounds.y)),bottom=Math.max(...arr.map(i=>i.bounds.y+i.bounds.h)),hc=(left+right)/2,vc=(top+bottom)/2;
    arr.forEach(i=>{let cx=i.center.x,cy=i.center.y;if(cmd==='left')cx=left+i.bounds.w/2;else if(cmd==='hcenter')cx=hc;else if(cmd==='right')cx=right-i.bounds.w/2;else if(cmd==='top')cy=top+i.bounds.h/2;else if(cmd==='vcenter')cy=vc;else if(cmd==='bottom')cy=bottom-i.bounds.h/2;targets.push({item:i,cx,cy})});
  }
  previewTargets=new Map(targets.map(t=>[t.item.id,{cx:t.cx,cy:t.cy}]));scheduleOverlay();bulkMove(targets);
}
menu.addEventListener('click',e=>{
  const b=e.target.closest('[data-cmd]');if(!b||b.disabled)return;const cmd=b.dataset.cmd;
  if(cmd==='selectAll'){selectAll();showMenu(parseFloat(menu.style.left)||20,parseFloat(menu.style.top)||20);return}
  if(cmd==='selectText'){selectAll('text');showMenu(parseFloat(menu.style.left)||20,parseFloat(menu.style.top)||20);return}
  if(cmd==='selectWave'){selectAll('wave');showMenu(parseFloat(menu.style.left)||20,parseFloat(menu.style.top)||20);return}
  if(cmd==='clear'){clearSelection();return}
  align(cmd);hideMenu();
});

window.__FW_MULTI_SELECT={clear:clearSelection,getSelection:()=>[...selected],selectAll:()=>selectAll(),refresh:scheduleOverlay};
})();