(()=>{
'use strict';

const canvas=document.getElementById('canvas');
const panel=document.querySelector('[data-panel="waveform"]');
if(!canvas||!panel)return;
const ctx=canvas.getContext('2d');
const U=window.__FW_UTILS||{};
const clamp=U.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const lerp=U.lerp||((a,b,t)=>a+(b-a)*t);
const validColor=U.validColor||((v,f='#ffffff')=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v).toLowerCase():f);
const notify=window.__FW_TOAST||(()=>{});
const C=window.__FW_WAVE_CONFIG;
if(!C)return;
const {DEFAULT_WAVE,DEFAULT_PLATE,STYLE_OPTIONS,SHAPE_OPTIONS,TEMPLATES,EDGE,ROUNDISH}=C;
const pipeline=window.__FW_RENDER_PIPELINE;
const MAX_WAVES=5;
const el=id=>document.getElementById(id);
const rangeMeta={
  waveReaction:['reaction','%','waveReactionValue'],beatPunch:['beatPunch','%','beatPunchValue'],beatSensitivity:['beatSensitivity','%','beatSensitivityValue'],waveSmoothing:['smoothing','%','waveSmoothingValue'],waveGlow:['glow','%','waveGlowValue'],
  waveSize:['size','%','waveSizeValue'],waveMaxSize:['maxSize','%','waveMaxSizeValue'],waveThickness:['thickness','','waveThicknessValue'],waveOpacity:['opacity','%','waveOpacityValue'],waveDetail:['detail','','waveDetailValue'],toothDepth:['toothDepth','%','toothDepthValue'],waveSharpness:['sharpness','%','waveSharpnessValue']
};
const PER_LAYER_IDS=new Set(['waveStyle','waveShape',...Object.keys(rangeMeta),'waveColor','showWave','showGlow','showSecondary']);
const styleIcons=Object.fromEntries(STYLE_OPTIONS.map(([v,i])=>[v,i]));
const shapeIcons=Object.fromEntries(SHAPE_OPTIONS.map(([v,i])=>[v,i]));
const styleValues=new Set(STYLE_OPTIONS.map(x=>x[0])),shapeValues=new Set(SHAPE_OPTIONS.map(x=>x[0]));

function nowId(){return'wave_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function clonePlate(p){return normalizePlate({...DEFAULT_PLATE,...(p||{})})}
function normalizePlate(p={}){
  return{
    enabled:!!p.enabled,shape:['blob','circle','rounded','diamond','follow'].includes(p.shape)?p.shape:DEFAULT_PLATE.shape,
    tone:['dark','light','auto','custom'].includes(p.tone)?p.tone:DEFAULT_PLATE.tone,
    size:clamp(Number.isFinite(+p.size)?+p.size:DEFAULT_PLATE.size,55,105),opacity:clamp(Number.isFinite(+p.opacity)?+p.opacity:DEFAULT_PLATE.opacity,20,100),
    softness:clamp(Number.isFinite(+p.softness)?+p.softness:DEFAULT_PLATE.softness,0,24),shadow:clamp(Number.isFinite(+p.shadow)?+p.shadow:DEFAULT_PLATE.shadow,0,30),
    color:validColor(p.color,DEFAULT_PLATE.color)
  };
}
function normalizeLayer(w={},index=0,{newId=false}={}){
  const n=(v,d,a,b)=>clamp(Number.isFinite(+v)?+v:d,a,b);
  const size=n(w.size,DEFAULT_WAVE.size,12,85);
  const maxSize=n(w.maxSize,Math.max(DEFAULT_WAVE.maxSize||70,size),size,100);
  return{
    id:!newId&&w.id?String(w.id):nowId(),name:String(w.name||`Wave ${index+1}`).slice(0,30),template:String(w.template||''),
    style:styleValues.has(w.style)?w.style:DEFAULT_WAVE.style,shape:shapeValues.has(w.shape)?w.shape:DEFAULT_WAVE.shape,
    reaction:n(w.reaction,DEFAULT_WAVE.reaction,0,400),beatPunch:n(w.beatPunch,DEFAULT_WAVE.beatPunch,0,300),beatSensitivity:n(w.beatSensitivity,DEFAULT_WAVE.beatSensitivity,50,250),smoothing:n(w.smoothing,DEFAULT_WAVE.smoothing,0,95),glow:n(w.glow,DEFAULT_WAVE.glow,0,100),
    size,maxSize,thickness:n(w.thickness,DEFAULT_WAVE.thickness,1,16),opacity:n(w.opacity,DEFAULT_WAVE.opacity,5,100),detail:n(w.detail,DEFAULT_WAVE.detail,16,256),toothDepth:n(w.toothDepth,DEFAULT_WAVE.toothDepth,0,220),sharpness:n(w.sharpness,DEFAULT_WAVE.sharpness,0,100),
    color:validColor(w.color,DEFAULT_WAVE.color),showWave:w.showWave!==false,showGlow:w.showGlow!==false,showSecondary:!!w.showSecondary,
    x:n(w.x,50,3,97),y:n(w.y,50,3,97),plate:normalizePlate(w.plate||{enabled:!!w.showPlate})
  };
}
function makeDefault(index=0){return normalizeLayer({...DEFAULT_WAVE,name:`Wave ${index+1}`,plate:{...DEFAULT_PLATE}},index,{newId:true})}

let layers=[makeDefault(0)],activeIndex=0,root=null;
function active(){return layers[activeIndex]||layers[0]}
function setControlValue(id,value){const e=el(id);if(!e||value===undefined)return;if(e.type==='checkbox')e.checked=!!value;else e.value=value}
function populateControls(){
  el('waveStyle').innerHTML=STYLE_OPTIONS.map(([v,i,n])=>`<option value="${v}">${i}  ${n}</option>`).join('');
  el('waveShape').innerHTML=SHAPE_OPTIONS.map(([v,i,n])=>`<option value="${v}">${i}  ${n}</option>`).join('');
  const grid=el('templateGrid');grid.innerHTML=Object.entries(TEMPLATES).map(([key,t])=>`<button class="template-card" type="button" data-template="${key}"><b>${t.icon}</b><span>${t.name}</span></button>`).join('');
}
function applyDom(w){
  if(!w)return;setControlValue('waveStyle',w.style);setControlValue('waveShape',w.shape);
  Object.entries(rangeMeta).forEach(([id,[key,suf,out]])=>{setControlValue(id,w[key]);if(el(out))el(out).textContent=w[key]+suf});
  const maxSizeControl=el('waveMaxSize');if(maxSizeControl)maxSizeControl.min=w.size;
  setControlValue('waveColor',w.color);['showWave','showGlow','showSecondary'].forEach(id=>setControlValue(id,w[id]));
  if(el('waveStyleIcon'))el('waveStyleIcon').textContent=styleIcons[w.style]||'≋';if(el('waveShapeIcon'))el('waveShapeIcon').textContent=shapeIcons[w.shape]||'○';
  if(el('waveShape'))el('waveShape').disabled=EDGE.has(w.style);if(el('waveMoveHint'))el('waveMoveHint').textContent=EDGE.has(w.style)?'This edge waveform is locked to the canvas edge.':'Select or drag this waveform directly in the preview.';
}
function layerSubtitle(w){
  const s=STYLE_OPTIONS.find(x=>x[0]===w.style)?.[2]||w.style,sh=EDGE.has(w.style)?'Edge':(SHAPE_OPTIONS.find(x=>x[0]===w.shape)?.[2]||w.shape);return`${s} · ${sh}`;
}
function renderLayerList(){
  if(!root)return;root.querySelector('.mw-count').textContent=layers.length+' / '+MAX_WAVES;
  root.querySelector('.mw-list').innerHTML=layers.map((w,i)=>`<div class="mw-item ${i===activeIndex?'active':''}" data-i="${i}"><button class="mw-select" type="button"><span class="mw-icon">${styleIcons[w.style]||'≋'}</span><span class="mw-copy"><b>${w.name}</b><small>${layerSubtitle(w)}</small></span></button><button class="mw-eye ${w.showWave?'on':''}" type="button" title="Show / hide">${w.showWave?'●':'○'}</button>${i===0?'<span class="mw-lock" title="Primary waveform">P</span>':'<button class="mw-delete" type="button" title="Delete">×</button>'}</div>`).join('');
  root.querySelector('.mw-add').disabled=layers.length>=MAX_WAVES;
}
function mountLayerUI(){
  const templateCard=el('templateGrid')?.closest('.card');if(!templateCard)return false;templateCard.classList.add('compact-templates-card');
  root=document.querySelector('.multi-wave-card');
  if(!root){root=document.createElement('div');root.className='card multi-wave-card';root.innerHTML=`<div class="card-title"><div><strong>Wave Layers</strong><small>Select and arrange directly on preview</small></div><span class="badge mw-count">1 / ${MAX_WAVES}</span></div><div class="mw-actions"><button class="button accent mw-add" type="button">+ Add waveform</button><button class="button mw-duplicate" type="button">Duplicate</button></div><div class="mw-list"></div><p class="hint">Wave layers are independent objects. Edge waves stay locked to their canvas edge.</p>`;templateCard.parentNode.insertBefore(root,templateCard)}
  root.querySelector('.mw-add').addEventListener('click',()=>addLayer());root.querySelector('.mw-duplicate').addEventListener('click',duplicateLayer);
  root.querySelector('.mw-list').addEventListener('click',e=>{const item=e.target.closest('.mw-item');if(!item)return;const i=+item.dataset.i;if(e.target.closest('.mw-delete'))return deleteLayer(i);if(e.target.closest('.mw-eye')){layers[i].showWave=!layers[i].showWave;if(i===activeIndex)setControlValue('showWave',layers[i].showWave);renderLayerList();return}if(e.target.closest('.mw-select'))selectLayer(i,{notifyUser:true})});
  renderLayerList();return true;
}
function selectLayer(i,{notifyUser=false}={}){i=clamp(+i||0,0,layers.length-1);activeIndex=i;applyDom(active());renderLayerList();window.__FW_APP?.updateAnalyserSettings?.();document.dispatchEvent(new CustomEvent('fw:wave-selection-change',{detail:{index:i,layer:{...active(),plate:{...active().plate}}}}));if(notifyUser)notify(active().name+' selected');return activeIndex}
function addLayer(source){if(layers.length>=MAX_WAVES){notify('Maximum '+MAX_WAVES+' waveform layers');return-1}const src=source||active(),w=normalizeLayer({...src,name:'Wave '+(layers.length+1),plate:{...(src.plate||DEFAULT_PLATE)}},layers.length,{newId:true});layers.push(w);selectLayer(layers.length-1);return activeIndex}
function duplicateLayer(){const i=addLayer(active());if(i>=0)notify('Waveform duplicated')}
function deleteLayer(i){i=+i;if(i<=0||i>=layers.length)return false;layers.splice(i,1);if(activeIndex===i)activeIndex=0;else if(activeIndex>i)activeIndex--;layers.forEach((w,n)=>{if(/^Wave \d+$/.test(w.name))w.name='Wave '+(n+1)});selectLayer(activeIndex);notify('Waveform removed');return true}
function applyPresetData(data={},label='Preset'){const w=active(),keepId=w.id,keepName=w.name,{name:_name,icon:_icon,plate:platePatch,...props}=data;const plate=platePatch?normalizePlate({...w.plate,...platePatch}):w.plate;Object.assign(w,props,{id:keepId,name:keepName,plate});w.size=clamp(+w.size||DEFAULT_WAVE.size,12,85);w.maxSize=clamp(Number.isFinite(+w.maxSize)?+w.maxSize:(DEFAULT_WAVE.maxSize||70),w.size,100);applyDom(w);renderLayerList();window.__FW_APP?.updateAnalyserSettings?.();document.dispatchEvent(new CustomEvent('fw:wave-setting-change',{detail:{preset:true}}));notify(label+' applied')}
function applyTemplate(key){const t=TEMPLATES[key];if(!t)return false;active().template=key;applyPresetData({...t,plate:t.plate||{...DEFAULT_PLATE}},t.name);document.querySelectorAll('.template-card').forEach(x=>x.classList.toggle('active',x.dataset.template===key));return true}

populateControls();mountLayerUI();applyDom(active());

el('templateGrid').addEventListener('click',e=>{const b=e.target.closest('[data-template]');if(b&&TEMPLATES[b.dataset.template]){e.preventDefault();e.stopImmediatePropagation();applyTemplate(b.dataset.template)}},true);
document.addEventListener('input',e=>{
  const id=e.target?.id;if(!PER_LAYER_IDS.has(id))return;const w=active();
  if(rangeMeta[id]){const [key,suf,out]=rangeMeta[id];w[key]=+e.target.value;if(key==='size'){w.size=clamp(w.size,12,85);if(w.maxSize<w.size)w.maxSize=w.size;const maxControl=el('waveMaxSize');if(maxControl){maxControl.min=w.size;maxControl.value=w.maxSize}if(el('waveMaxSizeValue'))el('waveMaxSizeValue').textContent=w.maxSize+'%'}else if(key==='maxSize'){w.maxSize=clamp(w.maxSize,w.size,100);e.target.value=w.maxSize}if(el(out))el(out).textContent=w[key]+suf;if(key==='smoothing')window.__FW_APP?.updateAnalyserSettings?.();document.dispatchEvent(new CustomEvent('fw:wave-setting-change',{detail:{key,value:w[key]}}))}
  else if(id==='waveColor'){w.color=e.target.value;document.dispatchEvent(new CustomEvent('fw:wave-setting-change',{detail:{key:'color',value:w.color}}))}
  renderLayerList();
},true);
document.addEventListener('change',e=>{
  const id=e.target?.id;if(!PER_LAYER_IDS.has(id))return;const w=active();
  if(id==='waveStyle'){w.style=e.target.value;if(el('waveStyleIcon'))el('waveStyleIcon').textContent=styleIcons[w.style]||'≋';if(el('waveShape'))el('waveShape').disabled=EDGE.has(w.style)}
  else if(id==='waveShape'){w.shape=e.target.value;if(el('waveShapeIcon'))el('waveShapeIcon').textContent=shapeIcons[w.shape]||'○'}
  else if(['showWave','showGlow','showSecondary'].includes(id))w[id]=!!e.target.checked;
  renderLayerList();document.dispatchEvent(new CustomEvent('fw:wave-setting-change',{detail:{key:id}}));
},true);
document.addEventListener('click',async e=>{
  if(e.target.closest?.('#autoColor')){e.preventDefault();e.stopImmediatePropagation();active().color=window.__FW_APP?.sampleBackgroundColor?.()||active().color;setControlValue('waveColor',active().color);notify('Wave color sampled');return}
  if(e.target.closest?.('#pickColor')){e.preventDefault();e.stopImmediatePropagation();if(!('EyeDropper'in window)){notify('Eyedropper is not supported');return}try{active().color=(await new EyeDropper().open()).sRGBHex;setControlValue('waveColor',active().color);notify('Wave color picked')}catch{}}
},true);

document.addEventListener('fw:project-reset',()=>{layers=[makeDefault(0)];activeIndex=0;applyDom(active());renderLayerList();window.__FW_APP?.updateAnalyserSettings?.();document.dispatchEvent(new CustomEvent('fw:wave-selection-change',{detail:{index:0}}))});

function isMovable(i){const w=layers[i];return!!w&&!EDGE.has(w.style)}
function setPosition(i,x,y){const w=layers[i];if(!w||EDGE.has(w.style)||!Number.isFinite(+x)||!Number.isFinite(+y))return false;w.x=clamp(+x,3,97);w.y=clamp(+y,3,97);return true}
function setSize(i,size){const w=layers[i];if(!w)return false;w.size=clamp(+size||w.size,12,85);w.maxSize=Math.max(w.size,Number.isFinite(+w.maxSize)?+w.maxSize:(DEFAULT_WAVE.maxSize||70));if(i===activeIndex)applyDom(w);return true}
function updatePlate(i,patch={}){const w=layers[i];if(!w)return false;w.plate=normalizePlate({...w.plate,...patch});document.dispatchEvent(new CustomEvent('fw:plate-change',{detail:{index:i,plate:{...w.plate}}}));return true}
function getBounds(i){
  const w=layers[i];if(!w||!w.showWave)return null;const W=canvas.width,H=canvas.height,cx=W*w.x/100,cy=H*w.y/100,m=Math.min(W,H);
  if(w.style==='centerLine'||w.style==='mountain'){const ww=W*w.size/100,hh=H*.26;return{x:cx-ww/2,y:cy-hh/2,w:ww,h:hh,cx,cy}}
  if(w.style==='top')return{x:W*.04,y:0,w:W*.92,h:H*.12,cx:W*.5,cy:H*.06};if(w.style==='bottom')return{x:W*.04,y:H*.88,w:W*.92,h:H*.12,cx:W*.5,cy:H*.94};if(w.style==='dual')return{x:W*.04,y:0,w:W*.92,h:H,cx:W*.5,cy:H*.5};if(w.style==='left')return{x:0,y:H*.14,w:W*.10,h:H*.72,cx:W*.05,cy:H*.5};if(w.style==='right')return{x:W*.90,y:H*.14,w:W*.10,h:H*.72,cx:W*.95,cy:H*.5};if(w.style==='sides')return{x:0,y:H*.14,w:W,h:H*.72,cx:W*.5,cy:H*.5};
  const rr=m*Math.max(w.size,Number.isFinite(+w.maxSize)?+w.maxSize:w.size)/100*.5*1.05;return{x:cx-rr,y:cy-rr,w:rr*2,h:rr*2,cx,cy};
}
function hitWave(i,x,y){const w=layers[i],b=getBounds(i);if(!w||!b)return false;if(w.style==='top')return x>=b.x&&x<=b.x+b.w&&y<=canvas.height*.11;if(w.style==='bottom')return x>=b.x&&x<=b.x+b.w&&y>=canvas.height*.89;if(w.style==='dual')return x>=canvas.width*.04&&x<=canvas.width*.96&&(y<=canvas.height*.11||y>=canvas.height*.89);if(w.style==='left')return y>=b.y&&y<=b.y+b.h&&x<=canvas.width*.11;if(w.style==='right')return y>=b.y&&y<=b.y+b.h&&x>=canvas.width*.89;if(w.style==='sides')return y>=b.y&&y<=b.y+b.h&&(x<=canvas.width*.11||x>=canvas.width*.89);if(ROUNDISH.has(w.style)){const rx=b.w/2,ry=b.h/2,nx=(x-b.cx)/(rx||1),ny=(y-b.cy)/(ry||1),d=Math.hypot(nx,ny);return d>=.48&&d<=1.08}return x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h}
function hitTest(x,y){for(let i=layers.length-1;i>=0;i--)if(hitWave(i,x,y))return i;return-1}

function rgba(hex,a){const s=String(hex||'#ffffff').replace('#',''),n=parseInt(s,16)||0xffffff;return`rgba(${n>>16},${n>>8&255},${n&255},${a})`}
function rgb(hex){const s=validColor(hex,'#ffffff').slice(1);return[parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)]}
function rgbCss(c,a=1){return`rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${clamp(a,0,1)})`}
function linear(v){v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}
function luminance(c){return .2126*linear(c[0])+.7152*linear(c[1])+.0722*linear(c[2])}
function mix(a,b,t){return a.map((v,i)=>v+(b[i]-v)*t)}
const sampleCache=new Map();
function sampleLayerLum(w,index){
  const now=performance.now(),cached=sampleCache.get(w.id);if(cached&&now-cached.at<350)return cached.lum;const b=getBounds(index);if(!b)return .5;
  const pts=[[b.cx,b.cy],[b.x+b.w*.15,b.cy],[b.x+b.w*.85,b.cy],[b.cx,b.y+b.h*.15],[b.cx,b.y+b.h*.85]];let sum=0,n=0;
  for(const [x,y] of pts){try{const d=ctx.getImageData(clamp(Math.round(x),0,canvas.width-1),clamp(Math.round(y),0,canvas.height-1),1,1).data;sum+=luminance([d[0],d[1],d[2]]);n++}catch{}}
  const lum=n?sum/n:.5;sampleCache.set(w.id,{at:now,lum});return lum;
}
function lookConfig(){return window.__FW_WAVE_LOOK?.getConfig?.()||{contrast:'auto',outline:3,backdrop:'local-soft'}}
function paletteFor(w,index){const look=lookConfig(),bgLum=sampleLayerLum(w,index),bright=bgLum>.50,contrast=bright?[8,10,12]:[250,248,243],base=rgb(w.color);let main=base;if(look.contrast==='auto')main=mix(base,bright?[18,20,22]:[255,252,244],bright?.34:.26);else if(look.contrast==='strong')main=mix(base,bright?[16,18,20]:[255,253,246],bright?.20:.16);const outlineAlpha=look.contrast==='strong'?.68:look.contrast==='soft'?.38:look.contrast==='auto'?.52:.42;return{look,main,contrast,outlineAlpha}}
function mainPaint(w,pal,fill=false){const color=rgbCss(pal.main,w.opacity/100);if(fill)ctx.fillStyle=color;else ctx.strokeStyle=color;if(w.showGlow&&w.glow){ctx.shadowColor=rgbCss(pal.main,.8);ctx.shadowBlur=w.glow*.34}else ctx.shadowBlur=0}
function paintStroke(w,index,baseWidth=w.thickness){
  const pal=paletteFor(w,index),look=pal.look,blur=look.backdrop==='local-blur';
  if(look.backdrop!=='off'){ctx.save();ctx.shadowBlur=blur?18:6;ctx.shadowColor=rgbCss(pal.contrast,blur?.18:.08);ctx.strokeStyle=rgbCss(pal.contrast,blur?.12:.09);ctx.lineWidth=baseWidth+Math.max(blur?14:9,baseWidth*(blur?3.7:2.4));ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();ctx.restore()}
  if(look.outline>0){ctx.save();ctx.shadowBlur=0;ctx.strokeStyle=rgbCss(pal.contrast,pal.outlineAlpha);ctx.lineWidth=baseWidth+look.outline*2;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();ctx.restore()}
  ctx.save();ctx.lineWidth=baseWidth;ctx.lineJoin='round';ctx.lineCap=w.sharpness>82?'butt':'round';mainPaint(w,pal,false);ctx.stroke();ctx.restore();
}
function paintFill(w,index){
  const pal=paletteFor(w,index),look=pal.look,blur=look.backdrop==='local-blur';
  if(look.backdrop!=='off'){ctx.save();ctx.shadowBlur=blur?16:5;ctx.shadowColor=rgbCss(pal.contrast,blur?.16:.07);ctx.strokeStyle=rgbCss(pal.contrast,blur?.11:.08);ctx.lineWidth=Math.max(blur?12:7,w.thickness+look.outline*2);ctx.stroke();ctx.restore()}
  if(look.outline>0){ctx.save();ctx.strokeStyle=rgbCss(pal.contrast,pal.outlineAlpha);ctx.lineWidth=Math.max(1,look.outline*2);ctx.stroke();ctx.restore()}
  ctx.save();mainPaint(w,pal,true);ctx.fill();ctx.restore();
}
function poly(shape){let n=0,rot=-Math.PI/2;if(shape==='triangle')n=3;if(shape==='square')n=4;if(shape==='diamond'){n=4;rot=0}if(shape==='pentagon')n=5;if(shape==='hexagon')n=6;if(shape==='octagon')n=8;if(!n)return null;return Array.from({length:n},(_,i)=>({x:Math.cos(rot+i*Math.PI*2/n),y:Math.sin(rot+i*Math.PI*2/n)}))}
function shapePoint(shape,t,r){const a=t*Math.PI*2-Math.PI/2;if(shape==='circle')return{x:Math.cos(a)*r,y:Math.sin(a)*r};if(shape==='lotus'){const rr=r*(.8+.2*Math.abs(Math.sin(a*4)));return{x:Math.cos(a)*rr,y:Math.sin(a)*rr}}if(shape==='blob'){const rr=r*(.9+.055*Math.sin(a*3+1.1)+.045*Math.sin(a*7+2.7)+.025*Math.sin(a*13));return{x:Math.cos(a)*rr,y:Math.sin(a)*rr}}if(shape==='star'){const count=10,u=(t*count)%1,i=Math.floor(t*count),aa=-Math.PI/2+i*Math.PI*2/count,ab=-Math.PI/2+(i+1)*Math.PI*2/count,ra=i%2===0?r:r*.48,rb=(i+1)%2===0?r:r*.48;return{x:lerp(Math.cos(aa)*ra,Math.cos(ab)*rb,u),y:lerp(Math.sin(aa)*ra,Math.sin(ab)*rb,u)}}const v=poly(shape)||poly('hexagon'),n=v.length,pos=t*n,i=Math.floor(pos)%n,u=pos-i,p=v[i],q=v[(i+1)%n];return{x:lerp(p.x,q.x,u)*r,y:lerp(p.y,q.y,u)*r}}
function pseudoBin(q,r,w){const low=r.bass*Math.pow(1-q,.9),mid=r.mid*Math.pow(Math.sin(Math.PI*q),2),hi=r.treble*Math.pow(q,.8),ripple=.52+.48*Math.abs(Math.sin(q*(29+w.detail*.11)+r.time*(2.2+r.treble*2)));return clamp((low*.8+mid*.65+hi*.55)*ripple+r.beat*.08,0,1.4)}
function punch(r,w){return clamp(r.beat*(w.beatPunch/100),0,3)}
function maxScale(w){const base=Math.max(1,+w.size||1),limit=Math.max(base,Number.isFinite(+w.maxSize)?+w.maxSize:(DEFAULT_WAVE.maxSize||70));return clamp(limit/base,1,8)}
function drawPath(w,r,cx,cy,rad,rough=0){const N=Math.max(160,Math.round(w.detail*2.5)),dep=w.toothDepth/100,p=punch(r,w),limit=maxScale(w);ctx.beginPath();for(let i=0;i<=N;i++){const t=(i%N)/N,sp=shapePoint(w.shape,t,rad),b=Math.pow(pseudoBin(t,r,w),lerp(.72,2.2,w.sharpness/100)),tri=1-Math.abs(((t*w.detail)%1)*2-1),tooth=(Math.pow(clamp(tri,0,1),lerp(.7,5.4,w.sharpness/100))-.28)*dep*.06,raw=1+clamp(b*(w.reaction/100)+p*.25,0,3)*.095+tooth+(rough?Math.sin(i*2.31)*rough*.01:0),m=Math.min(raw,limit),xx=cx+sp.x*m,yy=cy+sp.y*m;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)}ctx.closePath()}
function drawLayer(w,r,index){
  if(!w.showWave)return;const cx=canvas.width*w.x/100,cy=canvas.height*w.y/100,rad=Math.min(canvas.width,canvas.height)*w.size/100*.5,p=punch(r,w);ctx.save();
  if(w.style==='brushRing'||w.style==='smoothRing'){
    if(w.showSecondary){drawPath(w,r,cx,cy,rad*.78,w.style==='brushRing'?.7:0);ctx.save();ctx.globalAlpha=.35;paintStroke(w,index,Math.max(1,w.thickness*.55));ctx.restore()}
    drawPath(w,r,cx,cy,rad,w.style==='brushRing'?1.25:0);paintStroke(w,index,w.thickness);if(w.style==='brushRing'){ctx.save();ctx.globalAlpha=.28;drawPath(w,r,cx,cy,rad*1.018,.65);paintStroke(w,index,Math.max(1,w.thickness*.45));ctx.restore()}
  }else if(w.style==='radial'||w.style==='orbit'){
    const N=clamp(Math.round(w.detail),16,256),depth=w.toothDepth/100;ctx.beginPath();for(let i=0;i<N;i++){const t=i/N,sp=shapePoint(w.shape,t,rad),b=pseudoBin(t,r,w),react=clamp(b*(.10+depth*.15)*(w.reaction/100)+p*(.045+depth*.055),0,.9),growth=Math.max(0,maxScale(w)-1),len=rad*Math.min(.018+react,growth),mag=Math.hypot(sp.x,sp.y)||1,nx=sp.x/mag,ny=sp.y/mag;if(w.style==='radial'){ctx.moveTo(cx+sp.x,cy+sp.y);ctx.lineTo(cx+sp.x+nx*len,cy+sp.y+ny*len)}else{ctx.moveTo(cx+sp.x+nx*len*.5+Math.max(1.5,w.thickness*(.55+b*.8+p*.08)),cy+sp.y+ny*len*.5);ctx.arc(cx+sp.x+nx*len*.5,cy+sp.y+ny*len*.5,Math.max(1.5,w.thickness*(.55+b*.8+p*.08)),0,Math.PI*2)}}if(w.style==='radial')paintStroke(w,index,w.thickness);else paintFill(w,index);
  }else if(w.style==='centerLine'||w.style==='mountain'){
    const width=canvas.width*w.size/100,N=clamp(Math.round(w.detail),32,256),depth=.65+w.toothDepth/100*.55;ctx.beginPath();for(let i=0;i<N;i++){const q=i/(N-1),b=pseudoBin(q,r,w),amp=clamp(((b*.82+r.bass*.12)*(w.reaction/100)+p*.24)*depth,0,3.4),pattern=w.style==='mountain'?Math.abs(Math.sin(q*Math.PI)):Math.sin(q*Math.PI*8),yy=cy-pattern*(amp*canvas.height*.105),xx=cx-width/2+q*width;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)}paintStroke(w,index,w.thickness);
  }else{
    const N=clamp(Math.round(w.detail),32,256),margin=Math.min(canvas.width,canvas.height)*.035,spanH=canvas.height*.58,spanW=canvas.width*.88,depth=.65+w.toothDepth/100*.6;
    const line=side=>{ctx.beginPath();for(let i=0;i<N;i++){const q=i/(N-1),b=pseudoBin(q,r,w),a=clamp(((b*.78+r.bass*.13)*(w.reaction/100)+p*.22)*depth,0,3.2);let xx,yy;if(side==='bottom'||side==='top'){xx=canvas.width*.06+q*spanW;const base=side==='bottom'?canvas.height-margin:margin;yy=base+(side==='bottom'?-1:1)*a*canvas.height*.075}else{yy=canvas.height*.2+q*spanH;const base=side==='left'?margin:canvas.width-margin;xx=base+(side==='left'?1:-1)*a*canvas.width*.048}i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)}paintStroke(w,index,w.thickness)};
    if(w.style==='bottom'||w.style==='top'||w.style==='left'||w.style==='right')line(w.style);else if(w.style==='dual'){line('top');line('bottom')}else if(w.style==='sides'){line('left');line('right')}
  }
  ctx.restore();
}
function drawLayers(frame){const r=frame?.energy||{bass:0,mid:0,treble:0,beat:0,time:performance.now()/1000};layers.forEach((w,i)=>drawLayer(w,r,i))}
pipeline?.register('wave','wave-engine',drawLayers,0);

