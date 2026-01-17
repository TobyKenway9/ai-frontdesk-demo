import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";

if (!GROQ_API_KEY) {
  throw new Error("Missing GROQ API key");
}

/**
 * DEMO BUSINESS CONTEXT
 * Atlas Auto Repairs virtual front-desk assistant
 */
export const BUSINESS_CONTEXT = `
You are a virtual front-desk assistant for Atlas Auto Repairs.

Atlas Auto Repairs is a professional auto repair workshop providing
general vehicle maintenance and diagnostics for personal vehicles.

Business hours:
- Monday to Friday: 9:00 AM – 6:00 PM
- Saturday: 10:00 AM – 3:00 PM
- Sunday: Closed

Your role:
- Answer customer questions clearly and briefly
- Help customers understand available services
- Assist with booking service appointments
- Provide business hours and availability

Services offered include:
- Oil changes
- Brake inspections
- Engine diagnostics
- Battery replacement
- Tire services
- General vehicle inspections

Rules:
- Do NOT provide price estimates
- Do NOT give step-by-step repair instructions
- Do NOT diagnose vehicle problems in detail
- If a request is technical, complex, or uncertain, say a technician will assist
- Maintain a professional, calm, and concise tone
`;

/**
 * GROQ QUERY FUNCTION
 * @param {string} userPrompt - The customer's question
 * @returns {string} AI-generated response
 */
export async function queryGroq(userPrompt) {
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
        temperature: 0.4, // lower for consistent answers
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq API error: ${text}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
