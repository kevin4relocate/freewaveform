(()=>{
'use strict';

const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const lerp=(a,b,t)=>a+(b-a)*t;
const canvas=$('#canvas'),ctx=canvas.getContext('2d'),audio=$('#audio');
const state={
  tool:'audio',ratio:'16:9',image:null,imageUrl:'',
  bg:{fit:'cover',opacity:100,zoom:100,darkness:0,blur:0,saturation:100,x:50,y:50},
  wave:{template:'ink',style:'brushRing',shape:'circle',size:46,thickness:4,opacity:78,smoothing:72,reaction:100,glow:16,color:'#e5d3a6',showWave:true,showPlate:false,showGlow:true,showSecondary:false,x:50,y:50},
  texts:[
    {id:'song',label:'Song Name',text:'SONG TITLE',font:'serifCN',size:72,color:'#2c2925',opacity:100,x:50,y:46,show:true,react:true,strength:6},
    {id:'artist',label:'Artist / Channel',text:'ARTIST NAME',font:'sans',size:28,color:'#403b34',opacity:82,x:50,y:58,show:true,react:false,strength:4}
  ]
};

let audioUrl='',imageDrag=null,waveDrag=null,textDrag=null,textBoxes=[];
let audioCtx=null,sourceNode=null,analyser=null,mediaDest=null,freqData=null,lastBass=0,manualTime=0;
let exporting=false,exportRecorder=null,exportChunks=[];

const fonts={
  serifCN:'"Noto Serif SC","Songti SC","STSong",serif',
  calligraphy:'"Ma Shan Zheng","Kaiti SC","STKaiti",cursive',
  sansCN:'"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif',
  serifEN:'"Playfair Display",Georgia,serif',
  sans:'Inter,system-ui,sans-serif'
};
const fontOptions=[['serifCN','Songti 宋体'],['calligraphy','Calligraphy 书法'],['sansCN','Heiti 黑体'],['serifEN','Elegant Serif'],['sans','Modern Sans']];
const shapeOptions=[['circle','Circle'],['triangle','Triangle'],['square','Square'],['diamond','Diamond'],['pentagon','Pentagon'],['hexagon','Hexagon'],['octagon','Octagon'],['star','Star'],['lotus','Lotus'],['blob','Ink Blob']];
const styleOptions=[['brushRing','Brush Ring'],['smoothRing','Smooth Ring'],['radial','Radial Bars'],['orbit','Orbit Dots'],['centerLine','Center Wave'],['mountain','Mountain Wave'],['bottom','Bottom Wave'],['top','Top Wave'],['dual','Top + Bottom'],['left','Left Bars'],['right','Right Bars'],['sides','Side Bars']];
const templates={
  ink:{name:'Ink Ring',icon:'◯',style:'brushRing',shape:'circle',size:46,thickness:4,opacity:78,reaction:95,glow:8,showPlate:false,showSecondary:false},
  lotus:{name:'Lotus',icon:'✿',style:'smoothRing',shape:'lotus',size:48,thickness:3,opacity:72,reaction:90,glow:14,showPlate:false,showSecondary:true},
  seal:{name:'Seal',icon:'◇',style:'brushRing',shape:'diamond',size:43,thickness:5,opacity:80,reaction:105,glow:6,showPlate:true,showSecondary:false},
  spectrum:{name:'Spectrum',icon:'✺',style:'radial',shape:'circle',size:48,thickness:3,opacity:82,reaction:125,glow:20,showPlate:false,showSecondary:false},
  mountain:{name:'Mountain',icon:'⌁',style:'mountain',shape:'circle',size:58,thickness:4,opacity:78,reaction:115,glow:8,showPlate:false,showSecondary:false},
  bottom:{name:'Bottom',icon:'▁',style:'bottom',shape:'circle',size:72,thickness:4,opacity:84,reaction:115,glow:10,showPlate:false,showSecondary:false},
  dual:{name:'Top + Bottom',icon:'═',style:'dual',shape:'circle',size:72,thickness:3,opacity:72,reaction:110,glow:8,showPlate:false,showSecondary:false},
  sides:{name:'Side Bars',icon:'↔',style:'sides',shape:'circle',size:66,thickness:4,opacity:78,reaction:120,glow:12,showPlate:false,showSecondary:false},
  star:{name:'Star Pulse',icon:'☆',style:'smoothRing',shape:'star',size:45,thickness:3,opacity:74,reaction:100,glow:18,showPlate:false,showSecondary:true}
};

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),2200)}
function fmt(s){if(!Number.isFinite(s)||s<0)return'0:00';const m=Math.floor(s/60),q=Math.floor(s%60);return m+':'+String(q).padStart(2,'0')}
function isEdgeStyle(s=state.wave.style){return['bottom','top','dual','left','right','sides'].includes(s)}
function setRatio(r){state.ratio=r;const portrait=r==='9:16';canvas.width=portrait?1080:1920;canvas.height=portrait?1920:1080;$('#statusRatio').textContent=canvas.width+' × '+canvas.height;$$('[data-ratio]').forEach(b=>b.classList.toggle('active',b.dataset.ratio===r));fitCanvas();}
function fitCanvas(){const wrap=$('#stageWrap'),cw=wrap.clientWidth-20,ch=wrap.clientHeight-20,ratio=canvas.width/canvas.height;let w=cw,h=w/ratio;if(h>ch){h=ch;w=h*ratio}canvas.style.width=Math.max(10,w)+'px';canvas.style.height=Math.max(10,h)+'px'}
new ResizeObserver(fitCanvas).observe($('#stageWrap'));

