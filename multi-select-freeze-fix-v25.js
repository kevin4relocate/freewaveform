(()=>{
'use strict';

const canvas=document.getElementById('canvas');
const bridge=window.__FW_TEXT_BRIDGE;
if(!canvas||!bridge)return;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function activeTool(){return document.querySelector('.tool.active')?.dataset.tool||''}
function switchTool(tool){
  if(activeTool()===tool)return;
  document.querySelector(`.tool[data-tool="${tool}"]`)?.click();
}
function markedPointer(type,clientX,clientY,pointerId,buttons){
  const E=window.PointerEvent||window.MouseEvent;
  const ev=new E(type,{
    bubbles:true,cancelable:true,composed:true,
    clientX,clientY,button:0,buttons,
    pointerId,pointerType:'mouse',isPrimary:true
  });
  // Prevent Smart Align and the multi-select capture handler from treating
  // these internal position commits as a new user drag.
  try{Object.defineProperty(ev,'__fwSmartAlign',{value:true})}catch{}
  try{Object.defineProperty(ev,'__fwMultiAlignCommit',{value:true})}catch{}
  return ev;
}

bridge.moveTextTo=function(index,x,y){
  const positions=bridge.getPositions?.()||[];
  const p=positions[index];
  if(!p||!Number.isFinite(+x)||!Number.isFinite(+y))return false;

  const prevTool=activeTool();
  if(prevTool!=='text')switchTool('text');

  const r=canvas.getBoundingClientRect();
  const fromX=r.left+r.width*clamp(+p.x,2,98)/100;
  const fromY=r.top+r.height*clamp(+p.y,2,98)/100;
  const toX=r.left+r.width*clamp(+x,2,98)/100;
  const toY=r.top+r.height*clamp(+y,2,98)/100;
  const pid=700+(Number(index)||0);

  canvas.dispatchEvent(markedPointer('pointerdown',fromX,fromY,pid,1));
  canvas.dispatchEvent(markedPointer('pointermove',toX,toY,pid,1));
  canvas.dispatchEvent(markedPointer('pointerup',toX,toY,pid,0));

  if(prevTool&&prevTool!=='text')switchTool(prevTool);
  return true;
};

})();
