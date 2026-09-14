(()=>{
'use strict';

const wrap=document.getElementById('stageWrap');
if(!wrap)return;
let box=null;

function syncOffset(){
  if(!box||!box.isConnected)return;
  const r=wrap.getBoundingClientRect();
  box.style.setProperty('--fw-stage-left',r.left+'px');
  box.style.setProperty('--fw-stage-top',r.top+'px');
}
function portalEditor(){
  const next=document.getElementById('waveCenterTextEditor');
  if(!next)return false;
  box=next;
  if(box.parentElement!==document.body){
    syncOffset();
    document.body.appendChild(box);
    box.classList.add('wave-center-editor-portal');
    syncOffset();
  }
  return true;
}

const observer=new MutationObserver(()=>portalEditor());
observer.observe(wrap,{childList:true,subtree:true});
portalEditor();
window.addEventListener('resize',syncOffset);
window.addEventListener('scroll',syncOffset,true);
document.addEventListener('fw:ratio-change',()=>requestAnimationFrame(syncOffset));
})();
