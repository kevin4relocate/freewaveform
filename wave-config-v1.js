(()=>{
'use strict';

const DEFAULT_FILL={enabled:false,color:'#17191c',opacity:88};
// Internal compatibility state used by wave-engine-v2. The old "plate" object is no longer rendered as a separate layer;
// wave-fill-v1.js uses enabled/color/opacity from it as the waveform's reactive Fill state.
const DEFAULT_PLATE={enabled:false,shape:'follow',tone:'custom',size:100,opacity:88,softness:0,shadow:0,color:'#17191c'};
const DEFAULT_WAVE={
  template:'ncsClassic',style:'ncsClassic',shape:'circle',size:46,maxSize:76,thickness:3,opacity:96,
  smoothing:42,reaction:205,beatPunch:175,beatSensitivity:140,glow:18,
  detail:160,toothDepth:145,sharpness:83,color:'#f5f8ff',showWave:true,showGlow:true,showSecondary:false,
  x:50,y:50,plate:{...DEFAULT_PLATE}
};
const STYLE_OPTIONS=[
  ['ncsClassic','◉','NCS Classic Spectrum'],['ncsBars','✳','NCS Radial Spectrum'],
  ['brushRing','◯','Brush Ring'],['smoothRing','◎','Smooth Ring'],['radial','✺','Radial Bars'],['orbit','••','Orbit Dots'],
  ['centerLine','∿','Center Wave'],['mountain','⌁','Mountain Wave'],
  ['softBars','▥','Soft Bars'],['mirrorBars','▦','Mirror Bars'],['roundedBars','▤','Rounded Bars'],['centerBars','▧','Center Mirror'],
  ['bottom','▁','Bottom Wave'],['top','▔','Top Wave'],['dual','═','Top + Bottom'],['left','▏','Left Bars'],['right','▕','Right Bars'],['sides','↔','Side Bars']
];
const SHAPE_OPTIONS=[
  ['circle','○','Circle'],['triangle','△','Triangle'],['square','□','Square'],['diamond','◇','Diamond'],
  ['pentagon','⬠','Pentagon'],['hexagon','⬡','Hexagon'],['octagon','⯃','Octagon'],['star','★','Star'],
  ['lotus','✿','Lotus'],['blob','◌','Ink Blob']
];
const TEMPLATES={
  ncsClassic:{name:'NCS Classic',icon:'◉',style:'ncsClassic',shape:'circle',size:46,maxSize:76,thickness:3,opacity:96,reaction:205,beatPunch:175,beatSensitivity:140,smoothing:42,detail:160,toothDepth:145,sharpness:83,glow:18,color:'#f5f8ff',showSecondary:false,showGlow:true},
  ncsNeon:{name:'NCS Neon Pulse',icon:'✳',style:'ncsBars',shape:'circle',size:44,maxSize:86,thickness:4,opacity:93,reaction:265,beatPunch:245,beatSensitivity:158,smoothing:28,detail:192,toothDepth:190,sharpness:95,glow:36,color:'#69e8ff',showSecondary:true,showGlow:true},
  ncsMinimal:{name:'NCS Minimal',icon:'◎',style:'ncsClassic',shape:'circle',size:49,maxSize:68,thickness:2,opacity:90,reaction:135,beatPunch:100,beatSensitivity:115,smoothing:70,detail:128,toothDepth:80,sharpness:55,glow:6,color:'#ffffff',showSecondary:false,showGlow:true},
  ncsFestival:{name:'NCS Festival',icon:'✺',style:'ncsBars',shape:'circle',size:45,maxSize:93,thickness:4,opacity:100,reaction:310,beatPunch:270,beatSensitivity:175,smoothing:16,detail:232,toothDepth:210,sharpness:100,glow:42,color:'#ffc46e',showSecondary:true,showGlow:true},
  lofiCalm:{name:'Lo-fi Calm',icon:'▦',style:'mirrorBars',shape:'circle',size:54,maxSize:70,thickness:3,opacity:74,reaction:46,beatPunch:16,beatSensitivity:100,smoothing:91,detail:144,toothDepth:54,sharpness:18,glow:3,showSecondary:false},
  softVocal:{name:'Soft Vocal',icon:'▧',style:'centerBars',shape:'circle',size:58,maxSize:72,thickness:3,opacity:80,reaction:62,beatPunch:20,beatSensitivity:112,smoothing:87,detail:136,toothDepth:68,sharpness:28,glow:5,showSecondary:false},
  acousticGentle:{name:'Acoustic Gentle',icon:'▤',style:'roundedBars',shape:'circle',size:52,maxSize:68,thickness:4,opacity:76,reaction:55,beatPunch:18,beatSensitivity:105,smoothing:89,detail:120,toothDepth:62,sharpness:10,glow:2,showSecondary:false},
  chillPop:{name:'Chill Pop',icon:'▥',style:'softBars',shape:'circle',size:60,maxSize:74,thickness:3,opacity:82,reaction:72,beatPunch:28,beatSensitivity:118,smoothing:83,detail:152,toothDepth:78,sharpness:38,glow:6,showSecondary:false},
  ink:{name:'Ink Ring',icon:'◯',style:'brushRing',shape:'circle',size:46,thickness:4,opacity:78,reaction:145,beatPunch:145,detail:104,toothDepth:55,sharpness:58,glow:8,showSecondary:false},
  fine:{name:'Fine Teeth',icon:'✹',style:'brushRing',shape:'circle',size:47,thickness:3,opacity:82,reaction:185,beatPunch:175,detail:176,toothDepth:110,sharpness:78,glow:12,showSecondary:false},
  razor:{name:'Razor Ring',icon:'✷',style:'radial',shape:'circle',size:47,thickness:2,opacity:88,reaction:235,beatPunch:220,detail:216,toothDepth:165,sharpness:90,glow:18,showSecondary:false},
  lotus:{name:'Lotus',icon:'✿',style:'smoothRing',shape:'lotus',size:48,thickness:3,opacity:74,reaction:150,beatPunch:155,detail:112,toothDepth:45,sharpness:45,glow:14,showSecondary:true},
  seal:{name:'Seal',icon:'◇',style:'brushRing',shape:'diamond',size:43,thickness:5,opacity:82,reaction:165,beatPunch:170,detail:72,toothDepth:35,sharpness:72,glow:6,showSecondary:false},
  spectrum:{name:'Spectrum',icon:'✺',style:'radial',shape:'circle',size:48,thickness:3,opacity:84,reaction:220,beatPunch:185,detail:144,toothDepth:125,sharpness:76,glow:20,showSecondary:false},
  mountain:{name:'Mountain',icon:'⌁',style:'mountain',shape:'circle',size:58,thickness:4,opacity:80,reaction:190,beatPunch:150,detail:144,toothDepth:90,sharpness:68,glow:8,showSecondary:false},
  bottom:{name:'Bottom',icon:'▁',style:'bottom',shape:'circle',size:72,thickness:4,opacity:84,reaction:200,beatPunch:170,detail:160,toothDepth:100,sharpness:72,glow:10,showSecondary:false},
  dual:{name:'Top + Bottom',icon:'═',style:'dual',shape:'circle',size:72,thickness:3,opacity:75,reaction:190,beatPunch:170,detail:160,toothDepth:95,sharpness:70,glow:8,showSecondary:false},
  sides:{name:'Side Bars',icon:'↔',style:'sides',shape:'circle',size:66,thickness:4,opacity:80,reaction:205,beatPunch:175,detail:128,toothDepth:105,sharpness:76,glow:12,showSecondary:false},
  star:{name:'Star Pulse',icon:'★',style:'smoothRing',shape:'star',size:45,thickness:3,opacity:76,reaction:180,beatPunch:200,detail:96,toothDepth:65,sharpness:64,glow:18,showSecondary:true}
};
const EDGE=new Set(['bottom','top','dual','left','right','sides']);
const ROUNDISH=new Set(['brushRing','smoothRing','radial','orbit','ncsClassic','ncsBars']);
const SOFT=new Set(['softBars','mirrorBars','roundedBars','centerBars']);
window.__FW_WAVE_CONFIG={DEFAULT_FILL,DEFAULT_PLATE,DEFAULT_WAVE,STYLE_OPTIONS,SHAPE_OPTIONS,TEMPLATES,EDGE,ROUNDISH,SOFT,FILLABLE:ROUNDISH};
})();
