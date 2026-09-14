(()=>{
'use strict';

const LOOK_DEFAULTS={contrast:'auto',outline:3,backdrop:'local-soft'};
const LOOK_STORAGE='freewaveform.waveLook.v1';
let look={...LOOK_DEFAULTS};

function loadLook(){
  try{
    const saved=JSON.parse(localStorage.getItem(LOOK_STORAGE)||'null');
    if(saved&&typeof saved==='object')look={...look,...saved};
  }catch{}
  look.outline=Math.max(0,Math.min(10,+look.outline||0));
  if(!['none','soft','strong','auto'].includes(look.contrast))look.contrast='auto';
  if(!['off','local-soft','local-blur'].includes(look.backdrop))look.backdrop='local-soft';
}
function saveLook(){try{localStorage.setItem(LOOK_STORAGE,JSON.stringify(look))}catch{}}
function toast(text){
  const t=document.getElementById('toast');
  if(!t)return;
  t.textContent=text;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1800);
}

function mount(){
  const layers=document.querySelector('.multi-wave-card');
  const styleSelect=document.getElementById('waveStyle');
  const waveformCard=styleSelect?.closest('.card');
  if(!layers||!waveformCard)return false;

  if(!layers.classList.contains('mw-embedded')){
    layers.classList.add('mw-embedded');
    const title=waveformCard.querySelector(':scope > .card-title');
    if(title)title.insertAdjacentElement('afterend',layers);
    else waveformCard.prepend(layers);
  }

  if(!document.getElementById('mw-ui-v15-style')){
    const style=document.createElement('style');
    style.id='mw-ui-v15-style';
    style.textContent=`
      .multi-wave-card.mw-embedded{
        margin:10px 0 14px !important;
        padding:10px !important;
        border:1px solid #3a3022 !important;
        border-radius:10px !important;
        background:linear-gradient(180deg,#12110e,#0b1012) !important;
        box-shadow:0 0 0 1px rgba(217,169,95,.04) inset;
      }
      .multi-wave-card.mw-embedded .card-title{margin-bottom:8px}
      .multi-wave-card.mw-embedded .card-title strong{color:#e8c17e}
      .multi-wave-card.mw-embedded .hint{margin-bottom:0}
      .multi-wave-card.mw-embedded .mw-actions{
        display:flex !important;
        grid-template-columns:none !important;
        align-items:center;
        justify-content:flex-start;
        gap:6px;
        margin-bottom:8px;
      }
      .multi-wave-card.mw-embedded .mw-actions .button{
        width:auto !important;
        min-width:0 !important;
        height:30px;
        padding:0 9px;
        border-radius:7px;
        font-size:9px;
        line-height:1;
        white-space:nowrap;
      }
      .multi-wave-card.mw-embedded .mw-add{flex:0 0 auto}
      .multi-wave-card.mw-embedded .mw-duplicate{flex:0 0 auto}
      .wave-look-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 10px;margin:8px 0 10px}
      .wave-look-grid label{min-width:0}
      .wave-look-grid .wave-look-outline{grid-column:1/-1}
      .wave-look-note{margin-top:6px !important}
      @media(max-width:520px){
        .multi-wave-card.mw-embedded .mw-actions{display:flex !important}
        .multi-wave-card.mw-embedded .mw-actions .button{width:auto !important}
        .wave-look-grid{grid-template-columns:1fr}
        .wave-look-grid .wave-look-outline{grid-column:auto}
      }
    `;
    document.head.appendChild(style);
  }

  mountWaveLook(waveformCard);
  return true;
}

function mountWaveLook(waveformCard){
  if(document.getElementById('waveContrastMode'))return;
  const lookLabel=[...waveformCard.querySelectorAll('.section-label')].find(x=>x.textContent.trim().toUpperCase()==='LOOK');
  if(!lookLabel)return;

  const box=document.createElement('div');
  box.className='wave-look-grid';
  box.innerHTML=`
    <label>Contrast
      <select id="waveContrastMode">
        <option value="none">None</option>
        <option value="soft">Soft</option>
        <option value="strong">Strong</option>
        <option value="auto">Auto</option>
      </select>
    </label>
    <label>Backdrop
      <select id="waveBackdrop">
        <option value="off">Off</option>
        <option value="local-soft">Local Soft</option>
        <option value="local-blur">Local Blur</option>
      </select>
    </label>
    <label class="wave-look-outline">Outline <span id="waveOutlineValue">3px</span>
      <input id="waveOutline" class="range" type="range" min="0" max="10" step="1" value="3" />
    </label>
  `;
  lookLabel.insertAdjacentElement('afterend',box);
  const note=document.createElement('p');
  note.className='hint wave-look-note';
  note.innerHTML='<b>Auto Contrast</b> keeps the artwork intact and adds separation only around the waveform. <b>Local Soft</b> is the recommended default.';
  box.insertAdjacentElement('afterend',note);

  const contrast=document.getElementById('waveContrastMode');
  const outline=document.getElementById('waveOutline');
  const backdrop=document.getElementById('waveBackdrop');
  contrast.value=look.contrast;outline.value=look.outline;backdrop.value=look.backdrop;
  document.getElementById('waveOutlineValue').textContent=look.outline+'px';

  contrast.addEventListener('change',()=>{look.contrast=contrast.value;saveLook()});
  outline.addEventListener('input',()=>{look.outline=+outline.value;document.getElementById('waveOutlineValue').textContent=look.outline+'px';saveLook()});
  backdrop.addEventListener('change',()=>{look.backdrop=backdrop.value;saveLook()});

  const oldAuto=document.getElementById('autoColor');
  if(oldAuto){
    const auto=oldAuto.cloneNode(true);
    auto.id='autoContrastColor';
    auto.textContent='Auto Contrast';
    oldAuto.replaceWith(auto);
    auto.addEventListener('click',()=>{
      look.contrast='auto';contrast.value='auto';saveLook();toast('Auto Contrast enabled');
    });
  }
}

loadLook();

if(!mount()){
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(mount()||tries>30)clearInterval(timer);
  },100);
}

