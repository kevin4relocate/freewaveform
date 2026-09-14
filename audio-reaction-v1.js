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

const reaction={enabled:true,targets:{wave:true,bg:false,text:true,fx:true},bgPunch:7,textStrength:100};
let savedWaveEnergy=null,savedFxEnergy=null;

function enabled(key){return reaction.enabled&&reaction.targets[key]}
function zeroLike(r){return{bass:0,mid:0,treble:0,beat:0,bins:r?.bins||null,flux:0,time:r?.time||performance.now()/1000}}

/* Gate only the requested render stage. This keeps every target independent without rewriting its own settings. */
pipeline.register('ambient','audio-reaction-fx-gate-in',frame=>{savedFxEnergy=frame.energy;if(!enabled('fx'))frame.energy=zeroLike(frame.energy)},-1000);
pipeline.register('ambient','audio-reaction-fx-gate-out',frame=>{if(savedFxEnergy){frame.energy=savedFxEnergy;savedFxEnergy=null}},1000);
pipeline.register('wave','audio-reaction-wave-gate-in',frame=>{savedWaveEnergy=frame.energy;if(!enabled('wave'))frame.energy=zeroLike(frame.energy)},-1000);
pipeline.register('wave','audio-reaction-wave-gate-out',frame=>{if(savedWaveEnergy){frame.energy=savedWaveEnergy;savedWaveEnergy=null}},1000);

function ensureUI(){
  let button=rail.querySelector('[data-tool="reaction"]');
  if(!button){button=document.createElement('button');button.className='tool';button.dataset.tool='reaction';button.type='button';button.innerHTML='<span>◉</span><b>Reaction</b>';rail.insertBefore(button,presetsBtn);button.addEventListener('click',()=>app.switchTool('reaction'))}
  let panel=inspector.querySelector('[data-panel="reaction"]');
  if(!panel){
    panel=document.createElement('section');panel.className='panel';panel.dataset.panel='reaction';
    panel.innerHTML=`<div class="card audio-reaction-card">
      <div class="card-title"><div><strong>Audio Reaction</strong><small>Choose what reacts to the music</small></div><span class="badge">MASTER</span></div>
      <label class="reaction-master"><input id="audioReactionEnabled" type="checkbox" checked> Enable Audio Reaction</label>
      <p class="hint">OFF means no waveform, background, text or FX reacts to audio.</p>
      <div class="section-label">TARGETS</div>
      <div class="reaction-targets">
        <label><input id="reactTargetWave" type="checkbox" checked> Waveform</label>
        <label><input id="reactTargetBg" type="checkbox"> Background</label>
        <label><input id="reactTargetText" type="checkbox" checked> Text</label>
        <label><input id="reactTargetFx" type="checkbox" checked> FX</label>
      </div>
      <div class="reaction-group" data-reaction-group="wave">
        <div class="section-label">WAVEFORM</div>
        <label>Beat sync<select id="reactionSyncMode"><option value="balanced">Balanced</option><option value="punchy" selected>Punchy</option><option value="transient">Transient / Hard Hit</option></select></label>
        <div class="control-grid two reaction-wave-controls"></div>
        <p class="hint">Reaction, Beat punch, Sensitivity and Smoothing are still stored per waveform.</p>
      </div>
      <div class="reaction-group" data-reaction-group="bg">
        <div class="section-label">BACKGROUND</div>
        <label>Scale / light punch <span id="reactionBgValue">7%</span><input id="reactionBg" class="range" type="range" min="0" max="20" value="7"></label>
      </div>
      <div class="reaction-group" data-reaction-group="text">
        <div class="section-label">TEXT</div>
        <label>Pulse multiplier <span id="reactionTextValue">100%</span><input id="reactionText" class="range" type="range" min="0" max="200" value="100"></label>
        <p class="hint">Each text keeps its own Pulse strength; this is the global multiplier.</p>
      </div>
      <div class="reaction-group" data-reaction-group="fx">
        <div class="section-label">FX</div>
        <p class="hint">Individual FX reaction type and strength stay in the FX tab. This checkbox is the master gate for all FX.</p>
      </div>
    </div>`;
    inspector.appendChild(panel);
  }
  const old=document.querySelector('.react-section');
  if(old){
    const waveGrid=old.querySelector('.control-grid.two');
    const target=panel.querySelector('.reaction-wave-controls');
    if(waveGrid&&target){['waveReaction','beatPunch','beatSensitivity','waveSmoothing'].forEach(id=>{const input=document.getElementById(id);const label=input?.closest('label');if(label)target.appendChild(label)})}
    old.style.display='none';
  }
  const sync=document.getElementById('syncMode');if(sync)panel.querySelector('#reactionSyncMode').value=sync.value;
  mountStyles();bind();syncUI();apply();
}