function switchTool(tool){state.tool=tool;$$('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$$('.panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===tool));$('#panelTitle').textContent=tool[0].toUpperCase()+tool.slice(1);canvas.style.cursor=tool==='image'?'grab':tool==='waveform'&&!isEdgeStyle()?'move':tool==='text'?'default':'default'}
$$('.tool').forEach(b=>b.addEventListener('click',()=>switchTool(b.dataset.tool)));
$$('[data-ratio]').forEach(b=>b.addEventListener('click',()=>setRatio(b.dataset.ratio)));

function initWaveUI(){
  $('#waveStyle').innerHTML=styleOptions.map(([v,n])=>`<option value="${v}">${n}</option>`).join('');
  $('#waveShape').innerHTML=shapeOptions.map(([v,n])=>`<option value="${v}">${n}</option>`).join('');
  const grid=$('#templateGrid');grid.innerHTML=Object.entries(templates).map(([k,t])=>`<button class="template-card" type="button" data-template="${k}"><b>${t.icon}</b><span>${t.name}</span></button>`).join('');
  grid.addEventListener('click',e=>{const b=e.target.closest('[data-template]');if(!b)return;applyTemplate(b.dataset.template)});
  $('#waveStyle').addEventListener('change',e=>{state.wave.style=e.target.value;syncWaveUI();});
  $('#waveShape').addEventListener('change',e=>{state.wave.shape=e.target.value;});
  const binds=[['waveSize','size','%'],['waveThickness','thickness',''],['waveOpacity','opacity','%'],['waveSmoothing','smoothing','%'],['waveReaction','reaction','%'],['waveGlow','glow','%']];
  binds.forEach(([id,key,suf])=>$('#'+id).addEventListener('input',e=>{state.wave[key]=+e.target.value;$('#'+id+'Value').textContent=e.target.value+suf;if(key==='smoothing'&&analyser)analyser.smoothingTimeConstant=clamp(state.wave.smoothing/100,0,.95)}));
  $('#waveColor').addEventListener('input',e=>state.wave.color=e.target.value);
  [['showWave','showWave'],['showPlate','showPlate'],['showGlow','showGlow'],['showSecondary','showSecondary']].forEach(([id,key])=>$('#'+id).addEventListener('change',e=>state.wave[key]=e.target.checked));
  $('#autoColor').addEventListener('click',()=>{state.wave.color=sampleBackgroundColor();$('#waveColor').value=state.wave.color;toast('Wave color matched to background')});
  $('#pickColor').addEventListener('click',async()=>{if(!('EyeDropper'in window)){toast('Eyedropper is not supported in this browser');return}try{const v=(await new EyeDropper().open()).sRGBHex;state.wave.color=v;$('#waveColor').value=v}catch{}});
  syncWaveUI();
}
function applyTemplate(k){const t=templates[k];if(!t)return;state.wave.template=k;Object.keys(t).forEach(key=>{if(key!=='name'&&key!=='icon')state.wave[key]=t[key]});syncWaveUI();toast(t.name+' applied')}
function syncWaveUI(){
  const w=state.wave;$('#waveStyle').value=w.style;$('#waveShape').value=w.shape;$('#waveShape').disabled=isEdgeStyle(w.style);
  [['waveSize','size','%'],['waveThickness','thickness',''],['waveOpacity','opacity','%'],['waveSmoothing','smoothing','%'],['waveReaction','reaction','%'],['waveGlow','glow','%']].forEach(([id,key,suf])=>{$('#'+id).value=w[key];$('#'+id+'Value').textContent=w[key]+suf});
  $('#waveColor').value=w.color;$('#showWave').checked=w.showWave;$('#showPlate').checked=w.showPlate;$('#showGlow').checked=w.showGlow;$('#showSecondary').checked=w.showSecondary;
  $$('.template-card').forEach(b=>b.classList.toggle('active',b.dataset.template===w.template));
  $('#waveMoveHint').textContent=isEdgeStyle(w.style)?'This edge waveform is locked to the canvas edge. Choose a center style if you want free drag positioning.':'Drag anywhere on the canvas to move this waveform. Mouse wheel changes its size.';
  canvas.style.cursor=state.tool==='waveform'&&!isEdgeStyle(w.style)?'move':state.tool==='image'?'grab':'default';
}

