(()=>{
'use strict';

const canvas=document.getElementById('canvas');
const panel=document.querySelector('[data-panel="waveform"]');
if(!canvas||!panel)return;
const ctx=canvas.getContext('2d');
const audio=document.getElementById('audio');
const MAX_WAVES=5;
const EDGE=new Set(['bottom','top','dual','left','right','sides']);
const ROUNDISH=new Set(['brushRing','smoothRing','radial','orbit']);
const PER_LAYER_IDS=new Set(['waveStyle','waveShape','waveReaction','beatPunch','beatSensitivity','waveSmoothing','waveGlow','waveSize','waveThickness','waveOpacity','waveDetail','toothDepth','waveSharpness','waveColor','showWave','showPlate','showGlow','showSecondary']);
const rangeMeta={
  waveReaction:['reaction','%','waveReactionValue'],beatPunch:['beatPunch','%','beatPunchValue'],beatSensitivity:['beatSensitivity','%','beatSensitivityValue'],waveSmoothing:['smoothing','%','waveSmoothingValue'],waveGlow:['glow','%','waveGlowValue'],
  waveSize:['size','%','waveSizeValue'],waveThickness:['thickness','','waveThicknessValue'],waveOpacity:['opacity','%','waveOpacityValue'],waveDetail:['detail','','waveDetailValue'],toothDepth:['toothDepth','%','toothDepthValue'],waveSharpness:['sharpness','%','waveSharpnessValue']
};
const styleIcons={brushRing:'◯',smoothRing:'◎',radial:'✺',orbit:'••',centerLine:'∿',mountain:'⌁',bottom:'▁',top:'▔',dual:'═',left:'▏',right:'▕',sides:'↔'};
const shapeIcons={circle:'○',triangle:'△',square:'□',diamond:'◇',pentagon:'⬠',hexagon:'⬡',octagon:'⯃',star:'★',lotus:'✿',blob:'◌'};
const builtinTemplates={
  ink:{template:'ink',style:'brushRing',shape:'circle',size:46,thickness:4,opacity:78,reaction:145,beatPunch:145,detail:104,toothDepth:55,sharpness:58,glow:8,showPlate:false,showSecondary:false},
  fine:{template:'fine',style:'brushRing',shape:'circle',size:47,thickness:3,opacity:82,reaction:185,beatPunch:175,detail:176,toothDepth:110,sharpness:78,glow:12,showPlate:false,showSecondary:false},
  razor:{template:'razor',style:'radial',shape:'circle',size:47,thickness:2,opacity:88,reaction:235,beatPunch:220,detail:216,toothDepth:165,sharpness:90,glow:18,showPlate:false,showSecondary:false},
  lotus:{template:'lotus',style:'smoothRing',shape:'lotus',size:48,thickness:3,opacity:74,reaction:150,beatPunch:155,detail:112,toothDepth:45,sharpness:45,glow:14,showPlate:false,showSecondary:true},
  seal:{template:'seal',style:'brushRing',shape:'diamond',size:43,thickness:5,opacity:82,reaction:165,beatPunch:170,detail:72,toothDepth:35,sharpness:72,glow:6,showPlate:true,showSecondary:false},
  spectrum:{template:'spectrum',style:'radial',shape:'circle',size:48,thickness:3,opacity:84,reaction:220,beatPunch:185,detail:144,toothDepth:125,sharpness:76,glow:20,showPlate:false,showSecondary:false},
  mountain:{template:'mountain',style:'mountain',shape:'circle',size:58,thickness:4,opacity:80,reaction:190,beatPunch:150,detail:144,toothDepth:90,sharpness:68,glow:8,showPlate:false,showSecondary:false},
  bottom:{template:'bottom',style:'bottom',shape:'circle',size:72,thickness:4,opacity:84,reaction:200,beatPunch:170,detail:160,toothDepth:100,sharpness:72,glow:10,showPlate:false,showSecondary:false},
  dual:{template:'dual',style:'dual',shape:'circle',size:72,thickness:3,opacity:75,reaction:190,beatPunch:170,detail:160,toothDepth:95,sharpness:70,glow:8,showPlate:false,showSecondary:false},
  sides:{template:'sides',style:'sides',shape:'circle',size:66,thickness:4,opacity:80,reaction:205,beatPunch:175,detail:128,toothDepth:105,sharpness:76,glow:12,showPlate:false,showSecondary:false},
  star:{template:'star',style:'smoothRing',shape:'star',size:45,thickness:3,opacity:76,reaction:180,beatPunch:200,detail:96,toothDepth:65,sharpness:64,glow:18,showPlate:false,showSecondary:true}
};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const el=id=>document.getElementById(id);
function notify(text){const t=el('toast');if(!t)return;t.textContent=text;t.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>t.classList.remove('show'),1800)}
function nowId(){return'wave_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6)}
function num(id,fallback=0){const e=el(id);return e?+e.value:fallback}
function checked(id,fallback=false){const e=el(id);return e?!!e.checked:fallback}

function captureDom(base={}){
  return{
    ...base,
    style:el('waveStyle')?.value||base.style||'brushRing',shape:el('waveShape')?.value||base.shape||'circle',
    reaction:num('waveReaction',130),beatPunch:num('beatPunch',150),beatSensitivity:num('beatSensitivity',135),smoothing:num('waveSmoothing',55),glow:num('waveGlow',16),
    size:num('waveSize',46),thickness:num('waveThickness',4),opacity:num('waveOpacity',78),detail:num('waveDetail',128),toothDepth:num('toothDepth',80),sharpness:num('waveSharpness',70),
    color:el('waveColor')?.value||base.color||'#e5d3a6',showWave:checked('showWave',true),showPlate:checked('showPlate'),showGlow:checked('showGlow',true),showSecondary:checked('showSecondary'),
    x:Number.isFinite(+base.x)?+base.x:50,y:Number.isFinite(+base.y)?+base.y:50
  };
}
function setControlValue(id,value){const e=el(id);if(!e||value===undefined)return;if(e.type==='checkbox')e.checked=!!value;else e.value=value}
function applyDom(w){
  setControlValue('waveStyle',w.style);setControlValue('waveShape',w.shape);
  Object.entries(rangeMeta).forEach(([id,[key,suf,out]])=>{setControlValue(id,w[key]);if(el(out))el(out).textContent=w[key]+suf});
  setControlValue('waveColor',w.color);['showWave','showPlate','showGlow','showSecondary'].forEach(id=>setControlValue(id,w[id]));
  if(el('waveStyleIcon'))el('waveStyleIcon').textContent=styleIcons[w.style]||'≋';
  if(el('waveShapeIcon'))el('waveShapeIcon').textContent=shapeIcons[w.shape]||'○';
  if(el('waveShape'))el('waveShape').disabled=EDGE.has(w.style);
  if(el('waveMoveHint'))el('waveMoveHint').textContent=EDGE.has(w.style)?'This edge waveform is locked to the canvas edge.':'Select or drag this waveform directly in the preview.';
}

let layers=[{id:nowId(),name:'Wave 1',...captureDom({x:50,y:50})}];
let activeIndex=0;
let root=null;
let passCore=false;
function active(){return layers[activeIndex]||layers[0]}

// The original renderer remains responsible for audio analysis/background/text.
// Wave rendering is owned here so every layer, including Wave 1, has a direct position API.
function hideCoreWave(){
  const input=el('showWave');if(!input)return;
  const visual=active()?.showWave!==false;
  passCore=true;input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));passCore=false;
  input.checked=visual;
}
hideCoreWave();
applyDom(active());

