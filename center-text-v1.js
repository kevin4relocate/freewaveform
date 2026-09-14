(()=>{
'use strict';

const api=window.__FW_MULTI_WAVE;
const C=window.__FW_WAVE_CONFIG;
const pipeline=window.__FW_RENDER_PIPELINE;
const canvas=document.getElementById('canvas');
const wrap=document.getElementById('stageWrap');
const textList=document.getElementById('textList');
const addText=document.getElementById('addText');
if(!api||!C||!pipeline||!canvas||!wrap)return;

const ctx=canvas.getContext('2d');
const clamp=window.__FW_UTILS?.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const CLOSED=C.ROUNDISH||new Set(['brushRing','smoothRing','radial','orbit']);
const STORAGE_KEY='freewaveform.userPresets.v1';
const DEFAULT_TEXT={text:''};
const centerById=new Map();
let pointerStart=null;
let lastLayerIds=[];
let lastActiveId=null;
let pendingPreset=null;

const rawGetLayers=api.getLayers.bind(api);
const rawGetActiveLayer=api.getActiveLayer?.bind(api);
const rawSetLayers=api.setLayers?.bind(api);

function normalizeCenterText(v){
  if(typeof v==='string')return{text:v.slice(0,240)};
  return{text:String(v?.text||'').replace(/\r/g,'').slice(0,240)};
}
function centerFor(layer){
  if(!layer)return{...DEFAULT_TEXT};
  if(!centerById.has(layer.id))centerById.set(layer.id,{...DEFAULT_TEXT});
  return centerById.get(layer.id);
}
function eligible(layer){return!!layer&&layer.showWave!==false&&CLOSED.has(layer.style)}
function mergedLayers(){return rawGetLayers().map(w=>({...w,centerText:{...centerFor(w)}}))}
function prune(){const ids=new Set(rawGetLayers().map(w=>w.id));for(const id of centerById.keys())if(!ids.has(id))centerById.delete(id)}

api.getLayers=mergedLayers;
if(rawGetActiveLayer)api.getActiveLayer=()=>{const w=rawGetActiveLayer();return w?{...w,centerText:{...centerFor(w)}}:null};
if(rawSetLayers)api.setLayers=(incoming,index=0)=>{
  const saved=Array.isArray(incoming)?incoming.map(w=>normalizeCenterText(w?.centerText)):[];
  const result=rawSetLayers(incoming,index);
  rawGetLayers().forEach((w,i)=>centerById.set(w.id,saved[i]||{...DEFAULT_TEXT}));
  prune();syncLayerTracking();return result;
};

function syncLayerTracking(){
  const layers=rawGetLayers(),ids=layers.map(w=>w.id),newIds=ids.filter(id=>!lastLayerIds.includes(id));
  if(newIds.length&&lastActiveId){const source={...centerFor({id:lastActiveId})};newIds.forEach(id=>centerById.set(id,source))}
  prune();lastLayerIds=ids;lastActiveId=layers[api.getActiveIndex?.()||0]?.id||null;
}
syncLayerTracking();
document.addEventListener('fw:wave-selection-change',syncLayerTracking);
document.addEventListener('fw:project-reset',()=>{centerById.clear();requestAnimationFrame(()=>{syncLayerTracking();clearDefaultFreeText();decorateFreeTextUI()})});

function canvasPoint(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*canvas.width,y:(e.clientY-r.top)/r.height*canvas.height}}
function centerHit(x,y){
  const layers=rawGetLayers();
  for(let i=layers.length-1;i>=0;i--){const w=layers[i];if(!eligible(w))continue;const b=api.getBounds?.(i);if(!b)continue;const nx=(x-b.cx)/(b.w/2||1),ny=(y-b.cy)/(b.h/2||1);if(Math.hypot(nx,ny)<=.46)return i}
  return-1;
}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointerStart={x:e.clientX,y:e.clientY}},true);
canvas.addEventListener('pointercancel',()=>{pointerStart=null},true);
canvas.addEventListener('pointerup',e=>{
  if(!pointerStart)return;const moved=Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y);pointerStart=null;if(moved>6)return;
  const p=canvasPoint(e),i=centerHit(p.x,p.y);if(i<0)return;
  api.selectLayer?.(i);openEditor(i);
},true);

