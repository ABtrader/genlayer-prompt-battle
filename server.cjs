const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Initializing Supabase with the environment variables set up on Render
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to fetch and format scores so the frontend can read them seamlessly
async function getLeaderboardData() {
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('total_score', { ascending: false });

    if (error) throw error;

    // Map database snake_case keys back to the camelCase keys your App.tsx frontend expects
    return (data || []).map(player => ({
      username: player.username || 'Anonymous',
      walletAddress: player.wallet_address,
      score: player.total_score || 0,
      feedback: player.feedback,
      txHash: player.genlayer_tx_hash
    }));
  } catch (err) {
    console.error("Failed to fetch leaderboard from Supabase:", err);
    return [];
  }
}

io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Send current live database rankings to the user immediately on connection/refresh
  const initialPlayers = await getLeaderboardData();
  socket.emit('gameState', { players: initialPlayers });

  // Handle incoming results from the frontend game loop
  socket.on('submitPromptResult', async (data) => {
    console.log("Received result submission from frontend:", data);

    const walletAddress = data.walletAddress;
    const newScore = parseInt(data.score) || 0;

    try {
      // Check if this wallet already exists in your table
      const { data: existing, error: fetchError } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (existing) {
        // Only update if their new score beats their old score
        if (newScore > (existing.total_score || 0)) {
          await supabase
            .from('leaderboard')
            .update({ 
              total_score: newScore, 
              feedback: data.feedback, 
              genlayer_tx_hash: data.txHash,
              updated_at: new Date().toISOString()
            })
            .eq('wallet_address', walletAddress);
          console.log(`Updated high score for wallet: ${walletAddress}`);
        }
      } else {
        // Insert a brand new record if the wallet isn't in the database yet
        await supabase
          .from('leaderboard')
          .insert([{
            username: data.username || 'Anonymous',
            wallet_address: walletAddress,
            total_score: newScore,
            feedback: data.feedback,
            genlayer_tx_hash: data.txHash,
            updated_at: new Date().toISOString()
          }]);
        console.log(`Created new leaderboard profile for wallet: ${walletAddress}`);
      }

      // Fetch the updated rankings and broadcast them out to everyone live
      const updatedPlayers = await getLeaderboardData();
      io.emit('gameState', { players: updatedPlayers });

    } catch (err) {
      console.error("Supabase Operation Error:", err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});