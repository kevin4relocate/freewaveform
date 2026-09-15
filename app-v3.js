(()=>{
'use strict';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const U=window.__FW_UTILS||{};
const clamp=U.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const lerp=U.lerp||((a,b,t)=>a+(b-a)*t);
const fmt=U.fmt||(s=>'0:00');
const toast=window.__FW_TOAST||(()=>{});
const pipeline=window.__FW_RENDER_PIPELINE;
const canvas=$('#canvas');
const ctx=canvas.getContext('2d');
const audio=$('#audio');

const DEFAULT_BG={fit:'cover',opacity:100,zoom:100,darkness:0,blur:0,saturation:100,x:50,y:50};
const state={
  tool:'audio',ratio:'16:9',image:null,imageUrl:'',bg:{...DEFAULT_BG},
  reactive:{scope:'waveText',syncMode:'punchy',scenePunch:7},
  texts:[]
};

let audioUrl='',imageDrag=null;
let audioCtx=null,sourceNode=null,analyser=null,mediaDest=null,freqData=null,prevSpectrum=null;
let manualTime=0,exporting=false,exportRecorder=null,exportChunks=[],exportVideoStream=null,exportAudioTrack=null;
let lastBass=0,energyBaseline=.04,beatEnvelope=0,lastBeatAt=0,frameCounter=0,timelineLastPaint=0,renderLastPaint=0;

const fonts={
  serifCN:'"Noto Serif SC","Songti SC","STSong",serif',calligraphy:'"Ma Shan Zheng","Kaiti SC","STKaiti",cursive',
  sansCN:'"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif',serifEN:'"Playfair Display",Georgia,serif',sans:'Inter,system-ui,sans-serif'
};
const fontOptions=[['serifCN','Songti 宋体'],['calligraphy','Calligraphy 书法'],['sansCN','Heiti 黑体'],['serifEN','Elegant Serif'],['sans','Modern Sans']];

function activeWave(){return window.__FW_MULTI_WAVE?.getActiveLayer?.()||window.__FW_MULTI_WAVE?.getLayers?.()?.[window.__FW_MULTI_WAVE?.getActiveIndex?.()||0]||null}
function waveValue(key,fallback){const w=activeWave();if(w&&Number.isFinite(+w[key]))return +w[key];const map={smoothing:'waveSmoothing',beatSensitivity:'beatSensitivity'};const el=map[key]?document.getElementById(map[key]):null;return el&&Number.isFinite(+el.value)?+el.value:fallback}
function isEdgeStyle(){return window.__FW_WAVE_CONFIG?.EDGE?.has(activeWave()?.style||document.getElementById('waveStyle')?.value)}

function setRatio(r){
  state.ratio=r;const portrait=r==='9:16';canvas.width=portrait?1080:1920;canvas.height=portrait?1920:1080;
  $('#statusRatio').textContent=canvas.width+' × '+canvas.height;$$('[data-ratio]').forEach(b=>b.classList.toggle('active',b.dataset.ratio===r));fitCanvas();
  document.dispatchEvent(new CustomEvent('fw:ratio-change',{detail:{ratio:r,width:canvas.width,height:canvas.height}}));
}
function fitCanvas(){
  const wrap=$('#stageWrap'),cw=wrap.clientWidth-20,ch=wrap.clientHeight-20,ratio=canvas.width/canvas.height;let w=cw,h=w/ratio;
  if(h>ch){h=ch;w=h*ratio}canvas.style.width=Math.max(10,w)+'px';canvas.style.height=Math.max(10,h)+'px';
}
new ResizeObserver(fitCanvas).observe($('#stageWrap'));

function switchTool(tool){
  state.tool=tool;$$('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$$('.panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===tool));
  $('#panelTitle').textContent=tool[0].toUpperCase()+tool.slice(1);canvas.style.cursor=tool==='image'?'grab':tool==='waveform'&&!isEdgeStyle()?'move':'default';
}
$$('.tool').forEach(b=>b.addEventListener('click',()=>switchTool(b.dataset.tool)));
$$('[data-ratio]').forEach(b=>b.addEventListener('click',()=>setRatio(b.dataset.ratio)));

document.addEventListener('fw:wave-selection-change',()=>{if(state.tool==='waveform')canvas.style.cursor=isEdgeStyle()?'default':'move'});

function initReactiveUI(){
  $('#reactScope').addEventListener('change',e=>state.reactive.scope=e.target.value);
  $('#syncMode').addEventListener('change',e=>{state.reactive.syncMode=e.target.value;updateAnalyserSettings()});
  $('#scenePunch').addEventListener('input',e=>{state.reactive.scenePunch=+e.target.value;$('#scenePunchValue').textContent=e.target.value+'%'});
  $('#reactScope').value=state.reactive.scope;$('#syncMode').value=state.reactive.syncMode;$('#scenePunch').value=state.reactive.scenePunch;$('#scenePunchValue').textContent=state.reactive.scenePunch+'%';
}
function effectiveSmoothing(){const modeScale={balanced:1,punchy:.58,transient:.32}[state.reactive.syncMode]||1;return clamp((waveValue('smoothing',55)/100)*modeScale,0,.9)}
function updateAnalyserSettings(){if(analyser)analyser.smoothingTimeConstant=effectiveSmoothing()}

function initImageUI(){
  $('#imageFile').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;if(state.imageUrl)URL.revokeObjectURL(state.imageUrl);state.imageUrl=URL.createObjectURL(f);const img=new Image();img.onload=()=>{state.image=img;state.bg.x=50;state.bg.y=50;state.bg.zoom=100;syncImageUI();$('#imageName').textContent=f.name;toast('Background loaded')};img.src=state.imageUrl});
  $('#imageFit').addEventListener('change',e=>state.bg.fit=e.target.value);
  [['imageOpacity','opacity','%'],['imageZoom','zoom','%'],['imageDarkness','darkness','%'],['imageBlur','blur','px'],['imageSaturation','saturation','%']].forEach(([id,key,suf])=>$('#'+id).addEventListener('input',e=>{state.bg[key]=+e.target.value;$('#'+id+'Value').textContent=e.target.value+suf}));
  $('#imageCenter').addEventListener('click',()=>{state.bg.x=50;state.bg.y=50;toast('Background centered')});
  $('#imageReset').addEventListener('click',()=>{state.bg={...DEFAULT_BG};syncImageUI()});syncImageUI();
}
function syncImageUI(){const b=state.bg;$('#imageFit').value=b.fit;[['imageOpacity','opacity','%'],['imageZoom','zoom','%'],['imageDarkness','darkness','%'],['imageBlur','blur','px'],['imageSaturation','saturation','%']].forEach(([id,key,suf])=>{$('#'+id).value=b[key];$('#'+id+'Value').textContent=b[key]+suf})}