function layerSubtitle(w){
  const s=el('waveStyle')?.querySelector(`option[value="${w.style}"]`)?.textContent?.trim().replace(/^\S+\s+/,'')||w.style;
  const sh=EDGE.has(w.style)?'Edge':(el('waveShape')?.querySelector(`option[value="${w.shape}"]`)?.textContent?.trim().replace(/^\S+\s+/,'')||w.shape);
  return`${s} · ${sh}`;
}
function renderLayerList(){
  if(!root)return;
  root.querySelector('.mw-count').textContent=layers.length+' / '+MAX_WAVES;
  root.querySelector('.mw-list').innerHTML=layers.map((w,i)=>`<div class="mw-item ${i===activeIndex?'active':''}" data-i="${i}"><button class="mw-select" type="button"><span class="mw-icon">${styleIcons[w.style]||'≋'}</span><span class="mw-copy"><b>${w.name}</b><small>${layerSubtitle(w)}</small></span></button><button class="mw-eye ${w.showWave?'on':''}" type="button" title="Show / hide">${w.showWave?'●':'○'}</button>${i===0?'<span class="mw-lock" title="Primary waveform">P</span>':'<button class="mw-delete" type="button" title="Delete">×</button>'}</div>`).join('');
  root.querySelector('.mw-add').disabled=layers.length>=MAX_WAVES;
}
function selectLayer(i,{notifyUser=false}={}){
  i=clamp(+i||0,0,layers.length-1);activeIndex=i;applyDom(active());renderLayerList();
  if(notifyUser)notify(active().name+' selected');return activeIndex;
}
function addLayer(source){
  if(layers.length>=MAX_WAVES){notify('Maximum '+MAX_WAVES+' waveform layers');return-1}
  const src=source?{...source}:{...active()};
  const w={...src,id:nowId(),name:'Wave '+(layers.length+1),x:Number.isFinite(+src.x)?+src.x:50,y:Number.isFinite(+src.y)?+src.y:50};
  layers.push(w);selectLayer(layers.length-1);renderLayerList();return activeIndex;
}
function duplicateLayer(){const i=addLayer(active());if(i>=0)notify('Waveform duplicated')}
function deleteLayer(i){
  i=+i;if(i<=0||i>=layers.length)return false;layers.splice(i,1);if(activeIndex===i)activeIndex=0;else if(activeIndex>i)activeIndex--;selectLayer(activeIndex);notify('Waveform removed');return true;
}

