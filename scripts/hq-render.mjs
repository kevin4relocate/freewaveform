import {chromium} from 'playwright';
import FFT from 'fft.js';
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {mkdir,writeFile,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const FPS=30;
const SAMPLE_RATE=44100;
const FFT_SIZE=2048;
const ROOT=process.cwd();
const JOB_ID=process.env.JOB_ID;
const API_BASE=String(process.env.API_BASE||'').replace(/\/$/,'');
const TOKEN=process.env.HQ_RENDER_TOKEN;
const runtimeDir=path.join(ROOT,'.hq-runtime',JOB_ID||'missing');
const outputDir=path.join(ROOT,'.hq-output');
const outputPath=path.join(outputDir,'output.mp4');
if(!JOB_ID||!API_BASE||!TOKEN)throw new Error('JOB_ID, API_BASE and HQ_RENDER_TOKEN are required');

const authHeaders={authorization:`Bearer ${TOKEN}`};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const safe=s=>String(s||'asset').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,120)||'asset';

async function apiJson(url,options={}){
  const headers=new Headers(options.headers||{});headers.set('Authorization',`Bearer ${TOKEN}`);if(options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  const res=await fetch(url,{...options,headers});const text=await res.text();if(!res.ok)throw new Error(`${res.status} ${url}: ${text.slice(0,300)}`);return text?JSON.parse(text):{};
}
async function progress(value,message){try{await apiJson(`${API_BASE}/api/hq/progress/${JOB_ID}`,{method:'POST',body:JSON.stringify({progress:value,message})})}catch(err){console.warn('Progress update failed:',err.message)}}
async function downloadAsset(field,asset){
  const res=await fetch(`${API_BASE}/api/hq/asset/${encodeURIComponent(JOB_ID)}/${encodeURIComponent(field)}`,{headers:authHeaders});if(!res.ok)throw new Error(`Could not download ${field}: ${res.status}`);
  const filename=`${safe(field)}-${safe(asset.name)}`,dest=path.join(runtimeDir,filename);await writeFile(dest,Buffer.from(await res.arrayBuffer()));return dest;
}
function mimeFor(file){const ext=path.extname(file).toLowerCase();return({'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'}[ext]||'application/octet-stream')}
async function startStaticServer(){
  const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),rel=decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname),file=path.resolve(ROOT,'.'+rel);if(!file.startsWith(ROOT)){res.writeHead(403);res.end();return}const data=await readFile(file);res.writeHead(200,{'content-type':mimeFor(file),'cache-control':'no-store','cross-origin-resource-policy':'cross-origin'});res.end(data)}catch{res.writeHead(404);res.end('Not found')}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});const address=server.address();return{server,origin:`http://127.0.0.1:${address.port}`};
}
function ffprobeDuration(file){const r=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||'ffprobe failed');const d=Number(r.stdout.trim());if(!Number.isFinite(d)||d<=0)throw new Error('Invalid audio duration');return d}
function decodeAudio(file){const r=spawnSync('ffmpeg',['-v','error','-i',file,'-f','f32le','-ac','1','-ar',String(SAMPLE_RATE),'pipe:1'],{encoding:null,maxBuffer:512*1024*1024});if(r.status!==0)throw new Error(String(r.stderr||'ffmpeg audio decode failed'));const b=r.stdout,aligned=b.byteLength-b.byteLength%4;return new Float32Array(b.buffer,b.byteOffset,aligned/4)}
function analyzer(project){
  const fft=new FFT(FFT_SIZE),input=new Float64Array(FFT_SIZE),out=fft.createComplexArray(),bins=new Uint8Array(FFT_SIZE/2),prev=new Uint8Array(FFT_SIZE/2);let baseline=.04,lastBass=0,beatEnvelope=0,lastBeatFrame=-99;
  const syncMode=project?.reactive?.syncMode||'punchy',wave=project?.waveLayers?.[project?.waveActiveIndex||0]||project?.waveLayers?.[0]||{},sensitivity=(Number(wave.beatSensitivity)||135)/100,modeBoost={balanced:1,punchy:1.38,transient:1.78}[syncMode]||1;
  const band=(lo,hi)=>{const a=clamp(Math.floor(lo*FFT_SIZE/SAMPLE_RATE),0,bins.length-1),z=clamp(Math.ceil(hi*FFT_SIZE/SAMPLE_RATE),a+1,bins.length);let sum=0;for(let i=a;i<z;i++)sum+=bins[i];return(z>a?sum/(z-a):0)/255};
  return(samples,frame,time)=>{
    const center=Math.floor(time*SAMPLE_RATE),start=center-Math.floor(FFT_SIZE/2);for(let i=0;i<FFT_SIZE;i++){const idx=start+i,s=idx>=0&&idx<samples.length?samples[idx]:0,win=.5-.5*Math.cos(2*Math.PI*i/(FFT_SIZE-1));input[i]=s*win}
    fft.realTransform(out,input);
    for(let k=0;k<bins.length;k++){const re=out[2*k],im=out[2*k+1],mag=Math.sqrt(re*re+im*im)/(FFT_SIZE/2),db=20*Math.log10(mag+1e-8);bins[k]=Math.round(clamp((db+92)/82,0,1)*255)}
    const bass=band(35,180),mid=band(180,1800),treble=band(1800,9000);let fluxSum=0,fluxCount=0,maxBin=Math.min(bins.length,420);for(let i=2;i<maxBin;i+=2){const d=bins[i]-prev[i];if(d>0)fluxSum+=d;prev[i]=bins[i];fluxCount++}const flux=fluxCount?clamp(fluxSum/(fluxCount*34),0,1.6):0,combined=bass*.62+mid*.27+treble*.11,delta=Math.max(0,combined-baseline);baseline=baseline+(combined-baseline)*(combined>baseline?.022:.065);const bassAttack=Math.max(0,bass-lastBass);lastBass=lastBass+(bass-lastBass)*.22;const raw=clamp((delta*7.6+bassAttack*4.5+flux*.72)*sensitivity*modeBoost,0,1.8);if(raw>.34&&frame-lastBeatFrame>=2){beatEnvelope=Math.max(beatEnvelope,raw);lastBeatFrame=frame}else beatEnvelope=Math.max(raw*.64,beatEnvelope*(syncMode==='transient'?.74:.80));return{bass,mid,treble,beat:clamp(beatEnvelope,0,1.8),flux,time,bins:Array.from(bins)};
  }
}
async function waitDrain(stream){if(stream.write(''))return;await new Promise((resolve,reject)=>{stream.once('drain',resolve);stream.once('error',reject)})}
async function run(){
  await mkdir(runtimeDir,{recursive:true});await mkdir(outputDir,{recursive:true});await progress(4,'Loading HQ render job');
  const manifest=await apiJson(`${API_BASE}/api/hq/job/${JOB_ID}`),assetPaths={},assetUrls={};for(const [field,asset] of Object.entries(manifest.assets||{}))assetPaths[field]=await downloadAsset(field,asset);const audioPath=assetPaths.audio;if(!audioPath)throw new Error('HQ job has no audio asset');
  const duration=ffprobeDuration(audioPath),samples=decodeAudio(audioPath),analyze=analyzer(manifest.project||{}),frames=Math.max(1,Math.ceil(duration*FPS));await progress(7,`Preparing ${frames} deterministic frames`);
  const {server,origin}=await startStaticServer();for(const [field,file] of Object.entries(assetPaths)){if(field==='audio')continue;assetUrls[field]=`${origin}/${path.relative(ROOT,file).split(path.sep).map(encodeURIComponent).join('/')}`}
  const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage','--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});await page.goto(`${origin}/?hq-render=1`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__FW_HQ_EXPORT&&window.__FW_MULTI_WAVE&&window.__FW_WAVE_FILL,{timeout:60000});await page.evaluate(async({project,urls})=>{await window.__FW_HQ_EXPORT.applySnapshot(project,urls);window.__FW_HQ_EXPORT.enterRenderMode()},{project:manifest.project||{},urls:assetUrls});await sleep(120);
    const ff=spawn('ffmpeg',['-y','-loglevel','warning','-f','image2pipe','-framerate',String(FPS),'-vcodec','png','-i','pipe:0','-i',audioPath,'-c:v','libx264','-preset','medium','-crf','16','-profile:v','high','-pix_fmt','yuv420p','-c:a','aac','-b:a','320k','-shortest','-movflags','+faststart',outputPath],{stdio:['pipe','inherit','pipe']});ff.stderr.pipe(process.stderr);const ffDone=new Promise((resolve,reject)=>{ff.once('error',reject);ff.once('close',code=>code===0?resolve():reject(new Error(`ffmpeg exited ${code}`)))});
    for(let frame=0;frame<frames;frame++){
      const time=frame/FPS,energy=analyze(samples,frame,time);await page.evaluate(e=>{e.bins=Uint8Array.from(e.bins);window.__FW_HQ_EXPORT.renderFrame(e)},energy);const dataUrl=await page.evaluate(()=>document.getElementById('canvas').toDataURL('image/png')),png=Buffer.from(dataUrl.slice(dataUrl.indexOf(',')+1),'base64');if(!ff.stdin.write(png))await new Promise((resolve,reject)=>{ff.stdin.once('drain',resolve);ff.stdin.once('error',reject)});
      if(frame%150===0){const pct=8+Math.floor(frame/frames*84);await progress(pct,`Rendering frame ${frame+1} / ${frames}`)}
    }
    ff.stdin.end();await ffDone;await progress(94,'Encoding finished; uploading MP4');
  }finally{await browser.close().catch(()=>{});await new Promise(r=>server.close(r))}
  const info=await stat(outputPath);if(info.size<1024*1024)throw new Error('Rendered MP4 is unexpectedly small');console.log(`HQ MP4 ready: ${outputPath} (${(info.size/1024/1024).toFixed(1)} MB)`);
}
run().catch(async err=>{console.error(err);try{await apiJson(`${API_BASE}/api/hq/fail/${JOB_ID}`,{method:'POST',body:JSON.stringify({message:String(err?.stack||err).slice(0,500)})})}catch{}process.exitCode=1});
