(()=>{
'use strict';

const presetsHost=document.getElementById('presetsHost');
const grid=document.getElementById('templateGrid');
if(!presetsHost||!grid)return;

const templateCard=grid.closest('.card');
if(templateCard)templateCard.classList.add('compact-templates-card');

function markCreativeDivider(){
  for(const child of grid.children){
    if(child.tagName==='DIV'&&/Creative\s*\/\s*New/i.test(child.textContent||'')){child.classList.add('template-section-divider');return true}
  }
  return false;
}
function movePresets(){
  const card=document.querySelector('.user-presets-card');if(!card)return false;
  if(card.parentElement!==presetsHost)presetsHost.appendChild(card);return true;
}
markCreativeDivider();
if(!movePresets()){
  let tries=0;const timer=setInterval(()=>{tries++;markCreativeDivider();if(movePresets()||tries>40)clearInterval(timer)},100);
}
const observer=new MutationObserver(()=>markCreativeDivider());observer.observe(grid,{childList:true});setTimeout(()=>observer.disconnect(),5000);
})();
