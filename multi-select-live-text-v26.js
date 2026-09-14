(()=>{
'use strict';

const canvas=document.getElementById('canvas');
if(!canvas)return;
const ctx=canvas.getContext('2d');
const EDGE=new Set(['bottom','top','dual','left','right','sides']);
const ROUNDISH=new Set(['brushRing','smoothRing','radial','orbit']);
const FONT_MAP={
  serifCN:'"Noto Serif SC","Songti SC","STSong",serif',
  calligraphy:'"Ma Shan Zheng","Kaiti SC","STKaiti",cursive',
  sansCN:'"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif',
  serifEN:'"Playfair Display",Georgia,serif',
  sans:'Inter,system-ui,sans-serif',
  fwZcoolXiaoWei:'"ZCOOL XiaoWei","Noto Serif SC",serif',
  fwZcoolQingKe:'"ZCOOL QingKe HuangYou","Noto Sans SC",sans-serif',
  fwLiuJianMaoCao:'"Liu Jian Mao Cao","Ma Shan Zheng",cursive',
  fwLongCang:'"Long Cang","Ma Shan Zheng",cursive'
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

let live=null;
let drawIndex=0;
let visibleTextIndexes=[];

function canvasPoint(e){
  const r=canvas.getBoundingClientRect();
  return{x:(e.clientX-r.left)/r.width*canvas.width,y:(e.clientY-r.top)/r.height*canvas.height};
}
function selectedIds(){return new Set(window.__FW_MULTI_SELECT?.getSelection?.()||[])}
function textCards(){return [...document.querySelectorAll('#textList .text-card')]}
function textItem(index,cards,positions){
  const card=cards[index],p=positions[index];if(!card||!p)return null;
  const get=k=>card.querySelector(`[data-k="${k}"]`),show=get('show'),text=String(get('text')?.value||'');
  if(!text||show?.checked===false)return null;
  const base=Math.min(canvas.width,canvas.height),size=base*((+get('size')?.value||42)/1000),font=get('font')?.value||'sans';
  ctx.save();ctx.font=`600 ${size}px ${FONT_MAP[font]||FONT_MAP.sans}`;const width=Math.max(size*.8,ctx.measureText(text).width);ctx.restore();
  const height=size*1.28,cx=canvas.width*p.x/100,cy=canvas.height*p.y/100;
  return{id:`text:${index}`,type:'text',index,xPct:+p.x,yPct:+p.y,movable:true,bounds:{x:cx-width/2,y:cy-height/2,w:width,h:height},center:{x:cx,y:cy}};
}
function waveItem(index,layers){
  const w=layers[index];if(!w)return null;
  const style=w.style||'brushRing',xPct=Number.isFinite(+w.x)?+w.x:50,yPct=Number.isFinite(+w.y)?+w.y:50;
  const cx=canvas.width*xPct/100,cy=canvas.height*yPct/100,m=Math.min(canvas.width,canvas.height);let bounds;
  if(style==='centerLine'||style==='mountain'){
    const ww=canvas.width*(+w.size||46)/100,hh=canvas.height*.24;bounds={x:cx-ww/2,y:cy-hh/2,w:ww,h:hh};
  }else if(EDGE.has(style))return{id:`wave:${index}`,type:'wave',index,style,xPct,yPct,movable:false,bounds:null,center:{x:cx,y:cy}};
  else{
    const rr=m*(+w.size||46)/100*.5*1.18;bounds={x:cx-rr,y:cy-rr,w:rr*2,h:rr*2};
  }
  return{id:`wave:${index}`,type:'wave',index,style,xPct,yPct,movable:true,bounds,center:{x:bounds.x+bounds.w/2,y:bounds.y+bounds.h/2}};
}
function movableSelection(){
  const ids=selectedIds();if(ids.size<2)return[];
  const cards=textCards(),positions=window.__FW_TEXT_BRIDGE?.getPositions?.()||[],layers=window.__FW_MULTI_WAVE?.getLayers?.()||[],out=[];
  for(let i=0;i<cards.length;i++){if(!ids.has(`text:${i}`))continue;const item=textItem(i,cards,positions);if(item)out.push(item)}
  for(let i=0;i<layers.length;i++){if(!ids.has(`wave:${i}`))continue;const item=waveItem(i,layers);if(item?.movable)out.push(item)}
  return out;
}
function hitSelected(p,items){
  for(let i=items.length-1;i>=0;i--){
    const item=items[i],b=item.bounds;if(!b)continue;
    if(item.type==='text'){
      if(p.x>=b.x-12&&p.x<=b.x+b.w+12&&p.y>=b.y-10&&p.y<=b.y+b.h+10)return item;
      continue;
    }
    if(ROUNDISH.has(item.style)){
      const rx=b.w/2,ry=b.h/2,nx=(p.x-item.center.x)/(rx||1),ny=(p.y-item.center.y)/(ry||1),d=Math.hypot(nx,ny);
      if(d>=.45&&d<=1.22)return item;
    }else if(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)return item;
  }
  return null;
}
function refreshVisibleTextIndexes(){
  visibleTextIndexes=textCards().map((card,index)=>({card,index})).filter(({card})=>{
    const show=card.querySelector('input[data-k="show"]'),input=card.querySelector('input[data-k="text"]');
    return(!show||show.checked)&&String(input?.value||'').length>0;
  }).map(x=>x.index);
}

// Observe the same group drag before the canvas capture handler stops propagation.
document.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target!==canvas)return;
  const items=movableSelection();if(items.length<2)return;
  const start=canvasPoint(e);if(!hitSelected(start,items))return;
  live={pointerId:e.pointerId,start,items,ids:new Set(items.map(x=>x.id)),dx:0,dy:0};
  refreshVisibleTextIndexes();
},true);

