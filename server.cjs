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

function loadLeaderboard() {
  try {
    if (fs.existsSync(leaderboardFile)) {
      const data = fs.readFileSync(leaderboardFile, "utf-8");
      players = JSON.parse(data);

      if (!Array.isArray(players)) {
        players = [];
      }
    } else {
      players = [];
      saveLeaderboard();
    }
  } catch (error) {
    console.error(error);
    players = [];
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

loadLeaderboard();

app.get("/", (req, res) => {
  res.send("GenLayer Prompt Battle Backend Live");
});

app.get("/leaderboard", (req, res) => {
  res.json(sortPlayers(players));
});

/*
  HARD RESET:
  Use this only before your first real public launch
  or when you want to delete all test data completely.
*/
app.post("/admin/reset", (req, res) => {
  const secret = req.headers["x-admin-secret"];

  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  players = [];
  saveLeaderboard();

  io.emit("gameState", {
    players: [],
  });

  console.log("Leaderboard fully reset");

  res.json({
    success: true,
    message: "Leaderboard fully reset. All test scores were deleted.",
  });
});

/*
  NEW WEEK:
  Use this after each weekly event.
  It keeps old total scores but unlocks players
  so they can participate again.
*/
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

  io.emit("gameState", {
    players: sortPlayers(players),
  });

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
    console.error(error);

    return false;
  }
}

io.on("connection", (socket) => {
  console.log("User connected");

  socket.emit("gameState", {
    players: sortPlayers(players),
  });

  socket.on("joinRoom", (username) => {
    let existingPlayer = players.find((player) => player.name === username);

    if (!existingPlayer) {
      existingPlayer = {
        id: socket.id,
        name: username,
        score: 0,
        lastWeeklyScore: 0,
        submitted: false,
        completionTime: 0,
      };

      players.push(existingPlayer);
      saveLeaderboard();
    } else {
      existingPlayer.id = socket.id;
      saveLeaderboard();
    }

    io.emit("gameState", {
      players: sortPlayers(players),
    });
  });

  socket.on("submitFinalScore", async ({ finalScore, completionTime }) => {
    const player = players.find((p) => p.id === socket.id);

    if (!player) return;

    /*
      BLOCK REPLAY FOR THE CURRENT WEEK
    */
    if (player.submitted) {
      console.log("Replay attempt blocked");
      return;
    }

    const weeklyScore = Number(finalScore || 0);

    /*
      IMPORTANT:
      This adds the new weekly score to the previous total score.
      Example:
      Week 1 = 110
      Week 2 = 150
      Total = 260
    */
    player.score = Number(player.score || 0) + weeklyScore;
    player.lastWeeklyScore = weeklyScore;
    player.submitted = true;
    player.completionTime = Number(completionTime || 0);

    saveLeaderboard();

    await submitToGenLayer(player.name, weeklyScore, completionTime);

    io.emit("gameState", {
      players: sortPlayers(players),
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});