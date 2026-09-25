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
  const titles = [
    "Kesalahan 50 Juta yang Bikin Dagangan Sepi",
    "Kenapa Banyak UMKM Gagal di 6 Bulan Pertama",
    "Pekerjaan Ini Bakal Diganti AI Paling Cepat",
    "Rahasia Marketing yang Jarang Dibahas Orang",
    "Wawancara 100 Founder — Ini yang Paling Ngejutin",
    "3 Rumus Konten Biar FYP Terus",
    "Pelajaran 10 Miliar dari Startup yang Gagal",
    "Stop Lakuin Ini Kalau Mau Omzet Naik",
    "Cara Dapat 1 Juta Followers dalam 90 Hari",
    "Sisi Gelap Hustle Culture yang Jarang Diceritain"
  ];
  const hooks = [
    "\"Gak ada yang bahas ini, padahal ini yang bikin usaha gue tutup...\"",
    "\"Kalau kamu masih ngelakuin ini, kamu udah kalah duluan...\"",
    "\"Satu insight ini ngubah hidup gue total...\"",
    "\"Andai ada yang kasih tau gue 5 tahun lalu...\"",
    "\"Kebanyakan orang salah paham soal ini...\""
  ];
  const reasons = ["hook kuat + konflik + quotable","puncak emosi + pengungkapan","opini berani + cerita puncak","nilai praktis + hook","konflik + quotable"];
  const clips = [
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
  ];
  const shorts = Array.from({length:numClips},(_,i)=>{
    const score = 92 - i*4 - Math.floor(Math.random()*3);
    const start = 10 + i*85 + Math.floor(Math.random()*30);
    return {
      title: titles[i % titles.length],
      start_time: start, end_time: start + 35 + Math.floor(Math.random()*20),
      score, hook_sentence: hooks[i%hooks.length], virality_reason: reasons[i%reasons.length],
      clip_url: clips[i % clips.length],
      error: null
    };
  });
  return {
    brand: 'KINGSHORTCLIP',
    provider: 'ciora.id',
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
    const videoTag = hasClip ? `<video class="video-preview" controls preload="metadata" playsinline crossorigin="anonymous" src="${s.clip_url}" onerror="this.outerHTML='<div style=\\'background:#1a1a28;border:1px dashed #2e2415;padding:10px;border-radius:10px;margin-top:10px;font-size:12px;color:#a99a7a\\'>⚠️ Preview gagal load — klik Download untuk tonton. <a href=\\'${s.clip_url}\\' target=\\'_blank\\' style=\\'color:#FFD700\\'>Buka video ↗</a></div>'"></video>` : `<div style="background:#1a1a28;border:1px dashed #2e2415;padding:12px;border-radius:10px;margin-top:10px;font-size:12px;color:#a99a7a">⚠️ Clip belum tersedia — ${s.error||''}<br><small style="font-family:monospace">${s.clip_url||''}</small></div>`;
    return `<div class="clip">
      <div class="clip-head"><span class="clip-num">#${i+1}</span><span class="clip-score ${scCls}">skor ${s.score}</span></div>
      <h4>${s.title||'Tanpa judul'}</h4>
      <div class="time">${Number(s.start_time).toFixed(1)}d → ${Number(s.end_time).toFixed(1)}d • ${(Number(s.end_time)-Number(s.start_time)).toFixed(1)}d</div>
      <div class="hook">🪝 ${s.hook_sentence||'-'}</div>
      <div class="reason">💡 Alasan viral: ${s.virality_reason||'-'}</div>
      <div class="clip-actions">
        ${hasClip ? `<a class="btn-play" href="${s.clip_url}" target="_blank" download>⬇ Download</a>
        <a class="btn-dl" href="${s.clip_url}" target="_blank">▶ Buka</a>` : ``}
        <button class="btn-dl" onclick="navigator.clipboard.writeText('${(s.clip_url||'').replace(/'/g,"\\'")}');this.textContent='Tersalin ✓';setTimeout(()=>this.textContent='Salin Link',1500)">Salin Link</button>
      </div>
      ${videoTag}
    </div>`;
  }).join('');
}