function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function renderTextCards(){
  const list=$('#textList');list.innerHTML=state.texts.map((t,i)=>`<div class="text-card" data-index="${i}"><header><strong>${esc(t.label)}</strong><div><label class="text-show-toggle"><input data-k="show" type="checkbox" ${t.show?'checked':''}> Show</label><button class="delete-text" type="button" title="Delete">×</button></div></header><label>Text<input data-k="text" type="text" value="${esc(t.text)}"></label><div class="row"><label>Font<select data-k="font">${fontOptions.map(([v,n])=>`<option value="${v}" ${t.font===v?'selected':''}>${n}</option>`).join('')}</select></label><label class="text-color-label">Color<input class="text-native-color" data-k="color" type="color" value="${t.color}"></label><label>Size <span>${t.size}</span><input data-k="size" class="range" type="range" min="14" max="160" value="${t.size}"></label><label>Opacity <span>${t.opacity}%</span><input data-k="opacity" class="range" type="range" min="5" max="100" value="${t.opacity}"></label><label>Text reaction<select data-k="react"><option value="false" ${!t.react?'selected':''}>Follow scope</option><option value="true" ${t.react?'selected':''}>Always Pulse</option></select></label><label>Pulse strength <span>${t.strength}%</span><input data-k="strength" class="range" type="range" min="0" max="80" value="${t.strength}"></label></div></div>`).join('');
  window.__FW_TEXT_BRIDGE?.enhanceAll?.();document.dispatchEvent(new CustomEvent('fw:text-ui-rendered'));
}
function initTextUI(){renderTextCards();$('#addText').addEventListener('click',()=>{if(state.texts.length>=10){toast('Maximum 10 text layers');return}const n=state.texts.length+1;state.texts.push({id:'text'+Date.now(),label:'Free Text '+n,text:'Free Text',font:'sans',size:42,color:'#f0e2c8',opacity:90,x:50,y:70,show:true,react:false,strength:10});renderTextCards()})}
$('#textList').addEventListener('input',e=>{const card=e.target.closest('.text-card');if(!card)return;const t=state.texts[+card.dataset.index],k=e.target.dataset.k;if(!t||!k)return;if(k==='show')t.show=e.target.checked;else if(k==='react')t.react=e.target.value==='true';else if(['size','opacity','strength'].includes(k))t[k]=+e.target.value;else t[k]=e.target.value;if(e.target.type==='range'){const s=e.target.parentElement.querySelector('span');if(s)s.textContent=e.target.value+(k==='opacity'||k==='strength'?'%':'')}});
$('#textList').addEventListener('change',e=>{if(e.target.dataset.k==='react'){const card=e.target.closest('.text-card');state.texts[+card.dataset.index].react=e.target.value==='true'}});
$('#textList').addEventListener('click',e=>{if(!e.target.classList.contains('delete-text'))return;const card=e.target.closest('.text-card'),i=+card.dataset.index;state.texts.splice(i,1);window.__FW_TEXT_BRIDGE?.removeIndex?.(i);renderTextCards()});

