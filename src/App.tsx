import { useEffect, useState, useMemo, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS = "0xa2b82A505C37b344622F5498057Fa6327e988b8c";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "https://your-render-backend.onrender.com";

const socket: Socket = io(BACKEND_URL);

const PROMPTS = [
  "Explain Optimistic Democracy to a Web2 gamer.",
  "Describe a gaming use case for Intelligent Contracts.",
  "How can subjective AI decisions improve blockchain applications?",
  "Pitch GenLayer to a game developer in under 50 words.",
  "Why is AI consensus useful for games?"
];

type Player = {
  id: string;
  name: string;
  score: number;
};

export default function App() {
  const [showArena, setShowArena] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [answer, setAnswer] = useState<string>("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [txHash, setTxHash] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [score, setScore] = useState<number | null>(null);

  const [rawContractOutput, setRawContractOutput] = useState<string>("");

  const promptText = useMemo(() => {
    return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  }, []);

  // Real-time leaderboard listener loop
  useEffect(() => {
    socket.on("gameState", (data: { players?: Player[] }) => {
      if (data?.players) {
        const sortedPlayers = [...data.players].sort((a, b) => b.score - a.score);
        setPlayers(sortedPlayers);
      }
    });

    return () => {
      socket.off("gameState");
    };
  }, []);

  // Room synchronization whenever the checked identity state shifts
  useEffect(() => {
    if (username) {
      socket.emit("joinRoom", username);
    }
  }, [username]);

  // AUTOMATED ACCOUNT & DISCONNECT LISTENER CHAIN
  useEffect(() => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setWalletAddress("");
        setUsername("");
        setScore(null);
        setFeedback("");
        setTxHash("");
        setRawContractOutput("");
      } else {
        const nextAddress = accounts[0];
        setWalletAddress(nextAddress);
        
        const savedName = localStorage.getItem(`arena_discord_username_${nextAddress.toLowerCase()}`) || "";
        setUsername(savedName);
        
        setScore(null);
        setFeedback("");
        setTxHash("");
        setRawContractOutput("");
      }
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    
    ethereum.request({ method: "eth_accounts" })
      .then(handleAccountsChanged)
      .catch(console.error);

    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  // Dropdown background click tracking
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const connectWallet = async (): Promise<void> => {
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        alert("Please install an EVM wallet.");
        return;
      }

      const accounts: string[] = await ethereum.request({
        method: "eth_requestAccounts",
      });

      const activeAddress = accounts[0];
      setWalletAddress(activeAddress);
      
      const savedName = localStorage.getItem(`arena_discord_username_${activeAddress.toLowerCase()}`) || "";
      setUsername(savedName);
    } catch (err) {
      console.error(err);
    }
  };

  const connectDiscordIdentity = (): void => {
    if (!walletAddress) {
      alert("Connect your wallet first to anchor your identity profile registration.");
      return;
    }

    const name = window.prompt("Enter your Discord username");
    if (!name) return;

    setUsername(name);
    localStorage.setItem(`arena_discord_username_${walletAddress.toLowerCase()}`, name);

    socket.emit("joinRoom", name);
  };

  const handleSignOut = () => {
    setWalletAddress(""); 
    setUsername(""); 
    setDropdownOpen(false);
  };

  const handleGoHome = () => {
    setShowArena(false);
    setDropdownOpen(false);
  };

  const handleEnterArenaClick = () => {
    if (!walletAddress) {
      alert("Connect wallet first to access the arena!");
      return;
    }
    setShowArena(true);
  };

  // EXPLICIT MANUAL DATA REFRESH FUNCTION (FIXED ARGUMENTS & PARSING)
  const refreshContractState = async (): Promise<void> => {
    if (!walletAddress) return;
    try {
      setIsSyncing(true);
      setRawContractOutput("Fetching latest storage slots from GenLayer nodes...");

      const client = createClient({
        chain: studionet,
        account: walletAddress as `0x${string}`,
      });

      // Fixed: Swapped functionName to get_result and explicitly passed wallet address
      const result = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_result",
        args: [walletAddress],
      });

      const resultString = JSON.stringify(result);
      setRawContractOutput(resultString);

      let parsedScore = 0;
      let parsedFeedback = "No result logged yet.";

      if (result && resultString !== "{}" && resultString !== '""') {
        try {
          // Unpack Python JSON string mapping format
          const cleanData = typeof result === "string" ? JSON.parse(result) : result;
          if (cleanData && typeof cleanData === "object") {
            if (cleanData.score !== undefined) parsedScore = Number(cleanData.score);
            if (cleanData.feedback !== undefined) parsedFeedback = String(cleanData.feedback);
          }
        } catch (e) {
          parsedFeedback = String(result);
        }
      }

      setScore(parsedScore);
      setFeedback(parsedFeedback);
    } catch (err: any) {
      console.error("Manual sync failed:", err);
      setRawContractOutput(`Sync Error: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // WRITE TRANSACTION SUBMISSION LOOP (FIXED READBACK PATTERNS)
  const submitAnswer = async (): Promise<void> => {
    if (!walletAddress) {
      alert("Connect wallet first");
      return;
    }
    if (!username) {
      alert("Connect Discord identity first");
      return;
    }
    if (!answer.trim()) {
      alert("Enter an answer");
      return;
    }

    try {
      setIsSubmitting(true);
      setRawContractOutput("Processing transaction on GenLayer...");

      const client = createClient({
        chain: studionet,
        account: walletAddress as `0x${string}`,
      });

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "submit_answer",
        args: [username, answer],
        value: BigInt(0),
      });

      setTxHash(String(hash));

      await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.FINALIZED,
        interval: 5000, 
        retries: 60,    
      });

      // Fixed: Updated post-receipt read loop to check specific address keys
      const result = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_result",
        args: [walletAddress],
      });

      const resultString = JSON.stringify(result);
      setRawContractOutput(resultString);

      let parsedScore = 0;
      let parsedFeedback = String(result);

      if (result && resultString !== "{}" && resultString !== '""') {
        try {
          const cleanData = typeof result === "string" ? JSON.parse(result) : result;
          if (cleanData && typeof cleanData === "object") {
            if (cleanData.score !== undefined) parsedScore = Number(cleanData.score);
            if (cleanData.feedback !== undefined) parsedFeedback = String(cleanData.feedback);
          }
        } catch (e) {}
      }

      setScore(parsedScore);
      setFeedback(parsedFeedback);

      socket.emit("submitPromptResult", {
        score: parsedScore,
        feedback: parsedFeedback,
        txHash: String(hash),
        walletAddress,
        username: username 
      });

      alert("🎉 Submission successful! Processing complete on GenLayer.");
    } catch (err: any) {
      console.error("GenLayer Submission Detail Logs:", err);
      setRawContractOutput(`Error logging execution path: ${err?.message || JSON.stringify(err)}`);
      alert(`Submission failed: ${err?.message || err || "Verify token gas balance."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToLeaderboard = () => {
    setShowArena(true);
    setTimeout(() => {
      const element = document.getElementById("leaderboard-section");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  const isFullyAuthenticated = walletAddress && username;

  const getHeaderProfileText = () => {
    if (!walletAddress) {
      return "Connect Wallet";
    }
    if (username) {
      return `👾 ${username} ▾`;
    }
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} ▾`;
  };

  return (
    <>
      <style>{`
        body, html, #root {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100vh;
          background-color: #0b0e14 !important;
          color: #f0f2f5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }
        .landing-page {
          background-color: #0b0e14;
          min-height: 100vh;
          padding: 100px 20px 60px 20px;
          box-sizing: border-box;
          max-width: 900px;
          margin: 0 auto;
        }
        .hero {
          text-align: center;
          margin-bottom: 50px;
        }
        .hero h1 {
          font-size: 2.8rem;
          color: #ffffff;
          margin-bottom: 16px;
        }
        .hero-text {
          font-size: 1.2rem;
          color: #94a3b8;
        }
        .info-section {
          background: #111827;
          border: 1px solid #1f2937;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }
        .info-section h2 {
          margin-top: 0;
          color: #3498db;
          font-size: 1.5rem;
        }
        .info-section p, .info-section ul {
          color: #cbd5e1;
          line-height: 1.6;
        }
        .info-section ul {
          padding-left: 20px;
        }
        .info-section li {
          margin-bottom: 8px;
        }
        .cta-banner {
          text-align: center;
          background: linear-gradient(135deg, #1e1b4b 0%, #111827 100%);
          border: 1px solid #312e81;
          border-radius: 16px;
          padding: 40px 20px;
          margin-top: 40px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .cta-banner h2 {
          color: #ffffff;
          margin-bottom: 24px;
        }
        .join-btn {
          background-color: #3498db;
          color: #ffffff;
          border: none;
          padding: 16px 36px;
          font-size: 1.1rem;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
        }
        .join-btn:hover {
          background-color: #2980b9;
          transform: translateY(-1px);
        }
        
        .dropdown-menu {
          position: absolute;
          top: 42px;
          right: 0;
          background-color: #111827;
          border: 1px solid #1f2937;
          border-radius: 8px;
          width: 160px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 100;
        }
        .dropdown-item {
          background: none;
          border: none;
          color: #cbd5e1;
          padding: 12px 16px;
          text-align: left;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          font-family: inherit;
          transition: background 0.15s, color 0.15s;
        }
        .dropdown-item:hover {
          background-color: #1f2937;
          color: #ffffff;
        }
        .dropdown-item.signout-color {
          color: #e74c3c;
        }
        .dropdown-item.signout-color:hover {
          background-color: rgba(231, 76, 60, 0.1);
          color: #ff6b6b;
        }

        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .card {
          background: #111827;
          border: 1px solid #1f2937;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        }
        .card h1 {
          font-size: 2.2rem;
          margin-top: 0;
          margin-bottom: 8px;
          color: #ffffff;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .subtitle {
          color: #94a3b8;
          margin-bottom: 32px;
          font-size: 1rem;
        }
        .question {
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
        }
        .question h3 {
          margin-top: 0;
          color: #9b59b6;
          font-size: 1.2rem;
          margin-bottom: 12px;
        }
        .question p {
          color: #e2e8f0;
          margin: 0;
          font-size: 1.1rem;
          line-height: 1.6;
        }
        textarea {
          width: 100%;
          background: #0b0e14;
          border: 1px solid #374151;
          color: #ffffff;
          font-family: inherit;
          font-size: 1.05rem;
          line-height: 1.5;
          resize: vertical;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        textarea:focus {
          outline: none;
          border-color: #3498db;
        }
        button {
          background-color: #3498db;
          color: white;
          border: none;
          padding: 14px 28px;
          font-size: 1.05rem;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.2s;
        }
        button:hover:not(:disabled) {
          background-color: #2980b9;
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .sync-btn {
          background-color: #27ae60;
          padding: 8px 16px;
          font-size: 0.9rem;
        }
        .sync-btn:hover:not(:disabled) {
          background-color: #219653;
        }
        .leaderboard {
          margin-top: 48px;
          border-top: 1px solid #1f2937;
          padding-top: 32px;
        }
        .leaderboard h2 {
          font-size: 1.8rem;
          color: #ffffff;
          margin-top: 0;
          margin-bottom: 20px;
        }
        .player {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 8px;
          margin-bottom: 12px;
          font-size: 1.05rem;
        }
        .player.highlight {
          border-color: #9b59b6;
          background: rgba(155, 89, 182, 0.1);
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          color: #64748b;
          font-size: 0.9rem;
        }
      `}</style>

      <header
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "20px 40px",
          position: "absolute",
          top: 0,
          right: 0,
          zIndex: 10,
          height: "60px",
          left: 0,
          boxSizing: "border-box"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px", height: "100%" }}>
          <button
            onClick={scrollToLeaderboard}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "600",
              padding: "0",
              margin: "0",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              height: "36px"
            }}
          >
            Leaderboard
          </button>
          
          <button
            onClick={() => window.open("https://testnet-faucet.genlayer.foundation/", "_blank", "noopener,noreferrer")}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "600",
              padding: "0",
              margin: "0",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              height: "36px"
            }}
          >
            Faucet
          </button>

          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => {
                if (!walletAddress) {
                  connectWallet();
                } else {
                  setDropdownOpen(!dropdownOpen);
                }
              }}
              style={{
                backgroundColor: walletAddress ? (username ? "#9b59b6" : "#27ae60") : "#3498db",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                padding: "0 16px",
                borderRadius: "8px",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "36px",
                textOverflow: "ellipsis",
                overflow: "hidden",
                maxWidth: "240px",
                whiteSpace: "nowrap",
                margin: "0"
              }}
            >
              {getHeaderProfileText()}
            </button>

            {dropdownOpen && walletAddress && (
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={handleGoHome}>
                  🏠 Home
                </button>
                <button className="dropdown-item signout-color" onClick={handleSignOut}>
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {!showArena ? (
        <div className="landing-page">
          <div className="hero">
            <h1>🧠 GenLayer Prompt Battle Arena</h1>
            <p className="hero-text">
              Challenge AI. Earn XP. Climb the Leaderboard.
              Compete with the Community.
            </p>
          </div>

          <section className="info-section">
            <h2>What is GenLayer?</h2>
            <p>
              GenLayer is a blockchain built for Intelligent
              Contracts, enabling AI-powered reasoning and
              natural language understanding directly on-chain.
            </p>
          </section>

          <section className="info-section">
            <h2>How Prompt Battle Works</h2>
            <p>
              Players answer prompts. GenLayer evaluates the
              response and awards XP based on quality,
              reasoning, and relevance.
            </p>
          </section>

          <section className="info-section">
            <h2>🏆 XP & Rankings</h2>
            <ul>
              <li>Better answers earn more XP.</li>
              <li>XP determines leaderboard position.</li>
              <li>Discord username is your identity.</li>
              <li>Wallet verifies participation.</li>
            </ul>
          </section>

          <section className="info-section">
            <h2>⚔ Multiplayer Vision</h2>
            <p>
              Future updates will introduce live multiplayer
              battles, tournaments, seasonal rankings and
              community competitions.
            </p>
          </section>

          <div className="cta-banner">
            <h2>Ready to Challenge the AI?</h2>
            <button
              className="join-btn"
              onClick={handleEnterArenaClick}
            >
              ENTER THE ARENA
            </button>
          </div>
        </div>
      ) : (
        <div className="container" style={{ marginTop: "80px" }}>
          <div className="card">
            <h1>
              <span>GenLayer Prompt Battle Arena</span>
              {walletAddress && (
                <button 
                  className="sync-btn" 
                  onClick={refreshContractState} 
                  disabled={isSyncing || isSubmitting}
                >
                  {isSyncing ? "Syncing..." : "🔄 Refresh Score"}
                </button>
              )}
            </h1>
            <p className="subtitle">
              Complete your verification profiles to see the active game challenge stage.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", margin: "20px 0" }}>
              <div className="question">
                Wallet Status:{" "}
                {walletAddress ? (
                  <strong>Connected ({walletAddress})</strong>
                ) : (
                  <span>
                    <strong style={{ color: "#e74c3c" }}>Disconnected</strong>{" "}
                    <button onClick={connectWallet} style={{ padding: "4px 10px", fontSize: "12px", marginLeft: "10px" }}>
                      Connect Wallet
                    </button>
                  </span>
                )}
              </div>

              {!username ? (
                <div style={{ padding: "15px", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "8px", textAlign: "center" }}>
                  <p style={{ marginBottom: "12px" }}>To participate on the leaderboard ranking pool, link your Discord profile handle identity.</p>
                  <button onClick={connectDiscordIdentity}>
                    Connect Discord Identity
                  </button>
                </div>
              ) : (
                <div className="question">
                  Identity Registered: <strong>{username}</strong>
                </div>
              )}
            </div>

            {isFullyAuthenticated ? (
              <>
                <div className="question">
                  <h3>Prompt</h3>
                  <p>{promptText}</p>
                </div>

                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Write your answer..."
                  style={{
                    width: "100%",
                    minHeight: "180px",
                    marginTop: "20px",
                    borderRadius: "12px",
                    padding: "14px",
                  }}
                />

                <button
                  onClick={submitAnswer}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Submitting..."
                    : "Submit To GenLayer"}
                </button>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "20px", opacity: 0.6 }}>
                🔒 <em>Please complete verification profiles to access active prompts.</em>
              </div>
            )}

            {/* LIVE DATA STAGE DIAGNOSTIC BOX */}
            {rawContractOutput && (
              <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "#1e293b", border: "1px dashed #475569", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "bold", letterSpacing: "0.05em" }}>🔍 RAW SMART CONTRACT RETURN VALUE:</span>
                <pre style={{ margin: "8px 0 0 0", fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#cbd5e1", fontFamily: "monospace" }}>{rawContractOutput}</pre>
              </div>
            )}

            {score !== null && (
              <div className="question" style={{ marginTop: "20px", borderLeft: "4px solid #9b59b6" }}>
                <h3>Your Last Result</h3>
                <p><strong>Score:</strong> {score} XP</p>
                <p><strong>Feedback:</strong><br />{feedback}</p>
                <p><strong>Transaction Hash:</strong><br /><span style={{ fontSize: "12px", opacity: 0.7 }}>{txHash}</span></p>
              </div>
            )}

            <div id="leaderboard-section" className="leaderboard" style={{ marginTop: "40px" }}>
              <h2>Leaderboard</h2>
              {players.length === 0 ? (
                <p>No players yet.</p>
              ) : (
                players.map((player, index) => (
                  <div
                    key={player.id}
                    className={`player ${
                      player.name === username
                        ? "highlight"
                        : ""
                    }`}
                  >
                    <div>
                      #{index + 1} - {player.name}
                    </div>
                    <div>
                      {player.score} XP
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="footer">
              <p>
                Powered by GenLayer Intelligent Contracts
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}