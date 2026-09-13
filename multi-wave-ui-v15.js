(()=>{
'use strict';

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
    `;
    document.head.appendChild(style);
  }

  return true;
}

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

})();