function mount(){
  if(document.querySelector('.multi-wave-card')){root=document.querySelector('.multi-wave-card');return}
  const templateCard=el('templateGrid')?.closest('.card');if(!templateCard)return;
  root=document.createElement('div');root.className='card multi-wave-card';
  root.innerHTML=`<div class="card-title"><div><strong>Wave Layers</strong><small>Select and arrange directly on preview</small></div><span class="badge mw-count">1 / ${MAX_WAVES}</span></div><div class="mw-actions"><button class="button accent mw-add" type="button">+ Add waveform</button><button class="button mw-duplicate" type="button">Duplicate</button></div><div class="mw-list"></div><p class="hint">Wave layers are independent objects. Edge waves stay locked to their canvas edge.</p>`;
  templateCard.parentNode.insertBefore(root,templateCard);
  const st=document.createElement('style');st.textContent=`
  .multi-wave-card{margin-bottom:12px}.mw-actions{display:flex;gap:6px;margin-bottom:8px}.mw-list{display:grid;gap:6px}.mw-item{display:grid;grid-template-columns:minmax(0,1fr) 32px 32px;gap:5px;align-items:stretch}.mw-item.active .mw-select{border-color:#9a6c39;background:#18130e;box-shadow:0 0 0 1px rgba(217,169,95,.11) inset}.mw-select{min-width:0;height:46px;border:1px solid #293034;border-radius:9px;background:#0c1113;color:#ddd3c5;display:flex;align-items:center;gap:9px;padding:0 10px;text-align:left;cursor:pointer}.mw-select:hover{border-color:#5f4a32}.mw-icon{width:24px;height:24px;border:1px solid #574228;background:#1a160f;color:#d9a95f;border-radius:7px;display:grid;place-items:center;flex:none;font-size:11px}.mw-copy{min-width:0;display:flex;flex-direction:column;gap:2px}.mw-copy b{font-size:10px}.mw-copy small{font-size:8px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mw-eye,.mw-delete,.mw-lock{height:46px;border:1px solid #293034;border-radius:9px;background:#0c1113;color:#777;display:grid;place-items:center}.mw-eye{cursor:pointer;font-size:10px}.mw-eye.on{color:#d9a95f}.mw-delete{cursor:pointer;font-size:15px}.mw-lock{font-size:8px;font-weight:700;color:#92744e}`;
  document.head.appendChild(st);
  root.querySelector('.mw-add').addEventListener('click',()=>addLayer());
  root.querySelector('.mw-duplicate').addEventListener('click',duplicateLayer);
  root.querySelector('.mw-list').addEventListener('click',e=>{
    const item=e.target.closest('.mw-item');if(!item)return;const i=+item.dataset.i;
    if(e.target.closest('.mw-delete')){deleteLayer(i);return}
    if(e.target.closest('.mw-eye')){layers[i].showWave=!layers[i].showWave;if(i===activeIndex)setControlValue('showWave',layers[i].showWave);renderLayerList();return}
    if(e.target.closest('.mw-select'))selectLayer(i,{notifyUser:true});
  });
  renderLayerList();
}
mount();

