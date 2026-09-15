(()=>{
'use strict';

const nativeRAF=window.requestAnimationFrame.bind(window);
let pauseMainRender=false;
window.requestAnimationFrame=function(callback){
  let id=0;
  const wrapped=time=>{
    if(pauseMainRender&&callback?.name==='render'){
      id=nativeRAF(wrapped);
      return;
    }
    callback(time);
  };
  id=nativeRAF(wrapped);
  return id;
};
window.__FW_HQ_RAF={setPaused(value){pauseMainRender=!!value},isPaused(){return pauseMainRender}};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const normalizeHex=value=>{
  const s=String(value||'').replace(/^#/,'').toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,6);
  return s.length===6?s:null;
};
const validColor=(value,fallback='#ffffff')=>{
  const s=normalizeHex(value);
  return s?'#'+s:String(fallback||'#ffffff').toLowerCase();
};
const toast=(text,duration=2000)=>{
  const el=document.getElementById('toast');
  if(!el)return;
  el.textContent=String(text||'');
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t=setTimeout(()=>el.classList.remove('show'),duration);
};
const fmt=s=>{
  if(!Number.isFinite(s)||s<0)return'0:00';
  const m=Math.floor(s/60),q=Math.floor(s%60);
  return m+':'+String(q).padStart(2,'0');
};

const stages=new Map();
const orderedNames=['ambient','plate','wave','overlay'];
function register(stage,id,fn,order=0){
  if(typeof fn!=='function'||!stage||!id)return()=>{};
  if(!stages.has(stage))stages.set(stage,new Map());
  stages.get(stage).set(id,{fn,order:+order||0});
  return()=>stages.get(stage)?.delete(id);
}
function run(stage,frame){
  const entries=[...(stages.get(stage)?.values()||[])].sort((a,b)=>a.order-b.order);
  for(const entry of entries){
    try{entry.fn(frame)}catch(err){console.error(`[FreeWaveform:${stage}]`,err)}
  }
}
function runAll(frame){for(const stage of orderedNames)run(stage,frame)}
function inspect(){
  const out={};
  for(const [stage,items] of stages)out[stage]=[...items.keys()];
  return out;
}

window.__FW_UTILS={clamp,lerp,normalizeHex,validColor,fmt};
window.__FW_TOAST=toast;
window.__FW_RENDER_PIPELINE={register,run,runAll,inspect,stages:orderedNames.slice()};
})();