async function ensureAudioGraph(){
  if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();sourceNode=audioCtx.createMediaElementSource(audio);analyser=audioCtx.createAnalyser();analyser.fftSize=2048;analyser.minDecibels=-92;analyser.maxDecibels=-10;analyser.smoothingTimeConstant=effectiveSmoothing();mediaDest=audioCtx.createMediaStreamDestination();sourceNode.connect(analyser);analyser.connect(audioCtx.destination);sourceNode.connect(mediaDest);freqData=new Uint8Array(analyser.frequencyBinCount);prevSpectrum=new Uint8Array(analyser.frequencyBinCount)}
  if(audioCtx.state==='suspended')await audioCtx.resume();
}
function initAudioUI(){
  $('#audioFile').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=URL.createObjectURL(f);audio.src=audioUrl;audio.load();$('#audioName').textContent=f.name;$('#analysisLabel').textContent='Loading…';$('#statusAudio').textContent='AUDIO LOADED';audio.addEventListener('loadedmetadata',()=>{$('#durationLabel').textContent=fmt(audio.duration);$('#analysisLabel').textContent='Ready · transient FFT';updateTimeline()},{once:true})});
  const play=async()=>{if(!audio.src){toast('Upload audio first');return}await ensureAudioGraph();if(audio.paused)await audio.play();else audio.pause()};$('#playBtn').addEventListener('click',play);$('#timelinePlay').addEventListener('click',play);
  const restart=()=>{if(!audio.src)return;audio.currentTime=0;manualTime=0};$('#restartBtn').addEventListener('click',restart);$('#timelineRestart').addEventListener('click',restart);
  const seek=e=>{if(!Number.isFinite(audio.duration))return;audio.currentTime=(+e.target.value/1000)*audio.duration;manualTime=audio.currentTime};$('#audioSeek').addEventListener('input',seek);$('#timelineSeek').addEventListener('input',seek);
}
function averageBins(start,end){if(!freqData)return 0;start=clamp(Math.floor(start),0,freqData.length-1);end=clamp(Math.ceil(end),start+1,freqData.length);let s=0,n=0;for(let i=start;i<end;i++){s+=freqData[i];n++}return n?s/n/255:0}
function avgHz(lo,hi){if(!audioCtx||!analyser||!freqData)return 0;const nyquist=audioCtx.sampleRate/2;return averageBins((lo/nyquist)*freqData.length,(hi/nyquist)*freqData.length)}
function energy(){
  if(!analyser||audio.paused||audio.ended){beatEnvelope*=.82;return{bass:0,mid:0,treble:0,beat:beatEnvelope,bins:null,flux:0,time:audio.currentTime||performance.now()/1000}}
  analyser.getByteFrequencyData(freqData);const bass=avgHz(35,180),mid=avgHz(180,1800),treble=avgHz(1800,9000);
  let fluxSum=0,fluxCount=0;const maxBin=Math.min(freqData.length,420);for(let i=2;i<maxBin;i+=2){const d=freqData[i]-prevSpectrum[i];if(d>0)fluxSum+=d;prevSpectrum[i]=freqData[i];fluxCount++}
  const flux=fluxCount?clamp(fluxSum/(fluxCount*34),0,1.6):0,combined=bass*.62+mid*.27+treble*.11,delta=Math.max(0,combined-energyBaseline);
  energyBaseline=lerp(energyBaseline,combined,combined>energyBaseline?.022:.065);const bassAttack=Math.max(0,bass-lastBass);lastBass=lerp(lastBass,bass,.22);
  const modeBoost={balanced:1,punchy:1.38,transient:1.78}[state.reactive.syncMode]||1,sensitivity=waveValue('beatSensitivity',135)/100;
  const raw=clamp((delta*7.6+bassAttack*4.5+flux*.72)*sensitivity*modeBoost,0,1.8),now=performance.now();
  if(raw>.34&&now-lastBeatAt>62){beatEnvelope=Math.max(beatEnvelope,raw);lastBeatAt=now}else beatEnvelope=Math.max(raw*.64,beatEnvelope*(state.reactive.syncMode==='transient'?.74:.80));
  return{bass,mid,treble,beat:clamp(beatEnvelope,0,1.8),bins:freqData,flux,time:audio.currentTime||performance.now()/1000};
}
function updateMeters(r){if(exporting||(frameCounter++%2)!==0)return;[['meterBass',r.bass],['meterMid',r.mid],['meterTreble',r.treble],['meterBeat',r.beat/1.3]].forEach(([id,v])=>{const el=$('#'+id);if(el)el.style.width=(clamp(v,0,1)*100).toFixed(1)+'%'})}

