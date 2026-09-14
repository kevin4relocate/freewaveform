(()=>{
'use strict';

const presets={
  inkBreath:{name:'Ink Breathing Ring',icon:'◌',style:'smoothRing',shape:'blob',size:48,thickness:4,opacity:72,detail:184,toothDepth:58,sharpness:28,reaction:150,beatPunch:120,beatSensitivity:115,smoothing:78,glow:10,showSecondary:true,scope:'waveText',sync:'balanced',scenePunch:2},
  zenOrbit:{name:'Zen Brush Orbit',icon:'⟲',style:'orbit',shape:'blob',size:47,thickness:4,opacity:78,detail:88,toothDepth:125,sharpness:50,reaction:195,beatPunch:165,beatSensitivity:130,smoothing:50,glow:18,showSecondary:false,scope:'waveText',sync:'punchy',scenePunch:3},
  lotusBloom:{name:'Lotus Bloom',icon:'✿',style:'radial',shape:'lotus',size:50,thickness:3,opacity:86,detail:160,toothDepth:160,sharpness:78,reaction:230,beatPunch:210,beatSensitivity:140,smoothing:36,glow:22,showSecondary:false,scope:'waveText',sync:'punchy',scenePunch:4},
  jadeSeal:{name:'Jade Seal',icon:'⬡',style:'brushRing',shape:'octagon',size:43,thickness:4,opacity:82,detail:96,toothDepth:70,sharpness:82,reaction:180,beatPunch:175,beatSensitivity:125,smoothing:48,glow:8,showSecondary:true,scope:'waveText',sync:'punchy',scenePunch:3,plate:{enabled:true,shape:'follow',tone:'dark',size:78,opacity:88,softness:3,shadow:10}},
  crownBurst:{name:'Crown Burst',icon:'✦',style:'radial',shape:'star',size:47,thickness:3,opacity:90,detail:192,toothDepth:210,sharpness:96,reaction:300,beatPunch:270,beatSensitivity:155,smoothing:22,glow:28,showSecondary:false,scope:'waveText',sync:'transient',scenePunch:5},
  dualReactor:{name:'Dual Ring Reactor',icon:'◎',style:'brushRing',shape:'circle',size:49,thickness:3,opacity:84,detail:200,toothDepth:125,sharpness:76,reaction:240,beatPunch:220,beatSensitivity:145,smoothing:34,glow:24,showSecondary:true,scope:'waveText',sync:'punchy',scenePunch:4},
  diamondShock:{name:'Diamond Shock',icon:'◇',style:'radial',shape:'diamond',size:45,thickness:3,opacity:92,detail:176,toothDepth:200,sharpness:94,reaction:285,beatPunch:290,beatSensitivity:160,smoothing:18,glow:32,showSecondary:false,scope:'full',sync:'transient',scenePunch:6},
  inkNebula:{name:'Ink Nebula',icon:'✺',style:'orbit',shape:'blob',size:52,thickness:4,opacity:74,detail:144,toothDepth:175,sharpness:60,reaction:215,beatPunch:185,beatSensitivity:135,smoothing:42,glow:40,showSecondary:false,scope:'waveText',sync:'punchy',scenePunch:4},
  mountainCrest:{name:'Mountain Crest',icon:'⌁',style:'mountain',shape:'circle',size:70,thickness:4,opacity:82,detail:208,toothDepth:160,sharpness:75,reaction:240,beatPunch:190,beatSensitivity:130,smoothing:38,glow:14,showSecondary:false,scope:'waveText',sync:'punchy',scenePunch:3},
  bladeHalo:{name:'Blade Halo',icon:'✹',style:'radial',shape:'octagon',size:48,thickness:2,opacity:92,detail:240,toothDepth:220,sharpness:100,reaction:330,beatPunch:300,beatSensitivity:170,smoothing:14,glow:35,showSecondary:false,scope:'full',sync:'transient',scenePunch:7}
};
const rangeMap={size:'waveSize',thickness:'waveThickness',opacity:'waveOpacity',detail:'waveDetail',toothDepth:'toothDepth',sharpness:'waveSharpness',reaction:'waveReaction',beatPunch:'beatPunch',beatSensitivity:'beatSensitivity',smoothing:'waveSmoothing',glow:'waveGlow'};
function fire(el,type){el.dispatchEvent(new Event(type,{bubbles:true}))}
function setSelect(id,value){const el=document.getElementById(id);if(!el)return;el.value=value;fire(el,'change')}
function setRange(id,value){const el=document.getElementById(id);if(!el)return;el.value=value;fire(el,'input')}
function setCheck(id,value){const el=document.getElementById(id);if(!el)return;el.checked=!!value;fire(el,'change')}
function notify(text){if(window.__FW_TOAST)return window.__FW_TOAST(text);const el=document.getElementById('toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>el.classList.remove('show'),2000)}
function applyPreset(key,button){
  const p=presets[key];if(!p)return;setSelect('waveStyle',p.style);setSelect('waveShape',p.shape);Object.entries(rangeMap).forEach(([prop,id])=>setRange(id,p[prop]));setCheck('showSecondary',p.showSecondary);setCheck('showGlow',true);setCheck('showWave',true);setSelect('reactScope',p.scope);setSelect('syncMode',p.sync);setRange('scenePunch',p.scenePunch);if(p.plate)window.__FW_CENTER_PLATE?.setConfig?.(p.plate);document.querySelectorAll('.template-card').forEach(x=>x.classList.remove('active'));button?.classList.add('active');notify(p.name+' applied');
}
function mount(){
  const grid=document.getElementById('templateGrid');if(!grid||grid.dataset.creativeMounted)return false;grid.dataset.creativeMounted='1';
  const title=document.createElement('div');title.className='template-section-divider';title.innerHTML='<span>Creative / New</span><small>10 presets</small>';grid.appendChild(title);
  Object.entries(presets).forEach(([key,p])=>{const b=document.createElement('button');b.className='template-card creative-preset';b.type='button';b.dataset.creative=key;b.title=p.name;b.innerHTML=`<b>${p.icon}</b><span>${p.name}</span>`;grid.appendChild(b)});
  grid.addEventListener('click',e=>{const b=e.target.closest('[data-creative]');if(!b)return;e.preventDefault();e.stopPropagation();applyPreset(b.dataset.creative,b)},true);return true;
}
if(!mount()){let tries=0;const timer=setInterval(()=>{tries++;if(mount()||tries>20)clearInterval(timer)},100)}
})();
