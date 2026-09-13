(()=>{
'use strict';

function activateTool(tool){
  if(!tool)return;

  document.querySelectorAll('.tool[data-tool]').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.tool===tool);
    btn.setAttribute('aria-pressed',btn.dataset.tool===tool?'true':'false');
  });

  document.querySelectorAll('.panel[data-panel]').forEach(panel=>{
    const active=panel.dataset.panel===tool;
    panel.classList.toggle('active',active);
    panel.hidden=!active;
  });

  const title=document.querySelector('#panelTitle');
  if(title)title.textContent=tool.charAt(0).toUpperCase()+tool.slice(1);

  try{
    if(window.__FW_API&&typeof window.__FW_API.switchTool==='function'){
      window.__FW_API.switchTool(tool);
    }else if(window.__FW_STATE){
      window.__FW_STATE.tool=tool;
    }
  }catch(err){
    console.warn('FreeWaveform tool switch fallback used',err);
  }
}

function bind(){
  const buttons=[...document.querySelectorAll('.tool[data-tool]')];
  if(!buttons.length)return;

  buttons.forEach(btn=>{
    const run=e=>{
      activateTool(btn.dataset.tool);
      // Keep this handler independent from the alignment/canvas layer.
      // Do not stop propagation so the core editor can still receive the click.
    };
    btn.addEventListener('pointerdown',run,{capture:true});
    btn.addEventListener('click',run,{capture:true});
  });

  // Normalize the initial panel in case another script left stale inline state.
  const active=buttons.find(b=>b.classList.contains('active'))||buttons[0];
  activateTool(active.dataset.tool);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
else bind();
})();
