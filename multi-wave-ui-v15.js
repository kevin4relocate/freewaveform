(()=>{
'use strict';

const LOOK_DEFAULTS={contrast:'auto',outline:3,backdrop:'local-soft'};
const LOOK_STORAGE='freewaveform.waveLook.v1';
const clamp=window.__FW_UTILS?.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const toast=window.__FW_TOAST||(()=>{});
let look={...LOOK_DEFAULTS};

function normalize(value={}){return{contrast:['none','soft','strong','auto'].includes(value.contrast)?value.contrast:LOOK_DEFAULTS.contrast,outline:clamp(Number.isFinite(+value.outline)?+value.outline:LOOK_DEFAULTS.outline,0,10),backdrop:['off','local-soft','local-blur'].includes(value.backdrop)?value.backdrop:LOOK_DEFAULTS.backdrop}}
function load(){try{look=normalize(JSON.parse(localStorage.getItem(LOOK_STORAGE)||'{}'))}catch{look={...LOOK_DEFAULTS}}}
function save(){try{localStorage.setItem(LOOK_STORAGE,JSON.stringify(look))}catch{}document.dispatchEvent(new CustomEvent('fw:wave-look-change',{detail:{...look}}))}
function syncUI(){const c=document.getElementById('waveContrastMode'),o=document.getElementById('waveOutline'),b=document.getElementById('waveBackdrop'),v=document.getElementById('waveOutlineValue'),auto=document.getElementById('autoContrastColor');if(c)c.value=look.contrast;if(o)o.value=look.outline;if(b)b.value=look.backdrop;if(v)v.textContent=look.outline+'px';auto?.classList.toggle('active-look',look.contrast==='auto')}
function mount(){
  const layers=document.querySelector('.multi-wave-card'),waveformCard=document.getElementById('waveStyle')?.closest('.card');if(!layers||!waveformCard)return false;
  if(!layers.classList.contains('mw-embedded')){layers.classList.add('mw-embedded');const title=waveformCard.querySelector(':scope > .card-title');title?title.insertAdjacentElement('afterend',layers):waveformCard.prepend(layers)}
  if(!document.getElementById('waveLookBlock')){
    const lookLabel=[...waveformCard.querySelectorAll('.section-label')].find(x=>x.textContent.trim().toUpperCase()==='LOOK');if(!lookLabel)return false;
    const block=document.createElement('div');block.id='waveLookBlock';block.className='wave-look-block';block.innerHTML=`<div class="section-label">GLOBAL WAVE LOOK</div><div class="wave-look-grid"><label>Contrast<select id="waveContrastMode"><option value="none">None</option><option value="soft">Soft</option><option value="strong">Strong</option><option value="auto">Auto</option></select></label><label>Backdrop<select id="waveBackdrop"><option value="off">Off</option><option value="local-soft">Local Soft</option><option value="local-blur">Local Blur</option></select></label><label class="wave-look-outline">Outline <span id="waveOutlineValue">3px</span><input id="waveOutline" class="range" type="range" min="0" max="10" step="1" value="3" /></label></div><p class="hint wave-look-note">Global separation for every waveform. Auto + Local Soft is the recommended default.</p>`;
    lookLabel.insertAdjacentElement('afterend',block);
    document.getElementById('waveContrastMode').addEventListener('change',e=>{look.contrast=e.target.value;save();syncUI()});document.getElementById('waveBackdrop').addEventListener('change',e=>{look.backdrop=e.target.value;save()});document.getElementById('waveOutline').addEventListener('input',e=>{look.outline=+e.target.value;save();syncUI()});
  }
  const oldAuto=document.getElementById('autoColor');if(oldAuto){const auto=oldAuto.cloneNode(true);auto.id='autoContrastColor';auto.textContent='Auto Contrast';oldAuto.replaceWith(auto);auto.addEventListener('click',()=>{look.contrast='auto';save();syncUI();toast('Auto Contrast enabled')})}
  syncUI();return true;
}

load();mount();
document.querySelector('.tool[data-tool="waveform"]')?.addEventListener('click',()=>requestAnimationFrame(()=>document.querySelector('.multi-wave-card')?.scrollIntoView({block:'nearest'})));
document.addEventListener('fw:project-reset',()=>{look={...LOOK_DEFAULTS};save();syncUI()});
window.__FW_WAVE_LOOK={defaults:{...LOOK_DEFAULTS},getConfig:()=>({...look}),setConfig:(value={})=>{look=normalize({...look,...value});save();syncUI();return true},reset:()=>{look={...LOOK_DEFAULTS};save();syncUI()}};
})();
