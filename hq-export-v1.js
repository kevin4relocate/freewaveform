(()=>{
'use strict';
const app=window.__FW_APP,pipeline=window.__FW_RENDER_PIPELINE,canvas=document.getElementById('canvas');
if(!app||!pipeline||!canvas)return;
const ctx=canvas.getContext('2d'),audio=document.getElementById('audio'),toast=window.__FW_TOAST||(()=>{}),clamp=window.__FW_UTILS?.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fire=(el,type)=>el?.dispatchEvent(new Event(type,{bubbles:true}));
const fonts={serifCN:'"Noto Serif SC","Songti SC","STSong",serif',calligraphy:'"Ma Shan Zheng","Kaiti SC","STKaiti",cursive',sansCN:'"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif',serifEN:'"Playfair Display",Georgia,serif',sans:'Inter,system-ui,sans-serif'};
let hqBusy=false,lastReady=null;

function cleanFillConfig(raw,index){
  const r=raw?.resource||null;
  return{index,enabled:!!raw?.enabled,color:String(raw?.color||'#17191c'),opacity:+raw?.opacity||88,type:raw?.type==='image'?'image':'color',imageX:Number.isFinite(+raw?.imageX)?+raw.imageX:50,imageY:Number.isFinite(+raw?.imageY)?+raw.imageY:50,imageZoom:Number.isFinite(+raw?.imageZoom)?+raw.imageZoom:100,assetField:r?.url?`fill_${index}`:null,resourceName:r?.name||`fill-${index}.png`};
}
async function captureFillState(){
  const waves=window.__FW_MULTI_WAVE,fill=window.__FW_WAVE_FILL;
  if(!waves||!fill)return{configs:[],files:[]};
  const original=waves.getActiveIndex?.()||0,layers=waves.getLayers?.()||[],configs=[],files=[];
  for(let i=0;i<layers.length;i++){
    waves.selectLayer?.(i);await sleep(0);
    const raw=fill.getConfig?.()||{},cfg=cleanFillConfig(raw,i);configs.push(cfg);
    const url=raw?.resource?.url;
    if(cfg.assetField&&url){
      try{const res=await fetch(url);if(res.ok){const blob=await res.blob();files.push({field:cfg.assetField,blob,name:cfg.resourceName||`fill-${i}.png`})}}catch{}
    }
  }
  waves.selectLayer?.(original);return{configs,files};
}
function captureTexts(){
  const state=app.getState(),positions=window.__FW_TEXT_BRIDGE?.getPositions?.()||[];
  return(state.texts||[]).map((t,i)=>({...t,x:Number.isFinite(positions[i]?.x)?positions[i].x:t.x,y:Number.isFinite(positions[i]?.y)?positions[i].y:t.y}));
}
async function captureSnapshot(){
  const state=app.getState(),fill=await captureFillState(),bgFile=document.getElementById('imageFile')?.files?.[0]||null;
  return{
    snapshot:{version:1,ratio:state.ratio||'16:9',background:{config:{...state.bg},assetField:bgFile?'background':null},reactive:{...state.reactive},texts:captureTexts(),waveLayers:window.__FW_MULTI_WAVE?.getLayers?.()||[],waveActiveIndex:window.__FW_MULTI_WAVE?.getActiveIndex?.()||0,waveLook:window.__FW_WAVE_LOOK?.getConfig?.()||null,waveFill:fill.configs,fx:{layers:window.__FW_FX?.getLayers?.()||[],activeIndex:window.__FW_FX?.getActiveIndex?.()??-1,previewQuality:window.__FW_FX?.getPreviewQuality?.()||'performance'},reaction:window.__FW_AUDIO_REACTION?.getConfig?.()||null},
    bgFile,fillFiles:fill.files
  };
}
function setTextField(card,key,value){const e=card?.querySelector(`[data-k="${key}"]`);if(!e)return;if(e.type==='checkbox')e.checked=!!value;else e.value=String(value??'');fire(e,'input');if(e.tagName==='SELECT'||e.type==='checkbox')fire(e,'change')}
async function applyTexts(items=[]){
  const state=app.getState(),cards=()=>[...document.querySelectorAll('#textList .text-card')];
  while(state.texts.length>items.length)cards().at(-1)?.querySelector('.delete-text')?.click();
  while(state.texts.length<items.length)document.getElementById('addText')?.click();
  const next=cards();items.forEach((t,i)=>{const c=next[i];if(!c)return;setTextField(c,'show',t.show!==false);setTextField(c,'text',t.text||'');setTextField(c,'font',t.font||'sans');setTextField(c,'color',t.color||'#ffffff');setTextField(c,'size',t.size||42);setTextField(c,'opacity',t.opacity??100);setTextField(c,'react',String(!!t.react));setTextField(c,'strength',t.strength||0)});
  await sleep(30);items.forEach((t,i)=>{if(Number.isFinite(+t.x)&&Number.isFinite(+t.y))window.__FW_TEXT_BRIDGE?.moveTextTo?.(i,+t.x,+t.y)});
}
function loadImage(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url})}
async function setFillImage(index,url,name,cfg){
  const waves=window.__FW_MULTI_WAVE,fill=window.__FW_WAVE_FILL,input=document.getElementById('waveFillImageFile');if(!waves||!fill||!input)return;
  waves.selectLayer?.(index);fill.setConfig?.({enabled:cfg.enabled,color:cfg.color,opacity:cfg.opacity,type:'color'});
  if(!url){fill.setConfig?.(cfg);return}
  const res=await fetch(url),blob=await res.blob(),file=new File([blob],name||`fill-${index}.png`,{type:blob.type||'image/png'}),dt=new DataTransfer();dt.items.add(file);input.files=dt.files;fire(input,'change');
  for(let n=0;n<80;n++){if(fill.getConfig?.().hasImage)break;await sleep(25)}
  fill.setConfig?.({enabled:cfg.enabled,color:cfg.color,opacity:cfg.opacity,type:'image',imageX:cfg.imageX,imageY:cfg.imageY,imageZoom:cfg.imageZoom});
}
async function applySnapshot(snapshot={},assetUrls={}){
  app.setRatio?.(snapshot.ratio==='9:16'?'9:16':'16:9');
  const state=app.getState();state.bg={...(state.bg||{}),...(snapshot.background?.config||{})};state.reactive={...(state.reactive||{}),...(snapshot.reactive||{})};
  if(snapshot.background?.assetField&&assetUrls[snapshot.background.assetField]){try{state.image=await loadImage(assetUrls[snapshot.background.assetField])}catch{state.image=null}}else state.image=null;
  window.__FW_MULTI_WAVE?.setLayers?.(snapshot.waveLayers||[],snapshot.waveActiveIndex||0);window.__FW_WAVE_LOOK?.setConfig?.(snapshot.waveLook||{});await applyTexts(snapshot.texts||[]);
  window.__FW_FX?.setLayers?.(snapshot.fx?.layers||[],snapshot.fx?.activeIndex||0);if(snapshot.fx?.previewQuality)window.__FW_FX?.setPreviewQuality?.(snapshot.fx.previewQuality,true);
  if(snapshot.reaction){const r=window.__FW_AUDIO_REACTION;r?.setEnabled?.(snapshot.reaction.enabled!==false);Object.entries(snapshot.reaction.targets||{}).forEach(([k,v])=>r?.setTarget?.(k,!!v));const bg=document.getElementById('reactionBg');if(bg&&Number.isFinite(+snapshot.reaction.bgPunch)){bg.value=snapshot.reaction.bgPunch;fire(bg,'input')}}
  const fills=Array.isArray(snapshot.waveFill)?snapshot.waveFill:[],original=window.__FW_MULTI_WAVE?.getActiveIndex?.()||0;for(const cfg of fills){await setFillImage(cfg.index,assetUrls[cfg.assetField]||'',cfg.resourceName,cfg)}window.__FW_MULTI_WAVE?.selectLayer?.(original);
  await document.fonts?.ready;await sleep(50);return true;
}