// When Waveform is opened, make sure the layer selector is brought into view.
document.querySelector('.tool[data-tool="waveform"]')?.addEventListener('click',()=>{
  setTimeout(()=>{
    const layers=document.querySelector('.multi-wave-card');
    if(layers)layers.scrollIntoView({block:'nearest'});
  },40);
});

function hexRgb(hex){
  const s=String(hex||'').replace('#','').trim();
  if(s.length===3)return s.split('').map(x=>parseInt(x+x,16));
  if(s.length===6)return[parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)];
  return null;
}
function cssRgb(style){
  if(typeof style!=='string')return null;
  if(style[0]==='#'){
    const rgb=hexRgb(style);return rgb?{rgb,a:1}:null;
  }
  const m=style.match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
  return m?{rgb:[+m[1],+m[2],+m[3]],a:m[4]===undefined?1:+m[4]}:null;
}
function sameRgb(a,b){return!!a&&!!b&&Math.abs(a[0]-b[0])<2&&Math.abs(a[1]-b[1])<2&&Math.abs(a[2]-b[2])<2}
function rgbCss(rgb,a=1){return`rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${Math.max(0,Math.min(1,a))})`}
function linear(v){v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}
function luminance(rgb){return .2126*linear(rgb[0])+.7152*linear(rgb[1])+.0722*linear(rgb[2])}
function mix(a,b,t){return a.map((v,i)=>v+(b[i]-v)*t)}

const sampleCache=new Map();
function sampleLayerLum(layer,index,ctx,canvas){
  const now=performance.now(),cached=sampleCache.get(layer.id);
  if(cached&&now-cached.at<220)return cached.lum;
  const api=window.__FW_MULTI_WAVE;
  const b=api?.getBounds?.(index);
  if(!b)return .5;
  const pts=[];
  const add=(x,y)=>pts.push([Math.max(0,Math.min(canvas.width-1,Math.round(x))),Math.max(0,Math.min(canvas.height-1,Math.round(y)))]);
  if(['bottom','top'].includes(layer.style)){
    const y=layer.style==='bottom'?b.y+b.h*.65:b.y+b.h*.35;
    [.15,.32,.5,.68,.85].forEach(q=>add(b.x+b.w*q,y));
  }else if(['left','right'].includes(layer.style)){
    const x=layer.style==='left'?b.x+b.w*.65:b.x+b.w*.35;
    [.16,.33,.5,.67,.84].forEach(q=>add(x,b.y+b.h*q));
  }else if(layer.style==='dual'||layer.style==='sides'){
    add(b.x+b.w*.18,b.y+b.h*.08);add(b.x+b.w*.5,b.y+b.h*.08);add(b.x+b.w*.82,b.y+b.h*.08);
    add(b.x+b.w*.18,b.y+b.h*.92);add(b.x+b.w*.5,b.y+b.h*.92);add(b.x+b.w*.82,b.y+b.h*.92);
  }else if(layer.style==='centerLine'||layer.style==='mountain'){
    [.12,.3,.5,.7,.88].forEach(q=>add(b.x+b.w*q,b.cy));
  }else{
    add(b.cx,b.y+b.h*.10);add(b.x+b.w*.90,b.cy);add(b.cx,b.y+b.h*.90);add(b.x+b.w*.10,b.cy);
  }
  let sum=0,count=0;
  for(const [x,y] of pts){
    try{const d=ctx.getImageData(x,y,1,1).data;sum+=luminance([d[0],d[1],d[2]]);count++}catch{}
  }
  const lum=count?sum/count:.5;sampleCache.set(layer.id,{at:now,lum});return lum;
}
function findLayerForStyle(style){
  const parsed=cssRgb(style);if(!parsed)return null;
  const api=window.__FW_MULTI_WAVE;const layers=api?.getLayers?.()||[];
  for(let i=layers.length-1;i>=0;i--){const rgb=hexRgb(layers[i].color);if(sameRgb(parsed.rgb,rgb))return{layer:layers[i],index:i,parsed}}
  return null;
}
function paletteFor(layer,index,parsed,ctx,canvas){
  const bgLum=sampleLayerLum(layer,index,ctx,canvas);
  const brightBg=bgLum>.50;
  const contrastRgb=brightBg?[8,10,12]:[250,248,243];
  let mainRgb=parsed.rgb;
  if(look.contrast==='auto')mainRgb=mix(mainRgb,brightBg?[18,20,22]:[255,252,244],brightBg?.34:.26);
  else if(look.contrast==='strong')mainRgb=mix(mainRgb,brightBg?[16,18,20]:[255,253,246],brightBg?.20:.16);
  const outlineAlpha=look.contrast==='strong'?.68:look.contrast==='soft'?.38:look.contrast==='auto'?.52:.42;
  return{mainRgb,contrastRgb,outlineAlpha,bgLum};
}

