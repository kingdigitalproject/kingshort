export async function handler(){
  return {
    statusCode: 200,
    headers: {"Content-Type":"application/json","Access-Control-Allow-Origin":"*"},
    body: JSON.stringify({
      ok: true,
      brand: "KINGSHORT",
      tagline: "King of Shorts",
      version: "2.0.0-kingshort",
      hasMuapi: !!process.env.MUAPI_API_KEY,
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasGemini: !!process.env.GEMINI_API_KEY,
      llmProvider: process.env.LLM_PROVIDER || "openai",
      muapiBase: process.env.MUAPI_BASE_URL || "https://api.muapi.ai",
      timestamp: new Date().toISOString()
    })
  };
}
