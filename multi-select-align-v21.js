(()=>{
'use strict';

const canvas=document.getElementById('canvas');
const stage=document.getElementById('stageWrap');
if(!canvas||!stage)return;

const selected=new Set();
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
function notify(text){
  const t=document.getElementById('toast');if(!t)return;
  t.textContent=text;t.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>t.classList.remove('show'),2200);
}
function canvasPoint(e){
  const r=canvas.getBoundingClientRect();
  return{x:(e.clientX-r.left)/r.width*canvas.width,y:(e.clientY-r.top)/r.height*canvas.height};
}
function textCards(){return [...document.querySelectorAll('#textList .text-card')]}
function textItems(){
  const positions=window.__FW_TEXT_BRIDGE?.getPositions?.()||[];
  const ctx=canvas.getContext('2d'),base=Math.min(canvas.width,canvas.height);
  return textCards().map((card,index)=>{
    const get=k=>card.querySelector(`[data-k="${k}"]`);
    const p=positions[index];
    const show=get('show');
    const text=String(get('text')?.value||'');
    if(!p||!text||show?.checked===false)return null;
    const size=base*((+get('size')?.value||42)/1000);
    const font=get('font')?.value||'sans';
    ctx.save();ctx.font=`600 ${size}px ${FONT_MAP[font]||FONT_MAP.sans}`;
    const width=Math.max(size*.8,ctx.measureText(text).width);ctx.restore();
    const height=size*1.28,cx=canvas.width*p.x/100,cy=canvas.height*p.y/100;
    return{id:`text:${index}`,type:'text',index,label:String(card.querySelector('header strong')?.textContent||`Text ${index+1}`),xPct:p.x,yPct:p.y,movable:true,bounds:{x:cx-width/2,y:cy-height/2,w:width,h:height},center:{x:cx,y:cy}};
  }).filter(Boolean);
}
function waveItems(){
  const layers=window.__FW_MULTI_WAVE?.getLayers?.()||[];
  const m=Math.min(canvas.width,canvas.height);
  return layers.map((w,index)=>{
    const style=w.style||'brushRing',cx=canvas.width*(Number.isFinite(+w.x)?+w.x:50)/100,cy=canvas.height*(Number.isFinite(+w.y)?+w.y:50)/100;
    let bounds;
    if(style==='centerLine'||style==='mountain'){
      const ww=canvas.width*(+w.size||46)/100,hh=canvas.height*.24;
      bounds={x:cx-ww/2,y:cy-hh/2,w:ww,h:hh};
    }else if(style==='top') bounds={x:canvas.width*.04,y:0,w:canvas.width*.92,h:canvas.height*.18};
    else if(style==='bottom') bounds={x:canvas.width*.04,y:canvas.height*.82,w:canvas.width*.92,h:canvas.height*.18};
    else if(style==='left') bounds={x:0,y:canvas.height*.16,w:canvas.width*.16,h:canvas.height*.68};
    else if(style==='right') bounds={x:canvas.width*.84,y:canvas.height*.16,w:canvas.width*.16,h:canvas.height*.68};
    else if(style==='dual') bounds={x:canvas.width*.04,y:0,w:canvas.width*.92,h:canvas.height};
    else if(style==='sides') bounds={x:0,y:canvas.height*.16,w:canvas.width,h:canvas.height*.68};
    else{
      const r=m*(+w.size||46)/100*.5*1.18;
      bounds={x:cx-r,y:cy-r,w:r*2,h:r*2};
    }
    return{id:`wave:${index}`,type:'wave',index,label:w.name||`Wave ${index+1}`,style,xPct:Number.isFinite(+w.x)?+w.x:50,yPct:Number.isFinite(+w.y)?+w.y:50,movable:!EDGE.has(style),bounds,center:{x:bounds.x+bounds.w/2,y:bounds.y+bounds.h/2}};
  });
}
function items(){return[...textItems(),...waveItems()]}
function byId(id){return items().find(x=>x.id===id)||null}
function selectedItems(){return [...selected].map(byId).filter(Boolean)}

function hitItem(p){
  const texts=textItems();
  for(let i=texts.length-1;i>=0;i--){const b=texts[i].bounds;if(p.x>=b.x-12&&p.x<=b.x+b.w+12&&p.y>=b.y-10&&p.y<=b.y+b.h+10)return texts[i]}
  const waves=waveItems();
  for(let i=waves.length-1;i>=0;i--){
    const q=waves[i],b=q.bounds;
    if(ROUNDISH.has(q.style)){
      const rx=b.w/2,ry=b.h/2,nx=(p.x-q.center.x)/(rx||1),ny=(p.y-q.center.y)/(ry||1),d=Math.hypot(nx,ny);
      if(d>=.48&&d<=1.18)return q;
    }else if(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)return q;
  }
  return null;
}

const overlay=document.createElement('div');
overlay.className='fw-multi-select-overlay';
document.body.appendChild(overlay);
const badge=document.createElement('div');
badge.className='fw-selection-badge';badge.hidden=true;document.body.appendChild(badge);
const menu=document.createElement('div');
menu.className='fw-align-menu';menu.hidden=true;
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

const style=document.createElement('style');
style.id='fw-multi-select-align-v21-style';
style.textContent=`
.fw-multi-select-overlay{position:fixed;inset:0;pointer-events:none;z-index:80}
.fw-select-box{position:fixed;border:1.5px solid #e0a956;border-radius:7px;box-shadow:0 0 0 1px rgba(0,0,0,.45),0 0 0 3px rgba(224,169,86,.10);pointer-events:none}
.fw-select-box.wave{border-style:dashed;border-color:#79b9ff}.fw-select-tag{position:absolute;left:4px;top:-20px;height:17px;padding:0 6px;border-radius:5px;background:#0c1113;border:1px solid #4a3b27;color:#ebbd72;font:700 9px/15px Inter,system-ui,sans-serif;white-space:nowrap}
.fw-select-box.wave .fw-select-tag{color:#9fd0ff;border-color:#294c68}
.fw-selection-badge{position:fixed;z-index:82;padding:6px 9px;border:1px solid #554126;border-radius:8px;background:rgba(9,13,15,.94);color:#d9c9b4;font:600 9px Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.26);pointer-events:none}
.fw-align-menu{position:fixed;z-index:110;width:224px;padding:8px;border:1px solid #333b40;border-radius:10px;background:#0c1113;color:#ded7cc;box-shadow:0 18px 44px rgba(0,0,0,.48);font-family:Inter,system-ui,sans-serif}
.fw-align-head{display:flex;justify-content:space-between;align-items:center;padding:3px 4px 8px;font-size:10px}.fw-align-head span{color:#8f8a82;font-size:8px}
.fw-align-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.fw-align-menu button{border:1px solid #293136;background:#11171a;color:#cfc7bb;border-radius:7px;cursor:pointer}.fw-align-grid button{height:42px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:15px}.fw-align-grid button span{font-size:8px}.fw-align-menu button:hover{border-color:#765733;background:#1b1711;color:#f0c57f}.fw-align-wide{width:100%;height:29px;margin-top:4px;padding:0 8px;text-align:left;font-size:9px}.fw-align-menu button:disabled{opacity:.35;cursor:not-allowed}.fw-align-menu button:disabled:hover{border-color:#293136;background:#11171a;color:#cfc7bb}.fw-align-sep{height:1px;background:#252c30;margin:7px 1px 3px}.fw-align-wide.muted{color:#8e8981}
`;
document.head.appendChild(style);

function updateOverlay(){
  overlay.innerHTML='';
  const r=canvas.getBoundingClientRect(),sx=r.width/canvas.width,sy=r.height/canvas.height;
  const active=selectedItems();
  for(const item of active){
    const b=item.bounds,box=document.createElement('div');box.className='fw-select-box '+item.type;
    box.style.left=(r.left+b.x*sx)+'px';box.style.top=(r.top+b.y*sy)+'px';box.style.width=Math.max(8,b.w*sx)+'px';box.style.height=Math.max(8,b.h*sy)+'px';
    const tag=document.createElement('span');tag.className='fw-select-tag';tag.textContent=item.label;box.appendChild(tag);overlay.appendChild(box);
  }
  if(active.length){
    badge.hidden=false;badge.textContent=`${active.length} selected · Shift/Ctrl/Cmd + click to add · Right-click to align`;
    badge.style.left=(r.left+10)+'px';badge.style.top=(r.top+10)+'px';
  }else badge.hidden=true;
}
let raf=0;function refresh(){cancelAnimationFrame(raf);raf=requestAnimationFrame(updateOverlay)}
setInterval(()=>{if(selected.size)updateOverlay()},180);

function toggle(item,additive=true){
  if(!item)return;
  if(!additive)selected.clear();
  if(additive&&selected.has(item.id))selected.delete(item.id);else selected.add(item.id);
  hideMenu();refresh();
}
function clearSelection(){selected.clear();hideMenu();refresh()}

canvas.addEventListener('pointerdown',e=>{
  if(!(e.shiftKey||e.ctrlKey||e.metaKey)||e.button!==0)return;
  const hit=hitItem(canvasPoint(e));
  if(hit){e.preventDefault();e.stopImmediatePropagation();toggle(hit,true)}
},true);

// Also allow modifier-clicking the layer cards / text card headers to build a selection.
document.addEventListener('click',e=>{
  if(!(e.shiftKey||e.ctrlKey||e.metaKey))return;
  const wave=e.target.closest?.('.mw-item .mw-select');
  if(wave){const row=wave.closest('.mw-item'),i=Number(row?.dataset.i);if(Number.isFinite(i)){e.preventDefault();e.stopImmediatePropagation();toggle(waveItems()[i],true)}return}
  const card=e.target.closest?.('#textList .text-card');
  if(card&&e.target.closest('header')){const i=Number(card.dataset.index);const item=textItems().find(x=>x.index===i);if(item){e.preventDefault();e.stopImmediatePropagation();toggle(item,true)}}
},true);

function showMenu(x,y){
  const arr=selectedItems();if(!arr.length)return;
  menu.hidden=false;menu.querySelector('.fw-align-count').textContent=arr.length+' selected';
  const movable=arr.filter(x=>x.movable);
  menu.querySelectorAll('[data-cmd]:not([data-cmd="clear"])').forEach(b=>b.disabled=!movable.length);
  menu.querySelector('[data-cmd="distH"]').disabled=movable.length<3;
  menu.querySelector('[data-cmd="distV"]').disabled=movable.length<3;
  const mw=236,mh=menu.offsetHeight||300;
  menu.style.left=Math.min(x,window.innerWidth-mw-8)+'px';menu.style.top=Math.min(y,window.innerHeight-mh-8)+'px';
}
function hideMenu(){menu.hidden=true}
canvas.addEventListener('contextmenu',e=>{
  const hit=hitItem(canvasPoint(e));
  if(hit&&!selected.has(hit.id)){selected.clear();selected.add(hit.id);refresh()}
  if(!selected.size)return;
  e.preventDefault();showMenu(e.clientX,e.clientY);
});
document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!e.target.closest('.fw-align-menu'))hideMenu()});
window.addEventListener('blur',hideMenu);
document.addEventListener('keydown',e=>{if(e.key==='Escape')clearSelection()});

