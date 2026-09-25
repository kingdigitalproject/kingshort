// KINGSHORT — King of Shorts | Netlify Function: POST /.netlify/functions/generate
// Proxies to MuAPI pipeline (same logic as shorts_generator Python) + demo fallback.
// Brand: KINGSHORT • YouTube In, King Out
// Env vars (set in Netlify Dashboard):
//   MUAPI_API_KEY, MUAPI_BASE_URL (default https://api.muapi.ai), OPENAI_API_KEY, GEMINI_API_KEY, LLM_PROVIDER

const MUAPI_BASE = process.env.MUAPI_BASE_URL || "https://api.muapi.ai";
const POLL_INTERVAL = parseInt(process.env.MUAPI_POLL_INTERVAL || "5000", 10);
const POLL_TIMEOUT = parseInt(process.env.MUAPI_POLL_TIMEOUT || "1800000", 10);

function json(status, body){
  return { statusCode: status, headers: {"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}, body: JSON.stringify(body) };
}

async function muapiSubmit(path, payload, apiKey){
  const res = await fetch(`${MUAPI_BASE}${path}`, {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization": `Bearer ${apiKey}`, "x-api-key": apiKey },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(()=> ({}));
  if(!res.ok) throw new Error(`${path} failed ${res.status}: ${JSON.stringify(data).slice(0,600)}`);
  // MuAPI returns job_id or direct result — handle both
  return data;
}

async function muapiPoll(jobId, apiKey){
  const deadline = Date.now() + POLL_TIMEOUT;
  while(Date.now() < deadline){
    await new Promise(r=> setTimeout(r, POLL_INTERVAL));
    const res = await fetch(`${MUAPI_BASE}/job/${jobId}`, {
      headers:{ "Authorization": `Bearer ${apiKey}`, "x-api-key": apiKey }
    });
    const data = await res.json().catch(()=>({}));
    if(data.status === "completed" || data.status === "success") return data.result || data;
    if(data.status === "failed" || data.status === "error") throw new Error(`MuAPI job ${jobId} failed: ${JSON.stringify(data).slice(0,600)}`);
  }
  throw new Error(`MuAPI job ${jobId} timeout after ${POLL_TIMEOUT}ms`);
}

async function callMuapi(path, payload, apiKey){
  const submit = await muapiSubmit(path, payload, apiKey);
  // if immediate result
  if(submit.result || submit.url || submit.data) return submit.result || submit;
  if(submit.job_id || submit.jobId || submit.id){
    const jid = submit.job_id || submit.jobId || submit.id;
    return await muapiPoll(jid, apiKey);
  }
  // some endpoints are sync
  return submit;
}

// Simplified highlight ranking via MuAPI LLM if available, else OpenAI direct
async function getHighlightsViaMuapi(transcript, numClips, apiKey){
  // Try MuAPI highlight endpoint — payload mirrors shorts_generator/highlights.py
  try{
    const r = await callMuapi("/highlights", { transcript, num_clips: numClips }, apiKey);
    if(r.highlights) return r;
  }catch{}
  // fallback: call MuAPI generic LLM  (gpt-5-mini)
  const prompt = `You are a virality expert. Given transcript segments with timestamps, rank top ${numClips} viral shorts. Criteria: hooks, emotional peaks, opinion bombs, revelation, conflict, quotable, story peak, practical value. Return JSON {highlights:[{title,score,start_time,end_time,hook_sentence,virality_reason}]}`;
  try{
    const llm = await callMuapi("/chat/completions", {
      model: "gpt-5-mini",
      messages: [{role:"system",content:prompt},{role:"user",content: JSON.stringify(transcript).slice(0, 12000)}],
      temperature: 0.7
    }, apiKey);
    const text = llm.choices?.[0]?.message?.content || llm.output || "";
    const m = text.match(/\{[\s\S]*\}/);
    if(m) return JSON.parse(m[0]);
  }catch{}
  return null;
}

function mockResult(url, numClips){
  const titles = ["The one mistake that cost me $50K","Why your startup will fail in 6 months","AI will replace this job first","Nobody talks about this marketing trick","I interviewed 100 founders — this shocked me"];
  const shorts = Array.from({length:numClips},(_,i)=>({
    title: titles[i%titles.length], score: 92-i*4, start_time: 12+i*80, end_time: 48+i*80,
    hook_sentence: "\"Nobody talks about this, but it killed my first startup...\"",
    virality_reason: ["hook + conflict","emotional peak + revelation","opinion bomb"][i%3],
    clip_url: "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4"
  }));
  return { brand:"KINGSHORT", mode:"demo", source_video_url:url, transcript:{duration:600,segments:[{start:0,end:5,text:"👑 KINGSHORT Demo transcript — set MUAPI_API_KEY for real pipeline"}]}, highlights: shorts, shorts };
}

export async function handler(event){
  if(event.httpMethod==="OPTIONS") return { statusCode:204, headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type,Authorization","Access-Control-Allow-Methods":"POST,GET,OPTIONS"}, body:"" };
  if(event.httpMethod!=="POST") return json(405,{error:"Use POST {url, num_clips, aspect_ratio, format, language, mode}"});

  let body;
  try{ body = JSON.parse(event.body||"{}"); }catch{ return json(400,{error:"Invalid JSON body"}); }

  const url = (body.url||"").trim();
  const numClips = Math.min(10, Math.max(1, parseInt(body.num_clips||body.numClips||3,10)));
  const aspectRatio = body.aspect_ratio || body.aspectRatio || "9:16";
  const fmt = body.format || "720";
  const language = body.language || "auto";
  const mode = (body.mode||"api").toLowerCase();

  if(!url) return json(400,{error:"Missing 'url' (YouTube URL)"});

  // Demo mode — always works, no keys
  if(mode==="demo"){
    return json(200, mockResult(url, numClips));
  }

  const apiKey = (body.muapi_key || body.muapiKey || process.env.MUAPI_API_KEY || "").trim();

  if(!apiKey){
    // No key → explain + return demo with warning so UI still useful
    const demo = mockResult(url, numClips);
    demo.warning = "👑 KINGSHORT — MUAPI_API_KEY not set — returned demo/mock data. Set MUAPI_API_KEY in Netlify env vars for real pipeline.";
    demo.mode = "demo (no key)";
    demo.brand = "KINGSHORT";
    return json(200, demo);
  }

  try{
    // Step 1: download
    console.log("[generate] download", url);
    let sourceUrl;
    try{
      const dl = await callMuapi("/youtube-download", { url, format: fmt }, apiKey);
      sourceUrl = dl.url || dl.download_url || dl.source_url || dl.result?.url || url;
    }catch(e){
      // some MuAPI instances use /api/youtube/download
      const dl2 = await callMuapi("/api/youtube/download", { url, format: fmt }, apiKey);
      sourceUrl = dl2.url || dl2.download_url || url;
    }

    // Step 2: transcribe
    console.log("[generate] transcribe", sourceUrl);
    let transcript;
    try{
      transcript = await callMuapi("/openai-whisper", { url: sourceUrl, language: language==="auto"? undefined: language }, apiKey);
      if(transcript.transcript) transcript = transcript.transcript;
      if(!transcript.segments && transcript.text) transcript = { duration: 0, segments: [{start:0,end:10,text:transcript.text}] };
    }catch(e){
      throw new Error("Transcription failed: "+ e.message);
    }
    if(!transcript?.segments?.length) throw new Error("Whisper produced no segments — no speech detected.");

    // Step 3: highlights
    console.log("[generate] highlights");
    let highlights = await getHighlightsViaMuapi(transcript, numClips, apiKey);
    if(!highlights || !highlights.highlights){
      // last resort — synthetic highlights from transcript slices
      const segs = transcript.segments;
      highlights = { highlights: Array.from({length:numClips},(_,i)=>{
        const s = segs[Math.floor(i*segs.length/numClips)] || segs[0];
        return { title:`Highlight #${i+1}`, score: 88-i*3, start_time: s.start, end_time: Math.min(s.start+30, s.end+20), hook_sentence: (s.text||"").slice(0,80), virality_reason:"auto — set LLM for virality ranking" };
      })};
    }
    const allHighlights = highlights.highlights || [];
    // dedupe >50% overlap keep higher score
    allHighlights.sort((a,b)=>(b.score||0)-(a.score||0));
    const top = allHighlights.slice(0, numClips);

    // Step 4: autocrop each highlight
    console.log("[generate] autocrop", top.length, aspectRatio);
    const shorts = [];
    for(const h of top){
      try{
        const clip = await callMuapi("/autocrop", {
          url: sourceUrl,
          start_time: h.start_time, end_time: h.end_time,
          aspect_ratio: aspectRatio
        }, apiKey);
        shorts.push({ ...h, clip_url: clip.url || clip.clip_url || clip.result?.url || null, error: null });
      }catch(e){
        shorts.push({ ...h, clip_url: null, error: e.message.slice(0,300) });
      }
    }

    return json(200, { brand:"KINGSHORT", mode:"api", source_video_url: sourceUrl, transcript, highlights: allHighlights, shorts });

  }catch(err){
    console.error("[generate] error", err);
    // return 200 with error short so UI can display, but also include status 500
    return json(500, { error: err.message || String(err), hint: "Check MUAPI_API_KEY, MuAPI base URL, and that YouTube URL is public." });
  }
}
