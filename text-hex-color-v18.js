(()=>{
'use strict';

const list=document.getElementById('textList');
if(!list)return;

const normalize=value=>String(value||'').replace(/^#/,'').toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,6);
const toast=text=>{
  const el=document.getElementById('toast');
  if(!el)return;
  el.textContent=text;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t=setTimeout(()=>el.classList.remove('show'),1800);
};

const style=document.createElement('style');
style.id='text-hex-color-v18-style';
style.textContent=`
.text-card label.text-color-label{min-width:0}
.text-color-control{display:grid;grid-template-columns:42px minmax(0,1fr) 34px;height:35px;margin-top:5px;border:1px solid #2a3034;border-radius:8px;background:#0a0f11;overflow:hidden}
.text-color-control:focus-within{border-color:#9c7444;box-shadow:0 0 0 2px rgba(210,161,91,.10)}
.text-color-control>input[type=color]{width:42px!important;height:33px!important;margin:0!important;padding:3px!important;border:0!important;border-right:1px solid #2a3034!important;border-radius:0!important;background:#0a0f11!important}
.text-color-hex{min-width:0;width:100%;height:33px!important;margin:0!important;padding:0 8px!important;border:0!important;border-radius:0!important;background:transparent!important;color:#eee6da!important;outline:none!important;box-shadow:none!important;font:600 10px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;letter-spacing:.06em;text-transform:uppercase}
.text-color-copy{width:34px;height:33px;border:0;border-left:1px solid #2a3034;background:#11171a;color:#bdb5aa;cursor:pointer;font-size:13px;padding:0}
.text-color-copy:hover{background:#1b1711;color:#e4b66d}
`;
document.head.appendChild(style);

function enhanceCard(card){
  const picker=card.querySelector('input[data-k="color"][type="color"]');
  if(!picker||picker.dataset.hexEnhanced)return;
  picker.dataset.hexEnhanced='1';
  const label=picker.closest('label');
  if(label)label.classList.add('text-color-label');

  const control=document.createElement('div');
  control.className='text-color-control';
  picker.parentNode.insertBefore(control,picker);
  control.appendChild(picker);

  const hex=document.createElement('input');
  hex.className='text-color-hex';
  hex.type='text';
  hex.maxLength=6;
  hex.autocomplete='off';
  hex.spellcheck=false;
  hex.setAttribute('autocapitalize','characters');
  hex.setAttribute('aria-label','Text color HEX code');
  hex.value=normalize(picker.value)||'FFFFFF';
  control.appendChild(hex);

  const copy=document.createElement('button');
  copy.className='text-color-copy';
  copy.type='button';
  copy.title='Copy 6-character color code';
  copy.setAttribute('aria-label','Copy text color code');
  copy.textContent='⧉';
  control.appendChild(copy);

  let last=hex.value;
  const syncFromPicker=()=>{
    const next=normalize(picker.value)||last||'FFFFFF';
    last=next;
    if(document.activeElement!==hex||hex.value.length===6)hex.value=next;
  };
  const applyHex=()=>{
    const clean=normalize(hex.value);
    hex.value=clean;
    if(clean.length!==6)return false;
    last=clean;
    const value='#'+clean;
    if(picker.value.toUpperCase()!==value){
      picker.value=value;
      picker.dispatchEvent(new Event('input',{bubbles:true}));
    }
    return true;
  };

  hex.addEventListener('input',()=>{
    const pos=hex.selectionStart??hex.value.length;
    const clean=normalize(hex.value);
    if(hex.value!==clean)hex.value=clean;
    try{hex.setSelectionRange(Math.min(pos,clean.length),Math.min(pos,clean.length))}catch{}
    if(clean.length===6)applyHex();
  });
  hex.addEventListener('change',()=>{if(!applyHex())syncFromPicker()});
  hex.addEventListener('blur',()=>{if(hex.value.length!==6)syncFromPicker()});
  hex.addEventListener('focus',()=>setTimeout(()=>hex.select(),0));
  picker.addEventListener('input',syncFromPicker);
  picker.addEventListener('change',syncFromPicker);

  copy.addEventListener('click',async()=>{
    syncFromPicker();
    const value=hex.value;
    try{
      if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(value);
      else{hex.focus();hex.select();document.execCommand('copy')}
      toast('Copied text color: '+value);
    }catch{
      hex.focus();hex.select();toast('Color selected — press Ctrl/Cmd+C');
    }
  });
}

function enhanceAll(){list.querySelectorAll('.text-card').forEach(enhanceCard)}
enhanceAll();
new MutationObserver(enhanceAll).observe(list,{childList:true,subtree:true});
})();