function drawBackground(r,reactive=false){
  const state=app.getState(),w=canvas.width,h=canvas.height,b=state.bg||{};ctx.save();if(reactive){const pulse=clamp((r.beat||0)*((state.reactive?.scenePunch||0)/100),0,.2);ctx.translate(w/2,h/2);ctx.scale(1+pulse,1+pulse);ctx.translate(-w/2,-h/2)}
  const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#d7d8cf');g.addColorStop(.55,'#bec1b6');g.addColorStop(1,'#92978d');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.fillStyle='rgba(53,62,58,.08)';for(let l=0;l<4;l++){ctx.beginPath();ctx.moveTo(0,h);for(let i=0;i<=9;i++){const q=i/9;ctx.lineTo(q*w,h*(.32+l*.11)+Math.sin(q*7+l)*h*.035)}ctx.lineTo(w,h);ctx.closePath();ctx.fill()}
  if(state.image){const img=state.image,iw0=img.naturalWidth||img.width,ih0=img.naturalHeight||img.height,base=b.fit==='contain'?Math.min(w/iw0,h/ih0):Math.max(w/iw0,h/ih0),k=base*((b.zoom??100)/100),iw=iw0*k,ih=ih0*k,ox=(w-iw)*((b.x??50)/100),oy=(h-ih)*((b.y??50)/100);ctx.save();ctx.globalAlpha=(b.opacity??100)/100;ctx.filter=`blur(${b.blur||0}px) saturate(${b.saturation??100}%)`;ctx.drawImage(img,ox,oy,iw,ih);ctx.restore()}
  if(b.darkness){ctx.fillStyle=`rgba(0,0,0,${b.darkness/100})`;ctx.fillRect(0,0,w,h)}if(reactive&&r.beat>.05){ctx.globalCompositeOperation='screen';ctx.fillStyle=`rgba(255,225,175,${clamp(r.beat*.028,0,.045)})`;ctx.fillRect(0,0,w,h)}ctx.restore();
}
function textScopeEnabled(){const s=app.getState().reactive?.scope;return s==='waveText'||s==='full'}
function activeWave(){const a=window.__FW_MULTI_WAVE;return a?.getActiveLayer?.()||a?.getLayers?.()?.[a?.getActiveIndex?.()||0]||null}
function drawTexts(r){
  const state=app.getState(),bridge=window.__FW_TEXT_BRIDGE;bridge?.beginFrame?.();const base=Math.min(canvas.width,canvas.height),globalText=textScopeEnabled(),glowEnabled=activeWave()?.showGlow!==false;
  (state.texts||[]).forEach((t,i)=>{if(!t.show||!t.text)return;const pos=bridge?.resolvePosition?.(i,t.x,t.y)||{x:t.x,y:t.y},enabled=globalText||t.react,punch=enabled?clamp((r.beat||0)*1.12+(r.bass||0)*.22,0,1.8):0,pulse=1+punch*((t.strength||0)/100),size=base*((t.size||42)/1000)*pulse,x=canvas.width*pos.x/100,y=canvas.height*pos.y/100,family=bridge?.getFontFamily?.(t.font)||fonts[t.font]||fonts.sans,lines=String(t.text).replace(/\r/g,'').split('\n').slice(0,2),lineHeight=size*1.12,startY=y-((lines.length-1)*lineHeight)/2;ctx.save();ctx.font=`600 ${size}px ${family}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=(t.opacity??100)/100;ctx.fillStyle=t.color||'#fff';if(enabled&&glowEnabled){ctx.shadowColor=t.color||'#fff';ctx.shadowBlur=punch*size*.20}const widths=lines.map(line=>ctx.measureText(line||' ').width),width=Math.max(1,...widths),blockHeight=size*1.28+(lines.length-1)*lineHeight;lines.forEach((line,n)=>ctx.fillText(line,x,startY+n*lineHeight));ctx.restore();bridge?.recordRendered?.(i,{x:pos.x,y:pos.y,bounds:{x:x-width/2,y:y-blockHeight/2,w:width,h:blockHeight,cx:x,cy:y},visible:true})});
}
function runVisualFrame(r){const state=app.getState(),frame={ctx,canvas,audio,energy:r,state,time:r.time};drawBackground(r,state.reactive?.scope==='waveBg');pipeline.run('ambient',frame);pipeline.run('plate',frame);pipeline.run('wave',frame);drawTexts(r);pipeline.run('overlay',frame)}
function renderFrame(r={bass:0,mid:0,treble:0,beat:0,bins:null,flux:0,time:0}){const state=app.getState();ctx.clearRect(0,0,canvas.width,canvas.height);if(state.reactive?.scope==='full'){const w=canvas.width,h=canvas.height,p=clamp((r.beat||0)*((state.reactive?.scenePunch||0)/100),0,.18);ctx.save();ctx.translate(w/2,h/2);ctx.scale(1+p,1+p);ctx.translate(-w/2,-h/2);runVisualFrame(r);ctx.restore();if(r.beat>.04){ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=`rgba(255,225,175,${clamp(r.beat*.025,0,.04)})`;ctx.fillRect(0,0,w,h);ctx.restore()}}else runVisualFrame(r)}
function enterRenderMode(){window.__FW_HQ_RAF?.setPaused?.(true);audio?.pause?.()}
function exitRenderMode(){window.__FW_HQ_RAF?.setPaused?.(false)}

function getKey(){return localStorage.getItem('fw.hqExportKey')||''}
async function apiFetch(url,options={},retry=true){const headers=new Headers(options.headers||{}),key=getKey();if(key)headers.set('X-HQ-Key',key);const res=await fetch(url,{...options,headers});if(res.status===401&&retry){const entered=prompt('Enter your HQ Export Key');if(entered){localStorage.setItem('fw.hqExportKey',entered.trim());return apiFetch(url,options,false)}}return res}
function setButton(text,disabled=true){const b=document.getElementById('hqExportBtn');if(b){b.textContent=text;b.disabled=disabled}}
async function pollJob(jobId){
  while(hqBusy){await sleep(4000);const res=await apiFetch(`/api/hq/status/${encodeURIComponent(jobId)}`);if(!res.ok){setButton('Export HQ MP4',false);hqBusy=false;toast('Could not read HQ render status');return}const s=await res.json();if(s.state==='failed'){setButton('Export HQ MP4',false);hqBusy=false;toast('HQ render failed: '+(s.message||'unknown error'));return}if(s.state==='ready'){hqBusy=false;lastReady=s;setButton('Export HQ MP4',false);const d=document.getElementById('hqDownloadBtn');if(d){d.hidden=false;d.textContent='Download MP4'}toast('HQ MP4 is ready');return}const pct=Number.isFinite(+s.progress)?Math.round(+s.progress):0;setButton(`Rendering HQ… ${pct}%`,true)}
}
async function startHQExport(){
  if(hqBusy)return;const audioFile=document.getElementById('audioFile')?.files?.[0];if(!audioFile){toast('Upload audio first');return}
  hqBusy=true;lastReady=null;document.getElementById('hqDownloadBtn')?.setAttribute('hidden','');setButton('Preparing HQ…',true);
  try{const {snapshot,bgFile,fillFiles}=await captureSnapshot(),form=new FormData();form.append('project',JSON.stringify(snapshot));form.append('audio',audioFile,audioFile.name);if(bgFile)form.append('background',bgFile,bgFile.name);fillFiles.forEach(x=>form.append(x.field,x.blob,x.name));const res=await apiFetch('/api/hq/start',{method:'POST',body:form});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||`HQ export service returned ${res.status}`);setButton('Queued…',true);pollJob(data.jobId)}catch(err){console.error(err);hqBusy=false;setButton('Export HQ MP4',false);toast(err?.message||'HQ export could not start')}
}
function mountUI(){if(new URLSearchParams(location.search).get('hq-render')==='1')return;const quick=document.getElementById('exportBtn');if(!quick||document.getElementById('hqExportBtn'))return;const hq=document.createElement('button');hq.id='hqExportBtn';hq.type='button';hq.className='button accent';hq.textContent='Export HQ MP4';hq.addEventListener('click',startHQExport);const dl=document.createElement('button');dl.id='hqDownloadBtn';dl.type='button';dl.className='button';dl.textContent='Download MP4';dl.hidden=true;dl.addEventListener('click',()=>{if(!lastReady?.downloadUrl)return;const a=document.createElement('a');a.href=lastReady.downloadUrl;a.download=lastReady.fileName||'freewaveform-hq.mp4';document.body.appendChild(a);a.click();a.remove()});quick.insertAdjacentElement('afterend',hq);hq.insertAdjacentElement('afterend',dl)}

window.__FW_HQ_EXPORT={captureSnapshot,applySnapshot,enterRenderMode,exitRenderMode,renderFrame,startHQExport};
mountUI();
})();
