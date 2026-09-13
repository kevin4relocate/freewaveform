(async()=>{
'use strict';

const baseUrl='./app-v3.js?v=4';
let source='';
try{
  const res=await fetch(baseUrl,{cache:'no-store'});
  if(!res.ok)throw new Error('HTTP '+res.status);
  source=await res.text();
}catch(err){
  console.error('FreeWaveform core load failed',err);
  const el=document.querySelector('#toast');
  if(el){el.textContent='Core editor failed to load';el.classList.add('show')}
  return;
}

if(!source.includes('const state={')||!source.includes("initAudioUI();initImageUI();initWaveUI();initTextUI();setRatio('16:9');switchTool('audio');updateTimeline();render();")){
  console.error('FreeWaveform core signature changed; V4 bridge was not applied.');
  return;
}

source=source.replace('const state={','const state=window.__FW_STATE={');
source=source.replace(
  "initAudioUI();initImageUI();initWaveUI();initTextUI();setRatio('16:9');switchTool('audio');updateTimeline();render();",
  "window.__FW_API={state,canvas,getTextBoxes:()=>textBoxes,isEdgeStyle,switchTool,syncWaveUI,renderTextCards};initAudioUI();initImageUI();initWaveUI();initTextUI();setRatio('16:9');switchTool('audio');updateTimeline();render();"
);

try{
  (0,eval)(source);
}catch(err){
  console.error('FreeWaveform core eval failed',err);
  return;
}

const api=window.__FW_API;
if(!api)return;
const {state,canvas}=api;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const stage=document.querySelector('#stageWrap');
const guide=document.createElement('div');
guide.className='smart-guides';
guide.innerHTML='<i class="guide-v"></i><i class="guide-h"></i><span class="guide-badge"></span><div class="selection-badges"></div>';
stage.appendChild(guide);
const gv=guide.querySelector('.guide-v');
const gh=guide.querySelector('.guide-h');
const gb=guide.querySelector('.guide-badge');
const selectionBadges=guide.querySelector('.selection-badges');

const menu=document.createElement('div');
menu.className='align-menu';
menu.innerHTML=`
  <div class="align-menu-head"><b>Align selected</b><span id="alignCount">0 selected</span></div>
  <button data-align="centerBoth"><i>◎</i>Center on canvas</button>
  <button data-align="centerX"><i>↔</i>Center horizontally</button>
  <button data-align="centerY"><i>↕</i>Center vertically</button>
  <div class="align-sep"></div>
  <button data-align="alignX"><i>║</i>Align same X</button>
  <button data-align="alignY"><i>═</i>Align same Y</button>
  <div class="align-sep"></div>
  <button data-align="selectAll"><i>▣</i>Select wave + all text</button>
  <button data-align="clear"><i>×</i>Clear selection</button>`;
document.body.appendChild(menu);

const selected=new Set();
let activeDrag=null;
let anchorKey=null;
let flashUntil=0;
const snapThreshold=1.15;

function textKey(i){return 'text:'+i}
function keyData(key){
  if(key==='wave')return{key,type:'wave',x:state.wave.x,y:state.wave.y,label:'Waveform'};
  if(key.startsWith('text:')){
    const i=+key.split(':')[1],t=state.texts[i];
    if(!t)return null;
    return{key,type:'text',index:i,x:+t.x,y:+t.y,label:t.label||('Text '+(i+1))};
  }
  return null;
}
function visibleItems(){
  const items=[];
  if(state.wave.showWave&&!api.isEdgeStyle())items.push(keyData('wave'));
  state.texts.forEach((t,i)=>{if(t.show&&t.text)items.push(keyData(textKey(i))});
  return items.filter(Boolean);
}
function setItemPosition(key,x,y){
  if(key==='wave'){
    if(!api.isEdgeStyle()){
      state.wave.x=clamp(x,2,98);state.wave.y=clamp(y,2,98);
      api.syncWaveUI();
    }
    return;
  }
  const d=keyData(key);if(!d)return;
  const t=state.texts[d.index];t.x=clamp(x,2,98);t.y=clamp(y,2,98);
}
function canvasPoint(e){
  const r=canvas.getBoundingClientRect();
  return{x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100,px:e.clientX-r.left,py:e.clientY-r.top};
}
function hitItem(e){
  const p=canvasPoint(e),boxes=api.getTextBoxes();
  const px=p.x/100*canvas.width,py=p.y/100*canvas.height;
  const textHit=[...boxes].reverse().find(b=>px>=b.x-18&&px<=b.x+b.w+18&&py>=b.y-14&&py<=b.y+b.h+14);
  if(textHit)return textKey(textHit.i);
  if(!api.isEdgeStyle()&&state.wave.showWave){
    const dx=(p.x-state.wave.x),dy=(p.y-state.wave.y);
    const ratio=canvas.width/canvas.height;
    const rPercent=(Math.min(canvas.width,canvas.height)*state.wave.size/100*.5)/canvas.width*100;
    const rr=Math.hypot(dx,dy*ratio);
    if(rr<=Math.max(6,rPercent*1.35))return'wave';
  }
  return null;
}
function selectKey(key,add=false){
  if(!key){if(!add){selected.clear();anchorKey=null}drawSelection();return}
  if(!add){selected.clear();selected.add(key);anchorKey=key}
  else if(selected.has(key)){selected.delete(key);if(anchorKey===key)anchorKey=[...selected][0]||null}
  else{selected.add(key);if(!anchorKey)anchorKey=key}
  drawSelection();
}
function selectAll(){
  selected.clear();visibleItems().forEach(x=>selected.add(x.key));anchorKey=[...selected][0]||null;drawSelection();
}
function drawSelection(){
  selectionBadges.innerHTML='';
  const r=canvas.getBoundingClientRect(),sr=stage.getBoundingClientRect();
  selected.forEach(key=>{
    const d=keyData(key);if(!d)return;
    const dot=document.createElement('span');dot.className='selection-dot';
    dot.textContent=d.type==='wave'?'≋':'T';
    dot.style.left=(r.left-sr.left+r.width*d.x/100)+'px';
    dot.style.top=(r.top-sr.top+r.height*d.y/100)+'px';
    selectionBadges.appendChild(dot);
  });
}
function hideGuides(){gv.classList.remove('show');gh.classList.remove('show');gb.classList.remove('show')}
function showGuide(axis,value,label){
  const r=canvas.getBoundingClientRect(),sr=stage.getBoundingClientRect();
  if(axis==='x'){
    gv.style.left=(r.left-sr.left+r.width*value/100)+'px';gv.style.top=(r.top-sr.top)+'px';gv.style.height=r.height+'px';gv.classList.add('show');
  }else{
    gh.style.top=(r.top-sr.top+r.height*value/100)+'px';gh.style.left=(r.left-sr.left)+'px';gh.style.width=r.width+'px';gh.classList.add('show');
  }
  gb.textContent=label;gb.classList.add('show');
}
function snapPosition(key,x,y){
  let sx=x,sy=y,lx='',ly='';
  const others=visibleItems().filter(it=>it.key!==key);
  const xTargets=[{v:50,label:'CENTER'},...others.map(it=>({v:+it.x,label:'ALIGNED'}))];
  const yTargets=[{v:50,label:'CENTER'},...others.map(it=>({v:+it.y,label:'ALIGNED'}))];
  let bestX=null,bestY=null;
  xTargets.forEach(t=>{const d=Math.abs(x-t.v);if(d<=snapThreshold&&(!bestX||d<bestX.d))bestX={...t,d}});
  yTargets.forEach(t=>{const d=Math.abs(y-t.v);if(d<=snapThreshold&&(!bestY||d<bestY.d))bestY={...t,d}});
  if(bestX){sx=bestX.v;lx=bestX.label;showGuide('x',sx,lx)}else gv.classList.remove('show');
  if(bestY){sy=bestY.v;ly=bestY.label;showGuide('y',sy,ly)}else gh.classList.remove('show');
  if(!bestX&&!bestY)gb.classList.remove('show');
  else gb.textContent=bestX&&bestY?(lx===ly?lx:lx+' · '+ly):(lx||ly);
  return{x:sx,y:sy};
}

canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  const key=hitItem(e);
  if(e.shiftKey){selectKey(key,true);e.preventDefault();e.stopImmediatePropagation();return}
  if(key){
    selectKey(key,false);
    api.switchTool(key==='wave'?'waveform':'text');
    const p=canvasPoint(e),d=keyData(key);
    activeDrag={key,dx:p.x-d.x,dy:p.y-d.y};
    try{canvas.setPointerCapture(e.pointerId)}catch{}
    e.preventDefault();
    e.stopImmediatePropagation();
  }
},true);

canvas.addEventListener('pointermove',e=>{
  if(!activeDrag||!(e.buttons&1))return;
  const p=canvasPoint(e),x=p.x-activeDrag.dx,y=p.y-activeDrag.dy,sn=snapPosition(activeDrag.key,x,y);
  setItemPosition(activeDrag.key,sn.x,sn.y);
  drawSelection();
  e.preventDefault();
  e.stopImmediatePropagation();
},true);
canvas.addEventListener('pointerup',()=>{activeDrag=null;hideGuides();drawSelection()},true);
canvas.addEventListener('pointercancel',()=>{activeDrag=null;hideGuides()},true);

canvas.addEventListener('contextmenu',e=>{
  e.preventDefault();
  const key=hitItem(e);
  if(key&&!selected.has(key))selectKey(key,e.shiftKey);
  if(!selected.size)return;
  const count=document.querySelector('#alignCount');if(count)count.textContent=selected.size+' selected';
  menu.style.left=Math.min(e.clientX,window.innerWidth-225)+'px';
  menu.style.top=Math.min(e.clientY,window.innerHeight-310)+'px';
  menu.classList.add('show');
});

document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))menu.classList.remove('show')});
window.addEventListener('resize',()=>{menu.classList.remove('show');drawSelection()});

