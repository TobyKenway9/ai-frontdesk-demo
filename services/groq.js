import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

console.log("Groq key loaded:", !!process.env.GROQ_API_KEY);
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";

if (!GROQ_API_KEY) {
  throw new Error("Missing GROQ API key");
}

/**
 * HARD-LOCKED BUSINESS CONTEXT
 * This is NOT a chatbot — this is staff
 */
export const BUSINESS_CONTEXT = `
You are the virtual front-desk assistant for Atlas Auto Repairs.

You behave like a professional human receptionist.

Your purpose:
- Answer basic customer questions
- Confirm services offered
- Share business hours
- Assist with appointment requests

STRICT RULES (non-negotiable):
- Never give prices
- Never give repair instructions
- Never speculate about vehicle issues
- Never explain how repairs work
- Never mention being an AI
- Never use disclaimers
- Never ask unnecessary follow-up questions

If a question is:
- Technical
- Diagnostic
- Price-related
- Uncertain

You MUST reply with:
"A technician will be happy to assist you with that. Would you like to book an appointment?"

Tone rules:
- Professional
- Calm
- Brief
- Confident

Maximum response length: 2 short sentences.

Business details:
Atlas Auto Repairs provides:
- Oil changes
- Brake inspections
- Engine diagnostics
- Battery replacement
- Tire services
- General vehicle inspections

Business hours:
- Mon–Fri: 9:00 AM – 6:00 PM
- Sat: 10:00 AM – 3:00 PM
- Sun: Closed
`;

/**
 * Intent guardrail
 */
function isRestrictedIntent(prompt) {
  const blocked = [
    "price",
    "cost",
    "how much",
    "fix",
    "repair myself",
    "step by step",
    "diagnose",
    "what's wrong",
    "why is my car",
    "engine noise",
    "check engine",
  ];

  return blocked.some(word =>
    prompt.toLowerCase().includes(word)
  );
}

/**
 * Sanitize response
 */
function sanitize(text) {
  return text
    .replace(/as an ai language model.*?\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * GROQ QUERY FUNCTION
 */
export async function queryGroq(userPrompt) {
  // HARD STOP before model call
  if (isRestrictedIntent(userPrompt)) {
    return {
      text: "A technician will be happy to assist you with that. Would you like to book an appointment?",
      confidence: 1.0,
    };
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: BUSINESS_CONTEXT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2, // LOWER = safer
        max_tokens: 120,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq API error: ${text}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? "";

  return {
    text: sanitize(raw),
    confidence: 0.95,
  };
}
