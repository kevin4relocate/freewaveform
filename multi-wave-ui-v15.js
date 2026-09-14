(()=>{
'use strict';

const LOOK_DEFAULTS={contrast:'auto',outline:3,backdrop:'local-soft'};
const LOOK_STORAGE='freewaveform.waveLook.v2';
let look={...LOOK_DEFAULTS};
let lumCache={at:0,value:.5};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function normalizeLook(value={}){
  const out={...LOOK_DEFAULTS,...value};
  if(!['none','soft','strong','auto'].includes(out.contrast))out.contrast='auto';
  if(!['off','local-soft','local-blur'].includes(out.backdrop))out.backdrop='local-soft';
  out.outline=clamp(+out.outline||0,0,10);
  return out;
}
function loadLook(){try{look=normalizeLook(JSON.parse(localStorage.getItem(LOOK_STORAGE)||'null')||{})}catch{look={...LOOK_DEFAULTS}}}
function saveLook(){try{localStorage.setItem(LOOK_STORAGE,JSON.stringify(look))}catch{}}
function toast(text){
  if(window.__FW_TOAST)return window.__FW_TOAST(text);
  const t=document.getElementById('toast');if(!t)return;t.textContent=text;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2000);
}
function syncLookUI(){
  const c=document.getElementById('waveContrastMode'),o=document.getElementById('waveOutline'),b=document.getElementById('waveBackdrop'),v=document.getElementById('waveOutlineValue');
  if(c)c.value=look.contrast;if(o)o.value=look.outline;if(b)b.value=look.backdrop;if(v)v.textContent=look.outline+'px';
  const quick=document.getElementById('autoContrastColor');if(quick)quick.classList.toggle('active-look',look.contrast==='auto');
}
function moveGlowToLook(){
  const glow=document.getElementById('waveGlow')?.closest('label'),opacity=document.getElementById('waveOpacity')?.closest('label');
  if(glow&&opacity&&glow.parentElement!==opacity.parentElement)opacity.insertAdjacentElement('afterend',glow);
}
function mount(){
  const layers=document.querySelector('.multi-wave-card'),styleSelect=document.getElementById('waveStyle'),waveformCard=styleSelect?.closest('.card');
  if(!layers||!waveformCard)return false;
  if(!layers.classList.contains('mw-embedded')){
    layers.classList.add('mw-embedded');
    const title=waveformCard.querySelector(':scope > .card-title');if(title)title.insertAdjacentElement('afterend',layers);else waveformCard.prepend(layers);
  }
  moveGlowToLook();
  mountWaveLook(waveformCard);return true;
}
function mountWaveLook(waveformCard){
  if(document.getElementById('waveContrastMode')){syncLookUI();return}
  const colorRow=waveformCard.querySelector('.color-row');if(!colorRow)return;
  const box=document.createElement('div');box.className='wave-look-block';
  box.innerHTML=`
    <div class="section-label">GLOBAL WAVE LOOK</div>
    <div class="wave-look-grid">
      <label>Contrast<select id="waveContrastMode"><option value="none">None</option><option value="soft">Soft</option><option value="strong">Strong</option><option value="auto">Auto</option></select></label>
      <label>Backdrop<select id="waveBackdrop"><option value="off">Off</option><option value="local-soft">Local Soft</option><option value="local-blur">Local Blur</option></select></label>
      <label class="wave-look-outline">Outline <span id="waveOutlineValue">3px</span><input id="waveOutline" class="range" type="range" min="0" max="10" step="1" value="3" /></label>
    </div>
    <p class="hint wave-look-note">Applies to all waveform layers. Auto keeps the artwork intact and adds local separation around the wave.</p>`;
  colorRow.insertAdjacentElement('afterend',box);
  const contrast=document.getElementById('waveContrastMode'),outline=document.getElementById('waveOutline'),backdrop=document.getElementById('waveBackdrop');
  contrast.addEventListener('change',()=>{look.contrast=contrast.value;saveLook();syncLookUI()});
  outline.addEventListener('input',()=>{look.outline=+outline.value;saveLook();syncLookUI()});
  backdrop.addEventListener('change',()=>{look.backdrop=backdrop.value;saveLook();syncLookUI()});

  const oldAuto=document.getElementById('autoColor');
  if(oldAuto){
    const auto=oldAuto.cloneNode(true);auto.id='autoContrastColor';auto.textContent='Auto Contrast';oldAuto.replaceWith(auto);
    auto.addEventListener('click',()=>{look.contrast='auto';saveLook();syncLookUI();toast('Auto Contrast enabled')});
  }
  syncLookUI();
}

function hexRgb(hex){const s=String(hex||'').replace('#','').trim();if(s.length===3)return s.split('').map(x=>parseInt(x+x,16));if(s.length===6)return[parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)];return null}
function cssRgb(style){
  if(typeof style!=='string')return null;
  if(style[0]==='#'){const rgb=hexRgb(style);return rgb?{rgb,a:1}:null}
  const m=style.match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);return m?{rgb:[+m[1],+m[2],+m[3]],a:m[4]===undefined?1:+m[4]}:null;
}
function sameRgb(a,b){return!!a&&!!b&&Math.abs(a[0]-b[0])<2&&Math.abs(a[1]-b[1])<2&&Math.abs(a[2]-b[2])<2}
function rgbCss(rgb,a=1){return`rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${clamp(a,0,1)})`}
function linear(v){v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}
function luminance(rgb){return .2126*linear(rgb[0])+.7152*linear(rgb[1])+.0722*linear(rgb[2])}
function mix(a,b,t){return a.map((v,i)=>v+(b[i]-v)*t)}
function isWavePaint(style){
  const parsed=cssRgb(style);if(!parsed)return null;
  const layers=window.__FW_MULTI_WAVE?.getLayers?.()||[];
  return layers.some(layer=>layer.showWave!==false&&sameRgb(parsed.rgb,hexRgb(layer.color)))?parsed:null;
}
function sampleCanvasLum(ctx,canvas){
  const now=performance.now();if(now-lumCache.at<650)return lumCache.value;
  const pts=[[.5,.5],[.35,.5],[.65,.5],[.5,.35],[.5,.65],[.2,.2],[.8,.2],[.2,.8],[.8,.8]];let sum=0,n=0;
  for(const [qx,qy] of pts){try{const d=ctx.getImageData(Math.round((canvas.width-1)*qx),Math.round((canvas.height-1)*qy),1,1).data;sum+=luminance([d[0],d[1],d[2]]);n++}catch{}}
  lumCache={at:now,value:n?sum/n:.5};return lumCache.value;
}
function paletteFor(parsed,ctx,canvas){
  const bgLum=sampleCanvasLum(ctx,canvas),brightBg=bgLum>.46,contrastRgb=brightBg?[8,10,12]:[250,248,243];let mainRgb=parsed.rgb;
  if(look.contrast==='auto')mainRgb=mix(mainRgb,brightBg?[18,20,22]:[255,252,244],brightBg?.34:.26);
  else if(look.contrast==='strong')mainRgb=mix(mainRgb,brightBg?[16,18,20]:[255,253,246],brightBg?.20:.16);
  const outlineAlpha=look.contrast==='strong'?.68:look.contrast==='soft'?.38:look.contrast==='auto'?.52:.42;
  return{mainRgb,contrastRgb,outlineAlpha};
}
function installCanvasLook(){
  const canvas=document.getElementById('canvas'),api=window.__FW_MULTI_WAVE;if(!canvas||!api||canvas.__waveLookInstalled)return false;
  const ctx=canvas.getContext('2d'),nativeStroke=ctx.stroke.bind(ctx),nativeFill=ctx.fill.bind(ctx);canvas.__waveLookInstalled=true;
  ctx.stroke=function(...args){
    const parsed=isWavePaint(ctx.strokeStyle);if(!parsed)return nativeStroke(...args);
    const pal=paletteFor(parsed,ctx,canvas),baseWidth=ctx.lineWidth||1,allowBackdrop=look.backdrop!=='off'&&baseWidth>3;
    if(allowBackdrop){ctx.save();const blur=look.backdrop==='local-blur';ctx.strokeStyle=rgbCss(pal.contrastRgb,blur?.12:.10);ctx.lineWidth=baseWidth+Math.max(blur?14:9,baseWidth*(blur?3.6:2.4));ctx.lineJoin='round';ctx.lineCap='round';ctx.shadowColor=rgbCss(pal.contrastRgb,blur?.18:.08);ctx.shadowBlur=blur?18:6;nativeStroke(...args);ctx.restore()}
    if(look.outline>0){ctx.save();ctx.shadowBlur=0;ctx.strokeStyle=rgbCss(pal.contrastRgb,pal.outlineAlpha);ctx.lineWidth=baseWidth+look.outline*2;ctx.lineJoin='round';nativeStroke(...args);ctx.restore()}
    if(look.contrast==='auto'||look.contrast==='strong'){ctx.save();ctx.strokeStyle=rgbCss(pal.mainRgb,parsed.a);if(ctx.shadowBlur>0)ctx.shadowColor=rgbCss(pal.mainRgb,.72);nativeStroke(...args);ctx.restore();return}
    return nativeStroke(...args);
  };
  ctx.fill=function(...args){
    const parsed=isWavePaint(ctx.fillStyle);if(!parsed||parsed.a<.24)return nativeFill(...args);
    if(look.contrast==='auto'||look.contrast==='strong'){const pal=paletteFor(parsed,ctx,canvas);ctx.save();ctx.fillStyle=rgbCss(pal.mainRgb,parsed.a);if(ctx.shadowBlur>0)ctx.shadowColor=rgbCss(pal.mainRgb,.72);nativeFill(...args);ctx.restore();return}
    return nativeFill(...args);
  };
  return true;
}

