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

const leaderboardFile = path.join(
  __dirname,
  "leaderboard.json"
);

let players = [];

function loadLeaderboard() {
  if (fs.existsSync(leaderboardFile)) {
    const data = fs.readFileSync(
      leaderboardFile,
      "utf-8"
    );

    players = JSON.parse(data);
  }
}

function saveLeaderboard() {
  fs.writeFileSync(
    leaderboardFile,
    JSON.stringify(players, null, 2)
  );
}

loadLeaderboard();

app.get("/", (req, res) => {
  res.send("GenLayer Prompt Battle Backend Live");
});

app.get("/leaderboard", (req, res) => {
  res.json(players);
});

app.post("/admin/reset", (req, res) => {
  const secret = req.headers["x-admin-secret"];

  if (secret !== "change-this-before-live") {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  players = [];

  saveLeaderboard();

  io.emit("gameState", { players });

  res.json({
    success: true,
    message: "Leaderboard reset successfully",
  });
});

async function submitToGenLayer(
  username,
  score,
  completionTime
) {
  try {
    console.log(
      "Submitting score to GenLayer..."
    );

    console.log({
      username,
      score,
      completionTime,
    });

    /*
      FUTURE REAL RPC INTEGRATION AREA

      This is where real GenLayer RPC calls
      will happen later.

      Current MVP:
      - Backend logs all score submissions
      - Keeps structure ready for actual
        GenLayer transaction integration
    */

    return true;
  } catch (error) {
    console.error(
      "GenLayer submission failed:",
      error
    );

    return false;
  }
}

io.on("connection", (socket) => {
  console.log("User connected");

  socket.emit("gameState", {
    players,
  });

  socket.on("joinRoom", (username) => {
    const existingPlayer = players.find(
      (player) => player.name === username
    );

    if (!existingPlayer) {
      players.push({
        id: socket.id,
        name: username,
        score: 0,
        submitted: false,
        completionTime: 0,
      });

      saveLeaderboard();
    }

    io.emit("gameState", {
      players,
    });
  });

  socket.on(
    "submitFinalScore",
    async ({
      finalScore,
      completionTime,
    }) => {
      const player = players.find(
        (p) => p.id === socket.id
      );

      if (!player) return;

      if (player.submitted) {
        console.log(
          "Player already submitted"
        );

        return;
      }

      player.score = finalScore;

      player.submitted = true;

      player.completionTime =
        completionTime;

      saveLeaderboard();

      await submitToGenLayer(
        player.name,
        finalScore,
        completionTime
      );

      io.emit("gameState", {
        players,
      });
    }
  );

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

server.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});