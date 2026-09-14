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

if(!document.getElementById('fw-song-title-multiline-style')){
  const style=document.createElement('style');
  style.id='fw-song-title-multiline-style';
  style.textContent=`
    #textList .text-card:first-child textarea[data-k="text"]{
      width:100%;min-height:62px;margin-top:5px;padding:9px 10px;
      border:1px solid #2a3034;border-radius:8px;background:#0a0f11;
      color:#eee6da;font:inherit;line-height:1.35;resize:vertical;outline:none;
      box-sizing:border-box;
    }
    #textList .text-card:first-child textarea[data-k="text"]:focus{
      border-color:#9c7444;box-shadow:0 0 0 2px rgba(210,161,91,.10);
    }
    .fw-song-title-hint{display:block;margin-top:5px;color:#777;font-size:9px;line-height:1.35}
  `;
  document.head.appendChild(style);
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
function textControl(card){return card?.querySelector('[data-k="text"]')||null}
function visibleCards(){
  return cards().map((card,index)=>({card,index})).filter(({card})=>{
    const show=card.querySelector('input[data-k="show"]');
    const input=textControl(card);
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
function normalizeSongTitle(value){
  const lines=String(value||'').replace(/\r/g,'').split('\n');
  if(lines.length<=2)return lines.join('\n');
  return lines[0]+'\n'+lines.slice(1).join(' ');
}
function enhanceSongTitle(){
  const card=cards()[0];
  if(!card)return;
  let field=textControl(card);
  if(!field)return;
  if(field.tagName!=='TEXTAREA'){
    const area=document.createElement('textarea');
    area.dataset.k='text';area.rows=2;area.maxLength=240;
    area.value=normalizeSongTitle(field.value);
    area.className=field.className||'';
    area.placeholder='Song title — press Enter for line 2';
    area.setAttribute('aria-label','Song Name, up to two lines');
    field.replaceWith(area);field=area;
  }
  if(!card.querySelector('.fw-song-title-hint')){
    const hint=document.createElement('small');
    hint.className='fw-song-title-hint';
    hint.textContent='Enter = new line · maximum 2 lines';
    field.insertAdjacentElement('afterend',hint);
  }
}
function enhanceAll(){
  list.querySelectorAll('select[data-k="font"]').forEach(enhanceSelect);
  enhanceSongTitle();
}
enhanceAll();
new MutationObserver(enhanceAll).observe(list,{childList:true,subtree:true});

function rememberFont(e){
  const select=e.target?.matches?.('select[data-k="font"]')?e.target:null;if(!select)return;
  const idx=cardIndex(select.closest('.text-card'));
  if(FONT_DEFS[select.value])customByIndex.set(idx,select.value);else customByIndex.delete(idx);
}
list.addEventListener('input',rememberFont,true);
list.addEventListener('change',rememberFont,true);

// Song Name supports a deliberate second line, but never more than two lines.
list.addEventListener('keydown',e=>{
  const field=e.target?.matches?.('textarea[data-k="text"]')?e.target:null;
  if(!field||cardIndex(field.closest('.text-card'))!==0||e.key!=='Enter')return;
  if((field.value.match(/\n/g)||[]).length>=1){e.preventDefault()}
},true);
list.addEventListener('input',e=>{
  const field=e.target?.matches?.('textarea[data-k="text"]')?e.target:null;
  if(!field||cardIndex(field.closest('.text-card'))!==0)return;
  const clean=normalizeSongTitle(field.value);
  if(clean!==field.value){
    const pos=Math.min(field.selectionStart||clean.length,clean.length);
    field.value=clean;
    try{field.setSelectionRange(pos,pos)}catch{}
    field.dispatchEvent(new Event('input',{bubbles:true}));
  }
},true);

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

  const size=Number(String(ctx.font||'').match(/([0-9.]+)px/)?.[1])||32;
  const lines=String(text??'').replace(/\r/g,'').split('\n').slice(0,2);
  const lineHeight=size*1.12;
  const widths=lines.map(line=>ctx.measureText(line||' ').width);
  const width=Math.max(1,...widths);
  const blockHeight=size*1.28+(lines.length-1)*lineHeight;
  const startY=dy-((lines.length-1)*lineHeight)/2;
  bounds[index]={x:dx-width/2,y:dy-blockHeight/2,w:width,h:blockHeight,cx:dx,cy:dy};

  lines.forEach((line,i)=>prevFill(line,dx,startY+i*lineHeight,...rest));
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
    const input=textControl(card);
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