function drawBackground(r,reactive=false){
  const w=canvas.width,h=canvas.height,b=state.bg;ctx.save();if(reactive){const pulse=clamp(r.beat*(state.reactive.scenePunch/100),0,.2);ctx.translate(w/2,h/2);ctx.scale(1+pulse,1+pulse);ctx.translate(-w/2,-h/2)}
  const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#d7d8cf');g.addColorStop(.55,'#bec1b6');g.addColorStop(1,'#92978d');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  ctx.fillStyle='rgba(53,62,58,.08)';for(let l=0;l<4;l++){ctx.beginPath();ctx.moveTo(0,h);for(let i=0;i<=9;i++){const q=i/9;ctx.lineTo(q*w,h*(.32+l*.11)+Math.sin(q*7+l)*h*.035)}ctx.lineTo(w,h);ctx.closePath();ctx.fill()}
  if(state.image){const img=state.image,base=b.fit==='contain'?Math.min(w/img.width,h/img.height):Math.max(w/img.width,h/img.height),k=base*(b.zoom/100),iw=img.width*k,ih=img.height*k,ox=(w-iw)*(b.x/100),oy=(h-ih)*(b.y/100);ctx.save();ctx.globalAlpha=b.opacity/100;ctx.filter=`blur(${b.blur}px) saturate(${b.saturation}%)`;ctx.drawImage(img,ox,oy,iw,ih);ctx.restore()}
  if(b.darkness){ctx.fillStyle=`rgba(0,0,0,${b.darkness/100})`;ctx.fillRect(0,0,w,h)}if(reactive&&r.beat>.05){ctx.globalCompositeOperation='screen';ctx.fillStyle=`rgba(255,225,175,${clamp(r.beat*.028,0,.045)})`;ctx.fillRect(0,0,w,h)}ctx.restore();
}
function sampleBackgroundColor(){if(!state.image)return'#d9c69a';try{const o=document.createElement('canvas');o.width=o.height=40;const q=o.getContext('2d');q.drawImage(state.image,0,0,40,40);const d=q.getImageData(0,0,40,40).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=32){r+=d[i];g+=d[i+1];b+=d[i+2];n++}r/=n;g/=n;b/=n;const lum=(r+g+b)/765,m=lum>.56?.52:1.55;return'#'+[r,g,b].map(v=>clamp(Math.round(v*m),25,225).toString(16).padStart(2,'0')).join('')}catch{return'#d9c69a'}}

