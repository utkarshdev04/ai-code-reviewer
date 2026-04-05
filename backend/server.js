import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import connectDB from "./db.js";
import Review from "./models/Review.js";
import authRoutes from "./routes/auth.js";
import protect from "./middleware/authMiddleware.js";

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "10mb" }));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Auth Routes ──────────────────────────────────────────────────────────────

app.use("/auth", authRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.send("AI Code Reviewer API running");
});

// ─── Review a single file (protected) ────────────────────────────────────────

app.post("/review", protect, async (req, res) => {
  console.log("📥 Reviewing:", req.body.path, "| User:", req.user.email);
  const { path, content, language } = req.body;

  if (!content || !path) {
    return res.status(400).json({ error: "File path and content are required." });
  }

  try {
    const prompt = `You are an expert code reviewer. Analyze the following ${language || "code"} file.

File: ${path}

\`\`\`${language || ""}
${content.slice(0, 6000)}
\`\`\`

Return ONLY a raw JSON object with no markdown, no explanation, no backticks. Use this exact structure:
{
  "path": "${path}",
  "issues": [
    {
      "title": "short issue title",
      "severity": "critical | warning | info",
      "description": "clear explanation of the problem",
      "line": 10,
      "suggestion": "how to fix this issue",
      "code": "optional corrected code snippet"
    }
  ]
}

Check for:
- Bugs and logical errors
- Security vulnerabilities (SQL injection, XSS, exposed secrets, etc.)
- Performance problems
- Missing error handling
- Bad practices and code smells
- Outdated or deprecated usage

If no issues found, return an empty issues array.`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a senior software engineer and code reviewer. Always respond with raw JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    });

    const raw = response.choices[0].message.content.trim();

    let result;
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      result = JSON.parse(clean);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", raw);
      return res.status(500).json({ error: "AI returned invalid JSON. Try again." });
    }

    return res.json(result);

  } catch (err) {
    console.error("Groq error:", err.message);
    return res.status(500).json({ error: "AI review failed: " + err.message });
  }
});

// ─── Save full review to MongoDB (protected) ──────────────────────────────────

app.post("/save-review", protect, async (req, res) => {
  const { repoUrl, owner, repo, results } = req.body;

  if (!repoUrl || !results) {
    return res.status(400).json({ error: "repoUrl and results are required." });
  }

  try {
    const allIssues = results.flatMap(r => r.issues || []);
    const criticalCount = allIssues.filter(i => i.severity === "critical").length;

    const review = new Review({
      userId: req.user._id,
      repoUrl,
      owner,
      repo,
      totalFiles: results.length,
      totalIssues: allIssues.length,
      criticalCount,
      results,
    });

    await review.save();
    console.log("💾 Review saved for user:", req.user.email);
    return res.json({ message: "Review saved successfully!", id: review._id });

  } catch (err) {
    console.error("MongoDB save error:", err.message);
    return res.status(500).json({ error: "Failed to save review: " + err.message });
  }
});

// ─── Get review history (only current user's reviews) ────────────────────────

app.get("/history", protect, async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.user._id })
      .select("repoUrl owner repo totalFiles totalIssues criticalCount createdAt")
      .sort({ createdAt: -1 })
      .limit(20);

    return res.json(reviews);
  } catch (err) {
    console.error("MongoDB fetch error:", err.message);
    return res.status(500).json({ error: "Failed to fetch history: " + err.message });
  }
});

// ─── Get a single review by ID (protected) ───────────────────────────────────

app.get("/history/:id", protect, async (req, res) => {
  try {
    const review = await Review.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found." });
    }

    return res.json(review);
  } catch (err) {
    console.error("MongoDB fetch error:", err.message);
    return res.status(500).json({ error: "Failed to fetch review: " + err.message });
  }
});

// ─── Auto Fix Route ───────────────────────────────────────────────────────────

app.post("/fix", protect, async (req, res) => {
  const { filePath, issue, repoUrl } = req.body;

  if (!issue || !repoUrl || !filePath) {
    return res.status(400).json({ error: "filePath, issue and repoUrl are required." });
  }

  try {
    // Parse owner and repo from repoUrl
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/?\s#]+)/);
    if (!match) return res.status(400).json({ error: "Invalid repo URL." });
    const owner = match[1];
    const repo = match[2];

    // Fetch file content directly from GitHub
    const githubRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      { headers: { Accept: "application/vnd.github.v3+json" } }
    );

    if (!githubRes.ok) {
      return res.status(400).json({ error: "Could not fetch file from GitHub." });
    }

    const fileData = await githubRes.json();
    const originalCode = Buffer.from(fileData.content, "base64").toString("utf-8");

    // Ask Groq to fix the issue
    const prompt = `You are an expert software engineer. A code review found the following issue in a file.

File: ${filePath}

Issue Title: ${issue.title}
Severity: ${issue.severity}
Description: ${issue.description}
Line: ${issue.line || "unknown"}

Original Code:
\`\`\`
${originalCode.slice(0, 4000)}
\`\`\`

Your task:
1. Fix ONLY the specific issue mentioned above
2. Return ONLY the fixed code snippet (not the entire file)
3. No explanation, no markdown, no backticks
4. Just the raw fixed code`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert software engineer. Return only the fixed code, nothing else.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
    });

    const fixedCode = response.choices[0].message.content.trim();
    console.log("🔧 Fix generated for:", filePath, "| User:", req.user.email);
    return res.json({ fixedCode });

  } catch (err) {
    console.error("Fix error:", err.message);
    return res.status(500).json({ error: "Auto fix failed: " + err.message });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────

app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});