// Keep the active layer in sync with existing controls while preventing core Wave 1 from reappearing.
document.addEventListener('input',e=>{
  const id=e.target?.id;if(!PER_LAYER_IDS.has(id))return;
  const w=active();
  if(rangeMeta[id]){const [key,suf,out]=rangeMeta[id];w[key]=+e.target.value;if(el(out))el(out).textContent=e.target.value+suf}
  else if(id==='waveColor')w.color=e.target.value;
  renderLayerList();
},true);
document.addEventListener('change',e=>{
  const id=e.target?.id;if(passCore||!PER_LAYER_IDS.has(id))return;
  const w=active();
  if(id==='waveStyle'){w.style=e.target.value;if(el('waveStyleIcon'))el('waveStyleIcon').textContent=styleIcons[w.style]||'≋';if(el('waveShape'))el('waveShape').disabled=EDGE.has(w.style);e.stopImmediatePropagation()}
  else if(id==='waveShape'){w.shape=e.target.value;if(el('waveShapeIcon'))el('waveShapeIcon').textContent=shapeIcons[w.shape]||'○';e.stopImmediatePropagation()}
  else if(['showWave','showPlate','showGlow','showSecondary'].includes(id)){w[id]=!!e.target.checked;e.stopImmediatePropagation()}
  renderLayerList();
},true);

// Built-in templates are applied to whichever layer is active.
document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-template]');if(!b)return;
  const t=builtinTemplates[b.dataset.template];if(!t)return;
  e.preventDefault();e.stopImmediatePropagation();Object.assign(active(),t);applyDom(active());renderLayerList();notify((b.textContent||'Template').trim()+' applied');
},true);

document.addEventListener('click',async e=>{
  if(e.target.closest?.('#autoColor')){
    e.preventDefault();e.stopImmediatePropagation();
    try{const d=ctx.getImageData(Math.floor(canvas.width*.5),Math.floor(canvas.height*.5),1,1).data,avg=(d[0]+d[1]+d[2])/3,m=avg>145?.62:1.45;active().color='#'+[d[0],d[1],d[2]].map(v=>clamp(Math.round(v*m),28,225).toString(16).padStart(2,'0')).join('');setControlValue('waveColor',active().color);notify('Wave color sampled')}catch{}
    return;
  }
  if(e.target.closest?.('#pickColor')){
    e.preventDefault();e.stopImmediatePropagation();if(!('EyeDropper'in window)){notify('Eyedropper is not supported');return}
    try{active().color=(await new EyeDropper().open()).sRGBHex;setControlValue('waveColor',active().color);notify('Wave color picked')}catch{}
  }
},true);

// Compatibility for older preset restore code: only synthetic pointer events are accepted here.
canvas.addEventListener('pointerdown',e=>{
  if(e.isTrusted||EDGE.has(active().style))return;
  const r=canvas.getBoundingClientRect();setPosition(activeIndex,(e.clientX-r.left)/r.width*100,(e.clientY-r.top)/r.height*100);e.stopImmediatePropagation();
},true);

document.getElementById('resetProject')?.addEventListener('click',()=>setTimeout(()=>{
  layers=[{id:nowId(),name:'Wave 1',...captureDom({x:50,y:50})}];activeIndex=0;hideCoreWave();applyDom(active());renderLayerList();
},0));

