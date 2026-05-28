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
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT || 3001;
const ADMIN_SECRET = "change-this-before-live";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const connectedUsers = new Map();

function sortPlayers(list) {
  return [...list].sort((a, b) => {
    if (b.total_score !== a.total_score) {
      return b.total_score - a.total_score;
    }

    return a.completion_time - b.completion_time;
  });
}

async function getLeaderboard() {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*");

  if (error) {
    console.error(error);
    return [];
  }

  return sortPlayers(data || []);
}

async function broadcastLeaderboard() {
  const players = await getLeaderboard();

  io.emit("gameState", {
    players,
  });
}

app.get("/", (req, res) => {
  res.send("GenLayer Prompt Battle Backend Live");
});

app.get("/leaderboard", async (req, res) => {
  const players = await getLeaderboard();

  res.json(players);
});

/*
  FULL RESET
*/
app.post("/admin/reset", async (req, res) => {
  const secret = req.headers["x-admin-secret"];

  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  const { error } = await supabase
    .from("leaderboard")
    .delete()
    .neq("username", "");

  if (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to reset leaderboard",
    });
  }

  await broadcastLeaderboard();

  res.json({
    success: true,
    message: "Leaderboard fully reset",
  });
});

/*
  START NEW WEEK
*/
app.post("/admin/new-week", async (req, res) => {
  const secret = req.headers["x-admin-secret"];

  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  const players = await getLeaderboard();

  for (const player of players) {
    await supabase
      .from("leaderboard")
      .update({
        submitted: false,
        completion_time: 0,
        last_weekly_score: 0,
      })
      .eq("username", player.username);
  }

  await broadcastLeaderboard();

  res.json({
    success: true,
    message:
      "New weekly event started. Total scores preserved.",
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

  broadcastLeaderboard();

  socket.on("joinRoom", (username) => {
    connectedUsers.set(socket.id, username);

    console.log(
      `${username} connected`
    );
  });

  socket.on(
    "submitFinalScore",
    async ({
      finalScore,
      completionTime,
    }) => {
      const username =
        connectedUsers.get(socket.id);

      if (!username) {
        return;
      }

      const weeklyScore =
        Number(finalScore || 0);

      const timeTaken =
        Number(completionTime || 0);

      if (weeklyScore <= 0) {
        return;
      }

      const { data: existingPlayer } =
        await supabase
          .from("leaderboard")
          .select("*")
          .eq("username", username)
          .single();

      /*
        BLOCK REPLAY
      */

      if (
        existingPlayer &&
        existingPlayer.submitted
      ) {
        console.log(
          "Replay blocked"
        );

        return;
      }

      const updatedScore =
        Number(
          existingPlayer?.total_score || 0
        ) + weeklyScore;

      const payload = {
        username,
        total_score: updatedScore,
        last_weekly_score:
          weeklyScore,
        submitted: true,
        completion_time:
          timeTaken,
      };

      await supabase
        .from("leaderboard")
        .upsert(payload, {
          onConflict: "username",
        });

      await submitToGenLayer(
        username,
        weeklyScore,
        timeTaken
      );

      await broadcastLeaderboard();
    }
  );

  socket.on("disconnect", () => {
    connectedUsers.delete(socket.id);

    console.log(
      "User disconnected"
    );
  });
});

server.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});