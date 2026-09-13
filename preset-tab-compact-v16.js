(()=>{
'use strict';

const presetsPanel=document.querySelector('[data-panel="presets"]');
const presetsHost=document.getElementById('presetsHost');
const grid=document.getElementById('templateGrid');
if(!presetsPanel||!presetsHost||!grid)return;

const style=document.createElement('style');
style.textContent=`
/* V16: keep user presets out of Waveform and make template browsing denser. */
.compact-templates-card{padding:10px!important}
.compact-templates-card .card-title{margin-bottom:7px!important}
.compact-templates-card .card-title strong{font-size:12px!important}
.compact-templates-card .card-title small{font-size:8px!important}
.compact-templates-card .template-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important}
.compact-templates-card .template-card{min-height:48px!important;height:auto!important;flex-direction:row!important;align-items:center!important;justify-content:flex-start!important;gap:6px!important;padding:6px 7px!important;border-radius:8px!important;text-align:left!important}
.compact-templates-card .template-card b{width:20px!important;min-width:20px!important;font-size:17px!important;line-height:1!important;text-align:center!important}
.compact-templates-card .template-card span{font-size:8px!important;line-height:1.15!important;text-align:left!important;overflow-wrap:anywhere}
.compact-templates-card .template-section-divider{margin:5px 1px 0!important;padding-top:6px!important;font-size:8px!important;line-height:1!important}
.compact-templates-card .template-section-divider small{font-size:7px!important}
[data-panel="presets"] .user-presets-card{margin-top:0!important}
[data-panel="presets"] .user-preset-list{max-height:none}
@media(max-width:1100px){.compact-templates-card .template-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
@media(max-width:820px){
  .tool-rail{grid-template-columns:repeat(5,1fr)!important}
  .compact-templates-card .template-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .compact-templates-card .template-card{min-height:44px!important}
}
@media(max-width:520px){
  .tool-rail{grid-template-columns:repeat(5,1fr)!important}
  .tool{gap:3px!important;padding:4px 2px!important}
  .tool b{font-size:8px!important}
}
`;
document.head.appendChild(style);

const templateCard=grid.closest('.card');
if(templateCard)templateCard.classList.add('compact-templates-card');

function markCreativeDivider(){
  for(const child of grid.children){
    if(child.tagName==='DIV'&&/Creative\s*\/\s*New/i.test(child.textContent||'')){
      child.classList.add('template-section-divider');
      return true;
    }
  }
  return false;
}
markCreativeDivider();

function movePresets(){
  const card=document.querySelector('.user-presets-card');
  if(!card)return false;
  if(card.parentElement!==presetsHost)presetsHost.appendChild(card);
  return true;
}

if(!movePresets()){
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    markCreativeDivider();
    if(movePresets()||tries>40)clearInterval(timer);
  },100);
}

// Creative presets mount after the core template grid, so tag the divider if it appears later.
const observer=new MutationObserver(()=>markCreativeDivider());
observer.observe(grid,{childList:true});
setTimeout(()=>observer.disconnect(),5000);
})();
