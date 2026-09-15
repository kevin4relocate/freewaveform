(()=>{
'use strict';

const STORAGE_KEY='freewaveform.userPresets.v1';
const MAX_PRESETS=30;
const FILE_VERSION=4;
const U=window.__FW_UTILS||{};
const clamp=U.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const validColor=U.validColor||((v,f='#ffffff')=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v).toLowerCase():f);
const notify=window.__FW_TOAST||(()=>{});
const $=id=>document.getElementById(id);
const fire=(el,type)=>el?.dispatchEvent(new Event(type,{bubbles:true}));
const waveStyles=new Set(window.__FW_WAVE_CONFIG?.STYLE_OPTIONS?.map(x=>x[0])||[]);
const waveShapes=new Set(window.__FW_WAVE_CONFIG?.SHAPE_OPTIONS?.map(x=>x[0])||[]);
const plateShapes=new Set(['blob','circle','rounded','diamond','follow']);
const plateTones=new Set(['dark','light','auto','custom']);
const defaults=window.__FW_MULTI_WAVE?.defaults||{
  wave:{style:'brushRing',shape:'circle',reaction:130,beatPunch:150,beatSensitivity:135,smoothing:55,glow:16,size:46,maxSize:70,thickness:4,opacity:78,detail:128,toothDepth:80,sharpness:70,color:'#e5d3a6',showWave:true,showGlow:true,showSecondary:false,x:50,y:50},
  plate:{enabled:false,shape:'blob',tone:'dark',size:82,opacity:88,softness:4,shadow:12,color:'#17191c'}
};

function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function loadAll(){try{const d=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(d)?d:[]}catch{return[]}}
function saveAll(items){localStorage.setItem(STORAGE_KEY,JSON.stringify(items.slice(0,MAX_PRESETS)))}
function makeId(){return'p_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function formatDate(ts){try{return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric'})}catch{return''}}
function safeFileStamp(){return new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}
function num(v,fallback,min,max){const n=Number(v);return clamp(Number.isFinite(n)?n:fallback,min,max)}

function sanitizePlate(p={},legacy=false){
  const d=defaults.plate;
  return{
    enabled:p.enabled!==undefined?!!p.enabled:!!legacy,
    shape:plateShapes.has(p.shape)?p.shape:d.shape,
    tone:plateTones.has(p.tone)?p.tone:d.tone,
    size:num(p.size,d.size,55,105),opacity:num(p.opacity,d.opacity,20,100),
    softness:num(p.softness,d.softness,0,24),shadow:num(p.shadow,d.shadow,0,30),
    color:validColor(p.color,d.color)
  };
}
function sanitizeWave(w={},index=0,legacyPlate){
  const d=defaults.wave,size=num(w.size,d.size,12,85);
  return{
    name:String(w.name||`Wave ${index+1}`).slice(0,30),template:String(w.template||''),
    style:waveStyles.has(w.style)?w.style:d.style,shape:waveShapes.has(w.shape)?w.shape:d.shape,
    reaction:num(w.reaction,d.reaction,0,400),beatPunch:num(w.beatPunch,d.beatPunch,0,300),
    beatSensitivity:num(w.beatSensitivity,d.beatSensitivity,50,250),smoothing:num(w.smoothing,d.smoothing,0,95),
    glow:num(w.glow,d.glow,0,100),size,maxSize:num(w.maxSize,Math.max(d.maxSize||70,size),size,100),thickness:num(w.thickness,d.thickness,1,16),
    opacity:num(w.opacity,d.opacity,5,100),detail:num(w.detail,d.detail,16,256),toothDepth:num(w.toothDepth,d.toothDepth,0,220),
    sharpness:num(w.sharpness,d.sharpness,0,100),color:validColor(w.color,d.color),showWave:w.showWave!==false,
    showGlow:w.showGlow!==false,showSecondary:!!w.showSecondary,x:num(w.x,50,3,97),y:num(w.y,50,3,97),
    plate:sanitizePlate(w.plate||legacyPlate||{},!!w.showPlate)
  };
}
function sanitizeWaveLook(v={}){
  const d=window.__FW_WAVE_LOOK?.defaults||{contrast:'auto',outline:3,backdrop:'local-soft'};
  return{
    contrast:['none','soft','strong','auto'].includes(v.contrast)?v.contrast:d.contrast,
    outline:num(v.outline,d.outline,0,10),
    backdrop:['off','local-soft','local-blur'].includes(v.backdrop)?v.backdrop:d.backdrop
  };
}
function sanitizeText(t={},index=0){
  const out={label:String(t.label||`Free Text ${index+1}`).slice(0,50),text:String(t.text??'').slice(0,500),font:String(t.font||'sans').slice(0,64),color:validColor(t.color,'#ffffff'),size:num(t.size,42,14,160),opacity:num(t.opacity,100,5,100),show:t.show!==false,react:!!t.react,strength:num(t.strength,0,0,80)};
  if(Number.isFinite(+t.x))out.x=num(t.x,50,2,98);
  if(Number.isFinite(+t.y))out.y=num(t.y,50,2,98);
  return out;
}

