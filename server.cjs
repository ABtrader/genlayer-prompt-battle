const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT || 3001;
const ADMIN_SECRET = "change-this-before-live";

const leaderboardFile = path.join(__dirname, "leaderboard.json");

let players = [];

function normalizePlayer(player) {
  return {
    id: player.id || "",
    name: player.name,
    totalScore: Number(player.totalScore ?? player.score ?? 0),
    weeklyScore: Number(player.weeklyScore ?? player.score ?? 0),
    submitted: Boolean(player.submitted),
    completionTime: Number(player.completionTime ?? 0),
    weeksPlayed: Number(player.weeksPlayed ?? (player.submitted ? 1 : 0)),
    history: Array.isArray(player.history) ? player.history : [],
  };
}

function loadLeaderboard() {
  try {
    if (fs.existsSync(leaderboardFile)) {
      const data = fs.readFileSync(leaderboardFile, "utf-8");
      const parsed = JSON.parse(data);

      players = Array.isArray(parsed)
        ? parsed.filter((p) => p.name).map(normalizePlayer)
        : [];
    } else {
      players = [];
      saveLeaderboard();
    }
  } catch (error) {
    console.error("Error loading leaderboard:", error);
    players = [];
  }
}

function saveLeaderboard() {
  fs.writeFileSync(leaderboardFile, JSON.stringify(players, null, 2));
}

function getSortedPlayers() {
  return [...players].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.completionTime - b.completionTime;
  });
}

loadLeaderboard();

app.get("/", (req, res) => {
  res.send("GenLayer Prompt Battle Backend Live");
});

app.get("/leaderboard", (req, res) => {
  res.json(getSortedPlayers());
});

app.post("/admin/new-week", (req, res) => {
  const secret = req.headers["x-admin-secret"];

  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  players = players.map((player) => ({
    ...player,
    submitted: false,
    weeklyScore: 0,
    completionTime: 0,
  }));

  saveLeaderboard();

  io.emit("gameState", {
    players: getSortedPlayers(),
  });

  res.json({
    success: true,
    message:
      "New weekly event started. Lifetime scores were preserved and players can participate again.",
  });
});

app.post("/admin/hard-reset", (req, res) => {
  const secret = req.headers["x-admin-secret"];

  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  players = [];
  saveLeaderboard();

  io.emit("gameState", {
    players: [],
  });

  res.json({
    success: true,
    message: "All leaderboard data cleared completely.",
  });
});

async function submitToGenLayer(username, score, completionTime) {
  try {
    console.log("Submitting score to GenLayer...");
    console.log({ username, score, completionTime });
    return true;
  } catch (error) {
    console.error("GenLayer submission failed:", error);
    return false;
  }
}

io.on("connection", (socket) => {
  console.log("User connected");

  socket.emit("gameState", {
    players: getSortedPlayers(),
  });

  socket.on("joinRoom", (username) => {
    let existingPlayer = players.find((player) => player.name === username);

    if (!existingPlayer) {
      existingPlayer = {
        id: socket.id,
        name: username,
        totalScore: 0,
        weeklyScore: 0,
        submitted: false,
        completionTime: 0,
        weeksPlayed: 0,
        history: [],
      };

      players.push(existingPlayer);
    } else {
      existingPlayer.id = socket.id;
    }

    saveLeaderboard();

    io.emit("gameState", {
      players: getSortedPlayers(),
    });
  });

  socket.on("submitFinalScore", async ({ finalScore, completionTime }) => {
    const player = players.find((p) => p.id === socket.id);

    if (!player) return;

    if (player.submitted) {
      console.log("Replay attempt blocked");
      return;
    }

    const scoreToAdd = Number(finalScore || 0);
    const timeTaken = Number(completionTime || 0);

    player.weeklyScore = scoreToAdd;
    player.totalScore += scoreToAdd;
    player.submitted = true;
    player.completionTime = timeTaken;
    player.weeksPlayed += 1;

    player.history.push({
      week: player.weeksPlayed,
      score: scoreToAdd,
      completionTime: timeTaken,
      playedAt: new Date().toISOString(),
    });

    saveLeaderboard();

    await submitToGenLayer(player.name, scoreToAdd, timeTaken);

    io.emit("gameState", {
      players: getSortedPlayers(),
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});