function installCanvasLook(){
  const canvas=document.getElementById('canvas');
  const api=window.__FW_MULTI_WAVE;
  if(!canvas||!api||canvas.__waveLookInstalled)return false;
  const ctx=canvas.getContext('2d');
  const nativeStroke=ctx.stroke.bind(ctx),nativeFill=ctx.fill.bind(ctx);
  canvas.__waveLookInstalled=true;

  ctx.stroke=function(...args){
    const hit=findLayerForStyle(ctx.strokeStyle);
    if(!hit)return nativeStroke(...args);
    const {layer,index,parsed}=hit;
    if(!layer.showWave)return nativeStroke(...args);
    const pal=paletteFor(layer,index,parsed,ctx,canvas);
    const baseWidth=ctx.lineWidth||1;

    if(look.backdrop!=='off'){
      ctx.save();
      const blur=look.backdrop==='local-blur';
      ctx.strokeStyle=rgbCss(pal.contrastRgb,blur?.13:.11);
      ctx.lineWidth=baseWidth+Math.max(blur?16:10,baseWidth*(blur?4.2:2.8));
      ctx.lineJoin='round';ctx.lineCap='round';
      ctx.shadowColor=rgbCss(pal.contrastRgb,blur?.22:.10);
      ctx.shadowBlur=blur?22:8;
      nativeStroke(...args);
      ctx.restore();
    }

    if(look.outline>0){
      ctx.save();
      ctx.shadowBlur=0;
      ctx.strokeStyle=rgbCss(pal.contrastRgb,pal.outlineAlpha);
      ctx.lineWidth=baseWidth+look.outline*2;
      ctx.lineJoin='round';
      nativeStroke(...args);
      ctx.restore();
    }

    if(look.contrast==='auto'||look.contrast==='strong'){
      ctx.save();
      ctx.strokeStyle=rgbCss(pal.mainRgb,parsed.a);
      if(ctx.shadowBlur>0)ctx.shadowColor=rgbCss(pal.mainRgb,.75);
      nativeStroke(...args);
      ctx.restore();
      return;
    }
    return nativeStroke(...args);
  };

  ctx.fill=function(...args){
    const hit=findLayerForStyle(ctx.fillStyle);
    if(!hit||hit.parsed.a<.24)return nativeFill(...args);
    const {layer,index,parsed}=hit;
    const pal=paletteFor(layer,index,parsed,ctx,canvas);

    if(look.backdrop!=='off'){
      ctx.save();
      const blur=look.backdrop==='local-blur';
      ctx.strokeStyle=rgbCss(pal.contrastRgb,blur?.12:.10);
      ctx.lineWidth=Math.max(blur?14:8,(ctx.lineWidth||1)+(look.outline*2));
      ctx.shadowColor=rgbCss(pal.contrastRgb,blur?.20:.08);
      ctx.shadowBlur=blur?20:7;
      nativeStroke();
      ctx.restore();
    }
    if(look.outline>0){
      ctx.save();ctx.shadowBlur=0;ctx.strokeStyle=rgbCss(pal.contrastRgb,pal.outlineAlpha);ctx.lineWidth=Math.max(1,look.outline*2);nativeStroke();ctx.restore();
    }
    if(look.contrast==='auto'||look.contrast==='strong'){
      ctx.save();ctx.fillStyle=rgbCss(pal.mainRgb,parsed.a);if(ctx.shadowBlur>0)ctx.shadowColor=rgbCss(pal.mainRgb,.75);nativeFill(...args);ctx.restore();return;
    }
    return nativeFill(...args);
  };
  return true;
}

if(!installCanvasLook()){
  let attempts=0;
  const lookTimer=setInterval(()=>{attempts++;if(installCanvasLook()||attempts>40)clearInterval(lookTimer)},100);
}

document.getElementById('resetProject')?.addEventListener('click',()=>setTimeout(()=>{
  look={...LOOK_DEFAULTS};saveLook();
  const c=document.getElementById('waveContrastMode'),o=document.getElementById('waveOutline'),b=document.getElementById('waveBackdrop'),v=document.getElementById('waveOutlineValue');
  if(c)c.value=look.contrast;if(o)o.value=look.outline;if(b)b.value=look.backdrop;if(v)v.textContent=look.outline+'px';
},0));

})();
