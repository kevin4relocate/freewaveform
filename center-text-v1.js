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
const U=window.__FW_UTILS||{};
const clamp=U.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const validColor=U.validColor||((v,f='#f4ead8')=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v).toLowerCase():f);
const CLOSED=C.ROUNDISH||new Set(['brushRing','smoothRing','radial','orbit']);
const STORAGE_KEY='freewaveform.userPresets.v1';
const FONT_OPTIONS=[
  ['serifCN','Songti 宋体'],['calligraphy','Calligraphy 书法'],['sansCN','Heiti 黑体'],['serifEN','Elegant Serif'],['sans','Modern Sans'],
  ['fwZcoolXiaoWei','ZCOOL XiaoWei 小薇体'],['fwZcoolQingKe','ZCOOL QingKe 黄油体'],['fwLiuJianMaoCao','Liu Jian Mao Cao'],['fwLongCang','Long Cang 龙藏']
];
const FONT_VALUES=new Set(FONT_OPTIONS.map(x=>x[0]));
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
const DEFAULT_TEXT={text:'',font:'serifCN',size:64,colorMode:'wave',color:'#f4ead8',opacity:100,align:'center'};
const centerById=new Map();
let pointerStart=null;
let lastLayerIds=[];
let lastActiveId=null;
let pendingPreset=null;
let editingIndex=-1;

const rawGetLayers=api.getLayers.bind(api);
const rawGetActiveLayer=api.getActiveLayer?.bind(api);
const rawSetLayers=api.setLayers?.bind(api);

