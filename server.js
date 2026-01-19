import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { queryGroq } from "./services/groq.js";

dotenv.config();

const app = express();
app.use(express.json());

// ES module __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

/* =========================
   API KEYS (DEMO vs PAID)
========================= */
const API_KEYS = {
  "atlas-demo-key": { tier: "free", limit: 50, used: 0 },
  "atlas-paid-key": { tier: "paid", limit: 500, used: 0 }
};

/* =========================
   USAGE LOGGING
========================= */
const CSV_FILE = path.join(__dirname, "usage_log.csv");

if (!fs.existsSync(CSV_FILE)) {
  fs.writeFileSync(
    CSV_FILE,
    "timestamp,apiKey,tier,question,reply\n",
    "utf8"
  );
}

/* =========================
   CUSTOMER HOMEPAGE
========================= */
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Atlas Auto Repairs</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f4f4f4;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    .box {
      background: white;
      padding: 30px;
      border-radius: 8px;
      width: 420px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    input, button {
      width: 100%;
      padding: 10px;
      margin-top: 10px;
      font-size: 14px;
    }
    pre {
      background: #eee;
      padding: 10px;
      margin-top: 10px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="box">
    <h2>Atlas Auto Repairs</h2>
    <p>Ask our virtual front desk a question:</p>
    <input id="q" placeholder="Do you do brake inspections?" />
    <button onclick="ask()">Ask</button>
    <pre id="out"></pre>
  </div>

  <script>
    function ask() {
      fetch("/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "atlas-demo-key"
        },
        body: JSON.stringify({
          question: document.getElementById("q").value
        })
      })
      .then(r => r.json())
      .then(d => {
        document.getElementById("out").textContent =
          d.reply || JSON.stringify(d, null, 2);
      })
      .catch(err => {
        document.getElementById("out").textContent = "Error contacting server.";
      });
    }
  </script>
</body>
</html>
  `);
});

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
    return res.status(429).json({
      error: `Request limit reached for ${keyInfo.tier} tier`
    });
  }

  keyInfo.used++;
  req.apiKey = apiKey;
  req.tier = keyInfo.tier;
  next();
});

/* =========================
   AI ENDPOINT (THE PRODUCT)
========================= */
app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    let reply = await queryGroq(question);

// Safety: force reply into a string
if (typeof reply !== "string") {
  reply = JSON.stringify(reply);
}


    const logEntry =
      `${new Date().toISOString()},` +
      `${req.apiKey},` +
      `${req.tier},` +
      `"${question.replace(/"/g, '""')}",` +
      `"${reply.replace(/"/g, '""')}"\n`;

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
  const lines = fs
    .readFileSync(CSV_FILE, "utf8")
    .trim()
    .split("\n")
    .slice(1);

  const stats = {};
  lines.forEach(line => {
    const tier = line.split(",")[2];
    stats[tier] = (stats[tier] || 0) + 1;
  });

  res.json({
    totalRequests: lines.length,
    stats
  });
});

/* =========================
   DAILY RESET
========================= */
setInterval(() => {
  Object.values(API_KEYS).forEach(k => (k.used = 0));
  console.log("🔄 Daily API usage reset");
}, 24 * 60 * 60 * 1000);

/* =========================
   START SERVER
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
