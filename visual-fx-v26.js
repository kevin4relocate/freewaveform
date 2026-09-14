(()=>{
'use strict';
if(window.__FW_FX_V27_LOADING)return;
window.__FW_FX_V27_LOADING=true;
const s=document.createElement('script');
s.src='visual-fx-v27.js?v=27';
s.async=false;
s.onload=()=>{window.__FW_FX_V27_LOADING=false};
s.onerror=()=>{window.__FW_FX_V27_LOADING=false;console.error('Failed to load layered visual FX renderer')};
document.head.appendChild(s);
})();