const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3001;
const ADMIN_SECRET = "change-this-before-live";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

const connectedUsers = new Map();

function formatPlayer(row) {
  return {
    id: String(row.id || row.username),
    name: row.username,
    score: Number(row.total_score || 0),
    lastWeeklyScore: Number(row.last_weekly_score || 0),
    submitted: Boolean(row.submitted),
    completionTime: Number(row.completion_time || 0),
  };
}

function sortPlayers(players) {
  return [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const aTime = a.completionTime || 999999;
    const bTime = b.completionTime || 999999;

    return aTime - bTime;
  });
}

async function getLeaderboard() {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*");

  if (error) {
    console.error("Leaderboard fetch error:", error);
    return [];
  }

  return sortPlayers((data || []).map(formatPlayer));
}

async function broadcastLeaderboard() {
  const players = await getLeaderboard();

  io.emit("gameState", { players });
}

app.get("/", (req, res) => {
  res.send("GenLayer Prompt Battle Backend Live");
});

app.get("/leaderboard", async (req, res) => {
  const players = await getLeaderboard();
  res.json(players);
});

app.post("/admin/reset", async (req, res) => {
  const secret = req.headers["x-admin-secret"];

  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { error } = await supabase
    .from("leaderboard")
    .delete()
    .neq("username", "");

  if (error) {
    console.error("Reset error:", error);
    return res.status(500).json({ error: "Failed to reset leaderboard" });
  }

  await broadcastLeaderboard();

  res.json({
    success: true,
    message: "Leaderboard fully reset",
  });
});

app.post("/admin/new-week", async (req, res) => {
  const secret = req.headers["x-admin-secret"];

  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { error } = await supabase
    .from("leaderboard")
    .update({
      submitted: false,
      completion_time: 0,
      last_weekly_score: 0,
    })
    .neq("username", "");

  if (error) {
    console.error("New week error:", error);
    return res.status(500).json({ error: "Failed to start new week" });
  }

  await broadcastLeaderboard();

  res.json({
    success: true,
    message: "New week started. Total scores preserved.",
  });
});

async function submitToGenLayer(username, score, completionTime) {
  console.log("Submitting score to GenLayer...");
  console.log({ username, score, completionTime });
  return true;
}

io.on("connection", (socket) => {
  console.log("User connected");

  broadcastLeaderboard();

  socket.on("joinRoom", async (username) => {
    if (!username) return;

    connectedUsers.set(socket.id, username);

    console.log(`${username} connected`);

    await broadcastLeaderboard();
  });

  socket.on(
  "submitPromptResult",
  async ({
    score,
    feedback,
    txHash,
    walletAddress,
  }) => {
    const username = connectedUsers.get(socket.id);

    if (!username) {
      console.log("No username found for this socket");
      return;
    }

    const { data: existingPlayer, error: fetchError } = await supabase
      .from("leaderboard")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (fetchError) {
      console.error("Player fetch error:", fetchError);
      return;
    }

    if (existingPlayer?.submitted) {
      console.log("Replay blocked for:", username);
      await broadcastLeaderboard();
      return;
    }

    const previousTotal = Number(
      existingPlayer?.total_score || 0
    );

    const promptScore = Number(score || 0);

    const payload = {
      username,
      wallet_address: walletAddress || "",
      total_score: previousTotal + promptScore,
      last_weekly_score: promptScore,
      feedback: feedback || "",
      genlayer_tx_hash: txHash || "",
      submitted: true,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("leaderboard")
      .upsert(payload, {
        onConflict: "username",
      });

    if (upsertError) {
      console.error(
        "Prompt result save error:",
        upsertError
      );
      return;
    }

    await broadcastLeaderboard();
  }
);

  socket.on("disconnect", () => {
    connectedUsers.delete(socket.id);
    console.log("User disconnected");
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});