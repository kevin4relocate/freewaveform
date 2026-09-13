(()=>{
'use strict';

const btn=document.getElementById('exportBtn');
const audio=document.getElementById('audio');
if(!btn||!audio)return;

const fmt=s=>{
  if(!Number.isFinite(s)||s<0)return'0:00';
  const m=Math.floor(s/60),q=Math.floor(s%60);
  return m+':'+String(q).padStart(2,'0');
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const originalTitle=document.title;

const style=document.createElement('style');
style.textContent=`
.fw-export-progress{position:fixed;right:18px;top:66px;z-index:3000;width:min(340px,calc(100vw - 28px));padding:13px 14px 12px;border-radius:13px;background:rgba(14,18,20,.96);border:1px solid #343b3f;box-shadow:0 18px 48px rgba(0,0,0,.42);backdrop-filter:blur(10px);color:#e9e2d7;font-family:Inter,system-ui,sans-serif;opacity:0;transform:translateY(-8px);pointer-events:none;transition:.18s ease}
.fw-export-progress.show{opacity:1;transform:none}
.fw-export-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px}.fw-export-head b{font-size:11px}.fw-export-state{font-size:9px;color:#dfa95f;letter-spacing:.08em;text-transform:uppercase}
.fw-export-time{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:7px}.fw-export-time strong{font-size:18px;font-variant-numeric:tabular-nums}.fw-export-time span{font-size:10px;color:#918b82}
.fw-export-track{height:7px;border-radius:999px;overflow:hidden;background:#262d30;border:1px solid #31383c}.fw-export-fill{height:100%;width:0;background:linear-gradient(90deg,#b77b36,#e0b46d);border-radius:inherit;transition:width .2s linear}
.fw-export-meta{display:flex;justify-content:space-between;gap:10px;margin-top:7px;color:#9b958d;font-size:9px;font-variant-numeric:tabular-nums}.fw-export-note{margin-top:8px;padding-top:8px;border-top:1px solid #272d30;color:#777f82;font-size:9px;line-height:1.45}.fw-export-note.warn{color:#e1b56c}.fw-export-note.error{color:#ef8989}
@media(max-width:700px){.fw-export-progress{top:58px;right:10px}}
`;
document.head.appendChild(style);

const box=document.createElement('div');
box.className='fw-export-progress';
box.setAttribute('role','status');
box.setAttribute('aria-live','polite');
box.innerHTML=`
  <div class="fw-export-head"><b>Export WebM</b><span class="fw-export-state">Preparing</span></div>
  <div class="fw-export-time"><strong>0:00 / 0:00</strong><span class="fw-export-percent">0%</span></div>
  <div class="fw-export-track"><div class="fw-export-fill"></div></div>
  <div class="fw-export-meta"><span class="fw-export-elapsed">Elapsed 0:00</span><span class="fw-export-left">Remaining —</span></div>
  <div class="fw-export-note">Full-track export records in real time, so a 3-minute song usually takes about 3 minutes.</div>`;
document.body.appendChild(box);

const stateEl=box.querySelector('.fw-export-state');
const timeEl=box.querySelector('.fw-export-time strong');
const percentEl=box.querySelector('.fw-export-percent');
const fillEl=box.querySelector('.fw-export-fill');
const elapsedEl=box.querySelector('.fw-export-elapsed');
const leftEl=box.querySelector('.fw-export-left');
const noteEl=box.querySelector('.fw-export-note');

let active=false;
let everStarted=false;
let startWall=0;
let lastAudioTime=-1;
let lastMovement=0;
let timer=0;
let finishTimer=0;

function show(){box.classList.add('show')}
function hideLater(ms=3800){clearTimeout(finishTimer);finishTimer=setTimeout(()=>box.classList.remove('show'),ms)}
function setNote(text,type=''){
  noteEl.textContent=text;
  noteEl.className='fw-export-note'+(type?' '+type:'');
}
function resetVisual(){
  stateEl.textContent='Preparing';
  timeEl.textContent='0:00 / '+fmt(audio.duration);
  percentEl.textContent='0%';
  fillEl.style.width='0%';
  elapsedEl.textContent='Elapsed 0:00';
  leftEl.textContent='Remaining —';
  setNote('Full-track export records in real time, so a 3-minute song usually takes about 3 minutes.');
}
function begin(){
  if(active)return;
  active=true;everStarted=false;startWall=performance.now();lastAudioTime=-1;lastMovement=performance.now();
  clearInterval(timer);clearTimeout(finishTimer);resetVisual();show();
  timer=setInterval(tick,250);
  setTimeout(()=>{
    if(active&&!btn.disabled&&!everStarted){
      active=false;clearInterval(timer);document.title=originalTitle;hideLater(1200);
    }
  },1800);
}
function finish(ok=true,msg=''){
  if(!active&&!everStarted)return;
  active=false;clearInterval(timer);document.title=originalTitle;
  if(ok){
    stateEl.textContent='Done';fillEl.style.width='100%';percentEl.textContent='100%';
    if(Number.isFinite(audio.duration))timeEl.textContent=fmt(audio.duration)+' / '+fmt(audio.duration);
    leftEl.textContent='Remaining 0:00';
    setNote(msg||'Export complete. The WebM download should start automatically.');
    hideLater(5000);
  }else{
    stateEl.textContent='Error';setNote(msg||'Export stopped unexpectedly. Try again and keep this tab open.','error');hideLater(8000);
  }
}
function tick(){
  if(!active)return;
  if(btn.disabled)everStarted=true;
  const d=Number.isFinite(audio.duration)?audio.duration:0;
  const t=Number.isFinite(audio.currentTime)?audio.currentTime:0;
  const wall=(performance.now()-startWall)/1000;
  const p=d?clamp(t/d,0,1):0;
  const pct=Math.round(p*100);

  timeEl.textContent=fmt(t)+' / '+fmt(d);
  percentEl.textContent=pct+'%';
  fillEl.style.width=(p*100).toFixed(2)+'%';
  elapsedEl.textContent='Elapsed '+fmt(wall);
  leftEl.textContent=d?'Remaining ~'+fmt(Math.max(0,d-t)):'Remaining —';
  document.title=everStarted?`Export ${pct}% · FreeWaveform`:originalTitle;

  if(t>lastAudioTime+.03){lastAudioTime=t;lastMovement=performance.now()}

  if(everStarted&&audio.ended){
    stateEl.textContent='Finalizing';
    setNote('Audio finished. Packaging the WebM file…');
  }else if(everStarted){
    stateEl.textContent='Recording';
    if(document.hidden)setNote('This tab is hidden. Some browsers may slow or pause real-time export — keep the tab visible if possible.','warn');
    else if(performance.now()-lastMovement>10000)setNote('No progress detected for 10 seconds. Export may be stalled; keep this tab active and check that audio is still playing.','warn');
    else setNote('Recording the full song in real time. You can watch progress here; keep this tab open until Done.');
  }

  if(everStarted&&!btn.disabled){finish(true)}
}

btn.addEventListener('click',()=>setTimeout(begin,0));
audio.addEventListener('error',()=>{if(active||everStarted)finish(false,'Audio playback failed during export. Reload the audio and try again.')});
window.addEventListener('unhandledrejection',e=>{if(active||everStarted)finish(false,'Export hit an unexpected browser error. Try again; keeping this tab visible may help.')});
window.addEventListener('error',()=>{if(active||everStarted)setNote('A browser error occurred while exporting. If progress stops, retry the export.','error')});
document.addEventListener('visibilitychange',()=>{if(active)tick()});
})();
