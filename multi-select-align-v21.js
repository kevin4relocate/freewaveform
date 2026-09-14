(()=>{
'use strict';

const canvas=document.getElementById('canvas');
const stage=document.getElementById('stageWrap');
if(!canvas||!stage)return;

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

function canvasPoint(e){
  const r=canvas.getBoundingClientRect();
  return{x:(e.clientX-r.left)/r.width*canvas.width,y:(e.clientY-r.top)/r.height*canvas.height};
}
function textCards(){return [...document.querySelectorAll('#textList .text-card')]}
function textItem(index,cards,positions){
  const card=cards[index];
  const p=positions[index];
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
  const style=w.style||'brushRing',m=Math.min(canvas.width,canvas.height);
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
function snapshotSelected(){
  if(!selected.size)return[];
  const cards=textCards(),positions=window.__FW_TEXT_BRIDGE?.getPositions?.()||[],layers=window.__FW_MULTI_WAVE?.getLayers?.()||[];
  const out=[];
  for(const id of selected){
    const [type,raw]=id.split(':'),index=Number(raw);
    const item=type==='text'?textItem(index,cards,positions):type==='wave'?waveItem(index,layers):null;
    if(item)out.push(item);
  }
  return out;
}
function allItems(){
  const cards=textCards(),positions=window.__FW_TEXT_BRIDGE?.getPositions?.()||[],layers=window.__FW_MULTI_WAVE?.getLayers?.()||[];
  const out=[];
  for(let i=0;i<cards.length;i++){const item=textItem(i,cards,positions);if(item)out.push(item)}
  for(let i=0;i<layers.length;i++){const item=waveItem(i,layers);if(item)out.push(item)}
  return out;
}
function hitItem(p){
  const all=allItems(),texts=all.filter(x=>x.type==='text'),waves=all.filter(x=>x.type==='wave');
  for(let i=texts.length-1;i>=0;i--){const b=texts[i].bounds;if(p.x>=b.x-12&&p.x<=b.x+b.w+12&&p.y>=b.y-10&&p.y<=b.y+b.h+10)return texts[i]}
  for(let i=waves.length-1;i>=0;i--){
    const q=waves[i],b=q.bounds;
    if(ROUNDISH.has(q.style)){
      const rx=b.w/2,ry=b.h/2,nx=(p.x-q.center.x)/(rx||1),ny=(p.y-q.center.y)/(ry||1),d=Math.hypot(nx,ny);
      if(d>=.48&&d<=1.18)return q;
    }else if(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)return q;
  }
  return null;
}

const overlay=document.createElement('div');overlay.className='fw-multi-select-overlay';document.body.appendChild(overlay);
const badge=document.createElement('div');badge.className='fw-selection-badge';badge.hidden=true;document.body.appendChild(badge);
const menu=document.createElement('div');menu.className='fw-align-menu';menu.hidden=true;
menu.innerHTML=`
  <div class="fw-align-head"><b>Align selection</b><span class="fw-align-count"></span></div>
  <div class="fw-align-grid">
    <button data-cmd="left">⇤ <span>Left</span></button><button data-cmd="hcenter">↔ <span>Center</span></button><button data-cmd="right">⇥ <span>Right</span></button>
    <button data-cmd="top">⇡ <span>Top</span></button><button data-cmd="vcenter">↕ <span>Middle</span></button><button data-cmd="bottom">⇣ <span>Bottom</span></button>
  </div>
  <div class="fw-align-sep"></div>
  <button class="fw-align-wide" data-cmd="canvasH">Center horizontally on canvas</button>
  <button class="fw-align-wide" data-cmd="canvasV">Center vertically on canvas</button>
  <button class="fw-align-wide fw-distribute" data-cmd="distH">Distribute horizontally</button>
  <button class="fw-align-wide fw-distribute" data-cmd="distV">Distribute vertically</button>
  <div class="fw-align-sep"></div>
  <button class="fw-align-wide muted" data-cmd="clear">Clear selection</button>`;
document.body.appendChild(menu);

const style=document.createElement('style');style.id='fw-multi-select-align-v22-style';style.textContent=`
.fw-multi-select-overlay{position:fixed;inset:0;pointer-events:none;z-index:80;contain:layout style paint}
.fw-select-box{position:fixed;border:1.5px solid #e0a956;border-radius:7px;box-shadow:0 0 0 1px rgba(0,0,0,.45),0 0 0 3px rgba(224,169,86,.10);pointer-events:none;will-change:transform,width,height}
.fw-select-box.wave{border-style:dashed;border-color:#79b9ff}.fw-select-tag{position:absolute;left:4px;top:-20px;height:17px;padding:0 6px;border-radius:5px;background:#0c1113;border:1px solid #4a3b27;color:#ebbd72;font:700 9px/15px Inter,system-ui,sans-serif;white-space:nowrap}
.fw-select-box.wave .fw-select-tag{color:#9fd0ff;border-color:#294c68}
.fw-selection-badge{position:fixed;z-index:82;padding:6px 9px;border:1px solid #554126;border-radius:8px;background:rgba(9,13,15,.94);color:#d9c9b4;font:600 9px Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.26);pointer-events:none}
.fw-align-menu{position:fixed;z-index:110;width:224px;padding:8px;border:1px solid #333b40;border-radius:10px;background:#0c1113;color:#ded7cc;box-shadow:0 18px 44px rgba(0,0,0,.48);font-family:Inter,system-ui,sans-serif}
.fw-align-head{display:flex;justify-content:space-between;align-items:center;padding:3px 4px 8px;font-size:10px}.fw-align-head span{color:#8f8a82;font-size:8px}
.fw-align-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.fw-align-menu button{border:1px solid #293136;background:#11171a;color:#cfc7bb;border-radius:7px;cursor:pointer}.fw-align-grid button{height:42px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:15px}.fw-align-grid button span{font-size:8px}.fw-align-menu button:hover{border-color:#765733;background:#1b1711;color:#f0c57f}.fw-align-wide{width:100%;height:29px;margin-top:4px;padding:0 8px;text-align:left;font-size:9px}.fw-align-menu button:disabled{opacity:.35;cursor:not-allowed}.fw-align-sep{height:1px;background:#252c30;margin:7px 1px 3px}.fw-align-wide.muted{color:#8e8981}
`;document.head.appendChild(style);

function ensureBox(item){
  let box=boxes.get(item.id);
  if(box)return box;
  box=document.createElement('div');box.className='fw-select-box '+item.type;
  const tag=document.createElement('span');tag.className='fw-select-tag';box.appendChild(tag);overlay.appendChild(box);boxes.set(item.id,box);return box;
}
function updateOverlay(){
  const active=snapshotSelected(),keep=new Set(active.map(x=>x.id));
  for(const [id,box] of boxes){if(!keep.has(id)){box.remove();boxes.delete(id)}}
  if(!active.length){badge.hidden=true;return}
  const r=canvas.getBoundingClientRect(),sx=r.width/canvas.width,sy=r.height/canvas.height;
  for(const item of active){
    const b=item.bounds,box=ensureBox(item);
    box.className='fw-select-box '+item.type;
    box.style.transform=`translate3d(${r.left+b.x*sx}px,${r.top+b.y*sy}px,0)`;
    box.style.width=Math.max(8,b.w*sx)+'px';box.style.height=Math.max(8,b.h*sy)+'px';
    box.firstElementChild.textContent=item.label;
  }
  badge.hidden=false;badge.textContent=`${active.length} selected · Shift/Ctrl/Cmd + click · Right-click to align`;
  badge.style.left=(r.left+10)+'px';badge.style.top=(r.top+10)+'px';
}
let overlayRaf=0;
function scheduleOverlay(){if(overlayRaf)return;overlayRaf=requestAnimationFrame(()=>{overlayRaf=0;updateOverlay()})}
function hideMenu(){menu.hidden=true}
function toggle(item,additive=true){
  if(!item)return;if(!additive)selected.clear();
  if(additive&&selected.has(item.id))selected.delete(item.id);else selected.add(item.id);
  hideMenu();scheduleOverlay();
}
function clearSelection(){selected.clear();hideMenu();scheduleOverlay()}

canvas.addEventListener('pointerdown',e=>{
  if(!(e.shiftKey||e.ctrlKey||e.metaKey)||e.button!==0)return;
  const hit=hitItem(canvasPoint(e));if(!hit)return;
  e.preventDefault();e.stopImmediatePropagation();toggle(hit,true);
},true);
canvas.addEventListener('pointermove',e=>{if(selected.size&&(e.buttons&1))scheduleOverlay()},{passive:true});
canvas.addEventListener('pointerup',()=>{if(selected.size)scheduleOverlay()},{passive:true});
canvas.addEventListener('wheel',()=>{if(selected.size)scheduleOverlay()},{passive:true});
window.addEventListener('resize',scheduleOverlay,{passive:true});
window.addEventListener('scroll',scheduleOverlay,{passive:true,capture:true});

document.addEventListener('input',e=>{if(selected.size&&(e.target.closest?.('#textList')||e.target.closest?.('[data-panel="waveform"]')))scheduleOverlay()},{passive:true});
document.addEventListener('change',e=>{if(selected.size&&(e.target.closest?.('#textList')||e.target.closest?.('[data-panel="waveform"]')))scheduleOverlay()},{passive:true});
document.addEventListener('click',e=>{
  if(!(e.shiftKey||e.ctrlKey||e.metaKey))return;
  const wave=e.target.closest?.('.mw-item .mw-select');
  if(wave){const row=wave.closest('.mw-item'),i=Number(row?.dataset.i),item=waveItem(i,window.__FW_MULTI_WAVE?.getLayers?.()||[]);if(item){e.preventDefault();e.stopImmediatePropagation();toggle(item,true)}return}
  const card=e.target.closest?.('#textList .text-card');
  if(card&&e.target.closest('header')){
    const i=Number(card.dataset.index),item=textItem(i,textCards(),window.__FW_TEXT_BRIDGE?.getPositions?.()||[]);
    if(item){e.preventDefault();e.stopImmediatePropagation();toggle(item,true)}
  }
},true);

function showMenu(x,y){
  const arr=snapshotSelected();if(!arr.length)return;
  menu.hidden=false;menu.querySelector('.fw-align-count').textContent=arr.length+' selected';
  const movable=arr.filter(x=>x.movable);
  menu.querySelectorAll('[data-cmd]:not([data-cmd="clear"])').forEach(b=>b.disabled=!movable.length);
  menu.querySelector('[data-cmd="distH"]').disabled=movable.length<3;
  menu.querySelector('[data-cmd="distV"]').disabled=movable.length<3;
  const mw=236,mh=menu.offsetHeight||300;
  menu.style.left=Math.max(8,Math.min(x,window.innerWidth-mw-8))+'px';menu.style.top=Math.max(8,Math.min(y,window.innerHeight-mh-8))+'px';
}
canvas.addEventListener('contextmenu',e=>{
  const hit=hitItem(canvasPoint(e));
  if(hit&&!selected.has(hit.id)){selected.clear();selected.add(hit.id);scheduleOverlay()}
  if(!selected.size)return;e.preventDefault();showMenu(e.clientX,e.clientY);
});
document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!e.target.closest('.fw-align-menu'))hideMenu()});
window.addEventListener('blur',hideMenu);
document.addEventListener('keydown',e=>{if(e.key==='Escape')clearSelection()});

