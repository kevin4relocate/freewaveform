const JSON_HEADERS={'content-type':'application/json;charset=UTF-8','cache-control':'no-store'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const safe=s=>String(s||'file').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,120)||'file';
const now=()=>new Date().toISOString();
function parts(params){const raw=params?.path;return(Array.isArray(raw)?raw:String(raw||'').split('/')).filter(Boolean)}
function exportAuthorized(request,env){const expected=String(env.HQ_EXPORT_KEY||'').trim();return!expected||request.headers.get('X-HQ-Key')===expected}
function runnerAuthorized(request,env){const expected=String(env.HQ_RENDER_TOKEN||'').trim(),auth=request.headers.get('authorization')||'';return!!expected&&auth===`Bearer ${expected}`}
const statusKey=id=>`jobs/${id}/status.json`;
const manifestKey=id=>`jobs/${id}/manifest.json`;
async function readJson(bucket,key){const obj=await bucket.get(key);if(!obj)return null;try{return JSON.parse(await obj.text())}catch{return null}}
async function writeJson(bucket,key,value){await bucket.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}})}
async function updateStatus(bucket,id,patch){const current=await readJson(bucket,statusKey(id))||{jobId:id,createdAt:now()};const next={...current,...patch,updatedAt:now()};await writeJson(bucket,statusKey(id),next);return next}
async function dispatchGitHub(env,jobId,apiBase){
  const repo=String(env.GITHUB_REPO||'').trim(),token=String(env.GITHUB_TOKEN||'').trim(),workflow=String(env.GITHUB_WORKFLOW||'hq-render.yml').trim(),ref=String(env.GITHUB_REF||'main').trim();
  if(!repo||!token)throw new Error('GITHUB_REPO / GITHUB_TOKEN is not configured');
  const r=await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,{method:'POST',headers:{accept:'application/vnd.github+json',authorization:`Bearer ${token}`,'content-type':'application/json','user-agent':'FreeWaveform-HQ','x-github-api-version':'2022-11-28'},body:JSON.stringify({ref,inputs:{job_id:jobId,api_base:apiBase}})});
  if(!r.ok){const body=await r.text();throw new Error(`GitHub dispatch failed (${r.status}): ${body.slice(0,240)}`)}
}
async function handleStart(request,env){
  if(!exportAuthorized(request,env))return json({error:'Invalid HQ Export Key'},401);
  if(!env.HQ_BUCKET)return json({error:'R2 binding HQ_BUCKET is not configured'},503);
  if(!env.HQ_RENDER_TOKEN)return json({error:'HQ_RENDER_TOKEN is not configured'},503);
  if(!env.GITHUB_TOKEN||!env.GITHUB_REPO)return json({error:'GitHub Actions dispatch is not configured'},503);
  let form;try{form=await request.formData()}catch{return json({error:'Invalid multipart request'},400)}
  const rawProject=form.get('project');if(typeof rawProject!=='string')return json({error:'Missing project snapshot'},400);
  let project;try{project=JSON.parse(rawProject)}catch{return json({error:'Invalid project snapshot'},400)}
  const audio=form.get('audio');if(!(audio instanceof File)||!audio.size)return json({error:'Missing audio file'},400);
  if(audio.size>80*1024*1024)return json({error:'Audio file is too large for HQ export'},413);
  const id=crypto.randomUUID(),downloadToken=crypto.randomUUID()+crypto.randomUUID().replaceAll('-',''),base=`jobs/${id}`,assets={};
  try{
    for(const [field,value] of form.entries()){
      if(!(value instanceof File)||!value.size)continue;
      if(value.size>80*1024*1024)throw new Error(`${field} is too large`);
      const name=safe(value.name||field),key=`${base}/assets/${safe(field)}-${name}`;await env.HQ_BUCKET.put(key,value.stream(),{httpMetadata:{contentType:value.type||'application/octet-stream'}});assets[field]={field,key,name,type:value.type||'application/octet-stream',size:value.size};
    }
    if(!assets.audio)throw new Error('Audio upload failed');
    const fileName=`freewaveform-hq-${id.slice(0,8)}.mp4`,manifest={version:1,jobId:id,createdAt:now(),project,assets,resultKey:`${base}/output.mp4`,fileName};
    await writeJson(env.HQ_BUCKET,manifestKey(id),manifest);await writeJson(env.HQ_BUCKET,statusKey(id),{jobId:id,state:'queued',progress:1,message:'Queued for HQ renderer',createdAt:now(),updatedAt:now(),downloadToken,fileName,expiresAt:new Date(Date.now()+24*3600*1000).toISOString()});
    await dispatchGitHub(env,id,new URL(request.url).origin);
    return json({jobId:id,state:'queued'});
  }catch(err){await updateStatus(env.HQ_BUCKET,id,{state:'failed',progress:0,message:String(err?.message||err)}).catch(()=>{});return json({error:String(err?.message||err)},500)}
}
async function handleStatus(request,env,id){
  if(!exportAuthorized(request,env))return json({error:'Invalid HQ Export Key'},401);const s=await readJson(env.HQ_BUCKET,statusKey(id));if(!s)return json({error:'HQ job not found'},404);const out={jobId:id,state:s.state||'queued',progress:+s.progress||0,message:s.message||'',fileName:s.fileName||'freewaveform-hq.mp4',updatedAt:s.updatedAt||s.createdAt};if(s.state==='ready'&&s.downloadToken)out.downloadUrl=`/api/hq/download/${encodeURIComponent(id)}?token=${encodeURIComponent(s.downloadToken)}`;return json(out)
}
async function handleJob(request,env,id){if(!runnerAuthorized(request,env))return json({error:'Unauthorized renderer'},401);const m=await readJson(env.HQ_BUCKET,manifestKey(id));if(!m)return json({error:'HQ job not found'},404);await updateStatus(env.HQ_BUCKET,id,{state:'rendering',progress:3,message:'Renderer started'});return json(m)}
async function handleAsset(request,env,id,field){if(!runnerAuthorized(request,env))return json({error:'Unauthorized renderer'},401);const m=await readJson(env.HQ_BUCKET,manifestKey(id)),asset=m?.assets?.[field];if(!asset)return json({error:'Asset not found'},404);const obj=await env.HQ_BUCKET.get(asset.key);if(!obj)return json({error:'Asset missing from R2'},404);const h=new Headers();obj.writeHttpMetadata(h);h.set('cache-control','private, max-age=3600');h.set('content-disposition',`inline; filename="${safe(asset.name)}"`);return new Response(obj.body,{headers:h})}
async function handleProgress(request,env,id){if(!runnerAuthorized(request,env))return json({error:'Unauthorized renderer'},401);let body={};try{body=await request.json()}catch{}const progress=Math.max(3,Math.min(96,Number(body.progress)||3));await updateStatus(env.HQ_BUCKET,id,{state:'rendering',progress,message:String(body.message||'Rendering HQ MP4').slice(0,160)});return json({ok:true})}
async function handleComplete(request,env,id){if(!runnerAuthorized(request,env))return json({error:'Unauthorized renderer'},401);const m=await readJson(env.HQ_BUCKET,manifestKey(id));if(!m)return json({error:'HQ job not found'},404);const result=await env.HQ_BUCKET.head(m.resultKey);if(!result)return json({error:'Rendered MP4 is not in R2 yet'},409);await updateStatus(env.HQ_BUCKET,id,{state:'ready',progress:100,message:'HQ MP4 ready',size:result.size,fileName:m.fileName});return json({ok:true})}
async function handleFail(request,env,id){if(!runnerAuthorized(request,env))return json({error:'Unauthorized renderer'},401);let body={};try{body=await request.json()}catch{}await updateStatus(env.HQ_BUCKET,id,{state:'failed',progress:0,message:String(body.message||'HQ renderer failed').slice(0,300)});return json({ok:true})}
async function handleDownload(request,env,id){const s=await readJson(env.HQ_BUCKET,statusKey(id)),token=new URL(request.url).searchParams.get('token');if(!s||s.state!=='ready'||!token||token!==s.downloadToken)return json({error:'Invalid or expired download'},403);const m=await readJson(env.HQ_BUCKET,manifestKey(id)),obj=m&&await env.HQ_BUCKET.get(m.resultKey);if(!obj)return json({error:'Rendered MP4 not found'},404);const h=new Headers();obj.writeHttpMetadata(h);h.set('content-type','video/mp4');h.set('content-disposition',`attachment; filename="${safe(m.fileName||'freewaveform-hq.mp4')}"`);h.set('cache-control','private, no-store');return new Response(obj.body,{headers:h})}
export async function onRequest({request,env,params}){
  try{const p=parts(params),method=request.method.toUpperCase();if(method==='POST'&&p[0]==='start')return handleStart(request,env);if(method==='GET'&&p[0]==='status'&&p[1])return handleStatus(request,env,p[1]);if(method==='GET'&&p[0]==='job'&&p[1])return handleJob(request,env,p[1]);if(method==='GET'&&p[0]==='asset'&&p[1]&&p[2])return handleAsset(request,env,p[1],p[2]);if(method==='POST'&&p[0]==='progress'&&p[1])return handleProgress(request,env,p[1]);if(method==='POST'&&p[0]==='complete'&&p[1])return handleComplete(request,env,p[1]);if(method==='POST'&&p[0]==='fail'&&p[1])return handleFail(request,env,p[1]);if(method==='GET'&&p[0]==='download'&&p[1])return handleDownload(request,env,p[1]);return json({error:'HQ API route not found'},404)}catch(err){console.error(err);return json({error:String(err?.message||err)},500)}
}
