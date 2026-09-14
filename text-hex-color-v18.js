(()=>{
'use strict';
const list=document.getElementById('textList');if(!list)return;
const normalize=value=>String(value||'').replace(/^#/,'').toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,6);
const toast=text=>{if(window.__FW_TOAST)return window.__FW_TOAST(text);const el=document.getElementById('toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2000)};
function enhanceCard(card){
  const picker=card.querySelector('input[data-k="color"][type="color"]');if(!picker||picker.dataset.hexEnhanced)return;picker.dataset.hexEnhanced='1';picker.closest('label')?.classList.add('text-color-label');
  const control=document.createElement('div');control.className='text-color-control';picker.parentNode.insertBefore(control,picker);control.appendChild(picker);
  const hex=document.createElement('input');hex.className='text-color-hex';hex.type='text';hex.maxLength=6;hex.autocomplete='off';hex.spellcheck=false;hex.setAttribute('autocapitalize','characters');hex.setAttribute('aria-label','Text color HEX code');hex.value=normalize(picker.value)||'FFFFFF';control.appendChild(hex);
  const copy=document.createElement('button');copy.className='text-color-copy';copy.type='button';copy.title='Copy 6-character color code';copy.setAttribute('aria-label','Copy text color code');copy.textContent='⧉';control.appendChild(copy);
  let last=hex.value;const sync=()=>{const next=normalize(picker.value)||last||'FFFFFF';last=next;if(document.activeElement!==hex||hex.value.length===6)hex.value=next};
  const apply=()=>{const clean=normalize(hex.value);hex.value=clean;if(clean.length!==6)return false;last=clean;const value='#'+clean;if(picker.value.toUpperCase()!==value){picker.value=value;picker.dispatchEvent(new Event('input',{bubbles:true}))}return true};
  hex.addEventListener('input',()=>{const pos=hex.selectionStart??hex.value.length,clean=normalize(hex.value);if(hex.value!==clean)hex.value=clean;try{hex.setSelectionRange(Math.min(pos,clean.length),Math.min(pos,clean.length))}catch{}if(clean.length===6)apply()});hex.addEventListener('change',()=>{if(!apply())sync()});hex.addEventListener('blur',()=>{if(hex.value.length!==6)sync()});hex.addEventListener('focus',()=>setTimeout(()=>hex.select(),0));picker.addEventListener('input',sync);picker.addEventListener('change',sync);
  copy.addEventListener('click',async()=>{sync();const value=hex.value;try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(value);else{hex.focus();hex.select();document.execCommand('copy')}toast('Copied text color: '+value)}catch{hex.focus();hex.select();toast('Color selected — press Ctrl/Cmd+C')}});
}
function enhanceAll(){list.querySelectorAll('.text-card').forEach(enhanceCard)}enhanceAll();new MutationObserver(enhanceAll).observe(list,{childList:true,subtree:true});
})();