function setLayers(values=[],nextActive=0){
  const incoming=Array.isArray(values)?values.slice(0,MAX_WAVES):[];layers=(incoming.length?incoming:[DEFAULT_WAVE]).map((w,i)=>normalizeLayer(w,i,{newId:true}));activeIndex=clamp(+nextActive||0,0,layers.length-1);applyDom(active());renderLayerList();window.__FW_APP?.updateAnalyserSettings?.();document.dispatchEvent(new CustomEvent('fw:wave-selection-change',{detail:{index:activeIndex}}));return true;
}

window.__FW_MULTI_WAVE={
  defaults:{wave:{...DEFAULT_WAVE,plate:{...DEFAULT_PLATE}},plate:{...DEFAULT_PLATE}},
  getLayers:()=>layers.map(x=>({...x,plate:{...x.plate}})),getActiveIndex:()=>activeIndex,getActiveLayer:()=>active()?{...active(),plate:{...active().plate}}:null,
  selectLayer,setPosition,setSize,getBounds,isMovable,hitTest,updatePlate,setLayers,applyPreset:applyPresetData,applyTemplate,
  addLayer:(data)=>addLayer(data),deleteLayer,
  getItems:()=>layers.map((w,index)=>({id:`wave:${index}`,type:'wave',index,name:w.name,movable:isMovable(index),x:w.x,y:w.y,bounds:getBounds(index),style:w.style,showWave:w.showWave})).filter(x=>x.showWave&&x.bounds)
};
})();
