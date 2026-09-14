(()=>{
'use strict';

const STORAGE_KEY='freewaveform.userPresets.v1';
const MAX_PRESETS=30;
const FILE_VERSION=3;

const selectIds=['waveStyle','waveShape','reactScope','syncMode'];
const rangeIds=['waveReaction','beatPunch','beatSensitivity','waveSmoothing','scenePunch','waveGlow','waveSize','waveThickness','waveOpacity','waveDetail','toothDepth','waveSharpness'];
const checkIds=['showWave','showGlow','showSecondary'];
const colorIds=['waveColor'];
const allowedIds=new Set([...selectIds,...rangeIds,...checkIds,...colorIds]);
const waveRangeMap={waveReaction:'reaction',beatPunch:'beatPunch',beatSensitivity:'beatSensitivity',waveSmoothing:'smoothing',waveGlow:'glow',waveSize:'size',waveThickness:'thickness',waveOpacity:'opacity',waveDetail:'detail',toothDepth:'toothDepth',waveSharpness:'sharpness'};
const waveStyles=new Set(['brushRing','smoothRing','radial','orbit','centerLine','mountain','bottom','top','dual','left','right','sides']);
const waveShapes=new Set(['circle','triangle','square','diamond','pentagon','hexagon','octagon','star','lotus','blob']);
const EDGE=new Set(['bottom','top','dual','left','right','sides']);
const plateShapes=new Set(['blob','circle','rounded','diamond','follow']);
const plateTones=new Set(['dark','light','auto','custom']);

function $(id){return document.getElementById(id)}
function fire(el,type){if(el)el.dispatchEvent(new Event(type,{bubbles:true}))}
function notify(text){if(window.__FW_TOAST)return window.__FW_TOAST(text);const el=$('toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>el.classList.remove('show'),2000)}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]))}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function validColor(v,fallback='#ffffff'){v=String(v||'').trim();return /^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():fallback}

function loadAll(){try{const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(data)?data:[]}catch{return[]}}
function saveAll(items){localStorage.setItem(STORAGE_KEY,JSON.stringify(items.slice(0,MAX_PRESETS)))}

function captureControls(){
  const values={};
  selectIds.forEach(id=>{const el=$(id);if(el)values[id]=el.value});
  rangeIds.forEach(id=>{const el=$(id);if(el)values[id]=el.value});
  checkIds.forEach(id=>{const el=$(id);if(el)values[id]=!!el.checked});
  colorIds.forEach(id=>{const el=$(id);if(el)values[id]=el.value});
  return values;
}
function sanitizeValues(values){
  if(!values||typeof values!=='object'||Array.isArray(values))return null;
  const clean={};Object.entries(values).forEach(([key,value])=>{if(allowedIds.has(key)&&(typeof value==='string'||typeof value==='number'||typeof value==='boolean'))clean[key]=value});
  return Object.keys(clean).length?clean:null;
}
function applyControls(values){
  if(!values)return;
  selectIds.forEach(id=>{const el=$(id);if(!el||values[id]===undefined)return;el.value=values[id];fire(el,'change')});
  rangeIds.forEach(id=>{const el=$(id);if(!el||values[id]===undefined)return;el.value=values[id];fire(el,'input')});
  checkIds.forEach(id=>{const el=$(id);if(!el||values[id]===undefined)return;el.checked=!!values[id];fire(el,'change')});
  colorIds.forEach(id=>{const el=$(id);if(!el||values[id]===undefined)return;el.value=values[id];fire(el,'input')});
}

function captureWaveDom(base={}){
  const out={...base};out.style=$('waveStyle')?.value||out.style||'brushRing';out.shape=$('waveShape')?.value||out.shape||'circle';
  Object.entries(waveRangeMap).forEach(([id,key])=>{const el=$(id);if(el)out[key]=+el.value});
  out.color=$('waveColor')?.value||out.color||'#e5d3a6';
  ['showWave','showGlow','showSecondary'].forEach(id=>{const el=$(id);if(el)out[id]=!!el.checked});
  delete out.showPlate;return out;
}
function captureWaveLayers(){
  const api=window.__FW_MULTI_WAVE;let layers=api?.getLayers?.()||[];const active=Number(api?.getActiveIndex?.()||0);
  if(layers.length){layers=layers.map(x=>{const c={...x};delete c.showPlate;return c});layers[active]=captureWaveDom(layers[active]);return{layers,activeIndex:active}}
  return{layers:[captureWaveDom({name:'Wave 1',x:50,y:50})],activeIndex:0};
}
function sanitizeWaveLayer(w,index){
  if(!w||typeof w!=='object')return null;const n=(v,d,a,b)=>clamp(Number.isFinite(+v)?+v:d,a,b);
  return{name:String(w.name||`Wave ${index+1}`).slice(0,30),style:waveStyles.has(w.style)?w.style:'brushRing',shape:waveShapes.has(w.shape)?w.shape:'circle',reaction:n(w.reaction,130,0,400),beatPunch:n(w.beatPunch,150,0,300),beatSensitivity:n(w.beatSensitivity,135,50,250),smoothing:n(w.smoothing,55,0,95),glow:n(w.glow,16,0,100),size:n(w.size,46,12,85),thickness:n(w.thickness,4,1,16),opacity:n(w.opacity,78,5,100),detail:n(w.detail,128,16,256),toothDepth:n(w.toothDepth,80,0,220),sharpness:n(w.sharpness,70,0,100),color:validColor(w.color,'#e5d3a6'),showWave:w.showWave!==false,showGlow:w.showGlow!==false,showSecondary:!!w.showSecondary,x:n(w.x,50,3,97),y:n(w.y,50,3,97)};
}
function sanitizePlate(c,legacyEnabled=false){
  const d=window.__FW_CENTER_PLATE?.defaults||{enabled:false,shape:'blob',tone:'dark',size:82,opacity:88,softness:4,shadow:12,color:'#17191c'};
  c=c&&typeof c==='object'?c:{};const n=(v,def,a,b)=>clamp(Number.isFinite(+v)?+v:def,a,b);
  return{enabled:c.enabled!==undefined?!!c.enabled:!!legacyEnabled,shape:plateShapes.has(c.shape)?c.shape:d.shape,tone:plateTones.has(c.tone)?c.tone:d.tone,size:n(c.size,d.size,55,105),opacity:n(c.opacity,d.opacity,20,100),softness:n(c.softness,d.softness,0,24),shadow:n(c.shadow,d.shadow,0,30),color:validColor(c.color,d.color)};
}
function sanitizeWaveLook(value){
  const d=window.__FW_WAVE_LOOK?.defaults||{contrast:'auto',outline:3,backdrop:'local-soft'};value=value&&typeof value==='object'?value:{};
  return{contrast:['none','soft','strong','auto'].includes(value.contrast)?value.contrast:d.contrast,outline:clamp(Number.isFinite(+value.outline)?+value.outline:d.outline,0,10),backdrop:['off','local-soft','local-blur'].includes(value.backdrop)?value.backdrop:d.backdrop};
}

function captureTexts(){
  const cards=[...document.querySelectorAll('#textList .text-card')],positions=window.__FW_TEXT_BRIDGE?.getPositions?.()||[];
  return cards.map((card,i)=>{const get=k=>card.querySelector(`[data-k="${k}"]`),p=positions[i]||{};return{label:String(card.querySelector('header strong')?.textContent||`Text ${i+1}`),text:String(get('text')?.value||''),font:String(get('font')?.value||'sans'),color:validColor(get('color')?.value,'#ffffff'),size:+get('size')?.value||42,opacity:+get('opacity')?.value||100,show:!!get('show')?.checked,react:String(get('react')?.value||'false')==='true',strength:+get('strength')?.value||0,x:Number.isFinite(p.x)?p.x:undefined,y:Number.isFinite(p.y)?p.y:undefined}});
}
function sanitizeText(t,index){
  if(!t||typeof t!=='object')return null;const n=(v,d,a,b)=>clamp(Number.isFinite(+v)?+v:d,a,b);
  const clean={label:String(t.label||`Text ${index+1}`).slice(0,50),text:String(t.text??'').slice(0,500),font:String(t.font||'sans').slice(0,64),color:validColor(t.color,'#ffffff'),size:n(t.size,42,14,160),opacity:n(t.opacity,100,5,100),show:t.show!==false,react:!!t.react,strength:n(t.strength,0,0,80)};
  if(Number.isFinite(+t.x))clean.x=n(t.x,50,2,98);if(Number.isFinite(+t.y))clean.y=n(t.y,50,2,98);return clean;
}

function captureProject(){
  const wave=captureWaveLayers();
  return{schema:3,ratio:document.querySelector('[data-ratio].active')?.dataset.ratio||'16:9',controls:captureControls(),waveLayers:wave.layers,waveActiveIndex:wave.activeIndex,centerPlates:window.__FW_CENTER_PLATE?.getAllConfigs?.()||[],waveLook:window.__FW_WAVE_LOOK?.getConfig?.()||null,texts:captureTexts()};
}
function sanitizeProject(p){
  if(!p||typeof p!=='object'||Array.isArray(p))return null;
  const controls=sanitizeValues(p.controls||p.values||{})||{},rawWaves=Array.isArray(p.waveLayers)?p.waveLayers.slice(0,5):[],waveLayers=rawWaves.map(sanitizeWaveLayer).filter(Boolean),texts=Array.isArray(p.texts)?p.texts.slice(0,10).map(sanitizeText).filter(Boolean):[];
  const rawPlates=Array.isArray(p.centerPlates)?p.centerPlates:[];
  const centerPlates=waveLayers.map((_,i)=>sanitizePlate(rawPlates[i],!!rawWaves[i]?.showPlate));
  return{schema:3,ratio:p.ratio==='9:16'?'9:16':'16:9',controls,waveLayers,waveActiveIndex:clamp(+p.waveActiveIndex||0,0,Math.max(0,waveLayers.length-1)),centerPlates,waveLook:sanitizeWaveLook(p.waveLook),texts};
}

function setWaveControl(id,value,type){const e=$(id);if(!e||value===undefined)return;if(e.type==='checkbox')e.checked=!!value;else e.value=value;fire(e,type||((e.type==='checkbox'||e.tagName==='SELECT')?'change':'input'))}
function applyWaveLayer(w){
  setWaveControl('waveStyle',w.style,'change');setWaveControl('waveShape',w.shape,'change');Object.entries(waveRangeMap).forEach(([id,key])=>setWaveControl(id,w[key],'input'));setWaveControl('waveColor',w.color,'input');['showWave','showGlow','showSecondary'].forEach(id=>setWaveControl(id,w[id],'change'));
}
function placeActiveWave(w){
  if(EDGE.has(w.style)||!Number.isFinite(w.x)||!Number.isFinite(w.y))return;const canvas=$('canvas');if(!canvas)return;const r=canvas.getBoundingClientRect(),E=window.PointerEvent||window.MouseEvent,clientX=r.left+r.width*w.x/100,clientY=r.top+r.height*w.y/100,common={bubbles:true,cancelable:true,clientX,clientY,button:0,pointerId:91,isPrimary:true,pointerType:'mouse'};canvas.dispatchEvent(new E('pointerdown',{...common,buttons:1}));canvas.dispatchEvent(new E('pointerup',{...common,buttons:0}));
}
function restoreWaveLayers(project){
  const layers=project.waveLayers||[];if(!layers.length){applyControls(project.controls);return}
  const prev=document.querySelector('.tool.active')?.dataset.tool||'';document.querySelector('.tool[data-tool="waveform"]')?.click();const root=document.querySelector('.multi-wave-card');
  if(!root){applyWaveLayer(layers[0]);placeActiveWave(layers[0]);if(prev&&prev!=='waveform')document.querySelector(`.tool[data-tool="${prev}"]`)?.click();return}
  while(root.querySelectorAll('.mw-item').length>1){const del=[...root.querySelectorAll('.mw-delete')].pop();if(!del)break;del.click()}
  root.querySelector('.mw-item .mw-select')?.click();
  layers.forEach((w,i)=>{if(i>0)root.querySelector('.mw-add')?.click();applyWaveLayer(w);placeActiveWave(w)});
  const items=[...root.querySelectorAll('.mw-item .mw-select')];items[clamp(project.waveActiveIndex||0,0,items.length-1)]?.click();if(prev&&prev!=='waveform')document.querySelector(`.tool[data-tool="${prev}"]`)?.click();
}
function ensureTextCount(count){count=clamp(count,2,10);let cards=()=>[...document.querySelectorAll('#textList .text-card')];while(cards().length>count){const del=cards().at(-1)?.querySelector('.delete-text');if(!del)break;del.click()}while(cards().length<count){$('addText')?.click();if(cards().length>=10)break}}
function setTextField(card,key,value){const e=card.querySelector(`[data-k="${key}"]`);if(!e)return;if(e.type==='checkbox')e.checked=!!value;else e.value=String(value);fire(e,'input');if(e.tagName==='SELECT'||e.type==='checkbox')fire(e,'change')}
function twoFrames(){return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}
async function restoreTexts(texts){if(!Array.isArray(texts)||!texts.length)return;ensureTextCount(texts.length);window.__FW_TEXT_BRIDGE?.enhanceAll?.();const cards=[...document.querySelectorAll('#textList .text-card')];texts.forEach((t,i)=>{const c=cards[i];if(!c)return;setTextField(c,'show',t.show);setTextField(c,'text',t.text);setTextField(c,'font',t.font);setTextField(c,'color',t.color);setTextField(c,'size',t.size);setTextField(c,'opacity',t.opacity);setTextField(c,'react',String(!!t.react));setTextField(c,'strength',t.strength)});await twoFrames();texts.forEach((t,i)=>{if(Number.isFinite(t.x)&&Number.isFinite(t.y))window.__FW_TEXT_BRIDGE?.moveTextTo?.(i,t.x,t.y)})}
async function applyProject(project,legacyValues){
  if(!project){applyControls(legacyValues);return}
  document.querySelector(`[data-ratio="${project.ratio}"]`)?.click();['reactScope','syncMode'].forEach(id=>{if(project.controls?.[id]!==undefined)setWaveControl(id,project.controls[id],'change')});if(project.controls?.scenePunch!==undefined)setWaveControl('scenePunch',project.controls.scenePunch,'input');
  restoreWaveLayers(project);window.__FW_CENTER_PLATE?.setAllConfigs?.(project.centerPlates||[]);window.__FW_WAVE_LOOK?.setConfig?.(project.waveLook||{});await restoreTexts(project.texts);
}

function makeId(){return'p_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function formatDate(ts){try{return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric'})}catch{return''}}
function safeFileStamp(){return new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}

let root=null;
function render(){
  if(!root)return;const items=loadAll(),list=root.querySelector('.user-preset-list'),count=root.querySelector('.user-preset-count');count.textContent=items.length+' / '+MAX_PRESETS;
  if(!items.length){list.innerHTML='<div class="user-preset-empty">No saved layout presets yet.</div>';return}
  list.innerHTML=items.map(p=>`<div class="user-preset-item" data-id="${esc(p.id)}"><button class="user-preset-load" type="button" title="Load preset"><span class="user-preset-icon">★</span><span><b>${esc(p.name)}</b><small>${esc(formatDate(p.updatedAt||p.createdAt))}</small></span></button><button class="user-preset-delete" type="button" title="Delete preset">×</button></div>`).join('');
}
function saveCurrent(){
  const input=root.querySelector('.user-preset-name');let name=input.value.trim(),items=loadAll();if(!name)name='My Layout '+(items.length+1);const now=Date.now(),project=captureProject(),values=project.controls,existing=items.find(x=>String(x.name).toLowerCase()===name.toLowerCase());
  if(existing){existing.values=values;existing.project=project;existing.updatedAt=now;saveAll(items);notify('Updated layout preset: '+name)}else{items.unshift({id:makeId(),name,values,project,createdAt:now,updatedAt:now});saveAll(items);notify('Saved layout preset: '+name)}input.value='';render();
}
function exportPresets(){const items=loadAll();if(!items.length){notify('No presets to export');return}const payload={app:'FreeWaveform',type:'layout-presets',version:FILE_VERSION,exportedAt:new Date().toISOString(),presets:items},blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='freewaveform-presets-'+safeFileStamp()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);notify('Exported '+items.length+' preset'+(items.length===1?'':'s'))}
function normalizeImported(data){
  const source=Array.isArray(data)?data:data&&Array.isArray(data.presets)?data.presets:null;if(!source)return[];
  return source.map(item=>{if(!item||typeof item!=='object')return null;const name=String(item.name||'').trim().slice(0,40),values=sanitizeValues(item.values||item.settings||item.project?.controls),project=sanitizeProject(item.project);if(!name||(!values&&!project))return null;const createdAt=Number(item.createdAt)||Date.now(),updatedAt=Number(item.updatedAt)||createdAt;return{name,values:values||project?.controls||{},project,createdAt,updatedAt}}).filter(Boolean);
}
async function importPresets(file){
  if(!file)return;if(file.size>4*1024*1024){notify('Preset file is too large');return}
  try{const parsed=JSON.parse(await file.text());if(parsed?.app&&parsed.app!=='FreeWaveform')throw new Error('Not a FreeWaveform preset file');if(parsed?.version&&Number(parsed.version)>FILE_VERSION)throw new Error('Preset file is from a newer version');const incoming=normalizeImported(parsed);if(!incoming.length)throw new Error('No valid presets found');const items=loadAll();let added=0,updated=0;incoming.forEach(p=>{const existing=items.find(x=>String(x.name).toLowerCase()===p.name.toLowerCase());if(existing){existing.values=p.values;existing.project=p.project;existing.updatedAt=Date.now();updated++}else if(items.length<MAX_PRESETS){items.unshift({id:makeId(),...p});added++}});saveAll(items);render();const parts=[];if(added)parts.push(added+' added');if(updated)parts.push(updated+' updated');if(incoming.length>added+updated)parts.push((incoming.length-added-updated)+' skipped');notify('Import complete · '+(parts.join(' · ')||'no changes'))}catch(err){console.error('Preset import failed',err);notify('Import failed: '+(err?.message||'invalid preset file'))}
}

