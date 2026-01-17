import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { queryGroq } from "./services/groq.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔑 Single-client API key setup
const API_KEYS = {
  "atlas-demo-key": { tier: "free", limit: 50, used: 0 }, // free demo
  "atlas-paid-key": { tier: "paid", limit: 500, used: 0 } // paid tier
};

// 📊 CSV logging
const CSV_FILE = path.join(process.cwd(), "usage_log.csv");
if (!fs.existsSync(CSV_FILE)) {
  fs.writeFileSync(CSV_FILE, "timestamp,apiKey,tier,question,reply\n");
}

// Middleware: check API key + enforce limits
app.use("/ask", (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || !API_KEYS[apiKey]) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  const keyInfo = API_KEYS[apiKey];

  if (keyInfo.limit !== undefined && keyInfo.used >= keyInfo.limit) {
    return res.status(429).json({ error: `Request limit reached for ${keyInfo.tier} tier` });
  }

  if (keyInfo.limit !== undefined) keyInfo.used++;

  req.apiKey = apiKey;
  req.tier = keyInfo.tier;

  next();
});

// 🔄 Reset daily usage
setInterval(() => {
  Object.values(API_KEYS).forEach((key) => {
    if (key.limit !== undefined) key.used = 0;
  });
  console.log("API usage counters reset.");
}, 24 * 60 * 60 * 1000);

// Test route
app.get("/test", async (req, res) => {
  try {
    const reply = await queryGroq("Say hello in one sentence.");
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Monetizable route
app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Question is required" });

    const reply = await queryGroq(question);

    // Log to CSV
    const logEntry = `${new Date().toISOString()},${req.apiKey},${req.tier},"${question.replace(/"/g,'""')}","${reply.replace(/"/g,'""')}"\n`;
    fs.appendFile(CSV_FILE, logEntry, (err) => {
      if (err) console.error("Failed to write CSV log:", err);
    });

    res.json({ tier: req.tier, reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats route
app.get("/stats", (req, res) => {
  if (!fs.existsSync(CSV_FILE)) {
    return res.json({ message: "No usage yet", stats: {} });
  }

  const csvData = fs.readFileSync(CSV_FILE, "utf-8").trim();
  const lines = csvData.split("\n").slice(1); // skip header

  const usageStats = {};
  lines.forEach((line) => {
    const parts = line.split(",");
    const tier = parts[2];
    usageStats[tier] = (usageStats[tier] || 0) + 1;
  });

  res.json({ totalRequests: lines.length, stats: usageStats });
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