function normalizeCenterText(v){
  if(typeof v==='string')v={text:v};
  v=v&&typeof v==='object'?v:{};
  return{
    text:String(v.text||'').replace(/\r/g,'').slice(0,240),
    font:FONT_VALUES.has(v.font)?v.font:DEFAULT_TEXT.font,
    size:clamp(Number.isFinite(+v.size)?+v.size:DEFAULT_TEXT.size,20,120),
    colorMode:v.colorMode==='custom'?'custom':'wave',
    color:validColor(v.color,DEFAULT_TEXT.color),
    opacity:clamp(Number.isFinite(+v.opacity)?+v.opacity:DEFAULT_TEXT.opacity,20,100),
    align:['left','center','right'].includes(v.align)?v.align:'center'
  };
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
document.addEventListener('fw:project-reset',()=>{centerById.clear();closeEditor();requestAnimationFrame(()=>{syncLayerTracking();clearDefaultFreeText();decorateFreeTextUI()})});

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
  box.innerHTML=`
    <div class="wave-center-editor-head"><div><span>WAVEFORM TEXT</span><strong id="waveCenterTextWaveName">Wave</strong></div><button type="button" class="wave-center-close" aria-label="Close">×</button></div>
    <label class="wave-center-field">Text<textarea id="waveCenterTextInput" rows="3" maxlength="240" placeholder="Type text…"></textarea></label>
    <div class="wave-center-grid">
      <label>Font<select id="waveCenterTextFont">${FONT_OPTIONS.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label>
      <label>Align<select id="waveCenterTextAlign"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
    </div>
    <label class="wave-center-slider">Font size <span id="waveCenterTextSizeValue">64</span><input id="waveCenterTextSize" class="range" type="range" min="20" max="120" value="64" /></label>
    <label class="wave-center-slider">Opacity <span id="waveCenterTextOpacityValue">100%</span><input id="waveCenterTextOpacity" class="range" type="range" min="20" max="100" value="100" /></label>
    <div class="wave-center-color-row"><input id="waveCenterTextColor" type="color" value="#f4ead8" aria-label="Waveform text color" /><button type="button" class="button" id="waveCenterUseWaveColor">Use Wave Color</button><span id="waveCenterColorMode">Wave color</span></div>
    <div class="wave-center-editor-actions"><button type="button" class="button" data-center-clear>Clear</button><button type="button" class="button accent" data-center-done>Done</button></div>
    <small class="wave-center-help">Live preview · Enter = new line · Ctrl/⌘ + Enter = done</small>`;
  wrap.appendChild(box);
  box.addEventListener('pointerdown',e=>e.stopPropagation());
  box.addEventListener('click',e=>e.stopPropagation());
  box.querySelector('.wave-center-close').addEventListener('click',closeEditor);
  box.querySelector('[data-center-done]').addEventListener('click',closeEditor);
  box.querySelector('[data-center-clear]').addEventListener('click',()=>{box.querySelector('#waveCenterTextInput').value='';liveSync()});
  box.querySelector('#waveCenterTextInput').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();closeEditor()}else if(e.key==='Escape'){e.preventDefault();closeEditor()}});
  ['waveCenterTextInput','waveCenterTextFont','waveCenterTextAlign','waveCenterTextSize','waveCenterTextOpacity'].forEach(id=>{
    box.querySelector('#'+id).addEventListener('input',liveSync);
    box.querySelector('#'+id).addEventListener('change',liveSync);
  });
  box.querySelector('#waveCenterTextColor').addEventListener('input',()=>{box.dataset.colorMode='custom';liveSync()});
  box.querySelector('#waveCenterUseWaveColor').addEventListener('click',()=>{box.dataset.colorMode='wave';liveSync()});
  return box;
}
function editorEls(){const box=ensureEditor();return{box,name:box.querySelector('#waveCenterTextWaveName'),text:box.querySelector('#waveCenterTextInput'),font:box.querySelector('#waveCenterTextFont'),align:box.querySelector('#waveCenterTextAlign'),size:box.querySelector('#waveCenterTextSize'),sizeValue:box.querySelector('#waveCenterTextSizeValue'),opacity:box.querySelector('#waveCenterTextOpacity'),opacityValue:box.querySelector('#waveCenterTextOpacityValue'),color:box.querySelector('#waveCenterTextColor'),colorMode:box.querySelector('#waveCenterColorMode')}}
function readEditor(){
  const e=editorEls();return normalizeCenterText({text:e.text.value,font:e.font.value,align:e.align.value,size:+e.size.value,opacity:+e.opacity.value,color:e.color.value,colorMode:e.box.dataset.colorMode==='custom'?'custom':'wave'});
}
function syncEditorLabels(){const e=editorEls();e.sizeValue.textContent=e.size.value;e.opacityValue.textContent=e.opacity.value+'%';e.colorMode.textContent=e.box.dataset.colorMode==='custom'?'Custom color':'Wave color';e.color.disabled=e.box.dataset.colorMode!=='custom'}
function liveSync(){
  if(editingIndex<0)return;const layer=rawGetLayers()[editingIndex];if(!layer)return;
  centerById.set(layer.id,readEditor());syncEditorLabels();
}
function positionEditor(index){
  const e=editorEls(),b=api.getBounds?.(index);if(!b)return;
  const cr=canvas.getBoundingClientRect(),wr=wrap.getBoundingClientRect();
  const cx=cr.left-wr.left+(b.cx/canvas.width)*cr.width,cy=cr.top-wr.top+(b.cy/canvas.height)*cr.height;
  const halfWave=(b.w/canvas.width)*cr.width/2,panelW=Math.min(390,Math.max(300,wr.width*.32)),gap=14;
  let left=cx+halfWave+gap+panelW/2;
  if(left+panelW/2>wr.width-8)left=cx-halfWave-gap-panelW/2;
  if(left-panelW/2<8)left=clamp(cx,8+panelW/2,wr.width-8-panelW/2);
  const top=clamp(cy,150,Math.max(150,wr.height-150));
  e.box.style.width=panelW+'px';e.box.style.left=left+'px';e.box.style.top=top+'px';
}
function openEditor(index){
  const layer=rawGetLayers()[index];if(!eligible(layer))return;
  editingIndex=index;const cfg=centerFor(layer),e=editorEls();
  e.name.textContent=layer.name||`Wave ${index+1}`;e.text.value=cfg.text;e.font.value=cfg.font;e.align.value=cfg.align;e.size.value=cfg.size;e.opacity.value=cfg.opacity;e.color.value=cfg.color;e.box.dataset.colorMode=cfg.colorMode;
  syncEditorLabels();positionEditor(index);e.box.hidden=false;requestAnimationFrame(()=>{e.text.focus();e.text.select()});
}
function closeEditor(){const box=document.getElementById('waveCenterTextEditor');if(box)box.hidden=true;editingIndex=-1}
window.addEventListener('resize',()=>{if(editingIndex>=0)positionEditor(editingIndex)});
document.addEventListener('fw:ratio-change',()=>{if(editingIndex>=0)requestAnimationFrame(()=>positionEditor(editingIndex))});
document.addEventListener('fw:wave-setting-change',()=>{if(editingIndex>=0)requestAnimationFrame(()=>positionEditor(editingIndex))});