function mount(){
  const panel=document.querySelector('[data-panel="presets"]')||document.querySelector('[data-panel="waveform"]'),templateGrid=$('templateGrid');if(!panel||!templateGrid||document.querySelector('.user-presets-card'))return false;const templateCard=templateGrid.closest('.card');if(!templateCard)return false;
  root=document.createElement('div');root.className='card user-presets-card';root.innerHTML=`<div class="card-title"><div><strong>Layout Presets</strong><small>Wave layers + Center Plate + text layout</small></div><span class="badge user-preset-count">0 / ${MAX_PRESETS}</span></div><div class="user-preset-save-row"><input class="user-preset-name" type="text" maxlength="40" placeholder="Preset name, e.g. Kung Fu Punch" /><button class="button accent user-preset-save" type="button">Save current</button></div><div class="user-preset-transfer-row"><button class="button user-preset-export" type="button">⇩ Export presets</button><button class="button user-preset-import" type="button">⇧ Import presets</button><input class="user-preset-file" type="file" accept="application/json,.json" hidden /></div><div class="user-preset-list"></div><p class="hint">Saves waveform layers, Global Wave Look, Center Plate, text content/styles and positions. Background image files are intentionally not stored.</p>`;templateCard.insertAdjacentElement('afterend',root);
  const fileInput=root.querySelector('.user-preset-file');root.querySelector('.user-preset-save').addEventListener('click',saveCurrent);root.querySelector('.user-preset-name').addEventListener('keydown',e=>{if(e.key==='Enter')saveCurrent()});root.querySelector('.user-preset-export').addEventListener('click',exportPresets);root.querySelector('.user-preset-import').addEventListener('click',()=>fileInput.click());fileInput.addEventListener('change',async()=>{await importPresets(fileInput.files?.[0]);fileInput.value=''});
  root.querySelector('.user-preset-list').addEventListener('click',async e=>{const item=e.target.closest('.user-preset-item');if(!item)return;const id=item.dataset.id;if(e.target.closest('.user-preset-delete')){const items=loadAll(),p=items.find(x=>x.id===id);if(!p||!confirm('Delete preset "'+p.name+'"?'))return;saveAll(items.filter(x=>x.id!==id));render();notify('Preset deleted');return}if(e.target.closest('.user-preset-load')){const p=loadAll().find(x=>x.id===id);if(!p)return;await applyProject(sanitizeProject(p.project),sanitizeValues(p.values));notify('Loaded preset: '+p.name)}});
  render();return true;
}
if(!mount()){let tries=0;const timer=setInterval(()=>{tries++;if(mount()||tries>30)clearInterval(timer)},100)}
})();
