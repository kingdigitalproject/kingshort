const $ = s => document.querySelector(s);
const els = {
  url: $('#youtubeUrl'), mode: $('#mode'), numClips: $('#numClips'), aspectRatio: $('#aspectRatio'),
  format: $('#format'), language: $('#language'), llmProvider: $('#llmProvider'),
  muapiKey: $('#muapiKey'), openaiKey: $('#openaiKey'), geminiKey: $('#geminiKey'),
  modeBadge: $('#modeBadge'), generateBtn: $('#generateBtn'), results: $('#results'),
  resultMeta: $('#resultMeta'), status: $('#status'), progress: $('#progress'),
  progressFill: $('#progressFill'), progressText: $('#progressText'),
  jsonOutput: $('#jsonOutput'), jsonPre: $('#jsonPre'), thumbPreview: $('#thumbPreview'),
  thumbImg: $('#thumbImg'), thumbTitle: $('#thumbTitle'), thumbMeta: $('#thumbMeta')
};

let lastResult = null;

els.modeBadge.textContent = 'SIAP';
els.modeBadge.style.background = 'var(--grad)';

function getVideoId(url){
  try{
    const u = new URL(url);
    if(u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0].split('/')[0];
    if(u.searchParams.get('v')) return u.searchParams.get('v');
    const m = url.match(/\/embed\/([^?/]+)/);
    if(m) return m[1];
  }catch{}
  return null;
}
function updateThumb(){
  const id = getVideoId(els.url.value.trim());
  if(id){
    els.thumbImg.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    els.thumbTitle.textContent = 'YouTube • ' + id;
    els.thumbMeta.textContent = `https://youtube.com/watch?v=${id}`;
    els.thumbPreview.style.display = 'flex';
  } else {
    els.thumbPreview.style.display = 'none';
  }
}
els.url.addEventListener('input', updateThumb);
els.url.addEventListener('paste', ()=> setTimeout(updateThumb, 50));