function initImageUI(){
  $('#imageFile').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;if(state.imageUrl)URL.revokeObjectURL(state.imageUrl);state.imageUrl=URL.createObjectURL(f);const img=new Image();img.onload=()=>{state.image=img;state.bg.x=50;state.bg.y=50;state.bg.zoom=100;$('#imageZoom').value=100;$('#imageZoomValue').textContent='100%';$('#imageName').textContent=f.name;toast('Background loaded')};img.src=state.imageUrl});
  $('#imageFit').addEventListener('change',e=>state.bg.fit=e.target.value);
  const binds=[['imageOpacity','opacity','%'],['imageZoom','zoom','%'],['imageDarkness','darkness','%'],['imageBlur','blur','px'],['imageSaturation','saturation','%']];
  binds.forEach(([id,key,suf])=>$('#'+id).addEventListener('input',e=>{state.bg[key]=+e.target.value;$('#'+id+'Value').textContent=e.target.value+suf}));
  $('#imageCenter').addEventListener('click',()=>{state.bg.x=50;state.bg.y=50;toast('Background centered')});
  $('#imageReset').addEventListener('click',()=>{state.bg={fit:'cover',opacity:100,zoom:100,darkness:0,blur:0,saturation:100,x:50,y:50};syncImageUI()});
  syncImageUI();
}
function syncImageUI(){const b=state.bg;$('#imageFit').value=b.fit;[['imageOpacity','opacity','%'],['imageZoom','zoom','%'],['imageDarkness','darkness','%'],['imageBlur','blur','px'],['imageSaturation','saturation','%']].forEach(([id,key,suf])=>{$('#'+id).value=b[key];$('#'+id+'Value').textContent=b[key]+suf})}