function captureTexts(){
  const cards=[...document.querySelectorAll('#textList .text-card')],positions=window.__FW_TEXT_BRIDGE?.getPositions?.()||[];
  return cards.map((card,i)=>{const get=k=>card.querySelector(`[data-k="${k}"]`),p=positions[i]||{};return{label:String(card.querySelector('header strong')?.textContent||`Free Text ${i+1}`),text:String(get('text')?.value||''),font:String(get('font')?.value||'sans'),color:validColor(get('color')?.value,'#ffffff'),size:+get('size')?.value||42,opacity:+get('opacity')?.value||100,show:!!get('show')?.checked,react:String(get('react')?.value||'false')==='true',strength:+get('strength')?.value||0,x:Number.isFinite(p.x)?p.x:undefined,y:Number.isFinite(p.y)?p.y:undefined}});
}
function captureProject(){
  const api=window.__FW_MULTI_WAVE;
  return{schema:4,ratio:document.querySelector('[data-ratio].active')?.dataset.ratio||'16:9',reactive:{scope:$('reactScope')?.value||'waveText',syncMode:$('syncMode')?.value||'punchy',scenePunch:+$('scenePunch')?.value||7},waveLayers:api?.getLayers?.()||[],waveActiveIndex:api?.getActiveIndex?.()||0,waveLook:window.__FW_WAVE_LOOK?.getConfig?.()||null,texts:captureTexts()};
}
function sanitizeProject(p){
  if(!p||typeof p!=='object'||Array.isArray(p))return null;
  const raw=Array.isArray(p.waveLayers)?p.waveLayers.slice(0,5):[];
  const legacyPlates=Array.isArray(p.centerPlates)?p.centerPlates:[];
  const waves=raw.map((w,i)=>sanitizeWave(w,i,legacyPlates[i]));
  const reactiveRaw=p.reactive||p.controls||{};
  const scopeRaw=reactiveRaw.scope||reactiveRaw.reactScope;
  const reactive={
    scope:['wave','waveText','waveBg','full'].includes(scopeRaw)?scopeRaw:'waveText',
    syncMode:['balanced','punchy','transient'].includes(reactiveRaw.syncMode)?reactiveRaw.syncMode:'punchy',
    scenePunch:num(reactiveRaw.scenePunch,7,0,20)
  };
  const finalWaves=waves.length?waves:[sanitizeWave({},0)];
  return{schema:4,ratio:p.ratio==='9:16'?'9:16':'16:9',reactive,waveLayers:finalWaves,waveActiveIndex:num(p.waveActiveIndex,0,0,Math.max(0,finalWaves.length-1)),waveLook:sanitizeWaveLook(p.waveLook||{}),texts:Array.isArray(p.texts)?p.texts.slice(0,10).map(sanitizeText):[]};
}

