const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// This creates a physical file named leaderboard.json inside your project folder
const FILE_PATH = path.join(__dirname, 'leaderboard.json');

// Helper: Opens the notebook and reads saved scores when server starts
function loadPlayers() {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const data = fs.readFileSync(FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading leaderboard file:", error);
  }
  return [];
}

// Helper: Writes new scores into the notebook to save them safely
function savePlayers(playersList) {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(playersList, null, 2), 'utf8');
  } catch (error) {
    console.error("Error writing to leaderboard file:", error);
  }
}

// Initialize our players list using the saved file
let players = loadPlayers();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Hand the current leaderboard to the user the second they connect/refresh
  socket.emit('gameState', { players });

  socket.on('submitPromptResult', (data) => {
    const existingPlayerIndex = players.findIndex(p => p.walletAddress === data.walletAddress);

    const playerData = {
      username: data.username || 'Anonymous',
      walletAddress: data.walletAddress,
      score: parseInt(data.score) || 0,
      feedback: data.feedback,
      txHash: data.txHash,
      timestamp: new Date().toISOString()
    };

    if (existingPlayerIndex !== -1) {
      if (playerData.score > players[existingPlayerIndex].score) {
        players[existingPlayerIndex] = playerData;
      }
    } else {
      players.push(playerData);
    }

    // Sort leaderboard from highest score to lowest
    players.sort((a, b) => b.score - a.score);

    // Save it to the file system right now!
    savePlayers(players);

    // Tell all connected browsers to update their screens
    io.emit('gameState', { players });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});