function initTextUI(){renderTextCards();$('#addText').addEventListener('click',()=>{if(state.texts.length>=10){toast('Maximum 10 text layers');return}state.texts.push({id:'extra'+Date.now(),label:'Extra Text',text:'Extra Text',font:'calligraphy',size:42,color:'#3b342b',opacity:90,x:50,y:70,show:true,react:false,strength:5});renderTextCards()})}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function renderTextCards(){
  const list=$('#textList');list.innerHTML=state.texts.map((t,i)=>`<div class="text-card" data-index="${i}"><header><strong>${esc(t.label)}</strong><div><label style="display:inline-flex;align-items:center;gap:5px;margin:0 8px 0 0"><input data-k="show" type="checkbox" ${t.show?'checked':''}> Show</label>${i>1?'<button class="delete-text" type="button" title="Delete">×</button>':''}</div></header><label>Text<input data-k="text" type="text" value="${esc(t.text)}"></label><div class="row"><label>Font<select data-k="font">${fontOptions.map(([v,n])=>`<option value="${v}" ${t.font===v?'selected':''}>${n}</option>`).join('')}</select></label><label>Color<input data-k="color" type="color" value="${t.color}" style="width:100%;height:35px;margin-top:5px;background:#0a0f11;border:1px solid #2a3034;border-radius:8px"></label><label>Size <span>${t.size}</span><input data-k="size" class="range" type="range" min="14" max="160" value="${t.size}"></label><label>Opacity <span>${t.opacity}%</span><input data-k="opacity" class="range" type="range" min="5" max="100" value="${t.opacity}"></label><label>React to music<select data-k="react"><option value="false" ${!t.react?'selected':''}>Off</option><option value="true" ${t.react?'selected':''}>Pulse</option></select></label><label>Pulse strength <span>${t.strength}%</span><input data-k="strength" class="range" type="range" min="0" max="30" value="${t.strength}"></label></div></div>`).join('');
}
$('#textList').addEventListener('input',e=>{const card=e.target.closest('.text-card');if(!card)return;const t=state.texts[+card.dataset.index],k=e.target.dataset.k;if(!k)return;if(k==='show')t.show=e.target.checked;else if(k==='react')t.react=e.target.value==='true';else if(['size','opacity','strength'].includes(k))t[k]=+e.target.value;else t[k]=e.target.value;if(k==='text'&&t.id==='song')$('#previewTitle').textContent=t.text||'Untitled';if(e.target.type==='range')e.target.parentElement.querySelector('span').textContent=e.target.value+(k==='opacity'||k==='strength'?'%':'')});
$('#textList').addEventListener('change',e=>{if(e.target.dataset.k==='react'){const card=e.target.closest('.text-card');state.texts[+card.dataset.index].react=e.target.value==='true'}});
$('#textList').addEventListener('click',e=>{if(!e.target.classList.contains('delete-text'))return;const card=e.target.closest('.text-card');state.texts.splice(+card.dataset.index,1);renderTextCards()});

async function ensureAudioGraph(){
  if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();sourceNode=audioCtx.createMediaElementSource(audio);analyser=audioCtx.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=state.wave.smoothing/100;mediaDest=audioCtx.createMediaStreamDestination();sourceNode.connect(analyser);analyser.connect(audioCtx.destination);sourceNode.connect(mediaDest);freqData=new Uint8Array(analyser.frequencyBinCount)}
  if(audioCtx.state==='suspended')await audioCtx.resume();
}
function initAudioUI(){
  $('#audioFile').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=URL.createObjectURL(f);audio.src=audioUrl;audio.load();$('#audioName').textContent=f.name;$('#analysisLabel').textContent='Loading…';$('#statusAudio').textContent='AUDIO LOADED';audio.addEventListener('loadedmetadata',()=>{$('#durationLabel').textContent=fmt(audio.duration);$('#analysisLabel').textContent='Ready · live FFT';updateTimeline()}, {once:true})});
  const play=async()=>{if(!audio.src){toast('Upload audio first');return}await ensureAudioGraph();if(audio.paused){await audio.play()}else audio.pause()};
  $('#playBtn').addEventListener('click',play);$('#timelinePlay').addEventListener('click',play);
  const restart=()=>{if(!audio.src)return;audio.currentTime=0;manualTime=0};$('#restartBtn').addEventListener('click',restart);$('#timelineRestart').addEventListener('click',restart);
  const seek=e=>{if(!Number.isFinite(audio.duration))return;audio.currentTime=(+e.target.value/1000)*audio.duration;manualTime=audio.currentTime};$('#audioSeek').addEventListener('input',seek);$('#timelineSeek').addEventListener('input',seek);
}

function energy(){
  if(!analyser||audio.paused||audio.ended)return{bass:0,mid:0,treble:0,beat:0,bins:null};analyser.getByteFrequencyData(freqData);
  const avg=(a,b)=>{let s=0,n=0;for(let i=a;i<b&&i<freqData.length;i++){s+=freqData[i];n++}return n?s/n/255:0};
  const bass=avg(1,18),mid=avg(18,90),treble=avg(90,260),beat=clamp((bass-lastBass)*5.2,0,1);lastBass=lerp(lastBass,bass,.35);return{bass,mid,treble,beat,bins:freqData};
}