async function callGenerate(payload){
  try{
    const r = await fetch('/.netlify/functions/generate', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    const data = await r.json().catch(()=> ({}));
    if(r.ok){
      if(data.shorts || data.highlights) return data;
      if(data.error) throw new Error(data.error);
      return data;
    }
    // Handle 402 INSUFFICIENT_CREDITS specially
    if(r.status===402 || data.error_code==="INSUFFICIENT_CREDITS"){
      const err = new Error(data.error || "INSUFFICIENT_CREDITS");
      err.code = "INSUFFICIENT_CREDITS";
      err.status = 402;
      err.detail = data;
      throw err;
    }
    if(r.status===404) throw new Error('Function not found — running in static mode');
    throw new Error(data.error || data.hint || JSON.stringify(data).slice(0,600) || `HTTP ${r.status}`);
  }catch(e){
    if(e.code==="INSUFFICIENT_CREDITS") throw e;
    if(payload.mode==='demo' || e.message.includes('Function not found') || e.message.includes('Failed to fetch')){
      return mockResult(payload.url, payload.num_clips);
    }
    throw e;
  }
}

function renderCreditError(err){
  const d = err.detail || {};
  els.results.innerHTML = `
    <div class="clip" style="border-color:#ffb700;background:linear-gradient(135deg,rgba(255,183,0,.12),rgba(255,90,0,.08))">
      <div class="clip-head"><span class="clip-num" style="background:#ff3b30">402</span><span class="clip-score" style="color:#ffb700">INSUFFICIENT_CREDITS</span></div>
      <h4 style="margin:8px 0">💳 Kredit MuAPI Habis</h4>
      <p style="font-size:13px;color:var(--muted);line-height:1.6">Saldo kredit MuAPI tidak cukup untuk memproses video. Setiap video butuh kredit untuk <b>download + transcribe + AI ranking + crop</b>. Top up dulu, lalu coba lagi.</p>
      <div style="background:rgba(0,0,0,.25);padding:10px;border-radius:10px;margin:10px 0;font-size:12px">
        <div style="color:#ffb700">Endpoint gagal: <b>${d.endpoint_failed||'youtube-download'}</b></div>
        <div style="margin-top:4px;word-break:break-all;color:var(--muted)">${(err.message||'').slice(0,300)}</div>
      </div>
      <div class="clip-actions">
        <a class="btn-play" href="${d.topup_url||'https://muapi.ai/topup'}" target="_blank">💳 Top Up di muapi.ai ↗</a>
        <a class="btn-dl" href="https://muapi.ai/dashboard" target="_blank">Cek Saldo</a>
        <button class="btn-dl" id="tryDemoBtn">👑 Coba Demo (Gratis, tanpa kredit)</button>
      </div>
      <small style="display:block;margin-top:10px;color:var(--muted)">Sementara menunggu top up, klik <b>Coba Demo</b> untuk lihat preview KINGSHORTCLIP dengan video contoh.</small>
    </div>`;
  document.getElementById('tryDemoBtn')?.addEventListener('click', async()=>{
    showStatus('Menampilkan Demo KINGSHORTCLIP...','info');
    const demo = mockResult(els.url.value.trim()||'https://www.youtube.com/watch?v=dQw4w9WgXcQ', parseInt(els.numClips.value,10));
    renderResults(demo);
    showStatus('Ini hasil Demo (tanpa pakai kredit) — Top up untuk proses video asli.','ok');
  });
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
  showProgress(10,'KINGSHORTCLIP by ciora.id — gratis, mencari momen viral...');
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
    if(err.code==="INSUFFICIENT_CREDITS"){
      renderCreditError(err);
      showStatus('💳 Kredit habis — Top up di muapi.ai/topup lalu coba lagi. Atau klik Coba Demo.','err');
    } else {
      showStatus('Gagal: '+(err.message||err),'err');
    }
    console.error(err);
  }finally{
    els.generateBtn.disabled=false; els.generateBtn.textContent='👑 Buat Shorts Viral Sekarang';
  }
});

// auto-thumb on load if example param
const params = new URLSearchParams(location.search);
if(params.get('url')){ els.url.value=params.get('url'); updateThumb(); }
