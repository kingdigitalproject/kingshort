# 👑 KINGSHORT — King of Shorts (Netlify Ready)

> **YouTube In, King Out** — Paste YouTube URL → dapatkan N video 9:16 viral-ready.  
> Web wrapper premium untuk [Anil-matcha/AI-Youtube-Shorts-Generator](https://github.com/Anil-matcha/AI-Youtube-Shorts-Generator) dengan branding **KINGSHORT**, deploy 1-klik ke Netlify dari GitHub.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Anil-matcha/AI-Youtube-Shorts-Generator)

---

## ✨ Fitur

- 🔀 **Dua mode**: `API` (MuAPI cepat, no setup) & `Local` (yt-dlp + faster-whisper + OpenAI/Gemini) + `Demo` (mock tanpa key)
- 🤖 **Virality ranking**: hook, emotional peak, opinion bomb, revelation, conflict, quotable, story peak, practical value — plus `score` + `hook` + `reason`
- 🎤 **Whisper** cloud atau lokal (CPU/CUDA)
- ♻️ Smart dedupe (>50% overlap → keep skor tertinggi)
- 🎯 Smart vertical crop (MuAPI autocrop / OpenCV face tracking)
- 📱 Any aspect ratio: 9:16, 1:1, 4:5, custom
- 📦 JSON output — sama dengan `python main.py --output-json`
- ⚡ Netlify Functions — no Python di hosting, semua via MuAPI

## 🗂️ Struktur

```
.
├── index.html              # SPA UI
├── assets/
│   ├── style.css           # dark premium theme
│   └── app.js              # logic + Netlify Function call + demo fallback
├── netlify/
│   └── functions/
│       ├── generate.js     # POST /.netlify/functions/generate — full pipeline
│       └── health.js       # GET /.netlify/functions/health
├── netlify.toml            # publish=. , functions=netlify/functions
├── package.json
├── .env.example
└── README.md
```

## 🚀 Deploy ke Netlify (3 opsi)

### Opsi A — Via GitHub (Recommended)

1. **Push ke GitHub**: buat repo baru → push folder ini
   ```bash
   git init
   git add .
   git commit -m "feat: web UI for AI Shorts Generator"
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
   Atau fork `Anil-matcha/AI-Youtube-Shorts-Generator` lalu merge file-file web ini ke branch main.

2. Buka **https://app.netlify.com/start** → *Import from Git* → pilih repo.

3. Build settings:
   - **Build command**: *(kosongkan)*
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions` (otomatis dari netlify.toml)

4. **Environment variables** (Site settings → Environment variables):
   ```
   MUAPI_API_KEY=xxx          # wajib untuk mode API
   MUAPI_BASE_URL=https://api.muapi.ai
   OPENAI_API_KEY=xxx         # opsional, untuk mode Local
   GEMINI_API_KEY=xxx         # opsional
   LLM_PROVIDER=openai
   ```

5. **Deploy** → buka `https://<site>.netlify.app`

### Opsi B — Drag & Drop

1. Zip folder ini (atau `npm run build`)
2. Buka **https://app.netlify.com/drop** → drag zip → set env vars sama.

### Opsi C — Netlify CLI

```bash
npm i -g netlify-cli
netlify login
netlify init              # pilih create new site
netlify env:set MUAPI_API_KEY xxx
netlify deploy --prod
```

## 💻 Jalankan Lokal

```bash
# tanpa build — cukup serve statis
npx serve .

# atau dengan Netlify Functions lokal:
npm i -g netlify-cli
cp .env.example .env   # isi MUAPI_API_KEY
netlify dev            # http://localhost:8888 — functions di /.netlify/functions/*
```

Cek health: `http://localhost:8888/.netlify/functions/health`

## 🔌 API

### POST /.netlify/functions/generate

```bash
curl -X POST https://<site>.netlify.app/.netlify/functions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "num_clips": 3,
    "aspect_ratio": "9:16",
    "format": "720",
    "language": "auto",
    "mode": "api"
  }'
```

Response (sama dengan CLI `--output-json`):

```json
{
  "mode": "api",
  "source_video_url": "https://...",
  "transcript": { "duration": 600, "segments": [...] },
  "highlights": [{ "title":"...", "score":92, "start_time":124.3, "end_time":187.6, "hook_sentence":"...", "virality_reason":"..." }],
  "shorts": [{ "title":"...", "score":92, "clip_url":"https://.../short_1.mp4", "hook_sentence":"...", "virality_reason":"..." }]
}
```

Modes:
| mode | butuh key | pipeline |
|------|-----------|----------|
| `api` | `MUAPI_API_KEY` | MuAPI download→whisper→LLM→autocrop (tanpa setup) |
| `local` | `OPENAI_API_KEY` atau `GEMINI_API_KEY` + ffmpeg | yt-dlp + faster-whisper + LLM + OpenCV |
| `demo` | tidak | mock data — selalu berhasil, untuk preview UI |

Tanpa `MUAPI_API_KEY`, mode `api` otomatis fallback ke `demo` + `warning`.

### GET /.netlify/functions/health

```json
{ "ok": true, "hasMuapi": true, "version": "2.0.0" }
```

## 🔧 Konfigurasi (sinkron dengan Python)

Edit `shorts_generator/highlights.py` & `config.py` di repo asli, atau atur via env:

| var | default | ket |
|-----|---------|-----|
| `MUAPI_POLL_INTERVAL` | 5s | polling job status |
| `MUAPI_POLL_TIMEOUT` | 1800s | timeout |
| `CHUNK_SIZE_SECONDS` | 1200 | chunk long video |
| `LONG_VIDEO_THRESHOLD` | 1800 | threshold chunking |
| `CHUNK_OVERLAP_SECONDS` | 60 | overlap |

## 🐍 Tetap butuh CLI Python?

Repo asli tetap jalan terpisah — web ini hanya wrapper:

```bash
git clone https://github.com/Anil-matcha/AI-Youtube-Shorts-Generator.git
cd AI-Youtube-Shorts-Generator
pip install -r requirements.txt
echo "MUAPI_API_KEY=xxx" > .env
python main.py "https://www.youtube.com/watch?v=..." --num-clips 3 --output-json result.json
```

## 📄 Lisensi

MIT — lihat [LICENSE](https://github.com/Anil-matcha/AI-Youtube-Shorts-Generator/blob/main/LICENSE) repo asli.