function selectWaveLayer(index){
  const row=document.querySelector(`.mw-item[data-i="${index}"] .mw-select`);row?.click();
}
function moveWave(index,xPct,yPct){
  const w=(window.__FW_MULTI_WAVE?.getLayers?.()||[])[index];if(!w||EDGE.has(w.style))return false;
  const prevTool=document.querySelector('.tool.active')?.dataset.tool||'';
  const prevWave=Number(window.__FW_MULTI_WAVE?.getActiveIndex?.()||0);
  document.querySelector('.tool[data-tool="waveform"]')?.click();selectWaveLayer(index);
  const r=canvas.getBoundingClientRect(),E=window.PointerEvent||window.MouseEvent;
  const clientX=r.left+r.width*clamp(xPct,3,97)/100,clientY=r.top+r.height*clamp(yPct,3,97)/100;
  const common={bubbles:true,cancelable:true,clientX,clientY,button:0,pointerId:151,isPrimary:true,pointerType:'mouse'};
  canvas.dispatchEvent(new E('pointerdown',{...common,buttons:1}));canvas.dispatchEvent(new E('pointerup',{...common,buttons:0}));
  selectWaveLayer(prevWave);if(prevTool&&prevTool!=='waveform')document.querySelector(`.tool[data-tool="${prevTool}"]`)?.click();
  return true;
}
function moveItem(item,cx,cy){
  const x=clamp(cx/canvas.width*100,item.type==='text'?2:3,item.type==='text'?98:97),y=clamp(cy/canvas.height*100,item.type==='text'?2:3,item.type==='text'?98:97);
  if(item.type==='text')return !!window.__FW_TEXT_BRIDGE?.moveTextTo?.(item.index,x,y);
  return moveWave(item.index,x,y);
}
function align(cmd){
  const arr=selectedItems(),mov=arr.filter(x=>x.movable);if(!mov.length)return;
  const minX=Math.min(...arr.map(x=>x.bounds.x)),maxX=Math.max(...arr.map(x=>x.bounds.x+x.bounds.w));
  const minY=Math.min(...arr.map(x=>x.bounds.y)),maxY=Math.max(...arr.map(x=>x.bounds.y+x.bounds.h));
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  if(cmd==='distH'||cmd==='distV'){
    const sorted=[...mov].sort((a,b)=>cmd==='distH'?a.center.x-b.center.x:a.center.y-b.center.y);if(sorted.length<3)return;
    const first=sorted[0],last=sorted.at(-1),a=cmd==='distH'?first.center.x:first.center.y,b=cmd==='distH'?last.center.x:last.center.y,step=(b-a)/(sorted.length-1);
    sorted.forEach((it,i)=>{if(i===0||i===sorted.length-1)return;moveItem(it,cmd==='distH'?a+step*i:it.center.x,cmd==='distV'?a+step*i:it.center.y)});
  }else{
    mov.forEach(it=>{
      let nx=it.center.x,ny=it.center.y;
      if(cmd==='left')nx=minX+it.bounds.w/2;
      else if(cmd==='hcenter')nx=cx;
      else if(cmd==='right')nx=maxX-it.bounds.w/2;
      else if(cmd==='top')ny=minY+it.bounds.h/2;
      else if(cmd==='vcenter')ny=cy;
      else if(cmd==='bottom')ny=maxY-it.bounds.h/2;
      else if(cmd==='canvasH')nx=canvas.width/2;
      else if(cmd==='canvasV')ny=canvas.height/2;
      moveItem(it,nx,ny);
    });
  }
  setTimeout(()=>{refresh();notify('Selection aligned')},70);
}
menu.addEventListener('click',e=>{
  const b=e.target.closest('[data-cmd]');if(!b||b.disabled)return;
  const cmd=b.dataset.cmd;if(cmd==='clear')clearSelection();else{align(cmd);hideMenu()}
});

// Clear stale selections when project structure changes substantially.
document.getElementById('resetProject')?.addEventListener('click',()=>setTimeout(clearSelection,0));
window.__FW_MULTI_SELECT={clear:clearSelection,getSelected:()=>[...selected],refresh};
})();
