(()=>{
'use strict';
if(new URLSearchParams(location.search).get('hq-render')==='1')return;

const app=window.__FW_APP;
const host=document.getElementById('presetsHost');
const toast=window.__FW_TOAST||(()=>{});
const clamp=window.__FW_UTILS?.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
if(!app||!host)return;

const KEY='fw.hqExportKey';
const AUTO_KEY='fw.productionTemplate.autoLoad';
const fire=(el,type)=>el?.dispatchEvent(new Event(type,{bubbles:true}));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

let root=null,templates=[],defaultId='',busy=false,autoLoaded=false;

function getKey(){return localStorage.getItem(KEY)||''}
async function apiFetch(url,options={},retry=true){
  const headers=new Headers(options.headers||{}),key=getKey();
  if(key)headers.set('X-HQ-Key',key);
  const res=await fetch(url,{...options,headers});
  if(res.status===401&&retry){
    const entered=prompt('Enter your HQ Export Key');
    if(entered){localStorage.setItem(KEY,entered.trim());return apiFetch(url,options,false)}
  }
  return res;
}
function fmt(v){if(!v)return'';const d=new Date(v);return Number.isNaN(+d)?'':d.toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
function cleanFill(raw,index){
  const r=raw?.resource||null;
  return{index,enabled:!!raw?.enabled,color:String(raw?.color||'#17191c'),opacity:+raw?.opacity||88,type:raw?.type==='image'?'image':'color',imageX:Number.isFinite(+raw?.imageX)?+raw.imageX:50,imageY:Number.isFinite(+raw?.imageY)?+raw.imageY:50,imageZoom:Number.isFinite(+raw?.imageZoom)?+raw.imageZoom:100,assetField:r?.url?`fill_${index}`:null,resourceName:r?.name||`fill-${index}.png`};
}
async function captureFill(){
  const waves=window.__FW_MULTI_WAVE,fill=window.__FW_WAVE_FILL;
  if(!waves||!fill)return{configs:[],files:[]};
  const original=waves.getActiveIndex?.()||0,layers=waves.getLayers?.()||[],configs=[],files=[];
  for(let i=0;i<layers.length;i++){
    waves.selectLayer?.(i);await sleep(0);
    const raw=fill.getConfig?.()||{},cfg=cleanFill(raw,i);configs.push(cfg);
    if(cfg.assetField&&raw?.resource?.url){
      try{
        const res=await fetch(raw.resource.url);
        if(res.ok){const blob=await res.blob();files.push({field:cfg.assetField,blob,name:cfg.resourceName})}
      }catch{}
    }
  }
  waves.selectLayer?.(original);
  return{configs,files};
}
function captureTexts(){
  const state=app.getState(),positions=window.__FW_TEXT_BRIDGE?.getPositions?.()||[];
  return(state.texts||[]).map((t,i)=>({...t,x:Number.isFinite(positions[i]?.x)?positions[i].x:t.x,y:Number.isFinite(positions[i]?.y)?positions[i].y:t.y}));
}
async function captureTemplate(){
  const state=app.getState(),fill=await captureFill();
  return{
    project:{
      version:2,
      ratio:state.ratio||'16:9',
      background:{config:{...state.bg}},
      reactive:{...state.reactive},
      texts:captureTexts(),
      waveLayers:window.__FW_MULTI_WAVE?.getLayers?.()||[],
      waveActiveIndex:window.__FW_MULTI_WAVE?.getActiveIndex?.()||0,
      waveLook:window.__FW_WAVE_LOOK?.getConfig?.()||null,
      waveFill:fill.configs,
      fx:{layers:window.__FW_FX?.getLayers?.()||[],activeIndex:window.__FW_FX?.getActiveIndex?.()??-1,previewQuality:window.__FW_FX?.getPreviewQuality?.()||'performance'},
      reaction:window.__FW_AUDIO_REACTION?.getConfig?.()||null
    },
    fillFiles:fill.files
  };
}
function setTextField(card,key,value){
  const e=card?.querySelector(`[data-k="${key}"]`);if(!e)return;
  if(e.type==='checkbox')e.checked=!!value;else e.value=String(value??'');
  fire(e,'input');if(e.tagName==='SELECT'||e.type==='checkbox')fire(e,'change');
}
async function applyTexts(items=[]){
  const state=app.getState(),cards=()=>[...document.querySelectorAll('#textList .text-card')];
  while(state.texts.length>items.length)cards().at(-1)?.querySelector('.delete-text')?.click();
  while(state.texts.length<items.length)document.getElementById('addText')?.click();
  const next=cards();
  items.forEach((t,i)=>{
    const c=next[i];if(!c)return;
    setTextField(c,'show',t.show!==false);setTextField(c,'text',t.text||'');setTextField(c,'font',t.font||'sans');
    setTextField(c,'color',t.color||'#ffffff');setTextField(c,'size',t.size||42);setTextField(c,'opacity',t.opacity??100);
    setTextField(c,'react',String(!!t.react));setTextField(c,'strength',t.strength||0);
  });
  await sleep(30);
  items.forEach((t,i)=>{if(Number.isFinite(+t.x)&&Number.isFinite(+t.y))window.__FW_TEXT_BRIDGE?.moveTextTo?.(i,+t.x,+t.y)});
}
function syncBackgroundControls(config={}){
  const state=app.getState();
  state.bg={...(state.bg||{}),...config};
  const spec=[['imageFit','fit','change',''],['imageOpacity','opacity','input','%'],['imageZoom','zoom','input','%'],['imageDarkness','darkness','input','%'],['imageBlur','blur','input','px'],['imageSaturation','saturation','input','%']];
  spec.forEach(([id,key,type,suffix])=>{
    const el=document.getElementById(id);if(!el||config[key]===undefined)return;
    el.value=config[key];fire(el,type);
    const out=document.getElementById(id+'Value');if(out)out.textContent=String(config[key])+suffix;
  });
  state.bg.x=Number.isFinite(+config.x)?+config.x:state.bg.x;
  state.bg.y=Number.isFinite(+config.y)?+config.y:state.bg.y;
}
async function setFillImage(index,url,name,cfg){
  const waves=window.__FW_MULTI_WAVE,fill=window.__FW_WAVE_FILL,input=document.getElementById('waveFillImageFile');
  if(!waves||!fill)return;
  waves.selectLayer?.(index);
  fill.setConfig?.({enabled:cfg.enabled,color:cfg.color,opacity:cfg.opacity,type:'color',imageX:cfg.imageX,imageY:cfg.imageY,imageZoom:cfg.imageZoom});
  if(cfg.type!=='image'||!url||!input){fill.setConfig?.(cfg);return}
  try{
    const res=await apiFetch(url);if(!res.ok)throw new Error('Fill image unavailable');
    const blob=await res.blob(),file=new File([blob],name||`fill-${index}.png`,{type:blob.type||'image/png'}),dt=new DataTransfer();
    dt.items.add(file);input.files=dt.files;fire(input,'change');
    for(let n=0;n<80;n++){if(fill.getConfig?.().hasImage)break;await sleep(25)}
    fill.setConfig?.({enabled:cfg.enabled,color:cfg.color,opacity:cfg.opacity,type:'image',imageX:cfg.imageX,imageY:cfg.imageY,imageZoom:cfg.imageZoom});
  }catch{fill.setConfig?.({...cfg,type:'color'})}
}
function applyReaction(config){
  if(!config)return;
  const api=window.__FW_AUDIO_REACTION;
  api?.setEnabled?.(config.enabled!==false);
  Object.entries(config.targets||{}).forEach(([k,v])=>api?.setTarget?.(k,!!v));
  const pairs=[
    ['reactionBg',config.bgPunch,'input'],
    ['reactionTextPulse',config.textPulse,'input'],
    ['reactionFxMode',config.fxMode,'change'],
    ['reactionFxPulse',config.fxPulse,'input']
  ];
  pairs.forEach(([id,value,type])=>{const el=document.getElementById(id);if(el&&value!==undefined){el.value=value;fire(el,type)}});
}
async function applyProject(project={},assetUrls={}){
  app.setRatio?.(project.ratio==='9:16'?'9:16':'16:9');
  syncBackgroundControls(project.background?.config||{});
  const state=app.getState();
  state.reactive={...(state.reactive||{}),...(project.reactive||{})};
  window.__FW_MULTI_WAVE?.setLayers?.(project.waveLayers||[],project.waveActiveIndex||0);
  window.__FW_WAVE_LOOK?.setConfig?.(project.waveLook||{});
  await applyTexts(project.texts||[]);
  window.__FW_FX?.setLayers?.(project.fx?.layers||[],project.fx?.activeIndex||0);
  if(project.fx?.previewQuality)window.__FW_FX?.setPreviewQuality?.(project.fx.previewQuality,true);
  applyReaction(project.reaction);
  const fills=Array.isArray(project.waveFill)?project.waveFill:[],waves=window.__FW_MULTI_WAVE,original=waves?.getActiveIndex?.()||0;
  for(const cfg of fills)await setFillImage(cfg.index,assetUrls[cfg.assetField]||'',cfg.resourceName,cfg);
  waves?.selectLayer?.(original);
  await document.fonts?.ready;await sleep(40);
}
async function saveTemplate(){
  if(busy)return;
  let name=root.querySelector('.prod-name').value.trim();
  if(!name){toast('Enter a template name');return}
  name=name.slice(0,60);
  const same=templates.find(t=>t.name.toLowerCase()===name.toLowerCase());
  if(same&&!confirm(`Update production template "${same.name}"?`))return;
  busy=true;syncButtons();
  try{
    const {project,fillFiles}=await captureTemplate(),form=new FormData();
    form.append('name',name);form.append('project',JSON.stringify(project));
    if(same)form.append('id',same.id);
    fillFiles.forEach(x=>form.append(x.field,x.blob,x.name));
    const res=await apiFetch('/api/hq/template/save',{method:'POST',body:form}),data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||`Save failed (${res.status})`);
    root.querySelector('.prod-name').value='';
    toast(same?'Production template updated':'Production template saved');
    await loadList();
  }catch(err){toast(err?.message||'Could not save production template')}
  finally{busy=false;syncButtons()}
}
async function loadList(){
  try{
    const res=await apiFetch('/api/hq/template/list'),data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||`Could not load templates (${res.status})`);
    templates=Array.isArray(data.templates)?data.templates:[];defaultId=data.defaultId||'';renderList();
  }catch(err){if(root)root.querySelector('.prod-list').innerHTML=`<div class="prod-empty">${esc(err?.message||'Could not load templates')}</div>`}
}
async function loadTemplate(id){
  if(busy)return;busy=true;syncButtons();
  try{
    const res=await apiFetch(`/api/hq/template/${encodeURIComponent(id)}`),data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||`Load failed (${res.status})`);
    await applyProject(data.project||{},data.assetUrls||{});
    toast(`Loaded production template: ${data.name||'Template'}`);
  }catch(err){toast(err?.message||'Could not load production template')}
  finally{busy=false;syncButtons()}
}
async function loadDefault(silent=false){
  if(defaultId)return loadTemplate(defaultId);
  if(busy)return;
  busy=true;syncButtons();
  try{
    const res=await apiFetch('/api/hq/template/default'),data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||`Load default failed (${res.status})`);
    defaultId=data.id||'';await applyProject(data.project||{},data.assetUrls||{});
    if(!silent)toast(`Loaded default production template: ${data.name||'Template'}`);
    await loadList();
  }catch(err){if(!silent)toast(err?.message||'No default production template is set')}
  finally{busy=false;syncButtons()}
}
async function setDefault(id){
  if(busy)return;busy=true;syncButtons();
  try{
    const res=await apiFetch(`/api/hq/template/default/${encodeURIComponent(id)}`,{method:'POST'}),data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||`Could not set default (${res.status})`);
    defaultId=id;renderList();toast('Default production template updated');
  }catch(err){toast(err?.message||'Could not set default template')}
  finally{busy=false;syncButtons()}
}
async function removeTemplate(id){
  const item=templates.find(t=>t.id===id);if(!item||busy)return;
  if(!confirm(`Delete production template "${item.name}" from R2?`))return;
  busy=true;syncButtons();
  try{
    const res=await apiFetch(`/api/hq/template/${encodeURIComponent(id)}`,{method:'DELETE'}),data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||`Delete failed (${res.status})`);
    toast('Production template deleted');await loadList();
  }catch(err){toast(err?.message||'Could not delete template')}
  finally{busy=false;syncButtons()}
}
function newVideo(){
  const state=app.getState(),audio=document.getElementById('audio'),audioFile=document.getElementById('audioFile'),imageFile=document.getElementById('imageFile');
  try{audio?.pause?.();if(audio){audio.removeAttribute('src');audio.load()}}catch{}
  if(audioFile)audioFile.value='';if(imageFile)imageFile.value='';
  state.image=null;
  if(state.imageUrl){try{URL.revokeObjectURL(state.imageUrl)}catch{}state.imageUrl=''}
  const audioName=document.getElementById('audioName'),imageName=document.getElementById('imageName'),dur=document.getElementById('durationLabel'),analysis=document.getElementById('analysisLabel'),status=document.getElementById('statusAudio');
  if(audioName)audioName.textContent='No file selected';if(imageName)imageName.textContent='Optional';if(dur)dur.textContent='—';if(analysis)analysis.textContent='Waiting';if(status)status.textContent='NO AUDIO';
  toast('New video ready · template settings kept');
}
function renderList(){
  if(!root)return;
  const list=root.querySelector('.prod-list'),badge=root.querySelector('.prod-count');
  badge.textContent=`${templates.length} R2`;
  if(!templates.length){list.innerHTML='<div class="prod-empty">No production templates saved in R2 yet.</div>';syncButtons();return}
  list.innerHTML=templates.map(t=>`<div class="prod-item ${t.id===defaultId?'default':''}" data-id="${esc(t.id)}"><button type="button" class="prod-load"><span class="prod-star">${t.id===defaultId?'★':'☆'}</span><span class="prod-copy"><b>${esc(t.name)}</b><small>${t.id===defaultId?'DEFAULT · ':''}${esc(fmt(t.updatedAt))}</small></span></button><button type="button" class="prod-default" title="Set default">★</button><button type="button" class="prod-delete" title="Delete">×</button></div>`).join('');
  syncButtons();
}
function syncButtons(){
  if(!root)return;
  root.querySelectorAll('button').forEach(b=>{if(b.classList.contains('prod-new'))return;b.disabled=busy});
  const load=root.querySelector('.prod-load-default');if(load)load.disabled=busy;
}
function mountStyles(){
  if(document.getElementById('fw-production-template-style'))return;
  const s=document.createElement('style');s.id='fw-production-template-style';s.textContent=`
.prod-card{margin-bottom:10px}.prod-save-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px}.prod-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:7px 0 9px}.prod-list{display:grid;gap:6px}.prod-item{display:grid;grid-template-columns:minmax(0,1fr) 34px 34px;gap:5px}.prod-load{height:46px;border:1px solid #293034;border-radius:9px;background:#0c1113;color:#d8d0c4;display:flex;align-items:center;gap:8px;padding:0 9px;cursor:pointer;text-align:left;min-width:0}.prod-item.default .prod-load{border-color:#956a39;background:#18130e}.prod-star{width:22px;color:#e1b367;text-align:center}.prod-copy{min-width:0;display:flex;flex-direction:column;gap:2px}.prod-copy b{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.prod-copy small{font-size:8px;color:#777}.prod-default,.prod-delete{height:46px;border:1px solid #293034;border-radius:9px;background:#0c1113;color:#777;cursor:pointer}.prod-default{color:#d7aa62}.prod-delete:hover{color:#f1b8a7;border-color:#71443a}.prod-empty{padding:10px;border:1px dashed #2c3236;border-radius:9px;color:#777;font-size:9px;text-align:center}.prod-auto{display:flex!important;align-items:center;gap:7px;margin:8px 0 0!important;color:#a89f94!important;font-size:9px!important}.prod-note{margin-top:8px!important}@media(max-width:820px){.prod-save-row,.prod-actions{grid-template-columns:1fr}}
`;document.head.appendChild(s);
}
function mount(){
  mountStyles();
  root=document.createElement('div');root.className='card prod-card';root.innerHTML=`
    <div class="card-title"><div><strong>Production Templates</strong><small>Saved in R2 · shared across browsers with your HQ key</small></div><span class="badge prod-count">0 R2</span></div>
    <div class="prod-save-row"><input class="prod-name" type="text" maxlength="60" placeholder="Template name, e.g. Chinese Beats Default"><button class="button accent prod-save" type="button">Save Template</button></div>
    <div class="prod-actions"><button class="button prod-load-default" type="button">Load Default</button><button class="button prod-new" type="button">New Video</button></div>
    <label class="prod-auto"><input class="prod-auto-check" type="checkbox"> Auto-load default when this browser opens</label>
    <div class="prod-list"><div class="prod-empty">Loading production templates…</div></div>
    <p class="hint prod-note">Saves waveform, fill, FX, Reaction, Free Text, ratio and background settings. Audio and the main background image are never stored in the template.</p>`;
  host.prepend(root);
  root.querySelector('.prod-auto-check').checked=localStorage.getItem(AUTO_KEY)!=='0';
  root.querySelector('.prod-auto-check').addEventListener('change',e=>localStorage.setItem(AUTO_KEY,e.target.checked?'1':'0'));
  root.querySelector('.prod-save').addEventListener('click',saveTemplate);
  root.querySelector('.prod-load-default').addEventListener('click',()=>loadDefault(false));
  root.querySelector('.prod-new').addEventListener('click',newVideo);
  root.querySelector('.prod-list').addEventListener('click',e=>{
    const item=e.target.closest('.prod-item');if(!item)return;const id=item.dataset.id;
    if(e.target.closest('.prod-delete'))return removeTemplate(id);
    if(e.target.closest('.prod-default'))return setDefault(id);
    if(e.target.closest('.prod-load'))return loadTemplate(id);
  });
  root.querySelector('.prod-name').addEventListener('keydown',e=>{if(e.key==='Enter')saveTemplate()});
  init();
}
async function init(){
  const hasKey=!!getKey();
  if(!hasKey){root.querySelector('.prod-list').innerHTML='<div class="prod-empty">HQ key is not saved in this browser yet. Save or load a template and enter it once.</div>';syncButtons();return}
  await loadList();
  if(!autoLoaded&&localStorage.getItem(AUTO_KEY)!=='0'&&defaultId){
    autoLoaded=true;
    const state=app.getState(),hasAudio=!!document.getElementById('audioFile')?.files?.length,hasImage=!!state.image;
    if(!hasAudio&&!hasImage)await loadDefault(true);
  }
}

mount();
window.__FW_PRODUCTION_TEMPLATES={refresh:loadList,loadDefault,newVideo};
})();