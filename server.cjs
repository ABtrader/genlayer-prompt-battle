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
const connectedUsers = new Map();

function cleanPlayer(player) {
  return {
    name: String(player.name || ""),
    score: Number(player.score || 0),
    lastWeeklyScore: Number(player.lastWeeklyScore || 0),
    submitted: Boolean(player.submitted),
    completionTime: Number(player.completionTime || 0),
  };
}

function loadLeaderboard() {
  try {
    if (fs.existsSync(leaderboardFile)) {
      const data = fs.readFileSync(leaderboardFile, "utf-8");
      const parsed = JSON.parse(data);

      players = Array.isArray(parsed)
        ? parsed
            .filter((player) => player.name && Number(player.score || 0) > 0)
            .map(cleanPlayer)
        : [];
    } else {
      players = [];
      saveLeaderboard();
    }
  } catch (error) {
    console.error("Error loading leaderboard:", error);
    players = [];
    saveLeaderboard();
  }
}

function saveLeaderboard() {
  fs.writeFileSync(leaderboardFile, JSON.stringify(players, null, 2));
}

function sortPlayers(list) {
  return [...list].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const aTime = a.completionTime || 999999;
    const bTime = b.completionTime || 999999;

    return aTime - bTime;
  });
}

function broadcastLeaderboard() {
  io.emit("gameState", {
    players: sortPlayers(players),
  });
}

loadLeaderboard();

app.get("/", (req, res) => {
  res.send("GenLayer Prompt Battle Backend Live");
});

app.get("/leaderboard", (req, res) => {
  res.json(sortPlayers(players));
});

app.post("/admin/reset", (req, res) => {
  const secret = req.headers["x-admin-secret"];

  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  players = [];
  saveLeaderboard();

  broadcastLeaderboard();

  console.log("Leaderboard fully reset");

  res.json({
    success: true,
    message: "Leaderboard fully reset. All test scores were deleted.",
  });
});

app.post("/admin/new-week", (req, res) => {
  const secret = req.headers["x-admin-secret"];

  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  players = players.map((player) => ({
    ...player,
    submitted: false,
    completionTime: 0,
    lastWeeklyScore: 0,
  }));

  saveLeaderboard();
  broadcastLeaderboard();

  console.log("New weekly event started. Total scores preserved.");

  res.json({
    success: true,
    message:
      "New weekly event started. Total scores were preserved and players can play again.",
  });
});

async function submitToGenLayer(username, score, completionTime) {
  try {
    console.log("Submitting score to GenLayer...");

    console.log({
      username,
      score,
      completionTime,
    });

    return true;
  } catch (error) {
    console.error("GenLayer submission failed:", error);
    return false;
  }
}

io.on("connection", (socket) => {
  console.log("User connected");

  socket.emit("gameState", {
    players: sortPlayers(players),
  });

  socket.on("joinRoom", (username) => {
    if (!username) return;

    connectedUsers.set(socket.id, username);

    socket.emit("gameState", {
      players: sortPlayers(players),
    });

    console.log(`${username} connected but not added to leaderboard yet`);
  });

  socket.on("submitFinalScore", async ({ finalScore, completionTime }) => {
    const username = connectedUsers.get(socket.id);

    if (!username) {
      console.log("Score rejected: no username connected");
      return;
    }

    const weeklyScore = Number(finalScore || 0);
    const timeTaken = Number(completionTime || 0);

    if (weeklyScore <= 0) {
      console.log("Score rejected: score is zero");
      return;
    }

    let player = players.find((p) => p.name === username);

    if (player && player.submitted) {
      console.log("Replay attempt blocked");
      return;
    }

    if (!player) {
      player = {
        name: username,
        score: 0,
        lastWeeklyScore: 0,
        submitted: false,
        completionTime: 0,
      };

      players.push(player);
    }

    player.score = Number(player.score || 0) + weeklyScore;
    player.lastWeeklyScore = weeklyScore;
    player.submitted = true;
    player.completionTime = timeTaken;

    saveLeaderboard();

    await submitToGenLayer(username, weeklyScore, timeTaken);

    broadcastLeaderboard();
  });

  socket.on("disconnect", () => {
    connectedUsers.delete(socket.id);
    console.log("User disconnected");
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});