function drawBackground(){
  const w=canvas.width,h=canvas.height,b=state.bg;ctx.save();
  const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#d7d8cf');g.addColorStop(.55,'#bec1b6');g.addColorStop(1,'#92978d');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  ctx.fillStyle='rgba(53,62,58,.08)';for(let l=0;l<4;l++){ctx.beginPath();ctx.moveTo(0,h);for(let i=0;i<=9;i++){const q=i/9;ctx.lineTo(q*w,h*(.32+l*.11)+Math.sin(q*7+l)*h*.035)}ctx.lineTo(w,h);ctx.closePath();ctx.fill()}
  if(state.image){
    const img=state.image,fit=b.fit,base=fit==='contain'?Math.min(w/img.width,h/img.height):Math.max(w/img.width,h/img.height),k=base*(b.zoom/100),iw=img.width*k,ih=img.height*k,ox=(w-iw)*(b.x/100),oy=(h-ih)*(b.y/100);
    ctx.save();ctx.globalAlpha=b.opacity/100;ctx.filter=`blur(${b.blur}px) saturate(${b.saturation}%)`;ctx.drawImage(img,ox,oy,iw,ih);ctx.restore();
  }
  if(b.darkness){ctx.fillStyle=`rgba(0,0,0,${b.darkness/100})`;ctx.fillRect(0,0,w,h)}ctx.restore();
}
function sampleBackgroundColor(){
  if(!state.image)return'#d9c69a';try{const o=document.createElement('canvas');o.width=o.height=40;const q=o.getContext('2d');q.drawImage(state.image,0,0,40,40);const d=q.getImageData(0,0,40,40).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=32){r+=d[i];g+=d[i+1];b+=d[i+2];n++}r/=n;g/=n;b/=n;const lum=(r+g+b)/765,m=lum>.56?.52:1.55;return'#'+[r,g,b].map(v=>clamp(Math.round(v*m),25,225).toString(16).padStart(2,'0')).join('')}catch{return'#d9c69a'}
}
function rgba(hex,a){const s=hex.replace('#','');const n=parseInt(s,16);return`rgba(${n>>16},${n>>8&255},${n&255},${a})`}