function isMovable(i){const w=layers[i];return!!w&&!EDGE.has(w.style)}
function setPosition(i,x,y){
  const w=layers[i];if(!w||EDGE.has(w.style)||!Number.isFinite(+x)||!Number.isFinite(+y))return false;
  w.x=clamp(+x,3,97);w.y=clamp(+y,3,97);return true;
}
function setSize(i,size){const w=layers[i];if(!w)return false;w.size=clamp(+size||w.size,12,85);if(i===activeIndex)applyDom(w);return true}
function getBounds(i){
  const w=layers[i];if(!w||!w.showWave)return null;const W=canvas.width,H=canvas.height,cx=W*w.x/100,cy=H*w.y/100,m=Math.min(W,H);
  if(w.style==='centerLine'||w.style==='mountain'){const ww=W*w.size/100,hh=H*.26;return{x:cx-ww/2,y:cy-hh/2,w:ww,h:hh,cx,cy}}
  if(w.style==='top')return{x:W*.04,y:0,w:W*.92,h:H*.12,cx:W*.5,cy:H*.06};
  if(w.style==='bottom')return{x:W*.04,y:H*.88,w:W*.92,h:H*.12,cx:W*.5,cy:H*.94};
  if(w.style==='dual')return{x:W*.04,y:0,w:W*.92,h:H,cx:W*.5,cy:H*.5};
  if(w.style==='left')return{x:0,y:H*.14,w:W*.10,h:H*.72,cx:W*.05,cy:H*.5};
  if(w.style==='right')return{x:W*.90,y:H*.14,w:W*.10,h:H*.72,cx:W*.95,cy:H*.5};
  if(w.style==='sides')return{x:0,y:H*.14,w:W,h:H*.72,cx:W*.5,cy:H*.5};
  const rr=m*w.size/100*.5*1.22;return{x:cx-rr,y:cy-rr,w:rr*2,h:rr*2,cx,cy};
}
function hitWave(i,x,y){
  const w=layers[i],b=getBounds(i);if(!w||!b)return false;
  if(w.style==='top')return x>=b.x&&x<=b.x+b.w&&y<=HVal(.11);
  if(w.style==='bottom')return x>=b.x&&x<=b.x+b.w&&y>=canvas.height*.89;
  if(w.style==='dual')return x>=canvas.width*.04&&x<=canvas.width*.96&&(y<=canvas.height*.11||y>=canvas.height*.89);
  if(w.style==='left')return y>=b.y&&y<=b.y+b.h&&x<=canvas.width*.11;
  if(w.style==='right')return y>=b.y&&y<=b.y+b.h&&x>=canvas.width*.89;
  if(w.style==='sides')return y>=b.y&&y<=b.y+b.h&&(x<=canvas.width*.11||x>=canvas.width*.89);
  if(ROUNDISH.has(w.style)){
    const rx=b.w/2,ry=b.h/2,nx=(x-b.cx)/(rx||1),ny=(y-b.cy)/(ry||1),d=Math.hypot(nx,ny);return d>=.48&&d<=1.08;
  }
  return x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;
}
function HVal(q){return canvas.height*q}
function hitTest(x,y){for(let i=layers.length-1;i>=0;i--)if(hitWave(i,x,y))return i;return-1}

