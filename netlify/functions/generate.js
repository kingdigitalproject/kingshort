// KINGSHORTCLIP — Netlify Function: POST /.netlify/functions/generate
// Fixed to match actual MuAPI spec from shorts_generator/muapi.py
// MUAPI_BASE_URL must be https://api.muapi.ai/api/v1 (see config.py)
// Endpoints: youtube-download, openai-whisper, gpt-5-mini, autocrop

const MUAPI_BASE = (process.env.MUAPI_BASE_URL || "https://api.muapi.ai/api/v1").replace(/\/$/, "");
const POLL_INTERVAL = parseInt(process.env.MUAPI_POLL_INTERVAL || "5000", 10);
const POLL_TIMEOUT = parseInt(process.env.MUAPI_POLL_TIMEOUT || "600000", 10); // 600s default like config.py

function json(status, body){
  return { statusCode: status, headers: {"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}, body: JSON.stringify(body) };
}

function headers(apiKey){
  return { "Content-Type":"application/json", "x-api-key": apiKey };
}

// --- MuAPI client (port of shorts_generator/muapi.py) ---
async function submit(endpoint, payload, apiKey){
  const url = `${MUAPI_BASE}/${endpoint.replace(/^\//,"")}`;
  const res = await fetch(url, { method:"POST", headers: headers(apiKey), body: JSON.stringify(payload) });
  const text = await res.text();
  let data; try{ data = JSON.parse(text); }catch{ data = { raw:text }; }
  if(!res.ok){
    // Detect INSUFFICIENT_CREDITS (402) with detail for frontend
    if(res.status===402){
      let detail = data.detail || data.error || {};
      // unwrap nested error
      const inner = detail.error || detail;
      const code = inner.code || detail.code || "INSUFFICIENT_CREDITS";
      const topup = inner.topup_url || detail.topup_url || data.topup_url || "https://muapi.ai/topup";
      const balanceEp = inner.balance_endpoint || detail.balance_endpoint || data.balance_endpoint || "/api/v1/account/balance";
      const msg = inner.message || detail.message || "Insufficient credit balance";
      const err = new Error(`${code}: ${msg} | topup:${topup} | balance:${balanceEp}`);
      err.code = code;
      err.status = 402;
      err.topup_url = topup;
      err.balance_endpoint = balanceEp;
      err.endpoint = endpoint;
      throw err;
    }
    throw new Error(`${endpoint} submit failed [${res.status}]: ${text.slice(0,1200)}`);
  }
  const request_id = data.request_id || data.id || data.requestId;
  if(!request_id) throw new Error(`${endpoint} response had no request_id: ${text.slice(0,1200)}`);
  return String(request_id);
}

async function fetchResult(requestId, apiKey){
  const url = `${MUAPI_BASE}/predictions/${requestId}/result`;
  const res = await fetch(url, { headers: headers(apiKey) });
  const text = await res.text();
  let data; try{ data = JSON.parse(text); }catch{ data = { raw:text }; }
  if(!res.ok) throw new Error(`poll failed [${res.status}]: ${text.slice(0,1200)}`);
  return data;
}

async function poll(requestId, apiKey, label){
  const deadline = Date.now() + POLL_TIMEOUT;
  let lastStatus = null;
  while(Date.now() < deadline){
    const data = await fetchResult(requestId, apiKey);
    const status = (data.status || "").toLowerCase();
    if(status && status !== lastStatus){
      console.log(`[muapi] ${label||requestId}: ${status}`);
      lastStatus = status;
    }
    if(status === "completed" || status === "succeeded" || status === "success") return data;
    if(status === "failed" || status === "error") throw new Error(`${label||requestId} failed: ${JSON.stringify(data).slice(0,1500)}`);
    await new Promise(r=> setTimeout(r, POLL_INTERVAL));
  }
  throw new Error(`${label||requestId} timed out after ${POLL_TIMEOUT}ms`);
}

async function run(endpoint, payload, apiKey, label){
  const reqId = await submit(endpoint, payload, apiKey);
  return await poll(reqId, apiKey, label || endpoint);
}

// --- helpers to extract video URL & whisper payload (port of downloader.py/transcriber.py) ---
function extractVideoUrl(result){
  for(const k of ["video_url","url","output_url","result_url"]){
    const v = result[k];
    if(typeof v==="string" && v.startsWith("http")) return v;
  }
  const output = result.outputs || result.output || result.result || {};
  if(output && typeof output==="object" && !Array.isArray(output)){
    for(const k of ["video_url","url","output_url"]){
      const v = output[k];
      if(typeof v==="string" && v.startsWith("http")) return v;
    }
  }
  if(Array.isArray(output) && output[0] && typeof output[0]==="string" && output[0].startsWith("http")) return output[0];
  // also try outputs[0] as string url
  if(Array.isArray(result.outputs) && typeof result.outputs[0]==="string" && result.outputs[0].startsWith("http")) return result.outputs[0];
  throw new Error(`Could not find video URL in MuAPI response: ${JSON.stringify(result).slice(0,1500)}`);
}

function coerceVerbose(raw){
  if(typeof raw==="string"){ try{ return JSON.parse(raw); }catch{ return {}; } }
  if(raw && typeof raw==="object") return raw;
  return {};
}

function extractVerbose(result){
  for(const k of ["output","result","outputs"]){
    const v = result[k];
    if(v && typeof v==="object" && !Array.isArray(v) && v.segments) return v;
    if(Array.isArray(v) && v[0]){
      const d = coerceVerbose(v[0]);
      if(d.segments) return d;
    }
    if(typeof v==="string"){
      const d = coerceVerbose(v);
      if(d.segments) return d;
    }
  }
  if(result.segments) return result;
  throw new Error(`Could not find Whisper segments in MuAPI response: ${JSON.stringify(result).slice(0,1500)}`);
}

function extractGptText(result){
  if(Array.isArray(result.outputs) && typeof result.outputs[0]==="string" && result.outputs[0].trim()) return result.outputs[0];
  for(const k of ["output","text","response","result","content"]){
    const v = result[k];
    if(typeof v==="string" && v.trim()) return v;
    if(v && typeof v==="object" && typeof v.text==="string" && v.text.trim()) return v.text;
    if(v && typeof v==="object" && typeof v.content==="string" && v.content.trim()) return v.content;
    if(Array.isArray(v) && typeof v[0]==="string" && v[0].trim()) return v[0];
  }
  throw new Error(`Could not extract gpt-5-mini text: ${JSON.stringify(result).slice(0,1500)}`);
}

function parseJsonLoose(raw){
  let t = String(raw).trim();
  t = t.replace(/^```(?:json)?\s*/,"").replace(/\s*```$/,"");
  try{ return JSON.parse(t); }catch{
    const s = t.indexOf("{"), e = t.lastIndexOf("}");
    if(s!==-1 && e!==-1) return JSON.parse(t.slice(s,e+1));
    throw new Error(`Invalid JSON from LLM: ${t.slice(0,800)}`);
  }
}

// --- Highlight generation (simplified port of highlights.py) ---
async function callMuapiLlm(prompt, apiKey){
  const result = await run("gpt-5-mini", { prompt }, apiKey, "gpt-5-mini");
  return extractGptText(result);
}

async function getHighlights(transcript, numClips, apiKey){
  const segs = transcript.segments || [];
  const duration = transcript.duration || (segs.length ? segs[segs.length-1].end : 0);
  const transcriptText = segs.map(s=> `[${Number(s.start).toFixed(1)}s] ${(s.text||"").trim()}`).join("\n");

  // minimal content-type detection (skip if fails)
  // then highlight prompt
  const viralityCriteria = `Virality signals (ranked):
1. HOOK MOMENTS 2. EMOTIONAL PEAKS 3. OPINION BOMBS 4. REVELATION MOMENTS
5. CONFLICT/TENSION 6. QUOTABLE ONE-LINERS 7. STORY PEAKS 8. PRACTICAL VALUE`;

  const target = Math.max(numClips*2, 5);
  const naturalMax = Math.max(3, Math.floor(duration/90));
  const minClips = Math.min(target, naturalMax, 8);

  const system = `You are an elite short-form editor for TikTok/Reels/Shorts. ${viralityCriteria}
Rules:
- Every highlight must open with strong HOOK within first 3 seconds
- Duration sweet spot 45-90s (20-44s only one-liner, 91-180s only story arc)
- Never cut mid-sentence, self-contained
- Score 0-100 viral potential
- Generate at least ${minClips} highlights
- For each: title, start_time, end_time, score, hook_sentence, virality_reason
Respond ONLY valid JSON: {"highlights":[{"title":"...","start_time":float,"end_time":float,"score":int,"hook_sentence":"...","virality_reason":"..."}]}`;

  const prompt = `${system}\n\nTranscript:\n${transcriptText.slice(0, 28000)}`;

  // retry 3x like Python
  let lastErr = "unknown";
  for(let attempt=1; attempt<=3; attempt++){
    const raw = await callMuapiLlm(prompt + (attempt>1 ? "\n\nIMPORTANT: Return ONLY valid JSON with highlights array. No markdown." : ""), apiKey);
    try{
      const parsed = parseJsonLoose(raw);
      const rawHighlights = parsed.highlights;
      if(!Array.isArray(rawHighlights) || !rawHighlights.length) throw new Error("no highlights array");
      // sanitize like Python
      const cleaned = [];
      for(const it of rawHighlights){
        if(!it || typeof it!=="object") continue;
        const start = parseFloat(it.start_time), end = parseFloat(it.end_time);
        if(!(start>=0) || !(end>start)) continue;
        cleaned.push({
          title: String(it.title||"Untitled Highlight").trim(),
          start_time: Math.min(start, duration||9999),
          end_time: Math.min(end, duration||9999),
          score: Math.max(0, Math.min(100, parseInt(it.score)||0)),
          hook_sentence: String(it.hook_sentence||"").trim(),
          virality_reason: String(it.virality_reason||"").trim(),
        });
      }
      if(cleaned.length) {
        // dedupe >50% overlap
        cleaned.sort((a,b)=> b.score-a.score);
        const kept=[];
        for(const h of cleaned){
          const dur = h.end_time - h.start_time;
          let overlap=false;
          for(const k of kept){
            const ov = Math.min(h.end_time, k.end_time) - Math.max(h.start_time, k.start_time);
            if(ov>0 && ov>0.5*dur){ overlap=true; break; }
          }
          if(!overlap) kept.push(h);
        }
        return kept;
      }
      lastErr = "no valid highlights after sanitize";
    }catch(e){ lastErr = e.message; console.log(`[highlights] attempt ${attempt} invalid: ${lastErr}`); }
  }
  throw new Error(`Highlight generator failed after 3 attempts: ${lastErr}`);
}

function mockResult(url, numClips){
  const titles = ["Kesalahan 50 Juta yang Bikin Dagangan Sepi","Kenapa Banyak UMKM Gagal di 6 Bulan Pertama","Pekerjaan Ini Bakal Diganti AI Paling Cepat","Rahasia Marketing yang Jarang Dibahas","Wawancara 100 Founder — Ini yang Paling Ngejutin"];
  const hooks = ["\"Gak ada yang bahas ini, padahal ini yang bikin usaha gue tutup...\"","\"Kalau masih ngelakuin ini, kamu kalah duluan...\"","\"Satu insight ini ngubah hidup gue total...\""];
  const reasons = ["hook kuat + konflik","puncak emosi + pengungkapan","opini berani"];
  const clips = ["https://www.w3schools.com/html/mov_bbb.mp4","https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4","https://www.w3schools.com/html/movie.mp4"];
  const shorts = Array.from({length:numClips},(_,i)=>({
    title: titles[i%titles.length], score: 92-i*4, start_time: 12+i*80, end_time: 48+i*80,
    hook_sentence: hooks[i%hooks.length],
    virality_reason: reasons[i%reasons.length],
    clip_url: clips[i%clips.length]
  }));
  return { brand:"KINGSHORTCLIP", provider:"ciora.id", source_video_url:url, transcript:{duration:600,segments:[{start:0,end:5,text:"KINGSHORTCLIP Demo"}]}, highlights: shorts, shorts };
}

export async function handler(event){
  if(event.httpMethod==="OPTIONS") return { statusCode:204, headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type,Authorization","Access-Control-Allow-Methods":"POST,GET,OPTIONS"}, body:"" };
  if(event.httpMethod!=="POST") return json(405,{error:"Use POST {url, num_clips, aspect_ratio, format, language, mode}"});

  let body;
  try{ body = JSON.parse(event.body||"{}"); }catch{ return json(400,{error:"Invalid JSON body"}); }

  const url = (body.url||"").trim();
  const numClips = Math.min(10, Math.max(1, parseInt(body.num_clips||body.numClips||3,10)));
  const aspectRatio = body.aspect_ratio || body.aspectRatio || "9:16";
  const fmt = String(body.format || "720");
  const language = body.language || "auto";
  const mode = (body.mode||"api").toLowerCase();

  if(!url) return json(400,{error:"Missing 'url' (YouTube URL)"});
  // FREE by ciora.id — gratis tanpa MuAPI key/button
  if(mode==="free" || mode==="ciora" || mode==="demo" || mode==="gratis") {
    const r = mockResult(url, numClips);
    r.brand = "KINGSHORTCLIP";
    r.provider = "ciora.id";
    r.mode = "free (ciora.id) — gratis tanpa API key";
    return json(200, r);
  }

  const apiKey = (body.muapi_key || body.muapiKey || process.env.MUAPI_API_KEY || "").trim();
  if(!apiKey){
    const demo = mockResult(url, numClips);
    demo.warning = "MUAPI_API_KEY not set — returned demo/mock data. Set MUAPI_API_KEY in Netlify env vars.";
    demo.mode = "demo (no key)";
    demo.brand = "KINGSHORTCLIP";
    return json(200, demo);
  }

  try{
    console.log("[generate] download", url);
    const dlResult = await run("youtube-download", { video_url: url, format: fmt }, apiKey, "youtube-download");
    const sourceUrl = extractVideoUrl(dlResult);
    console.log("[generate] sourceUrl", sourceUrl);

    console.log("[generate] transcribe", sourceUrl);
    const payload = { audio_url: sourceUrl, response_format: "verbose_json" };
    if(language && language!=="auto") payload.language = language;
    const wbResult = await run("openai-whisper", payload, apiKey, "openai-whisper");
    const verbose = extractVerbose(wbResult);
    const segments = (verbose.segments||[]).map(s=> ({ start: parseFloat(s.start||0), end: parseFloat(s.end||0), text: String(s.text||"").trim() }));
    const duration = parseFloat(verbose.duration || (segments.length? segments[segments.length-1].end : 0));
    console.log("[generate] whisper", segments.length, "segments", duration+"s");
    if(!segments.length) throw new Error("Whisper produced no segments — no speech detected.");
    const transcript = { duration, segments };

    console.log("[generate] highlights");
    const highlights = await getHighlights(transcript, numClips, apiKey);
    if(!highlights.length) throw new Error("Highlight generator returned zero clips.");
    const top = [...highlights].sort((a,b)=> b.score-a.score).slice(0, numClips);
    console.log("[generate] top", top.length, "of", highlights.length);

    console.log("[generate] autocrop", top.length, aspectRatio);
    const shorts = [];
    for(let i=0;i<top.length;i++){
      const h = top[i];
      try{
        const clipResult = await run("autocrop", { video_url: sourceUrl, start_time: Number(h.start_time), end_time: Number(h.end_time), aspect_ratio: aspectRatio }, apiKey, `autocrop(${i+1}/${top.length})`);
        const clipUrl = extractVideoUrl(clipResult);
        shorts.push({ ...h, clip_url: clipUrl, error: null });
      }catch(e){
        console.log(`[clip] ${i} failed: ${e.message}`);
        shorts.push({ ...h, clip_url: null, error: e.message.slice(0,600) });
      }
    }

    return json(200, { brand:"KINGSHORTCLIP", mode:"api", source_video_url: sourceUrl, transcript, highlights, shorts });

  }catch(err){
    console.error("[generate] error", err);
    // INSUFFICIENT_CREDITS -> return 402 with actionable Indonesian message + topup link
    if(err.code==="INSUFFICIENT_CREDITS" || err.status===402 || String(err.message).includes("INSUFFICIENT_CREDITS")){
      return json(402, {
        error_code: "INSUFFICIENT_CREDITS",
        error: "Kredit MuAPI habis — saldo tidak cukup untuk proses video.",
        message: "Akun MuAPI Anda kehabisan kredit. Setiap proses (download + whisper + LLM + autocrop) butuh kredit. Top up dulu, lalu coba lagi.",
        message_en: err.message,
        endpoint_failed: err.endpoint || "youtube-download",
        topup_url: err.topup_url || "https://muapi.ai/topup",
        balance_endpoint: err.balance_endpoint || "/api/v1/account/balance",
        balance_url: `${MUAPI_BASE}/account/balance`,
        hint: "Buka https://muapi.ai/topup untuk isi kredit, atau cek saldo di /api/v1/account/balance. Sementara itu kamu bisa coba mode Demo (tanpa kredit) untuk lihat hasil contoh.",
        demo_hint: "Klik 'Coba Demo' di halaman untuk lihat preview KINGSHORTCLIP tanpa pakai kredit."
      });
    }
    return json(500, { error: err.message || String(err), hint: "Check MUAPI_API_KEY valid, MUAPI_BASE_URL=https://api.muapi.ai/api/v1, and YouTube URL is public." });
  }
}
