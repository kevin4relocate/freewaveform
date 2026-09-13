(()=>{
'use strict';

const color=document.getElementById('waveColor');
if(!color||document.getElementById('waveColorHex'))return;

const toast=text=>{
  const el=document.getElementById('toast');
  if(!el)return;
  el.textContent=text;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t=setTimeout(()=>el.classList.remove('show'),1800);
};
const normalize=value=>String(value||'').replace(/^#/,'').toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,6);
const currentHex=()=>normalize(color.value)||'E5D3A6';

const wrap=document.createElement('div');
wrap.className='wave-hex-wrap';
wrap.innerHTML=`
  <input id="waveColorHex" class="wave-hex-input" type="text" inputmode="text" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Waveform color hex code" value="${currentHex()}" />
  <button id="copyWaveColor" class="wave-hex-copy" type="button" title="Copy 6-character color code" aria-label="Copy color code">⧉</button>`;
color.insertAdjacentElement('afterend',wrap);
color.closest('.color-row')?.classList.add('has-hex-code');

const hex=document.getElementById('waveColorHex');
const copy=document.getElementById('copyWaveColor');
const auto=document.getElementById('autoColor');
const pick=document.getElementById('pickColor');
if(auto)auto.title='Auto match background';

const style=document.createElement('style');
style.textContent=`
.color-row.has-hex-code{grid-template-columns:46px minmax(88px,1fr) 96px 58px;align-items:center;gap:6px}
.wave-hex-wrap{height:36px;display:grid;grid-template-columns:minmax(0,1fr) 32px;border:1px solid #30363a;border-radius:8px;background:#0b0f11;overflow:hidden}
.wave-hex-input{min-width:0;width:100%;height:34px!important;margin:0!important;padding:0 8px!important;border:0!important;border-radius:0!important;background:transparent!important;color:#eee6da!important;font:600 10px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;letter-spacing:.06em;text-transform:uppercase;outline:none!important;box-shadow:none!important}
.wave-hex-input:focus{background:#101619!important}
.wave-hex-copy{width:32px;height:34px;border:0;border-left:1px solid #2b3135;background:#11171a;color:#bdb5aa;cursor:pointer;font-size:13px;padding:0}
.wave-hex-copy:hover{background:#1b1711;color:#e4b66d}
.color-row.has-hex-code:focus-within .wave-hex-wrap{border-color:#9c7444;box-shadow:0 0 0 2px rgba(210,161,91,.10)}
.color-row.has-hex-code #autoColor,.color-row.has-hex-code #pickColor{height:36px!important;min-height:36px!important;padding:0 8px!important;font-size:9px!important;line-height:1!important;white-space:nowrap!important;display:flex!important;align-items:center!important;justify-content:center!important}
@media(max-width:1100px){.color-row.has-hex-code{grid-template-columns:46px minmax(82px,1fr) 92px 54px;gap:5px}.color-row.has-hex-code #autoColor,.color-row.has-hex-code #pickColor{padding-left:6px!important;padding-right:6px!important;font-size:8.5px!important}}
@media(max-width:420px){.color-row.has-hex-code{grid-template-columns:46px 1fr 1fr}.color-row.has-hex-code #pickColor{grid-column:3}.color-row.has-hex-code #autoColor{grid-column:2/-1}}
`;
document.head.appendChild(style);

let last=currentHex();
function syncFromPicker(){
  const next=currentHex();
  if(next!==last||hex.value.length!==6){last=next;hex.value=next;}
}
function applyHex(){
  const clean=normalize(hex.value);
  hex.value=clean;
  if(clean.length!==6)return false;
  last=clean;
  const value='#'+clean;
  if(color.value.toUpperCase()!==value){
    color.value=value;
    color.dispatchEvent(new Event('input',{bubbles:true}));
  }
  return true;
}

hex.addEventListener('input',()=>{
  const pos=hex.selectionStart;
  const clean=normalize(hex.value);
  if(hex.value!==clean)hex.value=clean;
  try{hex.setSelectionRange(Math.min(pos,clean.length),Math.min(pos,clean.length))}catch{}
  if(clean.length===6)applyHex();
});
hex.addEventListener('change',()=>{if(!applyHex())syncFromPicker()});
hex.addEventListener('blur',()=>{if(hex.value.length!==6)syncFromPicker()});
hex.addEventListener('focus',()=>setTimeout(()=>hex.select(),0));
color.addEventListener('input',syncFromPicker);
color.addEventListener('change',syncFromPicker);

copy.addEventListener('click',async()=>{
  syncFromPicker();
  const value=hex.value;
  try{
    if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(value);
    else{
      hex.focus();hex.select();
      document.execCommand('copy');
    }
    toast('Copied color: '+value);
  }catch{
    hex.focus();hex.select();
    toast('Color selected — press Ctrl/Cmd+C');
  }
});

// Other editor features (auto color, eyedropper, layer switching, presets)
// can update the native color picker programmatically, so keep the code field in sync.
setInterval(syncFromPicker,180);
})();