function textScopeEnabled(){return state.reactive.scope==='waveText'||state.reactive.scope==='full'}
function drawTexts(r){
  const bridge=window.__FW_TEXT_BRIDGE;bridge?.beginFrame?.();
  const base=Math.min(canvas.width,canvas.height),globalText=textScopeEnabled(),glowEnabled=activeWave()?.showGlow!==false;
  state.texts.forEach((t,i)=>{
    if(!t.show||!t.text)return;
    const pos=bridge?.resolvePosition?.(i,t.x,t.y)||{x:t.x,y:t.y},enabled=globalText||t.react,punch=enabled?clamp(r.beat*1.12+r.bass*.22,0,1.8):0,pulse=1+punch*(t.strength/100),size=base*(t.size/1000)*pulse,x=canvas.width*pos.x/100,y=canvas.height*pos.y/100;
    const family=bridge?.getFontFamily?.(t.font)||fonts[t.font]||fonts.sans,lines=String(t.text).replace(/\r/g,'').split('\n').slice(0,2),lineHeight=size*1.12,startY=y-((lines.length-1)*lineHeight)/2;
    ctx.save();ctx.font=`600 ${size}px ${family}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=t.opacity/100;ctx.fillStyle=t.color;if(enabled&&glowEnabled){ctx.shadowColor=t.color;ctx.shadowBlur=punch*size*.20}
    const widths=lines.map(line=>ctx.measureText(line||' ').width),width=Math.max(1,...widths),blockHeight=size*1.28+(lines.length-1)*lineHeight;
    lines.forEach((line,n)=>ctx.fillText(line,x,startY+n*lineHeight));ctx.restore();
    bridge?.recordRendered?.(i,{x:pos.x,y:pos.y,bounds:{x:x-width/2,y:y-blockHeight/2,w:width,h:blockHeight,cx:x,cy:y},visible:true});
  });
}
function runVisualFrame(r){
  const frame={ctx,canvas,audio,energy:r,state,time:r.time};
  drawBackground(r,state.reactive.scope==='waveBg');pipeline?.run('ambient',frame);pipeline?.run('plate',frame);pipeline?.run('wave',frame);drawTexts(r);pipeline?.run('overlay',frame);
}
function render(now=performance.now()){
  if(exporting&&now-renderLastPaint<32){requestAnimationFrame(render);return}
  renderLastPaint=now;
  const r=energy();updateMeters(r);ctx.clearRect(0,0,canvas.width,canvas.height);const full=state.reactive.scope==='full';
  if(full){const w=canvas.width,h=canvas.height,p=clamp(r.beat*(state.reactive.scenePunch/100),0,.18);ctx.save();ctx.translate(w/2,h/2);ctx.scale(1+p,1+p);ctx.translate(-w/2,-h/2);runVisualFrame(r);ctx.restore();if(r.beat>.04){ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=`rgba(255,225,175,${clamp(r.beat*.025,0,.04)})`;ctx.fillRect(0,0,w,h);ctx.restore()}}
  else runVisualFrame(r);
  requestAnimationFrame(render);
}

canvas.addEventListener('pointerdown',e=>{if(state.tool!=='image'||!state.image)return;imageDrag={sx:e.clientX,sy:e.clientY,x:state.bg.x,y:state.bg.y};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing'});
canvas.addEventListener('pointermove',e=>{if(!imageDrag)return;const r=canvas.getBoundingClientRect();state.bg.x=clamp(imageDrag.x-(e.clientX-imageDrag.sx)/r.width*100,0,100);state.bg.y=clamp(imageDrag.y-(e.clientY-imageDrag.sy)/r.height*100,0,100)});
canvas.addEventListener('pointerup',()=>{imageDrag=null;canvas.style.cursor=state.tool==='image'?'grab':state.tool==='waveform'&&!isEdgeStyle()?'move':'default'});canvas.addEventListener('pointercancel',()=>{imageDrag=null});
canvas.addEventListener('wheel',e=>{if(state.tool==='image'&&state.image){e.preventDefault();state.bg.zoom=clamp(state.bg.zoom+(e.deltaY<0?8:-8),50,300);$('#imageZoom').value=state.bg.zoom;$('#imageZoomValue').textContent=Math.round(state.bg.zoom)+'%'}},{passive:false});

function updateTimeline(){
  const now=performance.now();
  if(!exporting||now-timelineLastPaint>=250){
    timelineLastPaint=now;const d=Number.isFinite(audio.duration)?audio.duration:0,t=Number.isFinite(audio.currentTime)?audio.currentTime:manualTime,q=d?t/d:0;
    $('#playBtn').textContent=audio.paused?'Play':'Pause';$('#timelinePlay').textContent=audio.paused?'▶':'Ⅱ';$('#audioSeek').value=Math.round(q*1000);$('#timelineSeek').value=Math.round(q*1000);$('#timelineTime').textContent=fmt(t)+' / '+fmt(d);
  }
  requestAnimationFrame(updateTimeline);
}
function cleanupExportSession(){
  try{exportVideoStream?.getTracks?.().forEach(track=>track.stop())}catch{}
  try{exportAudioTrack?.stop?.()}catch{}
  exportVideoStream=null;exportAudioTrack=null;exportRecorder=null;exportChunks=[];
}
async function exportFullTrack(){
  if(exporting){toast('Export already running');return}if(!audio.src||!Number.isFinite(audio.duration)){toast('Upload audio first');return}if(!window.MediaRecorder){toast('MediaRecorder is not supported');return}await ensureAudioGraph();
  exporting=true;renderLastPaint=0;$('#exportBtn').disabled=true;$('#exportBtn').textContent='Rendering…';
  exportVideoStream=canvas.captureStream(30);const videoTrack=exportVideoStream.getVideoTracks()[0];if(videoTrack&&'contentHint'in videoTrack)videoTrack.contentHint='motion';
  const sourceAudioTrack=mediaDest.stream.getAudioTracks()[0];exportAudioTrack=sourceAudioTrack?.clone?.()||sourceAudioTrack||null;
  const stream=new MediaStream([...exportVideoStream.getVideoTracks(),...(exportAudioTrack?[exportAudioTrack]:[])]);
  let mime='video/webm';for(const m of['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm'])if(MediaRecorder.isTypeSupported(m)){mime=m;break}
  exportChunks=[];exportRecorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000,audioBitsPerSecond:160000});
  const wasTime=audio.currentTime;
  const finishUI=()=>{exporting=false;renderLastPaint=0;$('#exportBtn').disabled=false;$('#exportBtn').textContent='Export WebM'};
  exportRecorder.ondataavailable=e=>{if(e.data.size)exportChunks.push(e.data)};
  exportRecorder.onerror=()=>{audio.pause();audio.currentTime=wasTime;cleanupExportSession();finishUI();toast('Export failed. Try again with this tab visible.')};
  exportRecorder.onstop=()=>{
    const chunks=exportChunks.slice(),type=mime;cleanupExportSession();finishUI();
    if(!chunks.length){toast('Export produced no video data');return}
    const blob=new Blob(chunks,{type}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='freewaveform-'+Date.now()+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);toast('Export finished');
  };
  audio.pause();audio.currentTime=0;energyBaseline=.04;beatEnvelope=0;lastBass=0;await new Promise(r=>setTimeout(r,140));
  exportRecorder.start(1000);
  try{await audio.play()}catch{if(exportRecorder?.state!=='inactive')exportRecorder.stop();return}
  const stop=()=>{if(exportRecorder&&exportRecorder.state!=='inactive')exportRecorder.stop();audio.currentTime=wasTime;audio.pause()};
  audio.addEventListener('ended',stop,{once:true});toast('Rendering full track at a stable 30 FPS');
}
$('#exportBtn').addEventListener('click',exportFullTrack);

function resetProject(){
  state.bg={...DEFAULT_BG};state.image=null;if(state.imageUrl)URL.revokeObjectURL(state.imageUrl);state.imageUrl='';$('#imageName').textContent='Optional';state.reactive={scope:'waveText',syncMode:'punchy',scenePunch:7};state.texts=[];energyBaseline=.04;beatEnvelope=0;lastBass=0;syncImageUI();initReactiveValues();renderTextCards();$('#previewTitle').textContent='Untitled';window.__FW_TEXT_BRIDGE?.reset?.();document.dispatchEvent(new CustomEvent('fw:project-reset'));toast('Project reset');
}
function initReactiveValues(){$('#reactScope').value=state.reactive.scope;$('#syncMode').value=state.reactive.syncMode;$('#scenePunch').value=state.reactive.scenePunch;$('#scenePunchValue').textContent=state.reactive.scenePunch+'%';updateAnalyserSettings()}
$('#resetProject').addEventListener('click',resetProject);

window.__FW_APP={getState:()=>state,sampleBackgroundColor,updateAnalyserSettings,switchTool,setRatio,isExporting:()=>exporting};

initAudioUI();initImageUI();initReactiveUI();initTextUI();setRatio('16:9');switchTool('audio');updateTimeline();render();
})();