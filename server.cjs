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

/*
  FORCE CLEAN START
*/

try {
  fs.writeFileSync(
    leaderboardFile,
    JSON.stringify([], null, 2)
  );

  players = [];

  console.log(
    "Leaderboard initialized clean"
  );
} catch (error) {
  console.log(error);
}

function saveLeaderboard() {
  fs.writeFileSync(
    leaderboardFile,
    JSON.stringify(players, null, 2)
  );
}

app.get("/", (req, res) => {
  res.send(
    "GenLayer Prompt Battle Backend Live"
  );
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

  fs.writeFileSync(
    leaderboardFile,
    JSON.stringify([], null, 2)
  );

  io.emit("gameState", {
    players: [],
  });

  console.log(
    "Leaderboard fully reset"
  );

  res.json({
    success: true,
    message: "Leaderboard fully reset",
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

    return true;
  } catch (error) {
    console.error(error);

    return false;
  }
}

io.on("connection", (socket) => {
  console.log("User connected");

  socket.emit("gameState", {
    players,
  });

  socket.on(
    "joinRoom",
    (username) => {
      const existingPlayer =
        players.find(
          (player) =>
            player.name === username
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
    }
  );

  socket.on(
    "submitFinalScore",
    async ({
      finalScore,
      completionTime,
    }) => {
      const player =
        players.find(
          (p) =>
            p.id === socket.id
        );

      if (!player) return;

      if (player.submitted) {
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

  socket.on(
    "disconnect",
    () => {
      console.log(
        "User disconnected"
      );
    }
  );
});

server.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});