function ensureTextCount(count){count=clamp(count,0,10);const cards=()=>[...document.querySelectorAll('#textList .text-card')];while(cards().length>count){const del=cards().at(-1)?.querySelector('.delete-text');if(!del)break;del.click()}while(cards().length<count){$('addText')?.click();if(cards().length>=10)break}}
function setTextField(card,key,value){const e=card.querySelector(`[data-k="${key}"]`);if(!e)return;if(e.type==='checkbox')e.checked=!!value;else e.value=String(value);fire(e,'input');if(e.tagName==='SELECT'||e.type==='checkbox')fire(e,'change')}
function twoFrames(){return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}
async function restoreTexts(texts){if(!Array.isArray(texts))return;ensureTextCount(texts.length);if(!texts.length){window.__FW_TEXT_BRIDGE?.reset?.();return}window.__FW_TEXT_BRIDGE?.enhanceAll?.();const cards=[...document.querySelectorAll('#textList .text-card')];texts.forEach((t,i)=>{const c=cards[i];if(!c)return;setTextField(c,'show',t.show);setTextField(c,'text',t.text);setTextField(c,'font',t.font);setTextField(c,'color',t.color);setTextField(c,'size',t.size);setTextField(c,'opacity',t.opacity);setTextField(c,'react',String(!!t.react));setTextField(c,'strength',t.strength)});await twoFrames();texts.forEach((t,i)=>{if(Number.isFinite(t.x)&&Number.isFinite(t.y))window.__FW_TEXT_BRIDGE?.moveTextTo?.(i,t.x,t.y)})}
async function applyProject(project){if(!project)return;document.querySelector(`[data-ratio="${project.ratio}"]`)?.click();const r=project.reactive;const scope=$('reactScope'),sync=$('syncMode'),punch=$('scenePunch');if(scope){scope.value=r.scope;fire(scope,'change')}if(sync){sync.value=r.syncMode;fire(sync,'change')}if(punch){punch.value=r.scenePunch;fire(punch,'input')}window.__FW_MULTI_WAVE?.setLayers?.(project.waveLayers,project.waveActiveIndex);window.__FW_WAVE_LOOK?.setConfig?.(project.waveLook);await restoreTexts(project.texts)}
function applyLegacyValues(values){if(!values||typeof values!=='object')return;const map={waveStyle:'change',waveShape:'change',waveReaction:'input',beatPunch:'input',beatSensitivity:'input',waveSmoothing:'input',waveGlow:'input',waveSize:'input',waveMaxSize:'input',waveThickness:'input',waveOpacity:'input',waveDetail:'input',toothDepth:'input',waveSharpness:'input',waveColor:'input',showWave:'change',showGlow:'change',showSecondary:'change',reactScope:'change',syncMode:'change',scenePunch:'input'};Object.entries(map).forEach(([id,type])=>{if(values[id]===undefined)return;const e=$(id);if(!e)return;if(e.type==='checkbox')e.checked=!!values[id];else e.value=values[id];fire(e,type)})}