$('#pasteBtn').addEventListener('click', async()=>{
  try{ els.url.value = await navigator.clipboard.readText(); updateThumb(); }catch{}
});
$('#exampleBtn').addEventListener('click', ()=>{
  els.url.value = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  updateThumb();
});
$('#clearBtn').addEventListener('click', ()=>{
  els.url.value=''; lastResult=null;
  els.results.innerHTML=`<div class="empty"><div class="empty-icon">👑</div><p><b>Hasil Shorts kamu akan muncul di sini</b><br><small>Paste URL YouTube lalu klik Buat Shorts.</small></p></div>`;
  els.jsonOutput.style.display='none'; els.resultMeta.textContent='Belum ada — klik Buat Shorts';
  hideStatus(); els.thumbPreview.style.display='none';
});
$('#jsonBtn').addEventListener('click', ()=>{
  if(!lastResult){ showStatus('Belum ada hasil. Generate dulu.','info'); return; }
  els.jsonPre.textContent = JSON.stringify(lastResult,null,2);
  els.jsonOutput.style.display = els.jsonOutput.style.display==='none' ? 'block' : 'none';
  if(els.jsonOutput.style.display==='block') els.jsonOutput.scrollIntoView({behavior:'smooth'});
});
$('#copyJson').addEventListener('click', ()=>{
  navigator.clipboard.writeText(els.jsonPre.textContent);
  showStatus('JSON copied ✓','ok');
});
$('#downloadJson').addEventListener('click', ()=>{
  const blob = new Blob([els.jsonPre.textContent],{type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='result.json'; a.click();
});

function showStatus(msg, type='info'){
  els.status.textContent = msg; els.status.className='status '+type; els.status.style.display='block';
}
function hideStatus(){ els.status.style.display='none'; }
function showProgress(pct, text){
  els.progress.style.display='block'; els.progressFill.style.width=pct+'%'; els.progressText.textContent=text;
}
function hideProgress(){ els.progress.style.display='none'; }

function mockResult(url, numClips){
  const vid = getVideoId(url) || 'demo';
  const base = 40 + Math.floor(Math.random()*20);
  const titles = [
    "The one mistake that cost me $50K","Why your startup will fail in 6 months",
    "AI will replace this job first","Nobody talks about this marketing trick",
    "I interviewed 100 founders — this shocked me","3 rules for viral content",
    "The $10M lesson from my failed startup","Stop doing this if you want to grow",
    "How I got 1M followers in 90 days","The dark side of hustle culture"
  ];
  const hooks = [
    "\"Nobody talks about this, but it killed my first startup...\"",
    "\"If you're doing this, you're already losing...\"",
    "\"This one insight changed everything for me...\"",
    "\"I wish someone told me this 5 years ago...\"",
    "\"Most people get this completely wrong...\""
  ];
  const reasons = ["hook + conflict + quotable","emotional peak + revelation","opinion bomb + story peak","practical value + hook","conflict + quotable"];
  const shorts = Array.from({length:numClips},(_,i)=>{
    const score = 92 - i*4 - Math.floor(Math.random()*3);
    const start = 10 + i*85 + Math.floor(Math.random()*30);
    return {
      title: titles[i % titles.length],
      start_time: start, end_time: start + 35 + Math.floor(Math.random()*20),
      score, hook_sentence: hooks[i%hooks.length], virality_reason: reasons[i%reasons.length],
      clip_url: `https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4`,
      error: null
    };
  });
  return {
    brand: 'KINGSHORTCLIP',
    mode: 'demo',
    source_video_url: url,
    transcript: { duration: 600, segments: [{start:0,end:5,text:"KINGSHORTCLIP Demo"}]},
    highlights: shorts.map(s=>({...s, type:'highlight'})),
    shorts
  };
}

function renderResults(result){
  lastResult = result;
  const n = result.shorts.length;
  els.resultMeta.textContent = `${n} Shorts viral siap`;
  els.jsonPre.textContent = JSON.stringify(result,null,2);

  if(!result.shorts.length){
    els.results.innerHTML = `<div class="empty"><p>Gagal — tidak ada shorts.<br><small>${result.error||'Unknown'}</small></p></div>`;
    return;
  }
  els.results.innerHTML = result.shorts.map((s,i)=>{
    const scCls = s.score>=85 ? 'hi' : s.score>=75 ? 'mid' : 'lo';
    const hasClip = s.clip_url && !s.clip_url.includes('FAILED');
    const videoTag = hasClip ? `<video class="video-preview" controls preload="metadata" src="${s.clip_url}"></video>` : `<div style="background:#1a1a28;border:1px dashed #23233a;padding:12px;border-radius:10px;margin-top:10px;font-size:12px;color:#9aa0b8">⚠️ Clip belum tersedia — ${s.error||'cek MUAPI_API_KEY / pipeline'}<br><small style="font-family:monospace">${s.clip_url||''}</small></div>`;
    return `<div class="clip">
      <div class="clip-head"><span class="clip-num">#${i+1}</span><span class="clip-score ${scCls}">score ${s.score}</span></div>
      <h4>${s.title||'Untitled clip'}</h4>
      <div class="time">${Number(s.start_time).toFixed(1)}s → ${Number(s.end_time).toFixed(1)}s • ${(Number(s.end_time)-Number(s.start_time)).toFixed(1)}s dur</div>
      <div class="hook">🪝 ${s.hook_sentence||'-'}</div>
      <div class="reason">💡 ${s.virality_reason||'-'}</div>
      <div class="clip-actions">
        ${hasClip ? `<a class="btn-play" href="${s.clip_url}" target="_blank" download>⬇ Download mp4</a>
        <a class="btn-dl" href="${s.clip_url}" target="_blank">▶ Open</a>` : ``}
        <button class="btn-dl" onclick="navigator.clipboard.writeText('${(s.clip_url||'').replace(/'/g,"\\'")}');this.textContent='Copied ✓';setTimeout(()=>this.textContent='Copy URL',1500)">Copy URL</button>
      </div>
      ${videoTag}
    </div>`;
  }).join('');
}

async function callGenerate(payload){
  // Try Netlify Function first
  try{
    const r = await fetch('/.netlify/functions/generate', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    if(r.ok){
      const data = await r.json();
      // function may return {error} or actual result
      if(data.shorts || data.highlights) return data;
      if(data.error) throw new Error(data.error);
    }
    // if 404 (local file:// without netlify dev), fall through to mock
    if(r.status===404) throw new Error('Function not found — running in static mode');
    const txt = await r.text();
    throw new Error(txt.slice(0,500));
  }catch(e){
    // fallback: if demo mode or function unavailable, return mock
    if(payload.mode==='demo' || e.message.includes('Function not found') || e.message.includes('Failed to fetch')){
      return mockResult(payload.url, payload.num_clips);
    }
    throw e;
  }
}

els.generateBtn.addEventListener('click', async()=>{
  const url = els.url.value.trim();
  if(!url){ showStatus('Masukkan YouTube URL dulu.','err'); els.url.focus(); return; }
  // validate YouTube-ish unless demo/local file
  const isFile = url.startsWith('file://') || url.startsWith('/') || url.match(/^[A-Z]:\\/i);
  if(!isFile && !getVideoId(url) && !url.includes('youtube.com') && !url.includes('youtu.be')){
    // still allow — backend will validate, but warn
    showStatus('URL tidak terlihat seperti YouTube — tetap dicoba...','info');
  }

  const payload = {
    url,
    num_clips: parseInt(els.numClips.value,10),
    aspect_ratio: els.aspectRatio.value,
    format: els.format.value || "720",
    language: els.language.value || "auto",
    mode: els.mode.value || "api",
  };

  els.generateBtn.disabled=true; els.generateBtn.textContent='👑 Memproses...';
  showProgress(10,'KINGSHORTCLIP sedang mencari momen viral...');
  hideStatus();

  let pct=15;
  const progInterval = setInterval(()=>{
    pct = Math.min(90, pct+ Math.random()*8);
    showProgress(Math.floor(pct), pct<30?'Download video...' : pct<55?'Transcribe (Whisper)...' : pct<75?'Ranking highlights (LLM virality)...' : 'Cropping vertical...');
  }, 900);

  try{
    showStatus('Memproses — mohon tunggu 30–90 detik...','info');
    const result = await callGenerate(payload);
    clearInterval(progInterval);
    showProgress(100,'Selesai ✓'); setTimeout(hideProgress,1500);
    renderResults(result);
    showStatus(`Selesai — ${result.shorts.length} Shorts viral siap! Klik Download untuk simpan.`,'ok');
  }catch(err){
    clearInterval(progInterval); hideProgress();
    showStatus('Gagal: '+(err.message||err),'err');
    console.error(err);
  }finally{
    els.generateBtn.disabled=false; els.generateBtn.textContent='👑 Buat Shorts Viral Sekarang';
  }
});

// auto-thumb on load if example param
const params = new URLSearchParams(location.search);
if(params.get('url')){ els.url.value=params.get('url'); updateThumb(); }
