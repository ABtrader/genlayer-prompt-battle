import { useEffect, useState, useMemo, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS = "0xa2b82A505C37b344622F5498057Fa6327e988b8c";

// Dynamic endpoint fallbacks targeting your live Render cluster
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://genlayer-prompt-battle.onrender.com";
const socket: Socket = io(BACKEND_URL);

const PROMPTS = [
  "Explain Optimistic Democracy to a Web2 gamer.",
  "Describe a gaming use case for Intelligent Contracts.",
  "How can subjective AI decisions improve blockchain applications?",
  "Pitch GenLayer to a game developer in under 50 words.",
  "Why is AI consensus useful for games?"
];

// Aligned with the exact key schemas emitted by your Node backend
type Player = {
  walletAddress: string;
  username: string;
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
  const [promptIndex, setPromptIndex] = useState<number>(0);

  const [rawContractOutput, setRawContractOutput] = useState<string>("");

  // Selects an initial stable random prompt index on load
  useEffect(() => {
    setPromptIndex(Math.floor(Math.random() * PROMPTS.length));
  }, []);

  const promptText = useMemo(() => {
    return PROMPTS[promptIndex];
  }, [promptIndex]);

  // Real-time leaderboard loop
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

  useEffect(() => {
    if (username) {
      socket.emit("joinRoom", username);
    }
  }, [username]);

  // Automated account listener tracks wallet states
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

  const refreshContractState = async (): Promise<void> => {
    if (!walletAddress) return;
    try {
      setIsSyncing(true);
      setRawContractOutput("Fetching latest storage slots from GenLayer nodes...");

      const client = createClient({
        chain: studionet,
        account: walletAddress as `0x${string}`,
      });

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
      setRawContractOutput("Processing transaction via GenVM AI Execution Engines...");

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

      // Emitting matching schema structure keys to Node/Supabase pipeline
      socket.emit("submitPromptResult", {
        score: parsedScore,
        feedback: parsedFeedback,
        txHash: String(hash),
        walletAddress,
        username: username 
      });

      // Advance stage to another prompt challenge selection loop path automatically
      setPromptIndex((prev) => (prev + 1) % PROMPTS.length);
      setAnswer("");

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
    if (!walletAddress) return "Connect Wallet";
    if (username) return `👾 ${username} ▾`;
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} ▾`;
  };

  return (
    <>
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
                  {isSubmitting ? "Submitting..." : "Submit To GenLayer"}
                </button>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "20px", opacity: 0.6 }}>
                🔒 <em>Please complete verification profiles to access active prompts.</em>
              </div>
            )}

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
                    key={player.walletAddress || index}
                    className={`player ${player.username === username ? "highlight" : ""}`}
                  >
                    <div>
                      #{index + 1} - {player.username || "Anonymous"}
                    </div>
                    <div>
                      {player.score} XP
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="footer">
              <p>Powered by GenLayer Intelligent Contracts</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}