const express = require("express");
const http = require("http");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = 3001;
const ADMIN_SECRET = "change-this-before-live";
const DATA_FILE = path.join(__dirname, "leaderboard.json");

let players = [];

function loadLeaderboard() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const savedData = fs.readFileSync(DATA_FILE, "utf8");
      players = JSON.parse(savedData);
    }
  } catch (error) {
    console.log("Could not load leaderboard:", error.message);
    players = [];
  }
}

function saveLeaderboard() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(players, null, 2));
  } catch (error) {
    console.log("Could not save leaderboard:", error.message);
  }
}

function getSortedPlayers() {
  return [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const aTime = a.completionTime || 999999;
    const bTime = b.completionTime || 999999;

    return aTime - bTime;
  });
}

loadLeaderboard();

app.get("/", (req, res) => {
  res.send("Prompt Battle Arena backend is live.");
});

app.post("/admin/reset", (req, res) => {
  const secret = req.headers["x-admin-secret"];

  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized reset attempt.",
    });
  }

  players = [];
  saveLeaderboard();

  io.emit("gameState", {
    players: getSortedPlayers(),
  });

  return res.json({
    success: true,
    message: "Leaderboard reset successfully.",
  });
});

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.emit("gameState", {
    players: getSortedPlayers(),
  });

  socket.on("joinRoom", (username) => {
    const existingPlayer = players.find((player) => player.name === username);

    if (!existingPlayer) {
      players.push({
        id: socket.id,
        name: username,
        score: 0,
        submitted: false,
        completionTime: 0,
      });
    } else {
      players = players.map((player) => {
        if (player.name === username) {
          return {
            ...player,
            id: socket.id,
          };
        }

        return player;
      });
    }

    saveLeaderboard();

    io.emit("gameState", {
      players: getSortedPlayers(),
    });
  });

  socket.on("submitFinalScore", ({ finalScore, completionTime }) => {
    players = players.map((player) => {
      if (player.id === socket.id) {
        const existingScore = player.score || 0;

        if (player.submitted && existingScore >= finalScore) {
          return player;
        }

        return {
          ...player,
          score: finalScore,
          submitted: true,
          completionTime,
        };
      }

      return player;
    });

    saveLeaderboard();

    io.emit("gameState", {
      players: getSortedPlayers(),
    });
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Multiplayer server running on http://localhost:${PORT}`);
});