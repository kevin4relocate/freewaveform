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

const clamp=window.__FW_UTILS?.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const toast=window.__FW_TOAST||(()=>{});
const IS_HQ=new URLSearchParams(location.search).get('hq-render')==='1';

const DEFAULTS=Object.freeze({
  enabled:true,
  targets:{wave:true,bg:false,text:true,fx:true},
  bgPunch:7,
  textPulse:10,
  fxPulse:40,
  fxMode:'beat'
});
const reaction={
  enabled:DEFAULTS.enabled,
  targets:{...DEFAULTS.targets},
  bgPunch:DEFAULTS.bgPunch,
  textPulse:DEFAULTS.textPulse,
  fxPulse:DEFAULTS.fxPulse,
  fxMode:DEFAULTS.fxMode
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
let syncingText=false;
let syncingFx=false;
let fxBridgeBusy=false;

const byId=id=>document.getElementById(id);
const targetEnabled=key=>reaction.enabled&&!!reaction.targets[key];
const zeroEnergy=r=>({
  bass:0,mid:0,treble:0,beat:0,
  bins:r?.bins||null,flux:0,
  time:r?.time||performance.now()/1000
});

/* Central gates decide which renderer receives live audio energy. */
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
    <div class="card-title"><div><strong>Audio Reaction</strong><small>Control every pulse from one place</small></div><span class="badge">MASTER</span></div>
    <label class="reaction-master"><input id="audioReactionEnabled" type="checkbox" checked> Enable Audio Reaction</label>
    <p class="hint">OFF freezes waveform, background, text and FX reaction.</p>
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
      <p class="hint">Waveform reaction remains per selected waveform layer.</p>
    </div>
    <div class="reaction-group" data-reaction-group="bg">
      <div class="section-label">BACKGROUND</div>
      <label>Scale / light punch <span id="reactionBgValue">7%</span><input id="reactionBg" class="range" type="range" min="0" max="20" value="7"></label>
    </div>
    <div class="reaction-group" data-reaction-group="text">
      <div class="section-label">TEXT</div>
      <label>Pulse strength <span id="reactionTextPulseValue">10%</span><input id="reactionTextPulse" class="range" type="range" min="0" max="80" value="10"></label>
      <p class="hint">One pulse value for every Free Text layer. Text styling stays in the Text tab.</p>
    </div>
    <div class="reaction-group" data-reaction-group="fx">
      <div class="section-label">FX</div>
      <label>Reaction style<select id="reactionFxMode"><option value="ambient">Ambient</option><option value="beat">Beat Sync</option></select></label>
      <label>Pulse strength <span id="reactionFxPulseValue">40%</span><input id="reactionFxPulse" class="range" type="range" min="0" max="100" value="40"></label>
      <p class="hint">Applies to all FX layers, including the Decor + Energy pack.</p>
    </div>
  </div>`;
  inspector.appendChild(panel);
  return panel;
}

function mountStyles(){
  if(byId('audio-reaction-v2-style'))return;
  const style=document.createElement('style');
  style.id='audio-reaction-v2-style';
  style.textContent=`
.reaction-master{display:flex!important;align-items:center;gap:8px;padding:10px 11px;border:1px solid #4b3a25;border-radius:9px;background:rgba(202,151,78,.08);font-weight:700!important;color:#ead8ba!important}
.reaction-targets{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:7px 0 12px}
.reaction-targets label{display:flex!important;align-items:center;gap:7px;padding:9px 10px;margin:0!important;border:1px solid #2c3235;border-radius:8px;background:#0a0f11;color:#ddd4c7!important;font-weight:600!important}
.reaction-group{margin-top:10px;padding-top:10px;border-top:1px solid #252b2e}.reaction-group.disabled{opacity:.38;pointer-events:none}.audio-reaction-card .section-label{margin-top:3px}
.react-section{display:none!important}.text-card label:has(select[data-k="react"]),.text-card label:has([data-k="strength"]){display:none!important}
.fx-settings label:has(.fx-reaction),.fx-settings label:has(.fx-strength){display:none!important}
.ccfx-card{margin-bottom:10px}.ccfx-group+.ccfx-group{margin-top:10px}.ccfx-group-title{margin:0 0 6px;color:#b78a50;font-size:8px;font-weight:700;letter-spacing:.11em;text-transform:uppercase}.ccfx-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.ccfx-template{min-height:48px;border:1px solid #293034;border-radius:9px;background:#0c1113;color:#cec5b8;display:flex;align-items:center;gap:6px;padding:6px 7px;cursor:pointer;text-align:left}.ccfx-template:hover{border-color:#946a3b;background:#18130e}.ccfx-template b{width:20px;text-align:center;color:#e1b367;font-size:15px}.ccfx-template span{font-size:8px;line-height:1.15}.ccfx-actions{display:flex;gap:6px;margin-bottom:8px}.ccfx-list{display:grid;gap:6px}.ccfx-item{display:grid;grid-template-columns:minmax(0,1fr) 32px 32px;gap:5px}.ccfx-select{height:42px;border:1px solid #293034;border-radius:9px;background:#0c1113;color:#d8d0c4;display:flex;align-items:center;gap:8px;padding:0 9px;cursor:pointer;text-align:left;min-width:0}.ccfx-item.active .ccfx-select{border-color:#956a39;background:#18130e}.ccfx-icon{width:22px;height:22px;border:1px solid #564126;border-radius:7px;background:#1b1710;color:#dda95d;display:grid;place-items:center;flex:none;font-size:10px}.ccfx-copy{min-width:0;display:flex;flex-direction:column;gap:2px}.ccfx-copy b{font-size:9px}.ccfx-copy small{font-size:8px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ccfx-eye,.ccfx-delete{height:42px;border:1px solid #293034;border-radius:9px;background:#0c1113;color:#777;cursor:pointer}.ccfx-eye.on{color:#e0ae61}.ccfx-delete:hover{color:#f1b8a7;border-color:#71443a}.ccfx-settings[hidden]{display:none!important}.ccfx-empty{padding:10px;border:1px dashed #2c3236;border-radius:9px;color:#777;font-size:9px;text-align:center}.ccfx-color-row{display:grid;grid-template-columns:46px minmax(0,1fr);gap:7px;align-items:center;margin-top:8px}.ccfx-color-row input[type=color]{width:46px;height:32px;padding:3px;border:1px solid #30363a;border-radius:8px;background:#0b0f11}.ccfx-color-row small{color:#817b73;font-size:8px;line-height:1.35}.ccfx-settings .section-label{margin-top:8px}@media(max-width:820px){.ccfx-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
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
      if(output){const originalOutput=label.querySelector('span');output.textContent=originalOutput?.textContent||original.value}
    };
    syncFromOriginal();
    input.addEventListener('input',()=>{original.value=input.value;original.dispatchEvent(new Event('input',{bubbles:true}));syncFromOriginal()});
    input.addEventListener('change',()=>{original.value=input.value;original.dispatchEvent(new Event('change',{bubbles:true}));syncFromOriginal()});
    original.addEventListener('input',syncFromOriginal);
    original.addEventListener('change',syncFromOriginal);
    host.appendChild(clone);
  });
}

function applyTextPulse(value=reaction.textPulse){
  value=clamp(+value||0,0,80);reaction.textPulse=value;syncingText=true;
  state.texts.forEach(t=>{t.react=false;t.strength=value});
  document.querySelectorAll('#textList [data-k="strength"]').forEach(input=>{input.value=value;const span=input.parentElement?.querySelector('span');if(span)span.textContent=value+'%'});
  syncingText=false;
}
function applyFxPolicy(){
  const fx=window.__FW_FX;if(!fx?.getLayers||!fx?.setLayers)return;
  const layers=fx.getLayers();if(!layers.length)return;
  const next=layers.map(l=>({...l,reaction:reaction.fxMode,strength:reaction.fxPulse}));
  syncingFx=true;fx.setLayers(next,fx.getActiveIndex?.()||0);syncingFx=false;
}
function inferFxPolicy(){
  const layers=window.__FW_FX?.getLayers?.()||[];if(!layers.length)return;
  const first=layers[0];
  if(['ambient','beat'].includes(first.reaction))reaction.fxMode=first.reaction;
  if(Number.isFinite(+first.strength))reaction.fxPulse=clamp(+first.strength,0,100);
  applyFxPolicy();syncUI();
}

function bind(panel){
  if(bound)return;bound=true;
  byId('audioReactionEnabled')?.addEventListener('change',e=>{reaction.enabled=e.target.checked;apply()});
  Object.entries(TARGET_IDS).forEach(([key,id])=>byId(id)?.addEventListener('change',e=>{reaction.targets[key]=e.target.checked;apply()}));
  byId('reactionSyncMode')?.addEventListener('change',e=>{state.reactive.syncMode=e.target.value;const legacy=byId('syncMode');if(legacy)legacy.value=e.target.value;app.updateAnalyserSettings?.()});
  byId('reactionBg')?.addEventListener('input',e=>{reaction.bgPunch=+e.target.value;byId('reactionBgValue').textContent=e.target.value+'%';apply()});
  byId('reactionTextPulse')?.addEventListener('input',e=>{reaction.textPulse=+e.target.value;byId('reactionTextPulseValue').textContent=e.target.value+'%';applyTextPulse();document.dispatchEvent(new CustomEvent('fw:audio-reaction-change',{detail:getConfig()}))});
  byId('reactionFxMode')?.addEventListener('change',e=>{reaction.fxMode=e.target.value==='ambient'?'ambient':'beat';applyFxPolicy();syncUI();document.dispatchEvent(new CustomEvent('fw:audio-reaction-change',{detail:getConfig()}))});
  byId('reactionFxPulse')?.addEventListener('input',e=>{reaction.fxPulse=clamp(+e.target.value,0,100);byId('reactionFxPulseValue').textContent=reaction.fxPulse+'%';applyFxPolicy();document.dispatchEvent(new CustomEvent('fw:audio-reaction-change',{detail:getConfig()}))});
  cloneWaveControls(panel);
}

function syncUI(){
  const master=byId('audioReactionEnabled');if(master)master.checked=reaction.enabled;
  Object.entries(TARGET_IDS).forEach(([key,id])=>{const input=byId(id);if(input)input.checked=reaction.targets[key]});
  const sync=byId('reactionSyncMode');if(sync)sync.value=state.reactive.syncMode;
  const bg=byId('reactionBg');if(bg)bg.value=reaction.bgPunch;
  const bgValue=byId('reactionBgValue');if(bgValue)bgValue.textContent=reaction.bgPunch+'%';
  const textPulse=byId('reactionTextPulse');if(textPulse)textPulse.value=reaction.textPulse;
  const textPulseValue=byId('reactionTextPulseValue');if(textPulseValue)textPulseValue.textContent=reaction.textPulse+'%';
  const fxMode=byId('reactionFxMode');if(fxMode)fxMode.value=reaction.fxMode;
  const fxPulse=byId('reactionFxPulse');if(fxPulse)fxPulse.value=reaction.fxPulse;
  const fxPulseValue=byId('reactionFxPulseValue');if(fxPulseValue)fxPulseValue.textContent=reaction.fxPulse+'%';
  document.querySelectorAll('[data-reaction-group]').forEach(group=>group.classList.toggle('disabled',!targetEnabled(group.dataset.reactionGroup)));
}

function apply(){
  const bg=targetEnabled('bg'),text=targetEnabled('text');
  state.reactive.scope=bg&&text?'full':bg?'waveBg':text?'waveText':'wave';
  state.reactive.scenePunch=reaction.bgPunch;
  state.texts.forEach(textLayer=>{textLayer.react=false});
  const legacyScope=byId('reactScope'),legacyScene=byId('scenePunch');
  if(legacyScope)legacyScope.value=state.reactive.scope;if(legacyScene)legacyScene.value=reaction.bgPunch;
  syncUI();app.updateAnalyserSettings?.();document.dispatchEvent(new CustomEvent('fw:audio-reaction-change',{detail:getConfig()}));
}

function reset(){
  reaction.enabled=DEFAULTS.enabled;reaction.targets={...DEFAULTS.targets};reaction.bgPunch=DEFAULTS.bgPunch;reaction.textPulse=DEFAULTS.textPulse;reaction.fxPulse=DEFAULTS.fxPulse;reaction.fxMode=DEFAULTS.fxMode;
  applyTextPulse();applyFxPolicy();apply();
}
function getConfig(){return{enabled:reaction.enabled,targets:{...reaction.targets},bgPunch:reaction.bgPunch,textPulse:reaction.textPulse,fxPulse:reaction.fxPulse,fxMode:reaction.fxMode}}

/* --------------------------------------------------------------------------
   Decor + Energy FX pack. It extends the existing FX API so presets and HQ
   snapshots automatically carry these extra layers without changing exporters.
   -------------------------------------------------------------------------- */
const CCFX_TYPES={
  'cc-feathers':{name:'Feathers',icon:'◜',group:'Decor',amount:38,speed:38,size:58,opacity:52,intensity:120,color:'#f5eee4',reaction:'ambient',strength:40,blend:'screen'},
  'cc-leaves':{name:'Leaves',icon:'❧',group:'Decor',amount:40,speed:42,size:56,opacity:56,intensity:120,color:'#d6b76a',reaction:'ambient',strength:36,blend:'source-over'},
  'cc-hearts':{name:'Heart Kisses',icon:'♥',group:'Decor',amount:34,speed:32,size:50,opacity:52,intensity:125,color:'#ff9fbb',reaction:'beat',strength:44,blend:'screen'},
  'cc-confetti':{name:'Confetti',icon:'▦',group:'Decor',amount:52,speed:58,size:48,opacity:64,intensity:120,color:'#ffd56d',reaction:'beat',strength:48,blend:'source-over'},
  'cc-butterflies':{name:'Butterflies',icon:'⋈',group:'Decor',amount:26,speed:34,size:62,opacity:58,intensity:125,color:'#f6a5ff',reaction:'ambient',strength:38,blend:'screen'},
  'cc-meteor':{name:'Meteor',icon:'☄',group:'Energy',amount:34,speed:72,size:66,opacity:60,intensity:140,color:'#b7e7ff',reaction:'beat',strength:62,blend:'screen'},
  'cc-lightning':{name:'Lightning',icon:'ϟ',group:'Energy',amount:24,speed:48,size:72,opacity:52,intensity:145,color:'#c6d6ff',reaction:'beat',strength:66,blend:'screen'},
  'cc-halo':{name:'Halo',icon:'◎',group:'Energy',amount:30,speed:20,size:118,opacity:34,intensity:145,color:'#ffd49a',reaction:'ambient',strength:46,blend:'screen'}
};
const CCFX_KEYS=Object.keys(CCFX_TYPES),MAX_CCFX=5;
let ccLayers=[],ccActive=-1,ccRoot=null;
const frac=v=>v-Math.floor(v);
const rnd=(seed,n=0)=>frac(Math.sin((seed+1)*12.9898+(n+1)*78.233)*43758.5453123);
const ccId=()=>`ccfx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const ccRgb=hex=>{const s=/^#[0-9a-f]{6}$/i.test(String(hex||''))?hex:'#ffffff',n=parseInt(s.slice(1),16);return[n>>16,n>>8&255,n&255]};
const ccRgba=(hex,a)=>{const c=ccRgb(hex);return`rgba(${c[0]},${c[1]},${c[2]},${clamp(a,0,1)})`};
function isCcType(type){return!!CCFX_TYPES[type]}
function sanitizeCc(raw={}){
  const type=isCcType(raw.type)?raw.type:'cc-feathers',d=CCFX_TYPES[type],num=(v,f,a,b)=>clamp(Number.isFinite(+v)?+v:f,a,b);
  return{id:String(raw.id||ccId()),type,name:d.name,enabled:raw.enabled!==false,seed:Number.isFinite(+raw.seed)?+raw.seed:Math.floor(Math.random()*1000000),amount:num(raw.amount,d.amount,0,100),speed:num(raw.speed,d.speed,0,200),size:num(raw.size,d.size,10,200),opacity:num(raw.opacity,d.opacity,0,100),intensity:num(raw.intensity,d.intensity,40,200),color:/^#[0-9a-f]{6}$/i.test(String(raw.color||''))?raw.color:d.color,reaction:['ambient','beat','off'].includes(raw.reaction)?raw.reaction:d.reaction,strength:num(raw.strength,d.strength,0,100),blend:d.blend};
}
function makeCc(type){const d=CCFX_TYPES[type];return sanitizeCc({type,reaction:reaction.fxMode,strength:reaction.fxPulse,color:d.color})}
function getCcLayers(){return ccLayers.map(l=>({...l}))}
function ccQualityScale(){const full=IS_HQ||window.__FW_APP?.isExporting?.()||window.__FW_FX?.getPreviewQuality?.()==='full';return full?1:.55}
function ccCount(l,min,max){return Math.max(1,Math.round((min+(max-min)*(l.amount/100))*ccQualityScale()))}
function ccPresence(l){return clamp((l.intensity||120)/100,.35,2)}
function ccAlpha(l,m=1){return clamp((l.opacity/100)*ccPresence(l)*m,0,1)}
function ccPulse(l,r){const s=clamp((l.strength||0)/100,0,1);if(l.reaction==='off')return 0;if(l.reaction==='ambient')return clamp(((r.bass||0)*.55+(r.mid||0)*.25+(r.beat||0)*.18)*s,0,1.2);return clamp((r.beat||0)*s,0,1.5)}
function drawHeart(ctx,x,y,s,color,a){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.beginPath();ctx.moveTo(0,.33);ctx.bezierCurveTo(-.62,-.08,-.52,-.68,-.12,-.62);ctx.bezierCurveTo(.02,-.60,.12,-.47,.18,-.34);ctx.bezierCurveTo(.24,-.47,.34,-.60,.48,-.62);ctx.bezierCurveTo(.88,-.68,.98,-.08,.36,.33);ctx.lineTo(.18,.55);ctx.closePath();ctx.fillStyle=ccRgba(color,a);ctx.fill();ctx.restore()}
function drawFeathers(ctx,l,r,t,w,h){const n=ccCount(l,5,54),p=ccPulse(l,r),a=ccAlpha(l)*(1+p*.35),base=(3+l.size*.11)*(w/1920),speed=10+l.speed*.38;for(let i=0;i<n;i++){const y=frac(rnd(l.seed,i*7+1)+t*speed/h*(.5+rnd(l.seed,i*7+2)))*h,x=frac(rnd(l.seed,i*7+3)+Math.sin(t*.23+i)*(.012+.025*rnd(l.seed,i*7+4)))*w,s=base*(.55+rnd(l.seed,i*7+5)*1.2),rot=t*(.15+rnd(l.seed,i)*.3)+rnd(l.seed,i*7+6)*6.28;ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.strokeStyle=ccRgba(l.color,a*(.6+.4*rnd(l.seed,i)));ctx.lineWidth=Math.max(.7*(w/1920),s*.12);ctx.beginPath();ctx.moveTo(-s*1.2,0);ctx.quadraticCurveTo(0,-s*.75,s*1.2,0);ctx.quadraticCurveTo(0,s*.45,-s*1.2,0);ctx.stroke();ctx.beginPath();ctx.moveTo(-s*.8,0);ctx.lineTo(s*.8,0);ctx.stroke();ctx.restore()}}
function drawLeaves(ctx,l,r,t,w,h){const n=ccCount(l,6,58),p=ccPulse(l,r),a=ccAlpha(l)*(1+p*.3),base=(3+l.size*.105)*(w/1920),speed=12+l.speed*.44;for(let i=0;i<n;i++){const y=frac(rnd(l.seed,i*8+1)+t*speed/h*(.55+rnd(l.seed,i*8+2)))*h,x=frac(rnd(l.seed,i*8+3)+Math.sin(t*.18+i)*(.018+.025*rnd(l.seed,i*8+4)))*w,s=base*(.6+rnd(l.seed,i*8+5)),rot=t*(.12+rnd(l.seed,i)*.35)+rnd(l.seed,i*8+6)*6.28;ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.fillStyle=ccRgba(l.color,a*(.55+.45*rnd(l.seed,i)));ctx.beginPath();ctx.moveTo(-s,0);ctx.quadraticCurveTo(0,-s*.72,s,0);ctx.quadraticCurveTo(0,s*.72,-s,0);ctx.fill();ctx.strokeStyle=ccRgba('#fff7d6',a*.22);ctx.lineWidth=Math.max(.5,s*.06);ctx.beginPath();ctx.moveTo(-s*.7,0);ctx.lineTo(s*.7,0);ctx.stroke();ctx.restore()}}
function drawHearts(ctx,l,r,t,w,h){const n=ccCount(l,4,44),p=ccPulse(l,r),a=ccAlpha(l)*(1+p*.75),base=(4+l.size*.12)*(w/1920)*(1+p*.12),speed=5+l.speed*.16;for(let i=0;i<n;i++){const y=frac(rnd(l.seed,i*7+1)-t*speed/h*(.5+rnd(l.seed,i*7+2)))*h,x=frac(rnd(l.seed,i*7+3)+Math.sin(t*.28+i)*.022)*w,s=base*(.55+rnd(l.seed,i*7+4)*1.1),tw=.55+.45*Math.sin(t*(.7+rnd(l.seed,i)*.6)+i);drawHeart(ctx,x,y,s,l.color,a*(.35+.65*Math.abs(tw)))}}
function drawConfetti(ctx,l,r,t,w,h){const n=ccCount(l,8,82),p=ccPulse(l,r),a=ccAlpha(l)*(1+p*.45),base=(2.5+l.size*.085)*(w/1920)*(1+p*.08),speed=18+l.speed*.65;for(let i=0;i<n;i++){const y=frac(rnd(l.seed,i*8+1)+t*speed/h*(.65+rnd(l.seed,i*8+2)))*h,x=frac(rnd(l.seed,i*8+3)+Math.sin(t*.4+i)*.012)*w,s=base*(.55+rnd(l.seed,i*8+4)*1.1),rot=t*(.5+rnd(l.seed,i)*1.2)+rnd(l.seed,i*8+5)*6.28,hue=i%4===0?'#ff8fa3':i%4===1?l.color:i%4===2?'#7edfff':'#d8a6ff';ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.fillStyle=ccRgba(hue,a*(.6+.4*rnd(l.seed,i)));ctx.fillRect(-s*.65,-s*.22,s*1.3,s*.44);ctx.restore()}}
function drawButterflies(ctx,l,r,t,w,h){const n=ccCount(l,3,28),p=ccPulse(l,r),a=ccAlpha(l)*(1+p*.42),base=(4+l.size*.12)*(w/1920),speed=.06+l.speed*.0027;for(let i=0;i<n;i++){const phase=t*speed*(.5+rnd(l.seed,i*7+1))+rnd(l.seed,i*7+2)*6.28,x=frac(rnd(l.seed,i*7+3)+Math.sin(phase+i)*(.03+.04*rnd(l.seed,i*7+4)))*w,y=frac(rnd(l.seed,i*7+5)+Math.cos(phase*.72+i)*(.02+.035*rnd(l.seed,i*7+6)))*h,s=base*(.55+rnd(l.seed,i)*1.1),flap=.35+.65*Math.abs(Math.sin(t*(2.2+rnd(l.seed,i)*1.8)+i));ctx.save();ctx.translate(x,y);ctx.fillStyle=ccRgba(l.color,a*(.5+.5*flap));ctx.beginPath();ctx.ellipse(-s*.38,0,s*.52*flap,s*.7,.35,0,6.28);ctx.ellipse(s*.38,0,s*.52*flap,s*.7,-.35,0,6.28);ctx.fill();ctx.fillStyle=ccRgba('#ffffff',a*.7);ctx.fillRect(-s*.05,-s*.35,s*.1,s*.7);ctx.restore()}}
function drawMeteor(ctx,l,r,t,w,h){const n=ccCount(l,2,16),p=ccPulse(l,r),a=ccAlpha(l)*(1+p*1.0),speed=.07+l.speed*.0028,base=(1.2+l.size*.045)*(w/1920)*(1+p*.18);for(let i=0;i<n;i++){const q=frac(rnd(l.seed,i*6+1)+t*speed*(.45+rnd(l.seed,i*6+2))),x=(q*1.4-.2)*w,y=frac(rnd(l.seed,i*6+3)+q*.48)*h*.72,len=(60+l.size*2.2)*(w/1920)*(.6+rnd(l.seed,i*6+4)),ang=.58+.18*rnd(l.seed,i*6+5),x2=x-Math.cos(ang)*len,y2=y-Math.sin(ang)*len,grad=ctx.createLinearGradient(x2,y2,x,y);grad.addColorStop(0,ccRgba(l.color,0));grad.addColorStop(.72,ccRgba(l.color,a*.35));grad.addColorStop(1,ccRgba('#ffffff',a));ctx.strokeStyle=grad;ctx.lineWidth=base*(.7+rnd(l.seed,i)*1.2);ctx.shadowColor=ccRgba(l.color,a);ctx.shadowBlur=base*7;ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x,y);ctx.stroke();ctx.shadowBlur=0}}
function lightningBranch(ctx,x,y,len,angle,depth,seed,color,a,width){if(depth<=0||len<4)return;const x2=x+Math.cos(angle)*len,y2=y+Math.sin(angle)*len;ctx.lineTo(x2,y2);if(depth>1&&rnd(seed,depth*11)>.48){ctx.save();ctx.beginPath();ctx.moveTo(x2,y2);lightningBranch(ctx,x2,y2,len*.55,angle+(.35+rnd(seed,depth)*.45),depth-1,seed+7,color,a*.55,width*.65);ctx.strokeStyle=ccRgba(color,a*.55);ctx.lineWidth=width*.65;ctx.stroke();ctx.restore()}lightningBranch(ctx,x2,y2,len*(.58+.12*rnd(seed,depth+3)),angle+(-.28+rnd(seed,depth+5)*.56),depth-1,seed+13,color,a,width)}
function drawLightning(ctx,l,r,t,w,h){const p=ccPulse(l,r),cycles=.22+l.speed*.0025,phase=t*cycles+l.seed*.00017,flash=Math.pow(Math.max(0,Math.sin(phase*6.283)),12),a=ccAlpha(l)*clamp(flash*.55+p*1.15,0,1.4);if(a<.045)return;const n=Math.max(1,Math.round(1+l.amount/45)),baseW=Math.max(1,(1.2+l.size*.025)*(w/1920));ctx.save();ctx.globalCompositeOperation='screen';for(let i=0;i<n;i++){const sx=(.12+rnd(l.seed,i*9+1)*.76)*w,sy=-h*.02,len=h*(.08+.05*rnd(l.seed,i*9+2));ctx.beginPath();ctx.moveTo(sx,sy);lightningBranch(ctx,sx,sy,len,1.35+(.18-rnd(l.seed,i)*.36),5,l.seed+i*37,l.color,a,baseW);ctx.strokeStyle=ccRgba(l.color,a);ctx.lineWidth=baseW;ctx.shadowColor=ccRgba('#ffffff',a);ctx.shadowBlur=baseW*8;ctx.stroke()}ctx.restore()}
function drawHalo(ctx,l,r,t,w,h){const n=ccCount(l,1,6),p=ccPulse(l,r),a=ccAlpha(l)*(1+p*.7),base=Math.min(w,h)*(.12+l.size*.0016)*(1+p*.1),speed=.05+l.speed*.0008;for(let i=0;i<n;i++){const phase=t*speed*(.6+rnd(l.seed,i*6+1))+rnd(l.seed,i*6+2)*6.28,x=(.2+.6*rnd(l.seed,i*6+3)+Math.sin(phase)*.08)*w,y=(.2+.6*rnd(l.seed,i*6+4)+Math.cos(phase*.8)*.06)*h,radius=base*(.55+rnd(l.seed,i*6+5)*.9),g=ctx.createRadialGradient(x,y,radius*.08,x,y,radius);g.addColorStop(0,ccRgba('#ffffff',a*.36));g.addColorStop(.18,ccRgba(l.color,a*.30));g.addColorStop(.56,ccRgba(l.color,a*.11));g.addColorStop(1,ccRgba(l.color,0));ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2)}}
function drawCcFx(frame){if(!ccLayers.length)return;const ctx=frame.ctx||document.getElementById('canvas').getContext('2d'),c=frame.canvas||document.getElementById('canvas'),r=frame.energy||{},t=Number.isFinite(+frame.time)?+frame.time:(r.time||performance.now()/1000),w=c.width,h=c.height;for(const l of ccLayers){if(!l.enabled||l.opacity<=0||l.amount<=0)continue;ctx.save();ctx.globalCompositeOperation=l.blend||'screen';if(l.type==='cc-feathers')drawFeathers(ctx,l,r,t,w,h);else if(l.type==='cc-leaves')drawLeaves(ctx,l,r,t,w,h);else if(l.type==='cc-hearts')drawHearts(ctx,l,r,t,w,h);else if(l.type==='cc-confetti')drawConfetti(ctx,l,r,t,w,h);else if(l.type==='cc-butterflies')drawButterflies(ctx,l,r,t,w,h);else if(l.type==='cc-meteor')drawMeteor(ctx,l,r,t,w,h);else if(l.type==='cc-lightning')drawLightning(ctx,l,r,t,w,h);else if(l.type==='cc-halo')drawHalo(ctx,l,r,t,w,h);ctx.restore()}}
pipeline.register('ambient','capcut-style-fx-pack',drawCcFx,10);

function ccActiveLayer(){return ccActive>=0?ccLayers[ccActive]:null}
function emitCc(){document.dispatchEvent(new CustomEvent('fw:fx-change',{detail:{layers:window.__FW_FX?.getLayers?.()||getCcLayers(),activeIndex:window.__FW_FX?.getActiveIndex?.()??0,previewQuality:window.__FW_FX?.getPreviewQuality?.()||'performance'}}))}
function setCcLayers(values=[],nextActive=0,{emit=true}={}){ccLayers=(Array.isArray(values)?values:[]).slice(0,MAX_CCFX).map(sanitizeCc);ccActive=ccLayers.length?clamp(+nextActive||0,0,ccLayers.length-1):-1;renderCcList();syncCcSettings();if(emit)emitCc();return true}
function addCc(type){if(!isCcType(type))return false;if(ccLayers.length>=MAX_CCFX){toast(`Maximum ${MAX_CCFX} extra FX layers`);return false}ccLayers.push(makeCc(type));ccActive=ccLayers.length-1;renderCcList();syncCcSettings();emitCc();toast(`${CCFX_TYPES[type].name} FX added`);return true}
function deleteCc(i){i=+i;if(i<0||i>=ccLayers.length)return;ccLayers.splice(i,1);if(ccActive>=ccLayers.length)ccActive=ccLayers.length-1;renderCcList();syncCcSettings();emitCc()}
function duplicateCc(){const l=ccActiveLayer();if(!l)return;if(ccLayers.length>=MAX_CCFX){toast(`Maximum ${MAX_CCFX} extra FX layers`);return}ccLayers.push(sanitizeCc({...l,id:ccId(),seed:Math.floor(Math.random()*1000000)}));ccActive=ccLayers.length-1;renderCcList();syncCcSettings();emitCc()}
function changeCcType(type){const l=ccActiveLayer();if(!l||!isCcType(type))return;const d=CCFX_TYPES[type],keep={id:l.id,enabled:l.enabled,seed:l.seed};Object.assign(l,sanitizeCc({...d,type,...keep,reaction:reaction.fxMode,strength:reaction.fxPulse}));renderCcList();syncCcSettings();emitCc()}
function renderCcList(){if(!ccRoot)return;const list=ccRoot.querySelector('.ccfx-list'),count=ccRoot.querySelector('.ccfx-count');if(count)count.textContent=`${ccLayers.length} / ${MAX_CCFX}`;if(!ccLayers.length){list.innerHTML='<div class="ccfx-empty">Add Decor or Energy FX above.</div>';return}list.innerHTML=ccLayers.map((l,i)=>`<div class="ccfx-item ${i===ccActive?'active':''}" data-i="${i}"><button class="ccfx-select" type="button"><span class="ccfx-icon">${CCFX_TYPES[l.type].icon}</span><span class="ccfx-copy"><b>${CCFX_TYPES[l.type].name}</b><small>${Math.round(l.opacity)}% · ${Math.round(l.amount)} amount</small></span></button><button class="ccfx-eye ${l.enabled?'on':''}" type="button" title="Show / hide">${l.enabled?'●':'○'}</button><button class="ccfx-delete" type="button" title="Delete">×</button></div>`).join('')}
function syncCcSettings(){if(!ccRoot)return;const box=ccRoot.querySelector('.ccfx-settings'),l=ccActiveLayer();box.hidden=!l;if(!l)return;ccRoot.querySelector('.ccfx-selected-name').textContent=CCFX_TYPES[l.type].name;ccRoot.querySelector('.ccfx-type').value=l.type;ccRoot.querySelector('.ccfx-color').value=l.color;for(const [cls,key] of [['.ccfx-intensity','intensity'],['.ccfx-amount','amount'],['.ccfx-speed','speed'],['.ccfx-size','size'],['.ccfx-opacity','opacity']]){const input=ccRoot.querySelector(cls);input.value=l[key];ccRoot.querySelector(cls+'-v').textContent=Math.round(l[key])+'%'}}
function mountCcUi(){if(IS_HQ||!document.getElementById('fxHost'))return;const host=document.getElementById('fxHost');if(host.querySelector('.ccfx-pack'))return;ccRoot=document.createElement('div');ccRoot.className='ccfx-pack';const groups=['Decor','Energy'].map(group=>`<div class="ccfx-group"><div class="ccfx-group-title">${group}</div><div class="ccfx-grid">${CCFX_KEYS.filter(k=>CCFX_TYPES[k].group===group).map(k=>`<button class="ccfx-template" type="button" data-cc-type="${k}"><b>${CCFX_TYPES[k].icon}</b><span>${CCFX_TYPES[k].name}</span></button>`).join('')}</div></div>`).join('');ccRoot.innerHTML=`<div class="card ccfx-card"><div class="card-title"><div><strong>More FX</strong><small>CapCut-style decor + energy effects</small></div><span class="badge">NEW</span></div>${groups}</div><div class="card ccfx-card"><div class="card-title"><div><strong>Extra FX Layers</strong><small>Stack up to ${MAX_CCFX} additional effects</small></div><span class="badge ccfx-count">0 / ${MAX_CCFX}</span></div><div class="ccfx-actions"><button class="button ccfx-duplicate" type="button">Duplicate</button></div><div class="ccfx-list"></div></div><div class="card ccfx-card ccfx-settings" hidden><div class="card-title"><div><strong>Selected Extra FX</strong><small class="ccfx-selected-name">—</small></div></div><label>Type<select class="ccfx-type">${CCFX_KEYS.map(k=>`<option value="${k}">${CCFX_TYPES[k].name}</option>`).join('')}</select></label><label>Intensity <span class="ccfx-intensity-v">120%</span><input class="range ccfx-intensity" type="range" min="40" max="200" value="120"></label><div class="control-grid two"><label>Amount <span class="ccfx-amount-v">40%</span><input class="range ccfx-amount" type="range" min="0" max="100" value="40"></label><label>Speed <span class="ccfx-speed-v">40%</span><input class="range ccfx-speed" type="range" min="0" max="200" value="40"></label><label>Size <span class="ccfx-size-v">50%</span><input class="range ccfx-size" type="range" min="10" max="200" value="50"></label><label>Opacity <span class="ccfx-opacity-v">50%</span><input class="range ccfx-opacity" type="range" min="0" max="100" value="50"></label></div><div class="ccfx-color-row"><input class="ccfx-color" type="color" value="#ffffff"><small>Audio pulse is controlled globally in the Reaction tab.</small></div></div>`;host.insertBefore(ccRoot,host.firstChild);ccRoot.addEventListener('click',e=>{const t=e.target.closest('[data-cc-type]');if(t)return addCc(t.dataset.ccType);if(e.target.closest('.ccfx-duplicate'))return duplicateCc();const item=e.target.closest('.ccfx-item');if(!item)return;const i=+item.dataset.i;if(e.target.closest('.ccfx-delete'))return deleteCc(i);if(e.target.closest('.ccfx-eye')){ccLayers[i].enabled=!ccLayers[i].enabled;renderCcList();emitCc();return}if(e.target.closest('.ccfx-select')){ccActive=i;renderCcList();syncCcSettings()}});ccRoot.querySelector('.ccfx-type').addEventListener('change',e=>changeCcType(e.target.value));ccRoot.querySelector('.ccfx-color').addEventListener('input',e=>{const l=ccActiveLayer();if(!l)return;l.color=e.target.value;emitCc()});for(const [cls,key] of [['.ccfx-intensity','intensity'],['.ccfx-amount','amount'],['.ccfx-speed','speed'],['.ccfx-size','size'],['.ccfx-opacity','opacity']])ccRoot.querySelector(cls).addEventListener('input',e=>{const l=ccActiveLayer();if(!l)return;l[key]=+e.target.value;ccRoot.querySelector(cls+'-v').textContent=e.target.value+'%';renderCcList();emitCc()});renderCcList();syncCcSettings()}
function bridgeFxApi(){const api=window.__FW_FX;if(!api||api.__ccfxExtended)return;const rawGet=api.getLayers.bind(api),rawSet=api.setLayers.bind(api),rawAdd=api.addLayer?.bind(api),rawGetActive=api.getActiveIndex?.bind(api),baseTypes=new Set(api.types||[]),baseMax=api.maxLayers||5;api.getLayers=()=>[...rawGet(),...getCcLayers()];api.setLayers=(values=[],nextActive=0)=>{const all=Array.isArray(values)?values:[],base=all.filter(l=>!isCcType(l?.type)),extra=all.filter(l=>isCcType(l?.type));fxBridgeBusy=true;rawSet(base,Math.min(Math.max(+nextActive||0,0),Math.max(0,base.length-1)));setCcLayers(extra,ccActive<0?0:ccActive,{emit:false});fxBridgeBusy=false;emitCc();return true};api.addLayer=type=>isCcType(type)?addCc(type):rawAdd?.(type);api.types=[...baseTypes,...CCFX_KEYS];api.featuredTypes=[...(api.featuredTypes||[]),...CCFX_KEYS];api.maxLayers=baseMax+MAX_CCFX;api.__ccfxExtended=true;window.__FW_CAPCUT_FX={getLayers:getCcLayers,setLayers:setCcLayers,addLayer:addCc,types:CCFX_KEYS.slice(),maxLayers:MAX_CCFX}}

bridgeFxApi();mountCcUi();

const panel=ensurePanel();ensureTool();mountStyles();bind(panel);

/* Pull saved per-layer values into the new global controls, then keep all layers unified. */
if(state.texts.length&&Number.isFinite(+state.texts[0].strength))reaction.textPulse=clamp(+state.texts[0].strength,0,80);
const initialFx=window.__FW_FX?.getLayers?.()||[];
if(initialFx.length){if(['ambient','beat'].includes(initialFx[0].reaction))reaction.fxMode=initialFx[0].reaction;if(Number.isFinite(+initialFx[0].strength))reaction.fxPulse=clamp(+initialFx[0].strength,0,100)}
apply();

document.addEventListener('fw:text-ui-rendered',()=>{
  state.texts.forEach(t=>{t.react=false});
  if(state.texts.length){const first=state.texts[0];if(Number.isFinite(+first.strength))reaction.textPulse=clamp(+first.strength,0,80);applyTextPulse(reaction.textPulse);syncUI()}
});
document.addEventListener('input',e=>{
  if(syncingText)return;
  if(e.target?.dataset?.k==='strength'){
    reaction.textPulse=clamp(+e.target.value||0,0,80);applyTextPulse(reaction.textPulse);syncUI();
  }
},true);
document.addEventListener('fw:fx-change',()=>{
  if(syncingFx||fxBridgeBusy)return;
  inferFxPolicy();
});
document.addEventListener('fw:project-reset',()=>setTimeout(()=>{setCcLayers([],0,{emit:false});reset()},0));

window.__FW_AUDIO_REACTION={
  getConfig,
  isEnabled:targetEnabled,
  setEnabled(value){reaction.enabled=!!value;apply()},
  setTarget(key,value){if(key in reaction.targets){reaction.targets[key]=!!value;apply()}},
  setTextPulse(value){reaction.textPulse=clamp(+value||0,0,80);applyTextPulse();syncUI()},
  setFxPulse(value){reaction.fxPulse=clamp(+value||0,0,100);applyFxPolicy();syncUI()},
  setFxMode(value){reaction.fxMode=value==='ambient'?'ambient':'beat';applyFxPolicy();syncUI()},
  reset,
  apply
};
})();
