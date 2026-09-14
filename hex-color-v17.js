(()=>{
'use strict';
const color=document.getElementById('waveColor');if(!color||document.getElementById('waveColorHex'))return;
const normalize=value=>window.__FW_UTILS?.normalizeHex?.(value)||String(value||'').replace(/^#/,'').toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,6);
const toast=window.__FW_TOAST||(()=>{}),currentHex=()=>normalize(color.value)||'E5D3A6';
const wrap=document.createElement('div');wrap.className='wave-hex-wrap';wrap.innerHTML=`<input id="waveColorHex" class="wave-hex-input" type="text" inputmode="text" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Waveform color hex code" value="${currentHex()}" /><button id="copyWaveColor" class="wave-hex-copy" type="button" title="Copy 6-character color code" aria-label="Copy color code">⧉</button>`;color.insertAdjacentElement('afterend',wrap);color.closest('.color-row')?.classList.add('has-hex-code');
const hex=document.getElementById('waveColorHex'),copy=document.getElementById('copyWaveColor');let last=currentHex();
function sync(){const next=currentHex();if(next!==last||hex.value.length!==6){last=next;hex.value=next}}
function apply(){const clean=normalize(hex.value);hex.value=clean;if(clean.length!==6)return false;last=clean;const value='#'+clean;if(color.value.toUpperCase()!==value){color.value=value;color.dispatchEvent(new Event('input',{bubbles:true}))}return true}
hex.addEventListener('input',()=>{const pos=hex.selectionStart??hex.value.length,clean=normalize(hex.value);if(hex.value!==clean)hex.value=clean;try{hex.setSelectionRange(Math.min(pos,clean.length),Math.min(pos,clean.length))}catch{}if(clean.length===6)apply()});hex.addEventListener('change',()=>{if(!apply())sync()});hex.addEventListener('blur',()=>{if(hex.value.length!==6)sync()});hex.addEventListener('focus',()=>setTimeout(()=>hex.select(),0));color.addEventListener('input',sync);color.addEventListener('change',sync);
copy.addEventListener('click',async()=>{sync();const value=hex.value;try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(value);else{hex.focus();hex.select();document.execCommand('copy')}toast('Copied color: '+value)}catch{hex.focus();hex.select();toast('Color selected — press Ctrl/Cmd+C')}});
['fw:wave-selection-change','fw:wave-setting-change','fw:project-reset'].forEach(name=>document.addEventListener(name,()=>requestAnimationFrame(sync)));
})();