// Lightweight audio-reactive renderer used consistently for every wave layer.
function meter(id,scale=1){const v=parseFloat(el(id)?.style.width)||0;return clamp(v/100*scale,0,1.8)}
function audioState(){return{bass:meter('meterBass'),mid:meter('meterMid'),treble:meter('meterTreble'),beat:meter('meterBeat',1.3),time:audio?.currentTime||performance.now()/1000}}
function rgba(hex,a){const s=(hex||'#ffffff').replace('#',''),n=parseInt(s,16)||0xffffff;return`rgba(${n>>16},${n>>8&255},${n&255},${a})`}
function poly(shape){let n=0,rot=-Math.PI/2;if(shape==='triangle')n=3;if(shape==='square')n=4;if(shape==='diamond'){n=4;rot=0}if(shape==='pentagon')n=5;if(shape==='hexagon')n=6;if(shape==='octagon')n=8;if(!n)return null;return Array.from({length:n},(_,i)=>({x:Math.cos(rot+i*Math.PI*2/n),y:Math.sin(rot+i*Math.PI*2/n)}))}
function shapePoint(shape,t,r){const a=t*Math.PI*2-Math.PI/2;if(shape==='circle')return{x:Math.cos(a)*r,y:Math.sin(a)*r};if(shape==='lotus'){const rr=r*(.8+.2*Math.abs(Math.sin(a*4)));return{x:Math.cos(a)*rr,y:Math.sin(a)*rr}}if(shape==='blob'){const rr=r*(.9+.055*Math.sin(a*3+1.1)+.045*Math.sin(a*7+2.7)+.025*Math.sin(a*13));return{x:Math.cos(a)*rr,y:Math.sin(a)*rr}}if(shape==='star'){const count=10,u=(t*count)%1,i=Math.floor(t*count),aa=-Math.PI/2+i*Math.PI*2/count,ab=-Math.PI/2+(i+1)*Math.PI*2/count,ra=i%2===0?r:r*.48,rb=(i+1)%2===0?r:r*.48;return{x:lerp(Math.cos(aa)*ra,Math.cos(ab)*rb,u),y:lerp(Math.sin(aa)*ra,Math.sin(ab)*rb,u)}}const v=poly(shape)||poly('hexagon'),n=v.length,pos=t*n,i=Math.floor(pos)%n,u=pos-i,p=v[i],q=v[(i+1)%n];return{x:lerp(p.x,q.x,u)*r,y:lerp(p.y,q.y,u)*r}}
function pseudoBin(q,r,w){const low=r.bass*Math.pow(1-q,.9),mid=r.mid*Math.pow(Math.sin(Math.PI*q),2),hi=r.treble*Math.pow(q,.8),ripple=.52+.48*Math.abs(Math.sin(q*(29+w.detail*.11)+r.time*(2.2+r.treble*2)));return clamp((low*.8+mid*.65+hi*.55)*ripple+r.beat*.08,0,1.4)}
function setup(w){ctx.strokeStyle=rgba(w.color,w.opacity/100);ctx.fillStyle=rgba(w.color,w.opacity/100);ctx.lineWidth=w.thickness;ctx.lineJoin='round';ctx.lineCap=w.sharpness>82?'butt':'round';if(w.showGlow&&w.glow){ctx.shadowColor=w.color;ctx.shadowBlur=w.glow*.34}}
function punch(r,w){return clamp(r.beat*(w.beatPunch/100),0,3)}
function drawPath(w,r,cx,cy,rad,rough=0){const N=Math.max(160,Math.round(w.detail*2.5)),dep=w.toothDepth/100,p=punch(r,w);ctx.beginPath();for(let i=0;i<=N;i++){const t=(i%N)/N,sp=shapePoint(w.shape,t,rad),b=Math.pow(pseudoBin(t,r,w),lerp(.72,2.2,w.sharpness/100)),tri=1-Math.abs(((t*w.detail)%1)*2-1),tooth=(Math.pow(clamp(tri,0,1),lerp(.7,5.4,w.sharpness/100))-.28)*dep*.06,m=1+clamp(b*(w.reaction/100)+p*.25,0,3)*.095+tooth+(rough?Math.sin(i*2.31)*rough*.01:0),xx=cx+sp.x*m,yy=cy+sp.y*m;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)}ctx.closePath()}
function drawLayer(w,r){
  if(!w.showWave)return;const cx=canvas.width*w.x/100,cy=canvas.height*w.y/100,rad=Math.min(canvas.width,canvas.height)*w.size/100*.5,p=punch(r,w);ctx.save();setup(w);
  if(w.showPlate&&!EDGE.has(w.style)){drawPath(w,r,cx,cy,rad*.92);ctx.fillStyle=rgba(w.color,.08*w.opacity/100);ctx.fill();ctx.strokeStyle=rgba(w.color,.25*w.opacity/100);ctx.lineWidth=Math.max(2,w.thickness*.6);ctx.stroke();setup(w)}
  if(w.style==='brushRing'||w.style==='smoothRing'){
    if(w.showSecondary){drawPath(w,r,cx,cy,rad*.78,w.style==='brushRing'?.7:0);ctx.globalAlpha=.35;ctx.lineWidth=Math.max(1,w.thickness*.55);ctx.stroke();ctx.globalAlpha=1;setup(w)}
    drawPath(w,r,cx,cy,rad,w.style==='brushRing'?1.25:0);ctx.stroke();if(w.style==='brushRing'){ctx.globalAlpha=.28;ctx.lineWidth=Math.max(1,w.thickness*.45);drawPath(w,r,cx,cy,rad*1.018,.65);ctx.stroke()}
  }else if(w.style==='radial'||w.style==='orbit'){
    const N=clamp(Math.round(w.detail),16,256),depth=w.toothDepth/100;for(let i=0;i<N;i++){const t=i/N,sp=shapePoint(w.shape,t,rad),b=pseudoBin(t,r,w),react=clamp(b*(.10+depth*.15)*(w.reaction/100)+p*(.045+depth*.055),0,.9),len=rad*(.018+react),mag=Math.hypot(sp.x,sp.y)||1,nx=sp.x/mag,ny=sp.y/mag;if(w.style==='radial'){ctx.beginPath();ctx.moveTo(cx+sp.x,cy+sp.y);ctx.lineTo(cx+sp.x+nx*len,cy+sp.y+ny*len);ctx.stroke()}else{ctx.beginPath();ctx.arc(cx+sp.x+nx*len*.5,cy+sp.y+ny*len*.5,Math.max(1.5,w.thickness*(.55+b*.8+p*.08)),0,Math.PI*2);ctx.fill()}}
  }else if(w.style==='centerLine'||w.style==='mountain'){
    const width=canvas.width*w.size/100,N=clamp(Math.round(w.detail),32,256),depth=.65+w.toothDepth/100*.55;ctx.beginPath();for(let i=0;i<N;i++){const q=i/(N-1),b=pseudoBin(q,r,w),amp=clamp(((b*.82+r.bass*.12)*(w.reaction/100)+p*.24)*depth,0,3.4),pattern=w.style==='mountain'?Math.abs(Math.sin(q*Math.PI)):Math.sin(q*Math.PI*8),yy=cy-pattern*(amp*canvas.height*.105),xx=cx-width/2+q*width;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)}ctx.stroke();
  }else{
    const N=clamp(Math.round(w.detail),32,256),margin=Math.min(canvas.width,canvas.height)*.035,spanH=canvas.height*.58,spanW=canvas.width*.88,depth=.65+w.toothDepth/100*.6;
    const line=side=>{ctx.beginPath();for(let i=0;i<N;i++){const q=i/(N-1),b=pseudoBin(q,r,w),a=clamp(((b*.78+r.bass*.13)*(w.reaction/100)+p*.22)*depth,0,3.2);let xx,yy;if(side==='bottom'||side==='top'){xx=canvas.width*.06+q*spanW;const base=side==='bottom'?canvas.height-margin:margin;yy=base+(side==='bottom'?-1:1)*a*canvas.height*.075}else{yy=canvas.height*.2+q*spanH;const base=side==='left'?margin:canvas.width-margin;xx=base+(side==='left'?1:-1)*a*canvas.width*.048}i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)}ctx.stroke()};
    if(w.style==='bottom'||w.style==='top'||w.style==='left'||w.style==='right')line(w.style);else if(w.style==='dual'){line('top');line('bottom')}else if(w.style==='sides'){line('left');line('right')}
  }
  ctx.restore();
}
function drawLayers(){const r=audioState();layers.forEach(w=>drawLayer(w,r))}
let drawn=false;
const prevClear=ctx.clearRect.bind(ctx);ctx.clearRect=function(...args){drawn=false;return prevClear(...args)};
const prevFill=ctx.fillText.bind(ctx);ctx.fillText=function(...args){if(!drawn){drawLayers();drawn=true}return prevFill(...args)};
function fallback(){if(!drawn){drawLayers();drawn=true}requestAnimationFrame(fallback)}requestAnimationFrame(fallback);

window.__FW_MULTI_WAVE={
  getLayers:()=>layers.map(x=>({...x})),getActiveIndex:()=>activeIndex,selectLayer,
  setPosition,setSize,getBounds,isMovable,hitTest,
  addLayer:(data)=>addLayer(data),deleteLayer,
  getItems:()=>layers.map((w,index)=>({id:`wave:${index}`,type:'wave',index,name:w.name,movable:isMovable(index),x:w.x,y:w.y,bounds:getBounds(index),style:w.style,showWave:w.showWave})).filter(x=>x.showWave&&x.bounds)
};
})();