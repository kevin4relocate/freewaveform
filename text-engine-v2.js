(()=>{
'use strict';

const list=document.getElementById('textList');
if(!list)return;
const clamp=window.__FW_UTILS?.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const FONT_DEFS={
  fwZcoolXiaoWei:{label:'ZCOOL XiaoWei 小薇体',family:'ZCOOL XiaoWei',fallback:'Noto Serif SC,serif'},
  fwZcoolQingKe:{label:'ZCOOL QingKe 黄油体',family:'ZCOOL QingKe HuangYou',fallback:'Noto Sans SC,sans-serif'},
  fwLiuJianMaoCao:{label:'Liu Jian Mao Cao 刘建毛草',family:'Liu Jian Mao Cao',fallback:'Ma Shan Zheng,cursive'},
  fwLongCang:{label:'Long Cang 龙藏',family:'Long Cang',fallback:'Ma Shan Zheng,cursive'}
};
if(!document.getElementById('fw-cn-font-link')){const link=document.createElement('link');link.id='fw-cn-font-link';link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family=Liu+Jian+Mao+Cao&family=Long+Cang&family=ZCOOL+QingKe+HuangYou&family=ZCOOL+XiaoWei&display=swap';document.head.appendChild(link)}
if(!document.getElementById('fw-multiline-text-style')){const style=document.createElement('style');style.id='fw-multiline-text-style';style.textContent='.text-card textarea[data-k="text"]{display:block;width:100%;min-height:58px;margin-top:5px;padding:9px 10px;resize:vertical;border:1px solid #2a3034;border-radius:8px;background:#0a0f11;color:#eee6da;font:500 11px/1.35 Inter,system-ui,sans-serif;outline:none;box-sizing:border-box}.text-card textarea[data-k="text"]:focus{border-color:#9c7444;box-shadow:0 0 0 2px rgba(210,161,91,.10)}.fw-text-line-hint{display:block;margin-top:4px;color:#6f746f;font-size:8px;line-height:1.2}';document.head.appendChild(style)}

const positions=[],overrides=[],bounds=[];
function cards(){return[...list.querySelectorAll('.text-card')]}
function cardIndex(card){const n=Number(card?.dataset?.index);return Number.isFinite(n)?n:cards().indexOf(card)}
function textControl(card){return card?.querySelector('[data-k="text"]')||null}
function normalizeTwoLines(value){const lines=String(value??'').replace(/\r/g,'').split('\n');return lines.length<=2?lines.join('\n'):[lines[0],lines.slice(1).join(' ')].join('\n')}
function enhanceTextControl(control){
  if(!control||control.tagName==='TEXTAREA'||control.dataset.multilineEnhanced)return;
  const area=document.createElement('textarea');
  [...control.attributes].forEach(attr=>area.setAttribute(attr.name,attr.value));
  area.removeAttribute('type');area.removeAttribute('value');area.dataset.multilineEnhanced='1';area.rows=2;area.maxLength=500;area.value=normalizeTwoLines(control.value);
  area.addEventListener('keydown',e=>{if(e.key==='Enter'&&area.value.includes('\n'))e.preventDefault()});
  area.addEventListener('input',()=>{const next=normalizeTwoLines(area.value);if(next!==area.value){area.value=next;area.selectionStart=area.selectionEnd=area.value.length}});
  control.replaceWith(area);
  const label=area.closest('label');if(label&&!label.querySelector('.fw-text-line-hint')){const hint=document.createElement('small');hint.className='fw-text-line-hint';hint.textContent='Press Enter for a second line';label.appendChild(hint)}
}
function enhanceSelect(select){if(!select||select.dataset.cnFontsEnhanced)return;select.dataset.cnFontsEnhanced='1';Object.entries(FONT_DEFS).forEach(([value,def])=>{if(select.querySelector(`option[value="${value}"]`))return;const opt=document.createElement('option');opt.value=value;opt.textContent=def.label;select.appendChild(opt)});const idx=cardIndex(select.closest('.text-card')),saved=window.__FW_APP?.getState?.()?.texts?.[idx]?.font;if(saved&&select.querySelector(`option[value="${saved}"]`))select.value=saved}
function enhanceAll(){list.querySelectorAll('select[data-k="font"]').forEach(enhanceSelect);list.querySelectorAll('[data-k="text"]').forEach(enhanceTextControl)}
enhanceAll();

function beginFrame(){bounds.length=0}
function resolvePosition(index,x,y){const p=overrides[index]||{x:+x||50,y:+y||50};positions[index]={x:p.x,y:p.y};return{x:p.x,y:p.y}}
function recordRendered(index,data={}){if(data.visible===false)return;if(data.bounds)bounds[index]={...data.bounds};if(Number.isFinite(+data.x)&&Number.isFinite(+data.y))positions[index]={x:+data.x,y:+data.y}}
function getPositions(){return cards().map((_,i)=>positions[i]?{...positions[i]}:overrides[i]?{...overrides[i]}:null)}
function getBounds(){return bounds.map(b=>b?{...b}:null)}
function getItems(){return cards().map((card,index)=>{const p=positions[index]||overrides[index],b=bounds[index],show=card.querySelector('input[data-k="show"]'),input=textControl(card),visible=(!show||show.checked)&&String(input?.value||'').length>0;if(!p||!b||!visible)return null;return{id:`text:${index}`,type:'text',index,label:card.querySelector('header strong')?.textContent||`Free Text ${index+1}`,x:p.x,y:p.y,bounds:{...b},movable:true}}).filter(Boolean)}
function setPosition(index,x,y){index=Number(index);if(!Number.isInteger(index)||index<0||index>=cards().length||!Number.isFinite(+x)||!Number.isFinite(+y))return false;const p={x:clamp(+x,2,98),y:clamp(+y,2,98)};overrides[index]=p;positions[index]={...p};return true}
function setPositions(items){if(!Array.isArray(items))return false;items.forEach(item=>setPosition(item.index,item.x,item.y));return true}
function moveTextTo(index,x,y){return setPosition(index,x,y)}
function clearOverrides(){overrides.length=0}
function removeIndex(index){index=+index;if(index<0)return;positions.splice(index,1);overrides.splice(index,1);bounds.splice(index,1)}
function reset(){positions.length=0;overrides.length=0;bounds.length=0}
function getFontFamily(value){const def=FONT_DEFS[value];return def?`"${def.family}",${def.fallback}`:null}

window.__FW_TEXT_BRIDGE={enhanceAll,beginFrame,resolvePosition,recordRendered,getPositions,getBounds,getItems,setPosition,setPositions,moveTextTo,clearOverrides,removeIndex,reset,getFontFamily,fontValues:Object.keys(FONT_DEFS)};
})();
