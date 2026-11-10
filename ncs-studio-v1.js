/* Music Visualizer Studio - a fast workflow on top of the existing FreeWaveform editor.
   Builds ordinary waveform, FX and text layers, preserving existing export and presets. */
(()=>{
'use strict';
if(new URLSearchParams(location.search).get('hq-render')==='1')return;
const $=s=>document.querySelector(s);
const toast=window.__FW_TOAST||(()=>{});
const host=$('[data-panel="audio"]'),api=()=>window.__FW_MULTI_WAVE,fx=()=>window.__FW_FX;
if(!host)return;
const palettes={
  classic:{name:'Classic White',color:'#f5f8ff',preset:'ncsClassic',darkness:25},
  cyan:{name:'Neon Cyan',color:'#69e8ff',preset:'ncsNeon',darkness:36},
  pink:{name:'Neon Pink',color:'#ff83cf',preset:'ncsNeon',darkness:35},
  gold:{name:'Golden Festival',color:'#ffc46e',preset:'ncsFestival',darkness:34},
  chill:{name:'Minimal White',color:'#ffffff',preset:'ncsMinimal',darkness:21}
};
const effects=[
 ['none','None'],['snow','❄ Snow'],['snowflake','❅ Detailed Snowflakes'],
 ['rain','☂ Rain'],['wind','➠ Wind'],['smoke','≈ Smoke'],['mist','≋ Mist / Fog'],
 ['petals','❀ Petals'],['flowers','✿ Floating Flowers'],['leaves','🍁 Autumn Leaves'],
 ['dust','✦ Dust'],['firefly','● Fireflies'],['sparkle','✧ Sparkles'],
 ['bubbles','○ Bubbles'],['embers','✴ Embers'],['bokeh','◯ Bokeh'],
 ['lightleak','◒ Light Leaks'],['rays','☀ Light Rays'],['frame','▣ Magic Frame'],
 ['cc-meteor','☄ Meteors'],['cc-lightning','ϟ Lightning'],['cc-halo','◎ Halo'],
 ['cc-confetti','▦ Confetti'],['cc-butterflies','⋈ Butterflies'],['cc-hearts','♥ Hearts']
];
const presetOptions=Object.entries(palettes).map(([id,p])=>`<option value="${id}">${p.name}</option>`).join('');
const effectOptions=effects.map(([id,name])=>`<label class="ncs-fx-choice"><input type="checkbox" value="${id}" ${id==='snow'?'checked':''}>${name}</label>`).join('');
const style=document.createElement('style');style.textContent=`
.ncs-studio-card{border:1px solid #4d5665;border-radius:13px;margin:0 0 13px;padding:13px;background:linear-gradient(155deg,rgba(35,49,65,.9),rgba(10,15,20,.95));color:#f3f6fc}
.ncs-studio-card .ncs-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px}
.ncs-studio-card .ncs-title strong{font-size:14px;color:white}.ncs-studio-card .ncs-title small{font-size:10px;color:#7de6ff}
.ncs-studio-card p{color:#adb8c9;font-size:11px;line-height:1.5;margin:5px 0 11px}
.ncs-studio-card .ncs-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ncs-studio-card label.ncs-field{display:grid;gap:5px;font-size:11px;color:#c7d4e2;margin:5px 0}
.ncs-studio-card input[type=text],.ncs-studio-card input[type=file],.ncs-studio-card select{width:100%;min-width:0;background:#101a26;color:#f6f7fb;border:1px solid #435365;border-radius:7px;padding:9px 7px;font:inherit;font-size:12px}
.ncs-studio-card input[type=file]{font-size:10px}.ncs-studio-card input[type=file]::file-selector-button{background:#27394d;color:#fff;border:0;border-radius:4px;padding:4px}
.ncs-studio-card .ncs-effects{max-height:170px;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;padding:8px;background:#101a26;border:1px solid #435365;border-radius:8px}
.ncs-studio-card .ncs-fx-choice{display:flex;align-items:center;gap:6px;font-size:11px;color:#e7f0f6;padding:5px 1px;cursor:pointer}
.ncs-studio-card .ncs-fx-choice input{accent-color:#78d7fc}
.ncs-studio-card .ncs-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}
.ncs-studio-card .ncs-actions button{background:#223348;color:#f0f5fb;border:1px solid #59708a;border-radius:8px;padding:10px 5px;font-weight:700;font-size:11px;cursor:pointer}
.ncs-studio-card .ncs-actions .primary{background:#0b96c6;border-color:#0b96c6;color:#fff}
.ncs-studio-card .ncs-actions button:disabled{opacity:.55;cursor:not-allowed}
.ncs-studio-card .ncs-foot{margin-top:8px;font-size:10px;color:#99afc0}
`;document.head.appendChild(style);
const card=document.createElement('section');card.className='ncs-studio-card';
card.innerHTML=`
<div class="ncs-title"><strong>◉ Music Visualizer Studio</strong><small>NCS-inspired</small></div>
<p>Upload one background and MP3, enter your title, choose a spectrum and atmosphere, then export your complete music video.</p>
<label class="ncs-field">1 · MP3 / audio file<input class="ncs-audio" type="file" accept="audio/*"></label>
<label class="ncs-field">2 · Background image<input class="ncs-background" type="file" accept="image/*"></label>
<div class="ncs-grid">
<label class="ncs-field">3 · Track title<input class="ncs-track" type="text" placeholder="The Night We Fly" maxlength="120"></label>
<label class="ncs-field">Artist / channel<input class="ncs-artist" type="text" placeholder="Your Artist Name" maxlength="120"></label>
</div>
<div class="ncs-grid">
<label class="ncs-field">4 · Spectrum theme<select class="ncs-theme">${presetOptions}</select></label>
<label class="ncs-field">Layout<select class="ncs-ratio"><option value="16:9">YouTube 16:9</option><option value="9:16">Shorts 9:16</option></select></label>
</div>
<label class="ncs-field">5 · Atmosphere (choose up to 8 layers)</label>
<div class="ncs-effects" role="group" aria-label="Ambient effects">${effectOptions}</div>
<div class="ncs-actions"><button type="button" class="primary ncs-apply">Apply Studio Scene</button><button type="button" class="ncs-export">Generate WebM</button></div>
<div class="ncs-actions"><button type="button" class="ncs-export-hq">Export HQ MP4</button><button type="button" class="ncs-open-wave">Advanced waveform</button></div>
<div class="ncs-foot">Local WebM is browser-recorded. HQ MP4 needs Cloudflare R2 + GitHub Actions setup; cloud export uploads your input assets.</div>`;
host.insertBefore(card,host.firstChild);
const el=cls=>card.querySelector(cls);
function attachFile(source,target){
 const file=source.files?.[0],input=$(target);if(!file||!input)return;
 const data=new DataTransfer();data.items.add(file);input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));
}
el('.ncs-audio').addEventListener('change',e=>attachFile(e.target,'#audioFile'));
el('.ncs-background').addEventListener('change',e=>attachFile(e.target,'#imageFile'));
function field(card,key,value,event='input'){
 const input=card?.querySelector(`[data-k="${key}"]`);
 if(!input)return;input.value=String(value);input.dispatchEvent(new Event(event,{bubbles:true}));
}
let sceneDirty=true;
function createText(title,artist){
 // Only Studio-created free-text layers are replaced. Advanced layers are left intact.
 const state=window.__FW_APP?.getState?.();
 if(!state)return;
 const previous=state.texts||[];
 for(let i=previous.length-1;i>=0;i--){if(previous[i]?.ncsStudio){const btn=$(`#textList .text-card[data-index="${i}"] .delete-text`);btn?.click()}}
 const items=[{value:title,y:78,size:56},{value:artist,y:85,size:33}].filter(x=>x.value?.trim());
 for(const t of items){
   const add=$('#addText');if(!add)break;
   add.click();const idx=state.texts.length-1,entry=state.texts[idx];
   if(!entry)continue;entry.ncsStudio=true;entry.label=t.size>40?'Music Title':'Artist';
   const row=$(`#textList .text-card[data-index="${idx}"]`);
   if(row?.querySelector('header strong'))row.querySelector('header strong').textContent=entry.label;
   field(row,'text',t.value);
   field(row,'font','sans','change');field(row,'color','#ffffff');
   field(row,'size',t.size);field(row,'opacity',96);
   field(row,'strength',12);
   window.__FW_TEXT_BRIDGE?.setPosition?.(idx,50,t.y);
 }
}
function applyStudio(){
 const wave=api(),effectsApi=fx();
 if(!wave){toast('Wave editor is not ready');return false}
 const theme=palettes[el('.ncs-theme').value]||palettes.classic;
 const preset=window.__FW_WAVE_CONFIG?.TEMPLATES?.[theme.preset];
 if(preset)wave.applyPreset?.({...preset,color:theme.color},theme.name);
 const ratio=el('.ncs-ratio').value;
 window.__FW_APP?.setRatio?.(ratio);
 const imgDarkness=$('#imageDarkness');if(imgDarkness){imgDarkness.value=theme.darkness;imgDarkness.dispatchEvent(new Event('input',{bubbles:true}))}
 createText(el('.ncs-track').value.trim(),el('.ncs-artist').value.trim());
 if(effectsApi){
   const selected=[...card.querySelectorAll('.ncs-effects input:checked')].map(e=>e.value).filter(t=>t!=='none');
   effectsApi.setLayers?.([],0);
   const allowed=new Set(effectsApi.types||[]);
   let extras=0,base=0;const extraSet=new Set(['cc-feathers','cc-leaves','cc-hearts','cc-confetti','cc-butterflies','cc-meteor','cc-lightning','cc-halo']);
   for(const type of selected){if(!allowed.has(type))continue;if(extraSet.has(type)){if(extras>=5)continue;extras++}else{if(base>=8)continue;base++}effectsApi.addLayer(type)}
 }
 sceneDirty=false;
 toast('Studio scene applied. Preview your track and export.');
 return true;
}
el('.ncs-apply').addEventListener('click',applyStudio);
el('.ncs-export').addEventListener('click',()=>{if(!$('#audioFile')?.files?.length){toast('Select your MP3 first');return}if((!sceneDirty||applyStudio()))$('#exportBtn')?.click()});
el('.ncs-export-hq').addEventListener('click',()=>{if(!$('#audioFile')?.files?.length){toast('Select your MP3 first');return}if(sceneDirty&&!applyStudio())return;const button=$('#hqExportBtn');if(button)button.click();else toast('HQ MP4 service is not configured')});
el('.ncs-open-wave').addEventListener('click',()=>$('[data-tool="waveform"]')?.click());
card.querySelectorAll('.ncs-effects input').forEach(input=>input.addEventListener('change',()=>{sceneDirty=true;
 const selected=[...card.querySelectorAll('.ncs-effects input:checked')];
 if(input.value==='none'&&input.checked)selected.filter(x=>x!==input).forEach(x=>x.checked=false);
 else if(input.value!=='none'&&input.checked)card.querySelector('input[value=none]').checked=false;
 const active=[...card.querySelectorAll('.ncs-effects input:checked')].filter(x=>x.value!=='none');
 if(active.length>8){input.checked=false;toast('Choose up to 8 effects');}
 const extras=active.filter(x=>['cc-meteor','cc-lightning','cc-halo','cc-confetti','cc-butterflies','cc-hearts'].includes(x.value));if(extras.length>5){input.checked=false;toast('Use up to 5 extra decor/energy effects');}
}));
card.addEventListener('input',e=>{if(e.target.closest('.ncs-effects'))return;sceneDirty=true});
card.addEventListener('change',e=>{if(e.target.closest('.ncs-effects'))return;sceneDirty=true});
window.__FW_NCS_STUDIO={applyStudio};
})();