(()=>{
'use strict';

const app=window.__FW_APP;
const pipeline=window.__FW_RENDER_PIPELINE;
if(!app||!pipeline)return;

const state=app.getState();
const inspector=document.querySelector('.inspector');
const rail=document.querySelector('.tool-rail');
const presetsBtn=rail?.querySelector('[data-tool="presets"]');
if(!inspector||!rail||!presetsBtn)return;

const DEFAULTS=Object.freeze({
  enabled:true,
  targets:{wave:true,bg:false,text:true,fx:true},
  bgPunch:7
});
const reaction={
  enabled:DEFAULTS.enabled,
  targets:{...DEFAULTS.targets},
  bgPunch:DEFAULTS.bgPunch
};

const TARGET_IDS={
  wave:'reactTargetWave',
  bg:'reactTargetBg',
  text:'reactTargetText',
  fx:'reactTargetFx'
};
const WAVE_CONTROL_IDS=['waveReaction','beatPunch','beatSensitivity','waveSmoothing'];
let savedWaveEnergy=null;
let savedFxEnergy=null;
let bound=false;

const byId=id=>document.getElementById(id);
const targetEnabled=key=>reaction.enabled&&!!reaction.targets[key];
const zeroEnergy=r=>({
  bass:0,mid:0,treble:0,beat:0,
  bins:r?.bins||null,flux:0,
  time:r?.time||performance.now()/1000
});

/* Compatibility gates live at pipeline boundaries. Renderers keep ownership of
   their own reaction math while the central controller decides whether a target
   receives live audio energy. */
pipeline.register('ambient','audio-reaction-fx-gate-in',frame=>{
  savedFxEnergy=frame.energy;
  if(!targetEnabled('fx'))frame.energy=zeroEnergy(frame.energy);
},-1000);
pipeline.register('ambient','audio-reaction-fx-gate-out',frame=>{
  if(savedFxEnergy!==null)frame.energy=savedFxEnergy;
  savedFxEnergy=null;
},1000);
pipeline.register('wave','audio-reaction-wave-gate-in',frame=>{
  savedWaveEnergy=frame.energy;
  if(!targetEnabled('wave'))frame.energy=zeroEnergy(frame.energy);
},-1000);
pipeline.register('wave','audio-reaction-wave-gate-out',frame=>{
  if(savedWaveEnergy!==null)frame.energy=savedWaveEnergy;
  savedWaveEnergy=null;
},1000);

function ensureTool(){
  let button=rail.querySelector('[data-tool="reaction"]');
  if(button)return button;
  button=document.createElement('button');
  button.className='tool';
  button.dataset.tool='reaction';
  button.type='button';
  button.innerHTML='<span>◉</span><b>Reaction</b>';
  rail.insertBefore(button,presetsBtn);
  button.addEventListener('click',()=>app.switchTool('reaction'));
  return button;
}

function ensurePanel(){
  let panel=inspector.querySelector('[data-panel="reaction"]');
  if(panel)return panel;
  panel=document.createElement('section');
  panel.className='panel';
  panel.dataset.panel='reaction';
  panel.innerHTML=`<div class="card audio-reaction-card">
    <div class="card-title"><div><strong>Audio Reaction</strong><small>One master switch, independent targets</small></div><span class="badge">MASTER</span></div>
    <label class="reaction-master"><input id="audioReactionEnabled" type="checkbox" checked> Enable Audio Reaction</label>
    <p class="hint">OFF freezes every audio-reactive target.</p>
    <div class="section-label">TARGETS</div>
    <div class="reaction-targets">
      <label><input id="reactTargetWave" type="checkbox" checked> Waveform</label>
      <label><input id="reactTargetBg" type="checkbox"> Background</label>
      <label><input id="reactTargetText" type="checkbox" checked> Text</label>
      <label><input id="reactTargetFx" type="checkbox" checked> FX</label>
    </div>
    <div class="reaction-group" data-reaction-group="wave">
      <div class="section-label">WAVEFORM</div>
      <label>Beat sync<select id="reactionSyncMode"><option value="balanced">Balanced</option><option value="punchy">Punchy</option><option value="transient">Transient / Hard Hit</option></select></label>
      <div class="control-grid two reaction-wave-controls"></div>
      <p class="hint">Waveform reaction settings remain per waveform.</p>
    </div>
    <div class="reaction-group" data-reaction-group="bg">
      <div class="section-label">BACKGROUND</div>
      <label>Scale / light punch <span id="reactionBgValue">7%</span><input id="reactionBg" class="range" type="range" min="0" max="20" value="7"></label>
    </div>
    <div class="reaction-group" data-reaction-group="text">
      <div class="section-label">TEXT</div>
      <p class="hint">Pulse strength is controlled per text layer in the Text tab.</p>
    </div>
    <div class="reaction-group" data-reaction-group="fx">
      <div class="section-label">FX</div>
      <p class="hint">Reaction type and strength remain per FX layer in the FX tab.</p>
    </div>
  </div>`;
  inspector.appendChild(panel);
  return panel;
}

function mountStyles(){
  if(byId('audio-reaction-v1-style'))return;
  const style=document.createElement('style');
  style.id='audio-reaction-v1-style';
  style.textContent=`
.reaction-master{display:flex!important;align-items:center;gap:8px;padding:10px 11px;border:1px solid #4b3a25;border-radius:9px;background:rgba(202,151,78,.08);font-weight:700!important;color:#ead8ba!important}
.reaction-targets{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:7px 0 12px}
.reaction-targets label{display:flex!important;align-items:center;gap:7px;padding:9px 10px;margin:0!important;border:1px solid #2c3235;border-radius:8px;background:#0a0f11;color:#ddd4c7!important;font-weight:600!important}
.reaction-group{margin-top:10px;padding-top:10px;border-top:1px solid #252b2e}.reaction-group.disabled{opacity:.38;pointer-events:none}.audio-reaction-card .section-label{margin-top:3px}
.react-section{display:none!important}.text-card label:has(select[data-k="react"]){display:none!important}
`;
  document.head.appendChild(style);
}

function cloneWaveControls(panel){
  const host=panel.querySelector('.reaction-wave-controls');
  if(!host||host.children.length)return;
  WAVE_CONTROL_IDS.forEach(id=>{
    const original=byId(id);
    const label=original?.closest('label');
    if(!original||!label)return;
    const clone=label.cloneNode(true);
    const input=clone.querySelector('input,select');
    if(!input)return;
    input.id='reaction-'+id;
    const output=clone.querySelector('span');
    const syncFromOriginal=()=>{
      input.value=original.value;
      if(output){
        const originalOutput=label.querySelector('span');
        output.textContent=originalOutput?.textContent||original.value;
      }
    };
    syncFromOriginal();
    input.addEventListener('input',()=>{
      original.value=input.value;
      original.dispatchEvent(new Event('input',{bubbles:true}));
      syncFromOriginal();
    });
    input.addEventListener('change',()=>{
      original.value=input.value;
      original.dispatchEvent(new Event('change',{bubbles:true}));
      syncFromOriginal();
    });
    original.addEventListener('input',syncFromOriginal);
    original.addEventListener('change',syncFromOriginal);
    host.appendChild(clone);
  });
}

function bind(panel){
  if(bound)return;
  bound=true;
  byId('audioReactionEnabled')?.addEventListener('change',e=>{
    reaction.enabled=e.target.checked;
    apply();
  });
  Object.entries(TARGET_IDS).forEach(([key,id])=>{
    byId(id)?.addEventListener('change',e=>{
      reaction.targets[key]=e.target.checked;
      apply();
    });
  });
  byId('reactionSyncMode')?.addEventListener('change',e=>{
    state.reactive.syncMode=e.target.value;
    const legacy=byId('syncMode');
    if(legacy)legacy.value=e.target.value;
    app.updateAnalyserSettings?.();
  });
  byId('reactionBg')?.addEventListener('input',e=>{
    reaction.bgPunch=+e.target.value;
    byId('reactionBgValue').textContent=e.target.value+'%';
    apply();
  });
  cloneWaveControls(panel);
}

function syncUI(){
  const master=byId('audioReactionEnabled');
  if(master)master.checked=reaction.enabled;
  Object.entries(TARGET_IDS).forEach(([key,id])=>{
    const input=byId(id);
    if(input)input.checked=reaction.targets[key];
  });
  const sync=byId('reactionSyncMode');
  if(sync)sync.value=state.reactive.syncMode;
  const bg=byId('reactionBg');
  if(bg)bg.value=reaction.bgPunch;
  const bgValue=byId('reactionBgValue');
  if(bgValue)bgValue.textContent=reaction.bgPunch+'%';
  document.querySelectorAll('[data-reaction-group]').forEach(group=>{
    group.classList.toggle('disabled',!targetEnabled(group.dataset.reactionGroup));
  });
}

function apply(){
  const bg=targetEnabled('bg');
  const text=targetEnabled('text');

  /* app-v3 still consumes the legacy scope internally. Keep that mapping in one
     compatibility boundary instead of spreading scope logic across modules. */
  state.reactive.scope=bg&&text?'full':bg?'waveBg':text?'waveText':'wave';
  state.reactive.scenePunch=reaction.bgPunch;

  /* Per-text Always Pulse is retired by the centralized target model. Do not
     rewrite strength; the Text tab remains the owner of each layer's strength. */
  state.texts.forEach(textLayer=>{textLayer.react=false});

  const legacyScope=byId('reactScope');
  const legacyScene=byId('scenePunch');
  if(legacyScope)legacyScope.value=state.reactive.scope;
  if(legacyScene)legacyScene.value=reaction.bgPunch;

  syncUI();
  app.updateAnalyserSettings?.();
  document.dispatchEvent(new CustomEvent('fw:audio-reaction-change',{detail:getConfig()}));
}

function reset(){
  reaction.enabled=DEFAULTS.enabled;
  reaction.targets={...DEFAULTS.targets};
  reaction.bgPunch=DEFAULTS.bgPunch;
  apply();
}
function getConfig(){return{
  enabled:reaction.enabled,
  targets:{...reaction.targets},
  bgPunch:reaction.bgPunch
}}

const panel=ensurePanel();
ensureTool();
mountStyles();
bind(panel);
apply();
document.addEventListener('fw:text-ui-rendered',()=>{
  state.texts.forEach(textLayer=>{textLayer.react=false});
});
document.addEventListener('fw:project-reset',()=>setTimeout(reset,0));

window.__FW_AUDIO_REACTION={
  getConfig,
  isEnabled:targetEnabled,
  setEnabled(value){reaction.enabled=!!value;apply()},
  setTarget(key,value){if(key in reaction.targets){reaction.targets[key]=!!value;apply()}},
  reset,
  apply
};
})();