loadLook();
if(!mount()){let tries=0;const timer=setInterval(()=>{tries++;if(mount()||tries>30)clearInterval(timer)},100)}
if(!installCanvasLook()){let attempts=0;const timer=setInterval(()=>{attempts++;if(installCanvasLook()||attempts>40)clearInterval(timer)},100)}

document.querySelector('.tool[data-tool="waveform"]')?.addEventListener('click',()=>setTimeout(()=>document.querySelector('.multi-wave-card')?.scrollIntoView({block:'nearest'}),40));
document.querySelectorAll('#imageOpacity,#imageZoom,#imageDarkness,#imageBlur,#imageSaturation').forEach(x=>x.addEventListener('input',()=>{lumCache.at=0}));
document.getElementById('imageFile')?.addEventListener('change',()=>{lumCache.at=0});
document.getElementById('resetProject')?.addEventListener('click',()=>setTimeout(()=>{look={...LOOK_DEFAULTS};saveLook();lumCache.at=0;syncLookUI()},0));

window.__FW_WAVE_LOOK={
  defaults:{...LOOK_DEFAULTS},
  getConfig:()=>({...look}),
  setConfig(patch={}){look=normalizeLook({...look,...patch});saveLook();lumCache.at=0;syncLookUI();return true},
  reset(){look={...LOOK_DEFAULTS};saveLook();lumCache.at=0;syncLookUI()}
};

})();
