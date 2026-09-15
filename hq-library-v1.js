(()=>{
'use strict';
if(new URLSearchParams(location.search).get('hq-render')==='1')return;
const toast=window.__FW_TOAST||(()=>{});
let modal=null,jobs=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const bytes=n=>{n=Number(n)||0;if(n<1024)return`${n} B`;if(n<1024**2)return`${(n/1024).toFixed(1)} KB`;if(n<1024**3)return`${(n/1024**2).toFixed(1)} MB`;return`${(n/1024**3).toFixed(2)} GB`};
const when=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(+d)?'—':d.toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})};
function getKey(){return localStorage.getItem('fw.hqExportKey')||''}
function syncKeyButton(){const b=modal?.querySelector('[data-hq-forget]');if(!b)return;const has=!!getKey();b.disabled=!has;b.title=has?'Remove the saved HQ Export Key from this browser':'No HQ Export Key is saved in this browser'}
async function apiFetch(url,options={},retry=true){
  const headers=new Headers(options.headers||{}),key=getKey();if(key)headers.set('X-HQ-Key',key);
  const res=await fetch(url,{...options,headers});
  if(res.status===401&&retry){const entered=prompt('Enter your HQ Export Key');if(entered){localStorage.setItem('fw.hqExportKey',entered.trim());syncKeyButton();return apiFetch(url,options,false)}}
  return res;
}
function styleMount(){
  if(document.getElementById('fw-hq-library-style'))return;
  const s=document.createElement('style');s.id='fw-hq-library-style';s.textContent=`
.fw-hq-files-btn{white-space:nowrap}.fw-hq-backdrop{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:22px}.fw-hq-backdrop[hidden]{display:none!important}.fw-hq-library{width:min(760px,96vw);max-height:min(720px,88vh);display:flex;flex-direction:column;border:1px solid #343a3d;border-radius:14px;background:#0c1113;color:#ddd5ca;box-shadow:0 24px 70px rgba(0,0,0,.6);overflow:hidden}.fw-hq-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #242a2d}.fw-hq-head strong{font-size:14px;color:#f0e7da}.fw-hq-head small{display:block;margin-top:3px;color:#7f8583;font-size:9px}.fw-hq-head-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.fw-hq-head-actions button,.fw-hq-job-actions button{height:30px;border:1px solid #333a3d;border-radius:8px;background:#111719;color:#cfc7bc;padding:0 10px;font:600 9px Inter,system-ui,sans-serif;cursor:pointer}.fw-hq-head-actions button:hover,.fw-hq-job-actions button:hover{border-color:#8d673e;color:#edc27d}.fw-hq-head-actions .danger,.fw-hq-job-actions .danger{color:#d9978b}.fw-hq-head-actions .danger:hover,.fw-hq-job-actions .danger:hover{border-color:#77473e;background:#1c1110;color:#f0b0a3}.fw-hq-head-actions button:disabled,.fw-hq-job-actions button:disabled{opacity:.35;cursor:not-allowed}.fw-hq-list{overflow:auto;padding:10px 12px 14px;display:grid;gap:8px}.fw-hq-summary{display:flex;justify-content:space-between;gap:12px;padding:9px 11px;border:1px solid #252c2f;border-radius:9px;background:#0a0f11;color:#8f9693;font-size:9px}.fw-hq-job{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px;border:1px solid #293034;border-radius:10px;background:#0e1416}.fw-hq-job-title{min-width:0}.fw-hq-job-title b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#ddd4c7;font-size:11px}.fw-hq-job-meta{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:5px;color:#7f8583;font-size:8px}.fw-hq-state{font-weight:700;text-transform:uppercase;letter-spacing:.07em}.fw-hq-state.ready{color:#83c59a}.fw-hq-state.rendering,.fw-hq-state.queued{color:#d7ae67}.fw-hq-state.failed{color:#d98d82}.fw-hq-job-actions{display:flex;gap:6px}.fw-hq-empty{padding:28px 14px;text-align:center;color:#717876;font-size:10px;border:1px dashed #2b3235;border-radius:10px}.fw-hq-loading{padding:34px;text-align:center;color:#8c9390;font-size:10px}@media(max-width:620px){.fw-hq-job{grid-template-columns:1fr}.fw-hq-job-actions{justify-content:flex-start}.fw-hq-head{align-items:flex-start;flex-direction:column}.fw-hq-head-actions{width:100%;justify-content:flex-start}}
`;
  document.head.appendChild(s);
}
function ensureModal(){
  if(modal)return modal;styleMount();
  modal=document.createElement('div');modal.className='fw-hq-backdrop';modal.hidden=true;modal.style.display='none';modal.setAttribute('aria-hidden','true');modal.innerHTML=`<div class="fw-hq-library" role="dialog" aria-modal="true" aria-label="HQ files in R2"><div class="fw-hq-head"><div><strong>HQ Files in R2</strong><small>Files automatically expire after about 1 day. You can remove finished jobs earlier.</small></div><div class="fw-hq-head-actions"><button type="button" data-hq-refresh>Refresh</button><button type="button" class="danger" data-hq-delete-finished>Delete finished</button><button type="button" data-hq-forget>Forget HQ Key</button><button type="button" data-hq-close>Close</button></div></div><div class="fw-hq-list"><div class="fw-hq-loading">Loading HQ files…</div></div></div>`;
  document.body.appendChild(modal);syncKeyButton();
  modal.addEventListener('click',e=>{
    if(e.target===modal||e.target.closest('[data-hq-close]')){e.preventDefault();e.stopPropagation();closeModal();return}
    if(e.target.closest('[data-hq-forget]')){e.preventDefault();e.stopPropagation();forgetKey();return}
    if(e.target.closest('[data-hq-refresh]'))load();
    const d=e.target.closest('[data-hq-delete]');if(d)removeJob(d.dataset.hqDelete);
    const a=e.target.closest('[data-hq-download]');if(a)downloadJob(a.dataset.hqDownload);
    if(e.target.closest('[data-hq-delete-finished]'))deleteFinished();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal&&!modal.hidden)closeModal()});
  return modal;
}
function render(totalBytes=0){
  const list=ensureModal().querySelector('.fw-hq-list'),finished=jobs.filter(j=>!['queued','rendering'].includes(j.state));
  const summary=`<div class="fw-hq-summary"><span>${jobs.length} job${jobs.length===1?'':'s'} in R2</span><span>Total storage: <b>${bytes(totalBytes)}</b></span></div>`;
  if(!jobs.length){list.innerHTML=summary+'<div class="fw-hq-empty">No HQ files are currently stored in R2.</div>';return}
  list.innerHTML=summary+jobs.map(j=>{
    const active=['queued','rendering'].includes(j.state),ready=j.state==='ready'&&j.downloadUrl,name=j.sourceName||j.fileName||`HQ ${j.jobId.slice(0,8)}`;
    const progress=active?` · ${Math.round(+j.progress||0)}%`:'';
    return `<div class="fw-hq-job"><div class="fw-hq-job-title"><b title="${esc(name)}">${esc(name)}</b><div class="fw-hq-job-meta"><span class="fw-hq-state ${esc(j.state)}">${esc(j.state)}${progress}</span><span>${bytes(j.totalBytes)} stored</span><span>Created ${esc(when(j.createdAt))}</span><span>Expires ${esc(when(j.expiresAt))}</span></div></div><div class="fw-hq-job-actions">${ready?`<button type="button" data-hq-download="${esc(j.jobId)}">Download</button>`:''}<button type="button" class="danger" data-hq-delete="${esc(j.jobId)}" ${active?'disabled title="Render still running"':''}>Delete</button></div></div>`
  }).join('');
  const bulk=modal.querySelector('[data-hq-delete-finished]');if(bulk)bulk.disabled=!finished.length;syncKeyButton();
}
async function load(){
  const list=ensureModal().querySelector('.fw-hq-list');list.innerHTML='<div class="fw-hq-loading">Loading HQ files…</div>';
  try{const res=await apiFetch('/api/hq/list');const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||`Could not list HQ files (${res.status})`);jobs=Array.isArray(data.jobs)?data.jobs:[];render(+data.totalBytes||0)}catch(err){list.innerHTML=`<div class="fw-hq-empty">${esc(err?.message||'Could not load HQ files')}</div>`}
}
function downloadJob(id){const j=jobs.find(x=>x.jobId===id);if(!j?.downloadUrl)return;const a=document.createElement('a');a.href=j.downloadUrl;a.download=j.fileName||'freewaveform-hq.mp4';document.body.appendChild(a);a.click();a.remove()}
async function removeJob(id,skipConfirm=false){
  const j=jobs.find(x=>x.jobId===id);if(!j)return false;const name=j.sourceName||j.fileName||id.slice(0,8);
  if(!skipConfirm&&!confirm(`Delete "${name}" from R2 now?\n\nThis removes the MP4, audio, images and job files. This cannot be undone.`))return false;
  try{const res=await apiFetch(`/api/hq/job/${encodeURIComponent(id)}`,{method:'DELETE'});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||`Delete failed (${res.status})`);jobs=jobs.filter(x=>x.jobId!==id);toast(`Deleted ${name} · freed ${bytes(data.freedBytes)}`);if(!skipConfirm)await load();return true}catch(err){toast(err?.message||'Could not delete HQ job');return false}
}
async function deleteFinished(){
  const targets=jobs.filter(j=>!['queued','rendering'].includes(j.state));if(!targets.length)return;
  if(!confirm(`Delete ${targets.length} finished HQ job${targets.length===1?'':'s'} from R2?\n\nThis removes their MP4, audio, images and job files.`))return;
  const button=modal.querySelector('[data-hq-delete-finished]');if(button)button.disabled=true;
  let deleted=0;for(const j of [...targets])if(await removeJob(j.jobId,true))deleted++;
  toast(`Deleted ${deleted} finished HQ job${deleted===1?'':'s'}`);await load();
}
function forgetKey(){
  if(!getKey()){toast('No HQ Export Key is saved in this browser');syncKeyButton();return false}
  if(!confirm('Forget the HQ Export Key saved in this browser?\n\nYou will be asked for it again the next time you use HQ Export or HQ Files.'))return false;
  localStorage.removeItem('fw.hqExportKey');syncKeyButton();closeModal();toast('HQ Export Key forgotten from this browser');return true;
}
function open(){const m=ensureModal();syncKeyButton();m.hidden=false;m.style.display='grid';m.setAttribute('aria-hidden','false');load()}
function closeModal(){if(!modal)return;modal.hidden=true;modal.style.display='none';modal.setAttribute('aria-hidden','true')}
function mountButton(){
  const anchor=document.getElementById('hqDownloadBtn')||document.getElementById('hqExportBtn')||document.getElementById('exportBtn');if(!anchor||document.getElementById('hqFilesBtn'))return;
  const b=document.createElement('button');b.id='hqFilesBtn';b.type='button';b.className='button ghost fw-hq-files-btn';b.textContent='HQ Files';b.title='View and delete HQ files currently stored in R2';b.addEventListener('click',open);anchor.insertAdjacentElement('afterend',b)
}
styleMount();mountButton();
window.__FW_HQ_LIBRARY={open,close:closeModal,refresh:load,forgetKey};
})();