function polygonVertices(shape){let n=0,rot=-Math.PI/2;if(shape==='triangle')n=3;if(shape==='square')n=4;if(shape==='diamond'){n=4;rot=0}if(shape==='pentagon')n=5;if(shape==='hexagon')n=6;if(shape==='octagon')n=8;if(!n)return null;return Array.from({length:n},(_,i)=>({x:Math.cos(rot+i*Math.PI*2/n),y:Math.sin(rot+i*Math.PI*2/n)}))}
function shapePoint(shape,t,r){
  const a=t*Math.PI*2-Math.PI/2;if(shape==='circle')return{x:Math.cos(a)*r,y:Math.sin(a)*r};
  if(shape==='lotus'){const rr=r*(.8+.2*Math.abs(Math.sin(a*4)));return{x:Math.cos(a)*rr,y:Math.sin(a)*rr}}
  if(shape==='blob'){const rr=r*(.9+.055*Math.sin(a*3+1.1)+.045*Math.sin(a*7+2.7)+.025*Math.sin(a*13));return{x:Math.cos(a)*rr,y:Math.sin(a)*rr}}
  if(shape==='star'){const count=10,u=(t*count)%1,i=Math.floor(t*count),aa=-Math.PI/2+i*Math.PI*2/count,ab=-Math.PI/2+(i+1)*Math.PI*2/count,ra=i%2===0?r:r*.48,rb=(i+1)%2===0?r:r*.48;return{x:lerp(Math.cos(aa)*ra,Math.cos(ab)*rb,u),y:lerp(Math.sin(aa)*ra,Math.sin(ab)*rb,u)}}
  const v=polygonVertices(shape)||polygonVertices('hexagon'),n=v.length,pos=t*n,i=Math.floor(pos)%n,u=pos-i,p=v[i],q=v[(i+1)%n];return{x:lerp(p.x,q.x,u)*r,y:lerp(p.y,q.y,u)*r};
}
function binAt(r,i,n){if(!r.bins)return 0;const idx=Math.floor((i/n)*Math.min(r.bins.length,280));return(r.bins[idx]||0)/255}
function drawShapePath(cx,cy,r,react,rough=0){const N=160;ctx.beginPath();for(let i=0;i<=N;i++){const t=(i%N)/N,p=shapePoint(state.wave.shape,t,r),b=binAt(react,i,N),amp=(b*.72+react.bass*.2+react.beat*.25)*(state.wave.reaction/100),m=1+amp*.12+(rough?Math.sin(i*2.31)*rough*.01:0),x=cx+p.x*m,y=cy+p.y*m;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()}
function waveCenter(){return{x:canvas.width*state.wave.x/100,y:canvas.height*state.wave.y/100,r:Math.min(canvas.width,canvas.height)*state.wave.size/100*.5}}
function drawPlate(cx,cy,r,react){if(!state.wave.showPlate)return;ctx.save();drawShapePath(cx,cy,r*.92,react,0);ctx.fillStyle=rgba(state.wave.color,.09*(state.wave.opacity/100));ctx.fill();ctx.strokeStyle=rgba(state.wave.color,.28*(state.wave.opacity/100));ctx.lineWidth=Math.max(2,state.wave.thickness*.6);ctx.stroke();ctx.restore()}
function strokeSetup(mult=1){ctx.strokeStyle=rgba(state.wave.color,state.wave.opacity/100);ctx.fillStyle=rgba(state.wave.color,state.wave.opacity/100);ctx.lineWidth=state.wave.thickness*mult;ctx.lineJoin='round';ctx.lineCap='round';if(state.wave.showGlow&&state.wave.glow){ctx.shadowColor=state.wave.color;ctx.shadowBlur=state.wave.glow*.34}}
function drawWaveform(r){if(!state.wave.showWave)return;const w=state.wave,{x:cx,y:cy,r:rad}=waveCenter(),react=r;ctx.save();strokeSetup();drawPlate(cx,cy,rad,react);
  if(w.style==='brushRing'||w.style==='smoothRing'){
    if(w.showSecondary){drawShapePath(cx,cy,rad*.78,react,w.style==='brushRing'?.9:0);ctx.globalAlpha=.35;ctx.lineWidth=Math.max(1,w.thickness*.55);ctx.stroke();ctx.globalAlpha=1}
    drawShapePath(cx,cy,rad,react,w.style==='brushRing'?1.6:0);ctx.stroke();if(w.style==='brushRing'){ctx.globalAlpha=.34;ctx.lineWidth=Math.max(1,w.thickness*.45);drawShapePath(cx,cy,rad*1.018,react,.8);ctx.stroke()}
  }else if(w.style==='radial'||w.style==='orbit'){
    const N=96;for(let i=0;i<N;i++){const t=i/N,p=shapePoint(w.shape,t,rad),b=binAt(react,i,N),len=rad*(.035+b*.18*(w.reaction/100)+react.beat*.045),mag=Math.hypot(p.x,p.y)||1,nx=p.x/mag,ny=p.y/mag;if(w.style==='radial'){ctx.beginPath();ctx.moveTo(cx+p.x,cy+p.y);ctx.lineTo(cx+p.x+nx*len,cy+p.y+ny*len);ctx.stroke()}else{ctx.beginPath();ctx.arc(cx+p.x+nx*len*.5,cy+p.y+ny*len*.5,Math.max(2,w.thickness*(.65+b*.6)),0,Math.PI*2);ctx.fill()}}
  }else if(w.style==='centerLine'||w.style==='mountain'){
    const width=canvas.width*w.size/100,baseY=cy,N=150;ctx.beginPath();for(let i=0;i<N;i++){const q=i/(N-1),b=binAt(react,i,N),amp=(b*.85+react.bass*.15)*(w.reaction/100),yy=baseY-(w.style==='mountain'?Math.abs(Math.sin(q*Math.PI))*1:Math.sin(q*Math.PI*8))*(amp*canvas.height*.13);const xx=cx-width/2+q*width;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)}ctx.stroke();
  }else drawEdgeWave(react);
  ctx.restore();
}
function drawEdgeWave(r){const s=state.wave.style,N=120,w=canvas.width,h=canvas.height,margin=Math.min(w,h)*.035,spanH=h*.58,spanW=w*.88,reactScale=state.wave.reaction/100;
  const line=(side)=>{ctx.beginPath();for(let i=0;i<N;i++){const q=i/(N-1),b=binAt(r,i,N),a=(b*.8+r.bass*.18+r.beat*.16)*reactScale;let x,y;if(side==='bottom'||side==='top'){x=w*.06+q*spanW;const base=side==='bottom'?h-margin:margin;y=base+(side==='bottom'?-1:1)*a*h*.085}else{y=h*.2+q*spanH;const base=side==='left'?margin:w-margin;x=base+(side==='left'?1:-1)*a*w*.055}i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke()};
  if(s==='bottom'||s==='top'||s==='left'||s==='right')line(s);else if(s==='dual'){line('top');line('bottom')}else if(s==='sides'){line('left');line('right')}
}
function drawTexts(r){textBoxes=[];const base=Math.min(canvas.width,canvas.height);state.texts.forEach((t,i)=>{if(!t.show||!t.text)return;const pulse=t.react?1+(r.bass*.62+r.beat*.65)*(t.strength/100):1,size=base*(t.size/1000)*pulse,x=canvas.width*t.x/100,y=canvas.height*t.y/100;ctx.save();ctx.font=`600 ${size}px ${fonts[t.font]||fonts.sans}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=t.opacity/100;ctx.fillStyle=t.color;if(t.react&&state.wave.showGlow){ctx.shadowColor=t.color;ctx.shadowBlur=(r.beat+r.bass)*size*.14}ctx.fillText(t.text,x,y);const m=ctx.measureText(t.text),hh=size*1.25;textBoxes.push({i,x:x-m.width/2,y:y-hh/2,w:m.width,h:hh});ctx.restore()})}
function render(){const r=energy();ctx.clearRect(0,0,canvas.width,canvas.height);drawBackground();drawWaveform(r);drawTexts(r);requestAnimationFrame(render)}

function canvasPoint(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*canvas.width,y:(e.clientY-r.top)/r.height*canvas.height}}
canvas.addEventListener('pointerdown',e=>{const p=canvasPoint(e);if(state.tool==='image'&&state.image){imageDrag={sx:e.clientX,sy:e.clientY,x:state.bg.x,y:state.bg.y};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';return}if(state.tool==='waveform'&&!isEdgeStyle()){waveDrag={};canvas.setPointerCapture(e.pointerId);state.wave.x=clamp(p.x/canvas.width*100,3,97);state.wave.y=clamp(p.y/canvas.height*100,3,97);return}if(state.tool==='text'){const hit=[...textBoxes].reverse().find(b=>p.x>=b.x-14&&p.x<=b.x+b.w+14&&p.y>=b.y-12&&p.y<=b.y+b.h+12);if(hit){textDrag={i:hit.i};canvas.setPointerCapture(e.pointerId)}}});
canvas.addEventListener('pointermove',e=>{if(imageDrag){const r=canvas.getBoundingClientRect();state.bg.x=clamp(imageDrag.x-(e.clientX-imageDrag.sx)/r.width*100,0,100);state.bg.y=clamp(imageDrag.y-(e.clientY-imageDrag.sy)/r.height*100,0,100)}else if(waveDrag){const p=canvasPoint(e);state.wave.x=clamp(p.x/canvas.width*100,3,97);state.wave.y=clamp(p.y/canvas.height*100,3,97)}else if(textDrag){const p=canvasPoint(e),t=state.texts[textDrag.i];t.x=clamp(p.x/canvas.width*100,2,98);t.y=clamp(p.y/canvas.height*100,2,98)}});
canvas.addEventListener('pointerup',e=>{imageDrag=waveDrag=textDrag=null;canvas.style.cursor=state.tool==='image'?'grab':state.tool==='waveform'&&!isEdgeStyle()?'move':'default'});canvas.addEventListener('pointercancel',()=>{imageDrag=waveDrag=textDrag=null});
canvas.addEventListener('wheel',e=>{if(state.tool==='image'&&state.image){e.preventDefault();state.bg.zoom=clamp(state.bg.zoom+(e.deltaY<0?8:-8),50,300);$('#imageZoom').value=state.bg.zoom;$('#imageZoomValue').textContent=Math.round(state.bg.zoom)+'%'}else if(state.tool==='waveform'&&!isEdgeStyle()){e.preventDefault();state.wave.size=clamp(state.wave.size+(e.deltaY<0?2:-2),12,85);syncWaveUI()}},{passive:false});

function updateTimeline(){const d=Number.isFinite(audio.duration)?audio.duration:0,t=Number.isFinite(audio.currentTime)?audio.currentTime:manualTime,q=d?t/d:0;$('#playBtn').textContent=audio.paused?'Play':'Pause';$('#timelinePlay').textContent=audio.paused?'▶':'Ⅱ';$('#audioSeek').value=Math.round(q*1000);$('#timelineSeek').value=Math.round(q*1000);$('#timelineTime').textContent=fmt(t)+' / '+fmt(d);$('#playhead').style.left=`calc(70px + ${(q*100).toFixed(2)}% * .93)`;requestAnimationFrame(updateTimeline)}

async function exportFullTrack(){
  if(exporting){toast('Export already running');return}if(!audio.src||!Number.isFinite(audio.duration)){toast('Upload audio first');return}
  if(!window.MediaRecorder){toast('MediaRecorder is not supported');return}await ensureAudioGraph();exporting=true;$('#exportBtn').disabled=true;$('#exportBtn').textContent='Exporting…';
  const video=canvas.captureStream(30),stream=new MediaStream([...video.getVideoTracks(),...mediaDest.stream.getAudioTracks()]);let mime='video/webm';for(const m of['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'])if(MediaRecorder.isTypeSupported(m)){mime=m;break}
  exportChunks=[];exportRecorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:10000000});exportRecorder.ondataavailable=e=>{if(e.data.size)exportChunks.push(e.data)};exportRecorder.onstop=()=>{const blob=new Blob(exportChunks,{type:mime}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='freewaveform-'+Date.now()+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);exporting=false;$('#exportBtn').disabled=false;$('#exportBtn').textContent='Export WebM';toast('Export finished')};
  const wasTime=audio.currentTime;audio.pause();audio.currentTime=0;await new Promise(r=>setTimeout(r,120));exportRecorder.start(1000);await audio.play();const stop=()=>{if(exportRecorder&&exportRecorder.state!=='inactive')exportRecorder.stop();audio.removeEventListener('ended',stop);audio.currentTime=wasTime;audio.pause()};audio.addEventListener('ended',stop,{once:true});toast('Recording full track in real time');
}
$('#exportBtn').addEventListener('click',exportFullTrack);

$('#resetProject').addEventListener('click',()=>{state.bg={fit:'cover',opacity:100,zoom:100,darkness:0,blur:0,saturation:100,x:50,y:50};state.image=null;if(state.imageUrl)URL.revokeObjectURL(state.imageUrl);state.imageUrl='';$('#imageName').textContent='Optional';state.wave={template:'ink',style:'brushRing',shape:'circle',size:46,thickness:4,opacity:78,smoothing:72,reaction:100,glow:16,color:'#e5d3a6',showWave:true,showPlate:false,showGlow:true,showSecondary:false,x:50,y:50};state.texts=[{id:'song',label:'Song Name',text:'SONG TITLE',font:'serifCN',size:72,color:'#2c2925',opacity:100,x:50,y:46,show:true,react:true,strength:6},{id:'artist',label:'Artist / Channel',text:'ARTIST NAME',font:'sans',size:28,color:'#403b34',opacity:82,x:50,y:58,show:true,react:false,strength:4}];syncImageUI();syncWaveUI();renderTextCards();$('#previewTitle').textContent='Untitled';toast('Project reset')});

initAudioUI();initImageUI();initWaveUI();initTextUI();setRatio('16:9');switchTool('audio');updateTimeline();render();
})();
