/* Cloudflare Worker: keeps GEMINI_API_KEY secret and calls Gemini. */
const MODEL = "gemini-2.5-flash";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "POST") return json({ error: "Only POST is supported." }, 405);
    if (!env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY is not configured in Worker secrets." }, 500);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
    const word = String(body.word || "").trim();
    const variation = String(body.variation || crypto.randomUUID()).slice(0, 100);
    if (!word || word.length > 80) return json({ error: "Enter a word up to 80 characters long." }, 400);

    const prompt = `You are a friendly English tutor for a Persian-speaking beginner.
The learner entered this exact English word or phrase: ${JSON.stringify(word)}.
Create a useful learning card. Each request must produce a DIFFERENT, natural example sentence from previous requests. Variation token: ${variation}. Do not mention the token. Avoid overly complex vocabulary. The sentence must use the requested word/phrase naturally, with the same spelling where possible.
Return ONLY valid JSON with exactly these string fields:
{"word":"the word as entered or its standard capitalization","meaning_fa":"a concise Persian meaning","sentence_en":"one fresh, natural English sentence using the word","sentence_fa":"accurate Persian translation of that sentence","image_query":"2 to 5 simple English keywords describing a real-world subject suitable for an image search"}
Use Persian script for the two Persian fields. No markdown, no extra fields, no explanation. If the input is a misspelling, explain the likely correction briefly in meaning_fa but do not silently change the input word in the example.`;

    try {
      const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.0, responseMimeType: "application/json" }
        })
      });
      const raw = await apiResponse.json().catch(() => ({}));
      if (!apiResponse.ok) {
        const detail = raw.error?.message || `Gemini API returned ${apiResponse.status}`;
        return json({ error: detail }, apiResponse.status === 429 ? 429 : 502);
      }
      const text = raw.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "";
      let card;
      try { card = JSON.parse(text); } catch { return json({ error: "AI returned an unreadable answer. Please try again." }, 502); }
      const output = {
        word: String(card.word || word).slice(0, 100),
        meaning_fa: String(card.meaning_fa || "").slice(0, 500),
        sentence_en: String(card.sentence_en || "").slice(0, 500),
        sentence_fa: String(card.sentence_fa || "").slice(0, 700),
        image_query: String(card.image_query || word).slice(0, 120)
      };
      if (!output.meaning_fa || !output.sentence_en || !output.sentence_fa) return json({ error: "AI response was incomplete. Please try again." }, 502);
      return json(output, 200, { "Cache-Control": "no-store" });
    } catch (_) {
      return json({ error: "Could not connect to the AI service. Please try again." }, 502);
    }
  }
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", ...extraHeaders }
  });
}
