import express from "express";
import { queryGroq } from "../services/groq.js";

const router = express.Router();

/**
 * Example endpoint:
 * GET /api/test?client=client1
 */
router.get("/test", async (req, res) => {
  try {
    const { client } = req.query;
    if (!client) return res.status(400).json({ error: "Missing client param" });

    // Sample GROQ query (you can customize)
    const sampleQuery = `*[_type == "post"]{title, body}[0...5]`;

    const data = await queryGroq(client, sampleQuery);
    res.json({ client, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