document.addEventListener('pointermove',e=>{
  if(!live||e.pointerId!==live.pointerId)return;
  const p=canvasPoint(e),rawDx=p.x-live.start.x,rawDy=p.y-live.start.y;
  let minDx=-Infinity,maxDx=Infinity,minDy=-Infinity,maxDy=Infinity;
  for(const item of live.items){
    const minPct=item.type==='text'?2:3,maxPct=item.type==='text'?98:97;
    minDx=Math.max(minDx,canvas.width*(minPct-item.xPct)/100);
    maxDx=Math.min(maxDx,canvas.width*(maxPct-item.xPct)/100);
    minDy=Math.max(minDy,canvas.height*(minPct-item.yPct)/100);
    maxDy=Math.min(maxDy,canvas.height*(maxPct-item.yPct)/100);
  }
  live.dx=clamp(rawDx,minDx,maxDx);live.dy=clamp(rawDy,minDy,maxDy);
},true);

function endLive(e){if(live&&(!e||e.pointerId===live.pointerId))live=null}
document.addEventListener('pointerup',endLive,true);
document.addEventListener('pointercancel',endLive,true);

// Shift the actual canvas text during group drag. We translate the context instead
// of changing x/y arguments, so the font bridge keeps the real stored positions.
const previousClear=ctx.clearRect.bind(ctx);
ctx.clearRect=function(...args){
  drawIndex=0;if(live)refreshVisibleTextIndexes();
  return previousClear(...args);
};
const previousFillText=ctx.fillText.bind(ctx);
ctx.fillText=function(text,x,y,...rest){
  if(!live)return previousFillText(text,x,y,...rest);
  const index=visibleTextIndexes[drawIndex++];
  if(index!==undefined&&live.ids.has(`text:${index}`)){
    ctx.save();ctx.translate(live.dx,live.dy);
    try{return previousFillText(text,x,y,...rest)}finally{ctx.restore()}
  }
  return previousFillText(text,x,y,...rest);
};

window.__FW_MULTI_SELECT_LIVE_TEXT={active:()=>!!live,getDelta:()=>live?{dx:live.dx,dy:live.dy}:null};
})();