function selectWaveLayer(index){document.querySelector(`.mw-item[data-i="${index}"] .mw-select`)?.click()}
function moveWave(index,xPct,yPct){
  const w=(window.__FW_MULTI_WAVE?.getLayers?.()||[])[index];if(!w||EDGE.has(w.style))return false;
  const prevTool=document.querySelector('.tool.active')?.dataset.tool||'';
  const prevWave=Number(window.__FW_MULTI_WAVE?.getActiveIndex?.()||0);
  document.querySelector('.tool[data-tool="waveform"]')?.click();selectWaveLayer(index);
  const r=canvas.getBoundingClientRect(),E=window.PointerEvent||window.MouseEvent;
  const clientX=r.left+r.width*clamp(xPct,3,97)/100,clientY=r.top+r.height*clamp(yPct,3,97)/100;
  const common={bubbles:true,cancelable:true,clientX,clientY,button:0,pointerId:151,isPrimary:true,pointerType:'mouse'};
  canvas.dispatchEvent(new E('pointerdown',{...common,buttons:1}));canvas.dispatchEvent(new E('pointerup',{...common,buttons:0}));
  selectWaveLayer(prevWave);if(prevTool&&prevTool!=='waveform')document.querySelector(`.tool[data-tool="${prevTool}"]`)?.click();return true;
}
function moveItem(item,cx,cy){
  const x=clamp(cx/canvas.width*100,item.type==='text'?2:3,item.type==='text'?98:97),y=clamp(cy/canvas.height*100,item.type==='text'?2:3,item.type==='text'?98:97);
  if(item.type==='text')return !!window.__FW_TEXT_BRIDGE?.moveTextTo?.(item.index,x,y);
  return moveWave(item.index,x,y);
}
function align(cmd){
  let arr=snapshotSelected().filter(x=>x.movable);if(!arr.length)return;
  if(cmd==='canvasH'){arr.forEach(i=>moveItem(i,canvas.width/2,i.center.y));scheduleOverlay();return}
  if(cmd==='canvasV'){arr.forEach(i=>moveItem(i,i.center.x,canvas.height/2));scheduleOverlay();return}
  if(cmd==='distH'||cmd==='distV'){
    if(arr.length<3)return;
    const horizontal=cmd==='distH';arr=[...arr].sort((a,b)=>(horizontal?a.center.x-a.center.x:a.center.y-b.center.y));
    const first=horizontal?arr[0].center.x:arr[0].center.y,last=horizontal?arr.at(-1).center.x:arr.at(-1).center.y,step=(last-first)/(arr.length-1);
    arr.forEach((i,n)=>{if(n===0||n===arr.length-1)return;const pos=first+step*n;moveItem(i,horizontal?pos:i.center.x,horizontal?i.center.y:pos)});scheduleOverlay();return;
  }
  const left=Math.min(...arr.map(i=>i.bounds.x)),right=Math.max(...arr.map(i=>i.bounds.x+i.bounds.w)),top=Math.min(...arr.map(i=>i.bounds.y)),bottom=Math.max(...arr.map(i=>i.bounds.y+i.bounds.h));
  const hcenter=(left+right)/2,vcenter=(top+bottom)/2;
  arr.forEach(i=>{
    let cx=i.center.x,cy=i.center.y;
    if(cmd==='left')cx=left+i.bounds.w/2;else if(cmd==='hcenter')cx=hcenter;else if(cmd==='right')cx=right-i.bounds.w/2;
    else if(cmd==='top')cy=top+i.bounds.h/2;else if(cmd==='vcenter')cy=vcenter;else if(cmd==='bottom')cy=bottom-i.bounds.h/2;
    moveItem(i,cx,cy);
  });
  scheduleOverlay();
}
menu.addEventListener('click',e=>{
  const b=e.target.closest('[data-cmd]');if(!b||b.disabled)return;
  const cmd=b.dataset.cmd;if(cmd==='clear')clearSelection();else{align(cmd);hideMenu()}
});

// Important for drag performance: no polling timer and no DOM rebuilding loop.
// The overlay only refreshes when selection/drag/controls actually change.
window.__FW_MULTI_SELECT={clear:clearSelection,getSelection:()=>[...selected],refresh:scheduleOverlay};
})();
