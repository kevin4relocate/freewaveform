(()=>{
'use strict';

const app=window.__FW_APP;
const waves=window.__FW_MULTI_WAVE;
const fx=window.__FW_FX;
if(!app)return;

const state=app.getState();
const inspector=document.querySelector('.inspector');
const rail=document.querySelector('.tool-rail');
const presetsBtn=rail?.querySelector('[data-tool="presets"]');
if(!inspector||!rail||!presetsBtn)return;

const reaction={
  enabled:true,
  targets:{wave:true,bg:false,text:true,fx:true},
  waveReaction:130,beatPunch:150,beatSensitivity:135,smoothing:55,
  bgPunch:7,textStrength:100
};

const zeroEnergy={bass:0,mid:0,treble:0,beat:0,bins:null,flux:0,time:0};
let waveSnapshot=new Map();
let fxSnapshot=null;

function ensureUI(){
  let button=rail.querySelector('[data-tool="reaction"]');
  if(!button){
    button=document.createElement('button');
    button.className='tool';button.dataset.tool='reaction';button.type='button';
    button.innerHTML='<span>◉</span><b>Reaction</b>';
    rail.insertBefore(button,presetsBtn);
    button.addEventListener('click',()=>app.switchTool('reaction'));
  }
  let panel=inspector.querySelector('[data-panel="reaction"]');
  if(!panel){
    panel=document.createElement('section');panel.className='panel';panel.dataset.panel='reaction';
    panel.innerHTML=`<div class="card audio-reaction-card">
      <div class="card-title"><div><strong>Audio Reaction</strong><small>Choose exactly what reacts to the music</small></div><span class="badge">MASTER</span></div>
      <label class="reaction-master"><input id="audioReactionEnabled" type="checkbox" checked> Enable Audio Reaction</label>
      <p class="hint">Turn this off and nothing reacts to audio. Visuals remain completely static.</p>
      <div class="section-label">TARGETS</div>
      <div class="reaction-targets">
        <label><input id="reactTargetWave" type="checkbox" checked> Waveform</label>
        <label><input id="reactTargetBg" type="checkbox"> Background</label>
        <label><input id="reactTargetText" type="checkbox" checked> Text</label>
        <label><input id="reactTargetFx" type="checkbox" checked> FX</label>
      </div>
      <div class="reaction-group" data-reaction-group="wave">
        <div class="section-label">WAVEFORM REACTION</div>
        <label>Beat sync<select id="reactionSyncMode"><option value="balanced">Balanced</option><option value="punchy" selected>Punchy</option><option value="transient">Transient / Hard Hit</option></select></label>
        <div class="control-grid two">
          <label>Reaction <span id="reactionWaveValue">130%</span><input id="reactionWave" class="range" type="range" min="0" max="400" value="130"></label>
          <label>Beat punch <span id="reactionBeatPunchValue">150%</span><input id="reactionBeatPunch" class="range" type="range" min="0" max="300" value="150"></label>
          <label>Sensitivity <span id="reactionSensitivityValue">135%</span><input id="reactionSensitivity" class="range" type="range" min="50" max="250" value="135"></label>
          <label>Smoothing <span id="reactionSmoothingValue">55%</span><input id="reactionSmoothing" class="range" type="range" min="0" max="95" value="55"></label>
        </div>
      </div>
      <div class="reaction-group" data-reaction-group="bg">
        <div class="section-label">BACKGROUND REACTION</div>
        <label>Scale / light punch <span id="reactionBgValue">7%</span><input id="reactionBg" class="range" type="range" min="0" max="20" value="7"></label>
      </div>
      <div class="reaction-group" data-reaction-group="text">
        <div class="section-label">TEXT REACTION</div>
        <label>Pulse multiplier <span id="reactionTextValue">100%</span><input id="reactionText" class="range" type="range" min="0" max="200" value="100"></label>
        <p class="hint">Each text layer keeps its own Pulse strength. This multiplier controls all text together.</p>
      </div>
      <div class="reaction-group" data-reaction-group="fx">
        <div class="section-label">FX REACTION</div>
        <p class="hint">FX keeps the individual reaction settings from the FX tab. This target is the global on/off gate.</p>
      </div>
    </div>`;
    inspector.appendChild(panel);
  }
  const old=document.querySelector('.react-section');
  if(old)old.style.display='none';
  mountStyles();bind();sync();
}

function mountStyles(){
  if(document.getElementById('audio-reaction-v1-style'))return;
  const s=document.createElement('style');s.id='audio-reaction-v1-style';s.textContent=`
.reaction-master{display:flex!important;align-items:center;gap:8px;padding:10px 11px;border:1px solid #4b3a25;border-radius:9px;background:rgba(202,151,78,.08);font-weight:700!important;color:#ead8ba!important}
.reaction-targets{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:7px 0 12px}
.reaction-targets label{display:flex!important;align-items:center;gap:7px;padding:9px 10px;margin:0!important;border:1px solid #2c3235;border-radius:8px;background:#0a0f11;color:#ddd4c7!important;font-weight:600!important}
.reaction-group{margin-top:10px;padding-top:10px;border-top:1px solid #252b2e}
.reaction-group.disabled{opacity:.38;pointer-events:none}
.audio-reaction-card .section-label{margin-top:3px}
`;
  document.head.appendChild(s);
}

function bind(){
  const $=id=>document.getElementById(id);
  $('audioReactionEnabled').addEventListener('change',e=>{reaction.enabled=e.target.checked;apply()});
  [['reactTargetWave','wave'],['reactTargetBg','bg'],['reactTargetText','text'],['reactTargetFx','fx']].forEach(([id,key])=>$(id).addEventListener('change',e=>{reaction.targets[key]=e.target.checked;apply()}));
  $('reactionSyncMode').addEventListener('change',e=>{state.reactive.syncMode=e.target.value;document.getElementById('syncMode').value=e.target.value;app.updateAnalyserSettings?.()});
  const ranges=[
    ['reactionWave','waveReaction','reactionWaveValue','%'],['reactionBeatPunch','beatPunch','reactionBeatPunchValue','%'],['reactionSensitivity','beatSensitivity','reactionSensitivityValue','%'],['reactionSmoothing','smoothing','reactionSmoothingValue','%'],['reactionBg','bgPunch','reactionBgValue','%'],['reactionText','textStrength','reactionTextValue','%']
  ];
  ranges.forEach(([id,key,out,suf])=>$(id).addEventListener('input',e=>{reaction[key]=+e.target.value;$(out).textContent=e.target.value+suf;apply()}));
}

function syncWaveValues(){
  const list=waves?.getLayers?.()||[];
  list.forEach((w,i)=>{
    if(!waveSnapshot.has(w.id))waveSnapshot.set(w.id,{reaction:w.reaction,beatPunch:w.beatPunch,beatSensitivity:w.beatSensitivity,smoothing:w.smoothing});
    const base=waveSnapshot.get(w.id);
    const enabled=reaction.enabled&&reaction.targets.wave;
    const next={...w,
      reaction:enabled?reaction.waveReaction:0,
      beatPunch:enabled?reaction.beatPunch:0,
      beatSensitivity:reaction.beatSensitivity,
      smoothing:reaction.smoothing
    };
    list[i]=next;
    if(base&&enabled){base.reaction=reaction.waveReaction;base.beatPunch=reaction.beatPunch;base.beatSensitivity=reaction.beatSensitivity;base.smoothing=reaction.smoothing}
  });
  if(list.length)waves?.setLayers?.(list,waves.getActiveIndex?.()||0);
}

function syncScope(){
  const bg=reaction.enabled&&reaction.targets.bg,text=reaction.enabled&&reaction.targets.text;
  state.reactive.scope=bg&&text?'full':bg?'waveBg':text?'waveText':'wave';
  state.reactive.scenePunch=reaction.bgPunch;
  const scope=document.getElementById('reactScope'),scene=document.getElementById('scenePunch');
  if(scope)scope.value=state.reactive.scope;if(scene)scene.value=reaction.bgPunch;
}

function syncText(){
  const on=reaction.enabled&&reaction.targets.text;
  state.texts.forEach(t=>{
    if(t.__reactionBaseStrength==null)t.__reactionBaseStrength=Number.isFinite(+t.strength)?+t.strength:10;
    t.react=false;
    t.strength=on?Math.round(t.__reactionBaseStrength*(reaction.textStrength/100)):0;
  });
}

function syncFx(){
  const api=window.__FW_FX;if(!api?.getLayers||!api?.setLayers)return;
  const current=api.getLayers();
  if(!fxSnapshot)fxSnapshot=current.map(x=>({id:x.id,reaction:x.reaction,strength:x.strength}));
  const on=reaction.enabled&&reaction.targets.fx;
  api.setLayers(current.map(x=>{
    const saved=fxSnapshot.find(s=>s.id===x.id);
    return{...x,reaction:on?(saved?.reaction||x.reaction||'ambient'):'off',strength:on?(saved?.strength??x.strength):0};
  }),api.getActiveIndex?.()||0);
}

function sync(){
  const $=id=>document.getElementById(id);
  $('audioReactionEnabled').checked=reaction.enabled;
  [['reactTargetWave','wave'],['reactTargetBg','bg'],['reactTargetText','text'],['reactTargetFx','fx']].forEach(([id,key])=>$(id).checked=reaction.targets[key]);
  document.querySelectorAll('[data-reaction-group]').forEach(g=>g.classList.toggle('disabled',!reaction.enabled||!reaction.targets[g.dataset.reactionGroup]));
}

function apply(){syncScope();syncWaveValues();syncText();syncFx();sync();app.updateAnalyserSettings?.();document.dispatchEvent(new CustomEvent('fw:audio-reaction-change',{detail:JSON.parse(JSON.stringify(reaction))}))}

ensureUI();
setTimeout(apply,0);
document.addEventListener('fw:wave-setting-change',()=>{if(reaction.enabled&&reaction.targets.wave)setTimeout(syncWaveValues,0)});
document.addEventListener('fw:project-reset',()=>setTimeout(apply,0));

window.__FW_AUDIO_REACTION={getConfig:()=>JSON.parse(JSON.stringify(reaction)),setEnabled:v=>{reaction.enabled=!!v;apply()},apply};
})();