let root=null;
function render(){if(!root)return;const items=loadAll(),list=root.querySelector('.user-preset-list'),count=root.querySelector('.user-preset-count');count.textContent=items.length+' / '+MAX_PRESETS;if(!items.length){list.innerHTML='<div class="user-preset-empty">No saved layout presets yet.</div>';return}list.innerHTML=items.map(p=>`<div class="user-preset-item" data-id="${esc(p.id)}"><button class="user-preset-load" type="button" title="Load preset"><span class="user-preset-icon">★</span><span><b>${esc(p.name)}</b><small>${esc(formatDate(p.updatedAt||p.createdAt))}</small></span></button><button class="user-preset-delete" type="button" title="Delete preset">×</button></div>`).join('')}
function saveCurrent(){const input=root.querySelector('.user-preset-name');let name=input.value.trim(),items=loadAll();if(!name)name='My Layout '+(items.length+1);const now=Date.now(),project=captureProject(),existing=items.find(x=>String(x.name).toLowerCase()===name.toLowerCase());if(existing){existing.project=project;existing.updatedAt=now;notify('Updated layout: '+name)}else{items.unshift({id:makeId(),name,project,createdAt:now,updatedAt:now});notify('Saved layout: '+name)}saveAll(items);input.value='';render()}
function exportPresets(){const items=loadAll();if(!items.length){notify('No presets to export');return}const payload={app:'FreeWaveform',type:'layout-presets',version:FILE_VERSION,exportedAt:new Date().toISOString(),presets:items},blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='freewaveform-presets-'+safeFileStamp()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);notify('Exported '+items.length+' preset'+(items.length===1?'':'s'))}
function normalizeImported(data){const source=Array.isArray(data)?data:data&&Array.isArray(data.presets)?data.presets:null;if(!source)return[];return source.map(item=>{if(!item||typeof item!=='object')return null;const name=String(item.name||'').trim().slice(0,40),project=sanitizeProject(item.project);if(project)return{name,project,createdAt:Number(item.createdAt)||Date.now(),updatedAt:Number(item.updatedAt)||Date.now()};if(item.values)return{name,legacyValues:item.values,createdAt:Number(item.createdAt)||Date.now(),updatedAt:Number(item.updatedAt)||Date.now()};return null}).filter(x=>x?.name)}
async function importPresets(file){if(!file)return;if(file.size>4*1024*1024){notify('Preset file is too large');return}try{const parsed=JSON.parse(await file.text());if(parsed?.app&&parsed.app!=='FreeWaveform')throw new Error('Not a FreeWaveform preset file');if(parsed?.version&&Number(parsed.version)>FILE_VERSION)throw new Error('Preset file is from a newer version');const incoming=normalizeImported(parsed);if(!incoming.length)throw new Error('No valid presets found');const items=loadAll();let added=0,updated=0;incoming.forEach(p=>{const existing=items.find(x=>String(x.name).toLowerCase()===p.name.toLowerCase());if(existing){Object.assign(existing,p,{id:existing.id,updatedAt:Date.now()});updated++}else if(items.length<MAX_PRESETS){items.unshift({id:makeId(),...p});added++}});saveAll(items);render();notify('Import complete · '+[added&&added+' added',updated&&updated+' updated'].filter(Boolean).join(' · '))}catch(err){console.error(err);notify('Import failed: '+(err?.message||'invalid preset file'))}}
function mount(){const host=document.getElementById('presetsHost');if(!host||document.querySelector('.user-presets-card'))return false;root=document.createElement('div');root.className='card user-presets-card';root.innerHTML=`<div class="card-title"><div><strong>Layout Presets</strong><small>Wave layers + Wave Look + Free Text</small></div><span class="badge user-preset-count">0 / ${MAX_PRESETS}</span></div><div class="user-preset-save-row"><input class="user-preset-name" type="text" maxlength="40" placeholder="Layout name, e.g. Kung Fu Punch" /><button class="button accent user-preset-save" type="button">Save current</button></div><div class="user-preset-transfer-row"><button class="button user-preset-export" type="button">⇩ Export presets</button><button class="button user-preset-import" type="button">⇧ Import presets</button><input class="user-preset-file" type="file" accept="application/json,.json" hidden /></div><div class="user-preset-list"></div><p class="hint">Saves waveform layers, Global Wave Look and Free Text content/styles/positions. Background media is not stored.</p>`;host.appendChild(root);const file=root.querySelector('.user-preset-file');root.querySelector('.user-preset-save').addEventListener('click',saveCurrent);root.querySelector('.user-preset-name').addEventListener('keydown',e=>{if(e.key==='Enter')saveCurrent()});root.querySelector('.user-preset-export').addEventListener('click',exportPresets);root.querySelector('.user-preset-import').addEventListener('click',()=>file.click());file.addEventListener('change',async()=>{await importPresets(file.files?.[0]);file.value=''});root.querySelector('.user-preset-list').addEventListener('click',async e=>{const item=e.target.closest('.user-preset-item');if(!item)return;const id=item.dataset.id;if(e.target.closest('.user-preset-delete')){const items=loadAll(),p=items.find(x=>x.id===id);if(!p||!confirm('Delete preset "'+p.name+'"?'))return;saveAll(items.filter(x=>x.id!==id));render();notify('Preset deleted');return}if(e.target.closest('.user-preset-load')){const p=loadAll().find(x=>x.id===id);if(!p)return;if(p.project)await applyProject(sanitizeProject(p.project));else applyLegacyValues(p.legacyValues||p.values);notify('Loaded preset: '+p.name)}});render();return true}
mount();
})();
