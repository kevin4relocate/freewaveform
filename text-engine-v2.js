(()=>{
'use strict';

const list=document.getElementById('textList');
const canvas=document.getElementById('canvas');
if(!list||!canvas)return;

const FONT_DEFS={
  fwZcoolXiaoWei:{label:'ZCOOL XiaoWei 小薇体',family:'ZCOOL XiaoWei',fallback:'Noto Serif SC,serif'},
  fwZcoolQingKe:{label:'ZCOOL QingKe 黄油体',family:'ZCOOL QingKe HuangYou',fallback:'Noto Sans SC,sans-serif'},
  fwLiuJianMaoCao:{label:'Liu Jian Mao Cao 刘建毛草',family:'Liu Jian Mao Cao',fallback:'Ma Shan Zheng,cursive'},
  fwLongCang:{label:'Long Cang 龙藏',family:'Long Cang',fallback:'Ma Shan Zheng,cursive'}
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

if(!document.getElementById('fw-cn-font-link')){
  const link=document.createElement('link');
  link.id='fw-cn-font-link';
  link.rel='stylesheet';
  link.href='https://fonts.googleapis.com/css2?family=Liu+Jian+Mao+Cao&family=Long+Cang&family=ZCOOL+QingKe+HuangYou&family=ZCOOL+XiaoWei&display=swap';
  document.head.appendChild(link);
}

const customByIndex=new Map();
const positions=[];
const overrides=[];
const bounds=[];
let visible=[];
let drawIndex=0;

function cards(){return[...list.querySelectorAll('.text-card')]}
function cardIndex(card){
  const n=Number(card?.dataset?.index);
  return Number.isFinite(n)?n:cards().indexOf(card);
}
function visibleCards(){
  return cards().map((card,index)=>({card,index})).filter(({card})=>{
    const show=card.querySelector('input[data-k="show"]');
    const input=card.querySelector('input[data-k="text"]');
    return(!show||show.checked)&&String(input?.value||'').length>0;
  });
}
function enhanceSelect(select){
  if(!select||select.dataset.cnFontsEnhanced)return;
  select.dataset.cnFontsEnhanced='1';
  Object.entries(FONT_DEFS).forEach(([value,def])=>{
    if(select.querySelector(`option[value="${value}"]`))return;
    const opt=document.createElement('option');opt.value=value;opt.textContent=def.label;select.appendChild(opt);
  });
  const idx=cardIndex(select.closest('.text-card'));
  const saved=customByIndex.get(idx);
  if(saved&&FONT_DEFS[saved])select.value=saved;
}
function enhanceAll(){list.querySelectorAll('select[data-k="font"]').forEach(enhanceSelect)}
enhanceAll();
new MutationObserver(enhanceAll).observe(list,{childList:true,subtree:true});

function rememberFont(e){
  const select=e.target?.matches?.('select[data-k="font"]')?e.target:null;if(!select)return;
  const idx=cardIndex(select.closest('.text-card'));
  if(FONT_DEFS[select.value])customByIndex.set(idx,select.value);else customByIndex.delete(idx);
}
list.addEventListener('input',rememberFont,true);
list.addEventListener('change',rememberFont,true);

// Keep index-based position state stable when a text card is removed.
list.addEventListener('click',e=>{
  const del=e.target.closest?.('.delete-text');if(!del)return;
  const idx=cardIndex(del.closest('.text-card'));if(idx<0)return;
  setTimeout(()=>{positions.splice(idx,1);overrides.splice(idx,1);bounds.splice(idx,1);},0);
},true);

document.getElementById('resetProject')?.addEventListener('click',()=>setTimeout(()=>{
  positions.length=0;overrides.length=0;bounds.length=0;
},0));

const ctx=canvas.getContext('2d');
const prevClear=ctx.clearRect.bind(ctx);
ctx.clearRect=function(...args){
  drawIndex=0;visible=visibleCards();bounds.length=0;
  return prevClear(...args);
};
const prevFill=ctx.fillText.bind(ctx);
ctx.fillText=function(text,x,y,...rest){
  const item=visible[drawIndex++];
  if(!item)return prevFill(text,x,y,...rest);

  const index=item.index,card=item.card,override=overrides[index];
  const px=override?.x??(x/canvas.width*100),py=override?.y??(y/canvas.height*100);
  const dx=canvas.width*px/100,dy=canvas.height*py/100;
  positions[index]={x:px,y:py};

  const select=card.querySelector('select[data-k="font"]');
  const def=FONT_DEFS[select?.value];
  if(def){
    const prefix=String(ctx.font||'').match(/^(.*?\d+(?:\.\d+)?px)\s+/)?.[1];
    if(prefix)ctx.font=`${prefix} "${def.family}",${def.fallback}`;
  }

  const m=ctx.measureText(String(text));
  const size=Number(String(ctx.font||'').match(/([0-9.]+)px/)?.[1])||32;
  bounds[index]={x:dx-m.width/2,y:dy-size*.64,w:Math.max(1,m.width),h:size*1.28,cx:dx,cy:dy};
  return prevFill(text,dx,dy,...rest);
};

function getPositions(){
  const c=cards();
  return c.map((_,i)=>positions[i]?{...positions[i]}:overrides[i]?{...overrides[i]}:null);
}
function getBounds(){return bounds.map(b=>b?{...b}:null)}
function getItems(){
  return cards().map((card,index)=>{
    const p=positions[index]||overrides[index],b=bounds[index];
    const show=card.querySelector('input[data-k="show"]');
    const input=card.querySelector('input[data-k="text"]');
    const visible=(!show||show.checked)&&String(input?.value||'').length>0;
    if(!p||!b||!visible)return null;
    return{id:`text:${index}`,type:'text',index,label:card.querySelector('header strong')?.textContent||`Text ${index+1}`,x:p.x,y:p.y,bounds:{...b},movable:true};
  }).filter(Boolean);
}
function setPosition(index,x,y){
  index=Number(index);if(!Number.isInteger(index)||index<0||index>=cards().length)return false;
  if(!Number.isFinite(+x)||!Number.isFinite(+y))return false;
  const p={x:clamp(+x,2,98),y:clamp(+y,2,98)};
  overrides[index]=p;positions[index]={...p};
  return true;
}
function setPositions(items){
  if(!Array.isArray(items))return false;
  items.forEach(item=>setPosition(item.index,item.x,item.y));
  return true;
}
function moveTextTo(index,x,y){return setPosition(index,x,y)}
function clearOverrides(){overrides.length=0}

window.__FW_TEXT_BRIDGE={
  enhanceAll,getPositions,getBounds,getItems,setPosition,setPositions,moveTextTo,clearOverrides,
  fontValues:Object.keys(FONT_DEFS)
};
})();