function fontFamily(value){return FONT_FAMILY[value]||FONT_FAMILY.serifCN}
function fitText(lines,maxW,maxH,cfg){
  let size=clamp(cfg.size,20,120),min=14;
  for(;size>min;size-=2){ctx.font=`600 ${size}px ${fontFamily(cfg.font)}`;const widest=Math.max(...lines.map(line=>ctx.measureText(line||' ').width));if(widest<=maxW&&lines.length*size*1.25<=maxH)break}
  return Math.max(min,size);
}
function drawCenterText(){
  rawGetLayers().forEach((w,i)=>{
    if(!eligible(w))return;const cfg=centerFor(w),text=cfg.text.trim();if(!text)return;const b=api.getBounds?.(i);if(!b)return;
    const lines=text.split('\n').slice(0,3),maxW=b.w*((w.shape==='star'||w.shape==='lotus')?.46:.56),maxH=b.h*.44,size=fitText(lines,maxW,maxH,cfg),lineH=size*1.25,startY=b.cy-((lines.length-1)*lineH)/2;
    const align=cfg.align,x=align==='left'?b.cx-maxW/2:align==='right'?b.cx+maxW/2:b.cx;
    ctx.save();ctx.textAlign=align;ctx.textBaseline='middle';ctx.font=`600 ${size}px ${fontFamily(cfg.font)}`;ctx.fillStyle=cfg.colorMode==='wave'?(w.color||cfg.color):cfg.color;ctx.globalAlpha=cfg.opacity/100;ctx.shadowColor='rgba(0,0,0,.58)';ctx.shadowBlur=Math.max(2,size*.08);lines.forEach((line,n)=>ctx.fillText(line,x,startY+n*lineH));ctx.restore();
  });
}
// The app renders free text before the overlay stage. Center text lives in overlay with a negative order so it is still below editor guides but always above waveform Fill/border.
pipeline.register('overlay','wave-center-text',drawCenterText,-100);

function emptyState(){
  if(!textList||textList.querySelector('.free-text-empty'))return;const d=document.createElement('div');d.className='free-text-empty';d.innerHTML='<strong>No free text</strong><span>Closed waveform shapes already accept text in their center. Add a free text layer only when you need independent text.</span>';textList.appendChild(d)
}
function clearDefaultFreeText(){
  const state=window.__FW_APP?.getState?.();if(!state?.texts)return;state.texts.splice(0,state.texts.length);window.__FW_TEXT_BRIDGE?.reset?.();if(textList)textList.innerHTML='';emptyState();
}
function decorateFreeTextUI(){
  const panel=document.querySelector('[data-panel="text"]');if(panel){const strong=panel.querySelector('.card-title strong'),small=panel.querySelector('.card-title small'),note=panel.querySelector('.text-scope-note');if(strong)strong.textContent='Free Text';if(small)small.textContent='Independent text layers';if(note)note.innerHTML='Tap the center of a closed waveform shape to edit its built-in text. Use this tab only for independent text.'}
  if(addText)addText.textContent='+ Add Free Text';
  const state=window.__FW_APP?.getState?.(),cards=[...(textList?.querySelectorAll('.text-card')||[])];
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
  defaults:{...DEFAULT_TEXT},
  getForWave:index=>{const w=rawGetLayers()[index];return w?{...centerFor(w)}:null},
  setForWave:(index,value)=>{const w=rawGetLayers()[index];if(!w)return false;centerById.set(w.id,normalizeCenterText({...centerFor(w),...(value||{})}));return true},
  editWave:openEditor,
  isSupported:index=>eligible(rawGetLayers()[index])
};
})();
