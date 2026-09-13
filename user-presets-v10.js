(()=>{
'use strict';

const STORAGE_KEY='freewaveform.userPresets.v1';
const MAX_PRESETS=30;

const selectIds=['waveStyle','waveShape','reactScope','syncMode'];
const rangeIds=['waveReaction','beatPunch','beatSensitivity','waveSmoothing','scenePunch','waveGlow','waveSize','waveThickness','waveOpacity','waveDetail','toothDepth','waveSharpness'];
const checkIds=['showWave','showPlate','showGlow','showSecondary'];
const colorIds=['waveColor'];

function $(id){return document.getElementById(id)}
function fire(el,type){if(el)el.dispatchEvent(new Event(type,{bubbles:true}))}
function notify(text){const el=$('toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>el.classList.remove('show'),2200)}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

function loadAll(){
  try{
    const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
    return Array.isArray(data)?data:[];
  }catch{return[]}
}
function saveAll(items){localStorage.setItem(STORAGE_KEY,JSON.stringify(items.slice(0,MAX_PRESETS)))}

function capture(){
  const values={};
  selectIds.forEach(id=>{const el=$(id);if(el)values[id]=el.value});
  rangeIds.forEach(id=>{const el=$(id);if(el)values[id]=el.value});
  checkIds.forEach(id=>{const el=$(id);if(el)values[id]=!!el.checked});
  colorIds.forEach(id=>{const el=$(id);if(el)values[id]=el.value});
  return values;
}

function apply(values){
  if(!values)return;
  // Apply style first because the core may enable/disable Shape based on the style.
  ['waveStyle','waveShape','reactScope','syncMode'].forEach(id=>{
    const el=$(id);if(!el||values[id]===undefined)return;
    el.value=values[id];fire(el,'change');
  });
  rangeIds.forEach(id=>{
    const el=$(id);if(!el||values[id]===undefined)return;
    el.value=values[id];fire(el,'input');
  });
  checkIds.forEach(id=>{
    const el=$(id);if(!el||values[id]===undefined)return;
    el.checked=!!values[id];fire(el,'change');
  });
  colorIds.forEach(id=>{
    const el=$(id);if(!el||values[id]===undefined)return;
    el.value=values[id];fire(el,'input');
  });
}

function makeId(){return 'p_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function formatDate(ts){try{return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric'})}catch{return''}}

let root=null;
function render(){
  if(!root)return;
  const items=loadAll();
  const list=root.querySelector('.user-preset-list');
  const count=root.querySelector('.user-preset-count');
  count.textContent=items.length+' / '+MAX_PRESETS;
  if(!items.length){
    list.innerHTML='<div class="user-preset-empty">No saved presets yet.</div>';
    return;
  }
  list.innerHTML=items.map(p=>`<div class="user-preset-item" data-id="${esc(p.id)}">
    <button class="user-preset-load" type="button" title="Load preset">
      <span class="user-preset-icon">★</span>
      <span><b>${esc(p.name)}</b><small>${esc(formatDate(p.updatedAt||p.createdAt))}</small></span>
    </button>
    <button class="user-preset-delete" type="button" title="Delete preset">×</button>
  </div>`).join('');
}

function saveCurrent(){
  const input=root.querySelector('.user-preset-name');
  let name=input.value.trim();
  const items=loadAll();
  if(!name)name='My Preset '+(items.length+1);
  const now=Date.now();
  const existing=items.find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(existing){
    existing.values=capture();
    existing.updatedAt=now;
    saveAll(items);
    notify('Updated preset: '+name);
  }else{
    items.unshift({id:makeId(),name,values:capture(),createdAt:now,updatedAt:now});
    saveAll(items);
    notify('Saved preset: '+name);
  }
  input.value='';
  render();
}

function mount(){
  const panel=document.querySelector('[data-panel="waveform"]');
  const templateGrid=$('templateGrid');
  if(!panel||!templateGrid||document.querySelector('.user-presets-card'))return false;
  const templateCard=templateGrid.closest('.card');
  if(!templateCard)return false;

  root=document.createElement('div');
  root.className='card user-presets-card';
  root.innerHTML=`
    <div class="card-title">
      <div><strong>My Presets</strong><small>Save your current waveform settings in this browser</small></div>
      <span class="badge user-preset-count">0 / ${MAX_PRESETS}</span>
    </div>
    <div class="user-preset-save-row">
      <input class="user-preset-name" type="text" maxlength="40" placeholder="Preset name, e.g. Kung Fu Punch" />
      <button class="button accent user-preset-save" type="button">Save current</button>
    </div>
    <div class="user-preset-list"></div>
    <p class="hint">Saving again with the same name updates that preset. Presets stay available after refresh, but are stored only in this browser.</p>`;
  templateCard.insertAdjacentElement('afterend',root);

  const style=document.createElement('style');
  style.textContent=`
    .user-presets-card{margin-top:12px}
    .user-preset-save-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
    .user-preset-name{width:100%;height:38px;padding:0 11px;border:1px solid #2b3236;border-radius:9px;background:#0a0f11;color:#eee6da;outline:none;font:500 10px Inter,system-ui,sans-serif}
    .user-preset-name:focus{border-color:#a87943;box-shadow:0 0 0 2px rgba(210,161,91,.10)}
    .user-preset-save{height:38px;white-space:nowrap;padding:0 12px}
    .user-preset-list{display:grid;gap:6px;margin-top:9px}
    .user-preset-item{display:grid;grid-template-columns:minmax(0,1fr) 34px;gap:6px;align-items:stretch}
    .user-preset-load{min-width:0;height:42px;border:1px solid #293034;border-radius:9px;background:#0c1113;color:#d8d0c4;display:flex;align-items:center;gap:9px;padding:0 10px;text-align:left;cursor:pointer}
    .user-preset-load:hover{border-color:#7d5c36;background:#15130f}
    .user-preset-load>span:last-child{min-width:0;display:flex;align-items:center;gap:8px;flex:1}
    .user-preset-load b{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
    .user-preset-load small{font-size:8px;color:#777;white-space:nowrap}
    .user-preset-icon{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:#1b1710;color:#d9a95f;border:1px solid #5b4327;font-size:10px;flex:none}
    .user-preset-delete{height:42px;border:1px solid #293034;border-radius:9px;background:#0c1113;color:#777;cursor:pointer;font-size:16px}
    .user-preset-delete:hover{color:#f1b8a7;border-color:#71443a;background:#1b1110}
    .user-preset-empty{padding:9px 10px;border:1px dashed #293034;border-radius:9px;color:#777;font-size:9px;text-align:center}
    @media(max-width:520px){.user-preset-save-row{grid-template-columns:1fr}.user-preset-save{width:100%}}
  `;
  document.head.appendChild(style);

  root.querySelector('.user-preset-save').addEventListener('click',saveCurrent);
  root.querySelector('.user-preset-name').addEventListener('keydown',e=>{if(e.key==='Enter')saveCurrent()});
  root.querySelector('.user-preset-list').addEventListener('click',e=>{
    const item=e.target.closest('.user-preset-item');if(!item)return;
    const id=item.dataset.id;
    if(e.target.closest('.user-preset-delete')){
      const items=loadAll();
      const p=items.find(x=>x.id===id);
      if(!p)return;
      if(!confirm('Delete preset "'+p.name+'"?'))return;
      saveAll(items.filter(x=>x.id!==id));
      render();notify('Preset deleted');
      return;
    }
    if(e.target.closest('.user-preset-load')){
      const p=loadAll().find(x=>x.id===id);if(!p)return;
      apply(p.values);notify('Loaded preset: '+p.name);
    }
  });

  render();
  return true;
}

if(!mount()){
  let tries=0;
  const timer=setInterval(()=>{tries++;if(mount()||tries>30)clearInterval(timer)},100);
}
})();