function mountStyles(){
  if(document.getElementById('audio-reaction-v1-style'))return;
  const s=document.createElement('style');s.id='audio-reaction-v1-style';s.textContent=`
.reaction-master{display:flex!important;align-items:center;gap:8px;padding:10px 11px;border:1px solid #4b3a25;border-radius:9px;background:rgba(202,151,78,.08);font-weight:700!important;color:#ead8ba!important}
.reaction-targets{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:7px 0 12px}
.reaction-targets label{display:flex!important;align-items:center;gap:7px;padding:9px 10px;margin:0!important;border:1px solid #2c3235;border-radius:8px;background:#0a0f11;color:#ddd4c7!important;font-weight:600!important}
.reaction-group{margin-top:10px;padding-top:10px;border-top:1px solid #252b2e}.reaction-group.disabled{opacity:.38;pointer-events:none}.audio-reaction-card .section-label{margin-top:3px}
.text-card label:has(select[data-k="react"]){display:none!important}
`;
  document.head.appendChild(s);
}

function bind(){
  const $=id=>document.getElementById(id);
  $('audioReactionEnabled').addEventListener('change',e=>{reaction.enabled=e.target.checked;apply()});
  [['reactTargetWave','wave'],['reactTargetBg','bg'],['reactTargetText','text'],['reactTargetFx','fx']].forEach(([id,key])=>$(id).addEventListener('change',e=>{reaction.targets[key]=e.target.checked;apply()}));
  $('reactionSyncMode').addEventListener('change',e=>{state.reactive.syncMode=e.target.value;const old=$('syncMode');if(old)old.value=e.target.value;app.updateAnalyserSettings?.()});
  $('reactionBg').addEventListener('input',e=>{reaction.bgPunch=+e.target.value;$('reactionBgValue').textContent=e.target.value+'%';apply()});
  $('reactionText').addEventListener('input',e=>{reaction.textStrength=+e.target.value;$('reactionTextValue').textContent=e.target.value+'%';applyTextStrength()});
}

function applyTextStrength(){
  const on=enabled('text');
  state.texts.forEach(t=>{
    if(t.__audioReactionBase==null)t.__audioReactionBase=Number.isFinite(+t.strength)?+t.strength:10;
    t.react=false;
    t.strength=on?Math.round(t.__audioReactionBase*(reaction.textStrength/100)):0;
  });
}
function apply(){
  const bg=enabled('bg'),text=enabled('text');
  state.reactive.scope=bg&&text?'full':bg?'waveBg':text?'waveText':'wave';
  state.reactive.scenePunch=reaction.bgPunch;
  const scope=document.getElementById('reactScope'),scene=document.getElementById('scenePunch');if(scope)scope.value=state.reactive.scope;if(scene)scene.value=reaction.bgPunch;
  applyTextStrength();syncUI();app.updateAnalyserSettings?.();document.dispatchEvent(new CustomEvent('fw:audio-reaction-change',{detail:getConfig()}));
}
function syncUI(){
  const $=id=>document.getElementById(id);$('audioReactionEnabled').checked=reaction.enabled;
  [['reactTargetWave','wave'],['reactTargetBg','bg'],['reactTargetText','text'],['reactTargetFx','fx']].forEach(([id,key])=>$(id).checked=reaction.targets[key]);
  document.querySelectorAll('[data-reaction-group]').forEach(g=>g.classList.toggle('disabled',!enabled(g.dataset.reactionGroup)));
}
function getConfig(){return JSON.parse(JSON.stringify(reaction))}

ensureUI();
document.addEventListener('fw:text-ui-rendered',applyTextStrength);
document.addEventListener('fw:project-reset',()=>setTimeout(apply,0));
window.__FW_AUDIO_REACTION={getConfig,setEnabled:v=>{reaction.enabled=!!v;apply()},apply};
})();