function ensureEditor(){
  let box=document.getElementById('waveCenterTextEditor');if(box)return box;
  box=document.createElement('div');box.id='waveCenterTextEditor';box.className='wave-center-editor';box.hidden=true;
  box.innerHTML=`<div class="wave-center-editor-label">WAVEFORM TEXT</div><textarea id="waveCenterTextInput" rows="3" maxlength="240" placeholder="Type text…"></textarea><div class="wave-center-editor-actions"><button type="button" class="button" data-center-clear>Clear</button><button type="button" class="button accent" data-center-done>Done</button></div><small>Enter = new line · Ctrl/⌘ + Enter = done</small>`;
  wrap.appendChild(box);
  box.addEventListener('pointerdown',e=>e.stopPropagation());
  box.querySelector('[data-center-done]').addEventListener('click',()=>commitEditor(true));
  box.querySelector('[data-center-clear]').addEventListener('click',()=>{box.querySelector('textarea').value='';commitEditor(true)});
  box.querySelector('textarea').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();commitEditor(true)}else if(e.key==='Escape'){e.preventDefault();closeEditor()}});
  return box;
}
let editingIndex=-1;
function positionEditor(index){
  const box=ensureEditor(),b=api.getBounds?.(index);if(!b)return;
  const cr=canvas.getBoundingClientRect(),wr=wrap.getBoundingClientRect();
  box.style.left=(cr.left-wr.left+(b.cx/canvas.width)*cr.width)+'px';
  box.style.top=(cr.top-wr.top+(b.cy/canvas.height)*cr.height)+'px';
  box.style.maxWidth=Math.max(220,Math.min(390,cr.width*(b.w/canvas.width)*.74))+'px';
}
function openEditor(index){
  const layer=rawGetLayers()[index];if(!eligible(layer))return;
  editingIndex=index;const box=ensureEditor(),input=box.querySelector('textarea');input.value=centerFor(layer).text;positionEditor(index);box.hidden=false;requestAnimationFrame(()=>{input.focus();input.select()});
}
function commitEditor(close){
  if(editingIndex<0)return;const layer=rawGetLayers()[editingIndex],box=ensureEditor();if(layer)centerById.set(layer.id,{text:String(box.querySelector('textarea').value||'').replace(/\r/g,'').slice(0,240)});if(close)closeEditor();
}
function closeEditor(){const box=ensureEditor();box.hidden=true;editingIndex=-1}
window.addEventListener('resize',()=>{if(editingIndex>=0)positionEditor(editingIndex)});
document.addEventListener('fw:ratio-change',()=>{if(editingIndex>=0)requestAnimationFrame(()=>positionEditor(editingIndex))});