function alignSelected(mode){
  const items=[...selected].map(keyData).filter(Boolean);if(!items.length)return;
  if(mode==='selectAll'){selectAll();return}
  if(mode==='clear'){selected.clear();anchorKey=null;drawSelection();return}
  const anchor=keyData(anchorKey)||items[0];
  items.forEach(it=>{
    let x=it.x,y=it.y;
    if(mode==='centerBoth'||mode==='centerX')x=50;
    if(mode==='centerBoth'||mode==='centerY')y=50;
    if(mode==='alignX')x=anchor.x;
    if(mode==='alignY')y=anchor.y;
    setItemPosition(it.key,x,y);
  });
  api.renderTextCards();
  drawSelection();
  flashUntil=performance.now()+700;
  if(mode==='centerBoth'){showGuide('x',50,'CENTER');showGuide('y',50,'CENTER')}
  else if(mode==='centerX')showGuide('x',50,'CENTER');
  else if(mode==='centerY')showGuide('y',50,'CENTER');
  else if(mode==='alignX')showGuide('x',anchor.x,'ALIGNED');
  else if(mode==='alignY')showGuide('y',anchor.y,'ALIGNED');
  setTimeout(()=>{if(performance.now()>=flashUntil)hideGuides()},720);
}
menu.addEventListener('click',e=>{
  const b=e.target.closest('[data-align]');if(!b)return;
  alignSelected(b.dataset.align);menu.classList.remove('show');
});

new ResizeObserver(drawSelection).observe(stage);
document.querySelectorAll('[data-ratio],.tool').forEach(el=>el.addEventListener('click',()=>requestAnimationFrame(drawSelection)));

const helper=document.createElement('div');
helper.className='align-helper';
helper.innerHTML='<b>Alignment</b><span>Click a wave/text layer · Shift-click to multi-select · Right-click for Center / Align</span>';
stage.appendChild(helper);

})();
