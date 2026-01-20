import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { queryGroq } from "./services/groq.js";

dotenv.config();

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

/* =========================
   API KEYS (MONETIZATION)
========================= */
const API_KEYS = {
  "atlas-demo-key": { tier: "free", limit: 50, used: 0 },
  "atlas-paid-key": { tier: "paid", limit: 500, used: 0 }
};

/* =========================
   CSV LOGGING
========================= */
const CSV_FILE = path.join(__dirname, "usage_log.csv");
if (!fs.existsSync(CSV_FILE)) {
  fs.writeFileSync(CSV_FILE, "timestamp,apiKey,tier,question,reply\n", "utf8");
}

/* =========================
   SERVE CUSTOMER UI
========================= */
app.use(express.static(__dirname));

/* =========================
   API KEY MIDDLEWARE
========================= */
app.use("/ask", (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || !API_KEYS[apiKey]) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  const keyInfo = API_KEYS[apiKey];
  if (keyInfo.used >= keyInfo.limit) {
    return res.status(429).json({ error: `Limit reached for ${keyInfo.tier} tier` });
  }
  keyInfo.used++;
  req.apiKey = apiKey;
  req.tier = keyInfo.tier;
  next();
});

/* =========================
   RESET USAGE DAILY
========================= */
setInterval(() => {
  Object.values(API_KEYS).forEach(k => (k.used = 0));
  console.log("Daily API usage reset");
}, 24 * 60 * 60 * 1000);

/* =========================
   AI ENDPOINT
========================= */
app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Question is required" });

    let reply = await queryGroq(question);

    // Normalize reply: if object, pick text field, otherwise keep string
    if (typeof reply === "object") {
      if (reply.text) reply = reply.text;
      else reply = JSON.stringify(reply); // fallback
    }

    // Log to CSV
    const logEntry = `${new Date().toISOString()},${req.apiKey},${req.tier},"${question.replace(/"/g,'""')}","${reply.replace(/"/g,'""')}"\n`;
    fs.appendFile(CSV_FILE, logEntry, () => {});

    res.json({ tier: req.tier, reply });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   STATS (FOR YOU)
========================= */
app.get("/stats", (req, res) => {
  if (!fs.existsSync(CSV_FILE)) return res.json({ totalRequests: 0, stats: {} });
  const data = fs.readFileSync(CSV_FILE, "utf8").trim().split("\n").slice(1);
  const stats = {};
  data.forEach(row => {
    const tier = row.split(",")[2];
    stats[tier] = (stats[tier] || 0) + 1;
  });
  res.json({ totalRequests: data.length, stats });
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