function fontFamily(){return'"Noto Serif SC","Playfair Display","Songti SC",Georgia,serif'}
function fitText(lines,maxW,maxH){
  let size=Math.min(maxH/(Math.max(1,lines.length)*1.28),maxW*.17);size=clamp(size,18,110);
  for(;size>18;size-=2){ctx.font=`600 ${size}px ${fontFamily()}`;const widest=Math.max(...lines.map(line=>ctx.measureText(line||' ').width));if(widest<=maxW&&lines.length*size*1.28<=maxH)break}
  return size;
}
function drawCenterText(){
  rawGetLayers().forEach((w,i)=>{if(!eligible(w))return;const text=centerFor(w).text.trim();if(!text)return;const b=api.getBounds?.(i);if(!b)return;const lines=text.split('\n').slice(0,3),maxW=b.w*((w.shape==='star'||w.shape==='lotus')?.46:.56),maxH=b.h*.44,size=fitText(lines,maxW,maxH),lineH=size*1.28,startY=b.cy-((lines.length-1)*lineH)/2;
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 ${size}px ${fontFamily()}`;ctx.fillStyle=w.color||'#f4ead8';ctx.globalAlpha=.98;ctx.shadowColor='rgba(0,0,0,.58)';ctx.shadowBlur=Math.max(2,size*.08);lines.forEach((line,n)=>ctx.fillText(line,b.cx,startY+n*lineH));ctx.restore();
  })
}
pipeline.register('text','wave-center-text',drawCenterText,-30);

function emptyState(){
  if(!textList||textList.querySelector('.free-text-empty'))return;const d=document.createElement('div');d.className='free-text-empty';d.innerHTML='<strong>No free text</strong><span>Closed waveform shapes already accept text in their center. Add a free text layer only when you need independent text.</span>';textList.appendChild(d)
}
function clearDefaultFreeText(){
  const state=window.__FW_APP?.getState?.();if(!state?.texts)return;state.texts.splice(0,state.texts.length);window.__FW_TEXT_BRIDGE?.reset?.();if(textList)textList.innerHTML='';emptyState();
}
function decorateFreeTextUI(){
  const panel=document.querySelector('[data-panel="text"]');if(panel){const strong=panel.querySelector('.card-title strong'),small=panel.querySelector('.card-title small'),note=panel.querySelector('.text-scope-note');if(strong)strong.textContent='Free Text';if(small)small.textContent='Independent text layers';if(note)note.innerHTML='Text inside closed waveform shapes is edited by tapping the waveform center. Use this tab only for independent text.'}
  if(addText)addText.textContent='+ Add Free Text';
  const state=window.__FW_APP?.getState?.();const cards=[...(textList?.querySelectorAll('.text-card')||[])];
  if(!cards.length){emptyState();return}
  textList?.querySelector('.free-text-empty')?.remove();
  cards.forEach((card,i)=>{if(state?.texts?.[i])state.texts[i].label=`Free Text ${i+1}`;const title=card.querySelector('header strong');if(title)title.textContent=`Free Text ${i+1}`;card.querySelector('.fw-song-title-hint')?.remove();const area=card.querySelector('textarea[data-k="text"]');if(area){const input=document.createElement('input');input.type='text';input.dataset.k='text';input.value=area.value;input.placeholder='Free text';area.replaceWith(input)}const actions=card.querySelector('header>div');if(actions&&!actions.querySelector('.delete-text')){const btn=document.createElement('button');btn.className='delete-text';btn.type='button';btn.title='Delete';btn.textContent='×';actions.appendChild(btn)}})
}
clearDefaultFreeText();decorateFreeTextUI();
document.addEventListener('fw:text-ui-rendered',()=>requestAnimationFrame(decorateFreeTextUI));

function readPresetRaw(id){try{return(JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')||[]).find(x=>x.id===id)||null}catch{return null}}
document.addEventListener('click',e=>{
  const item=e.target.closest?.('.user-preset-item');if(!item||!e.target.closest('.user-preset-load'))return;const raw=readPresetRaw(item.dataset.id);if(!raw?.project)return;pendingPreset={center:(raw.project.waveLayers||[]).map(w=>normalizeCenterText(w.centerText)),freeCount:Array.isArray(raw.project.texts)?raw.project.texts.length:null};setTimeout(()=>restorePendingPreset(),80)
},true);
function restorePendingPreset(){
  if(!pendingPreset)return;const layers=rawGetLayers();pendingPreset.center.forEach((t,i)=>{if(layers[i])centerById.set(layers[i].id,t)});if(Number.isInteger(pendingPreset.freeCount)){const state=window.__FW_APP?.getState?.();if(state?.texts){while(state.texts.length>pendingPreset.freeCount){const card=textList?.querySelectorAll('.text-card')?.[state.texts.length-1],del=card?.querySelector('.delete-text');if(del)del.click();else{state.texts.pop();card?.remove()}}if(pendingPreset.freeCount===0){state.texts.splice(0);if(textList)textList.innerHTML='';emptyState()}}}pendingPreset=null;decorateFreeTextUI();
}

window.__FW_CENTER_TEXT={
  getForWave:index=>{const w=rawGetLayers()[index];return w?{...centerFor(w)}:null},
  setForWave:(index,value)=>{const w=rawGetLayers()[index];if(!w)return false;centerById.set(w.id,normalizeCenterText(value));return true},
  editWave:openEditor,
  isSupported:index=>eligible(rawGetLayers()[index])
};
})();
