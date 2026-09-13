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

if(!document.getElementById('fw-cn-font-link')){
  const link=document.createElement('link');
  link.id='fw-cn-font-link';
  link.rel='stylesheet';
  link.href='https://fonts.googleapis.com/css2?family=Liu+Jian+Mao+Cao&family=Long+Cang&family=ZCOOL+QingKe+HuangYou&family=ZCOOL+XiaoWei&display=swap';
  document.head.appendChild(link);
}

const customByIndex=new Map();
const positions=[];

function cardIndex(card){
  const n=Number(card?.dataset?.index);
  return Number.isFinite(n)?n:[...list.querySelectorAll('.text-card')].indexOf(card);
}

function enhanceSelect(select){
  if(!select||select.dataset.cnFontsEnhanced)return;
  select.dataset.cnFontsEnhanced='1';
  Object.entries(FONT_DEFS).forEach(([value,def])=>{
    if(select.querySelector(`option[value="${value}"]`))return;
    const opt=document.createElement('option');
    opt.value=value;opt.textContent=def.label;select.appendChild(opt);
  });
  const idx=cardIndex(select.closest('.text-card'));
  const saved=customByIndex.get(idx);
  if(saved&&FONT_DEFS[saved])select.value=saved;
}

function enhanceAll(){
  list.querySelectorAll('select[data-k="font"]').forEach(enhanceSelect);
}
enhanceAll();
new MutationObserver(enhanceAll).observe(list,{childList:true,subtree:true});

function rememberFont(e){
  const select=e.target?.matches?.('select[data-k="font"]')?e.target:null;
  if(!select)return;
  const idx=cardIndex(select.closest('.text-card'));
  if(FONT_DEFS[select.value])customByIndex.set(idx,select.value);else customByIndex.delete(idx);
}
list.addEventListener('input',rememberFont,true);
list.addEventListener('change',rememberFont,true);

const ctx=canvas.getContext('2d');
let drawIndex=0;
const prevClear=ctx.clearRect.bind(ctx);
ctx.clearRect=function(...args){drawIndex=0;return prevClear(...args)};
const prevFill=ctx.fillText.bind(ctx);
ctx.fillText=function(text,x,y,...rest){
  const visible=[...list.querySelectorAll('.text-card')].map((card,index)=>({card,index})).filter(({card})=>{
    const show=card.querySelector('input[data-k="show"]');
    const input=card.querySelector('input[data-k="text"]');
    return (!show||show.checked)&&String(input?.value||'').length>0;
  });
  const item=visible[drawIndex++];
  if(item){
    positions[item.index]={x:x/canvas.width*100,y:y/canvas.height*100};
    const select=item.card.querySelector('select[data-k="font"]');
    const def=FONT_DEFS[select?.value];
    if(def){
      const prefix=String(ctx.font||'').match(/^(.*?\d+(?:\.\d+)?px)\s+/)?.[1];
      if(prefix)ctx.font=`${prefix} "${def.family}",${def.fallback}`;
    }
  }
  return prevFill(text,x,y,...rest);
};

function getPositions(){return positions.map(p=>p?{...p}:null)}
function moveTextTo(index,x,y){
  const p=positions[index];
  if(!p||!Number.isFinite(x)||!Number.isFinite(y))return false;
  const prev=document.querySelector('.tool.active')?.dataset.tool||'';
  document.querySelector('.tool[data-tool="text"]')?.click();
  const r=canvas.getBoundingClientRect();
  const point=(q)=>({clientX:r.left+r.width*q.x/100,clientY:r.top+r.height*q.y/100});
  const from=point(p),to=point({x,y});
  const E=window.PointerEvent||window.MouseEvent;
  const common={bubbles:true,cancelable:true,button:0,pointerId:77,isPrimary:true,pointerType:'mouse'};
  canvas.dispatchEvent(new E('pointerdown',{...common,...from,buttons:1}));
  canvas.dispatchEvent(new E('pointermove',{...common,...to,buttons:1}));
  canvas.dispatchEvent(new E('pointerup',{...common,...to,buttons:0}));
  if(prev&&prev!=='text')document.querySelector(`.tool[data-tool="${prev}"]`)?.click();
  positions[index]={x,y};
  return true;
}

window.__FW_TEXT_BRIDGE={
  enhanceAll,
  getPositions,
  moveTextTo,
  fontValues:Object.keys(FONT_DEFS)
};
})();
