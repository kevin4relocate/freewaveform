(()=>{
'use strict';

const DEFAULT_PLATE={enabled:false,shape:'blob',tone:'dark',size:82,opacity:88,softness:4,shadow:12,color:'#17191c'};
const DEFAULT_WAVE={
  template:'ink',style:'brushRing',shape:'circle',size:46,thickness:4,opacity:78,
  smoothing:55,reaction:130,beatPunch:150,beatSensitivity:135,glow:16,
  detail:128,toothDepth:80,sharpness:70,color:'#e5d3a6',showWave:true,showGlow:true,showSecondary:false,
  x:50,y:50,plate:{...DEFAULT_PLATE}
};
const STYLE_OPTIONS=[
  ['brushRing','◯','Brush Ring'],['smoothRing','◎','Smooth Ring'],['radial','✺','Radial Bars'],['orbit','••','Orbit Dots'],
  ['centerLine','∿','Center Wave'],['mountain','⌁','Mountain Wave'],['bottom','▁','Bottom Wave'],['top','▔','Top Wave'],
  ['dual','═','Top + Bottom'],['left','▏','Left Bars'],['right','▕','Right Bars'],['sides','↔','Side Bars']
];
const SHAPE_OPTIONS=[
  ['circle','○','Circle'],['triangle','△','Triangle'],['square','□','Square'],['diamond','◇','Diamond'],
  ['pentagon','⬠','Pentagon'],['hexagon','⬡','Hexagon'],['octagon','⯃','Octagon'],['star','★','Star'],
  ['lotus','✿','Lotus'],['blob','◌','Ink Blob']
];
const TEMPLATES={
  ink:{name:'Ink Ring',icon:'◯',style:'brushRing',shape:'circle',size:46,thickness:4,opacity:78,reaction:145,beatPunch:145,detail:104,toothDepth:55,sharpness:58,glow:8,showSecondary:false},
  fine:{name:'Fine Teeth',icon:'✹',style:'brushRing',shape:'circle',size:47,thickness:3,opacity:82,reaction:185,beatPunch:175,detail:176,toothDepth:110,sharpness:78,glow:12,showSecondary:false},
  razor:{name:'Razor Ring',icon:'✷',style:'radial',shape:'circle',size:47,thickness:2,opacity:88,reaction:235,beatPunch:220,detail:216,toothDepth:165,sharpness:90,glow:18,showSecondary:false},
  lotus:{name:'Lotus',icon:'✿',style:'smoothRing',shape:'lotus',size:48,thickness:3,opacity:74,reaction:150,beatPunch:155,detail:112,toothDepth:45,sharpness:45,glow:14,showSecondary:true},
  seal:{name:'Seal',icon:'◇',style:'brushRing',shape:'diamond',size:43,thickness:5,opacity:82,reaction:165,beatPunch:170,detail:72,toothDepth:35,sharpness:72,glow:6,showSecondary:false,plate:{enabled:true,shape:'follow',tone:'dark',size:78,opacity:86,softness:3,shadow:10,color:'#17191c'}},
  spectrum:{name:'Spectrum',icon:'✺',style:'radial',shape:'circle',size:48,thickness:3,opacity:84,reaction:220,beatPunch:185,detail:144,toothDepth:125,sharpness:76,glow:20,showSecondary:false},
  mountain:{name:'Mountain',icon:'⌁',style:'mountain',shape:'circle',size:58,thickness:4,opacity:80,reaction:190,beatPunch:150,detail:144,toothDepth:90,sharpness:68,glow:8,showSecondary:false},
  bottom:{name:'Bottom',icon:'▁',style:'bottom',shape:'circle',size:72,thickness:4,opacity:84,reaction:200,beatPunch:170,detail:160,toothDepth:100,sharpness:72,glow:10,showSecondary:false},
  dual:{name:'Top + Bottom',icon:'═',style:'dual',shape:'circle',size:72,thickness:3,opacity:75,reaction:190,beatPunch:170,detail:160,toothDepth:95,sharpness:70,glow:8,showSecondary:false},
  sides:{name:'Side Bars',icon:'↔',style:'sides',shape:'circle',size:66,thickness:4,opacity:80,reaction:205,beatPunch:175,detail:128,toothDepth:105,sharpness:76,glow:12,showSecondary:false},
  star:{name:'Star Pulse',icon:'★',style:'smoothRing',shape:'star',size:45,thickness:3,opacity:76,reaction:180,beatPunch:200,detail:96,toothDepth:65,sharpness:64,glow:18,showSecondary:true}
};
window.__FW_WAVE_CONFIG={
  DEFAULT_PLATE,DEFAULT_WAVE,STYLE_OPTIONS,SHAPE_OPTIONS,TEMPLATES,
  EDGE:new Set(['bottom','top','dual','left','right','sides']),
  ROUNDISH:new Set(['brushRing','smoothRing','radial','orbit'])
};
})();
