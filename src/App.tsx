import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

type Player = {
  id: string;
  name: string;
  score: number;
  submitted: boolean;
  completionTime: number;
};

type Challenge = {
  title: string;
  question: string;
  options: string[];
  correct: number;
};

const socket = io("https://genlayer-prompt-battle.onrender.com");
const CLIENT_ID = "1509214466540044298";
const GAME_DURATION = 300;
const MAX_SCORE = 250;

const GENLAYER_CONTRACT = import.meta.env.VITE_GENLAYER_CONTRACT_ADDRESS;

export default function App() {
  const [joined, setJoined] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [username, setUsername] = useState("");
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [participationMessage, setParticipationMessage] = useState("");

  const roomId = "GL-WEEKLY-ARENA";

  const challenges: Challenge[] = [
    {
      title: "Question 1: Intelligent Contracts",
      question:
        "What makes GenLayer Intelligent Contracts different from traditional smart contracts?",
      options: [
        "They only transfer tokens between wallets.",
        "They can reason with AI and evaluate subjective information.",
        "They are used only for storing images.",
      ],
      correct: 1,
    },
    {
      title: "Question 2: Optimistic Democracy",
      question: "What is the main role of Optimistic Democracy in GenLayer?",
      options: [
        "To help validators reach agreement on AI-generated outputs.",
        "To let one admin decide every result.",
        "To stop users from joining applications.",
      ],
      correct: 0,
    },
    {
      title: "Question 3: AI Validators",
      question: "Why are AI validators useful in GenLayer?",
      options: [
        "They replace all frontend developers.",
        "They only count button clicks.",
        "They help judge outcomes that require reasoning and interpretation.",
      ],
      correct: 2,
    },
    {
      title: "Question 4: Trustless Adjudication",
      question: "What does trustless adjudication mean?",
      options: [
        "A single host secretly chooses the winner.",
        "Results can be judged fairly without trusting one central person.",
        "Players are ranked randomly.",
      ],
      correct: 1,
    },
    {
      title: "Question 5: Subjective Judging",
      question: "Which task best shows GenLayer’s strength?",
      options: [
        "Displaying a fixed welcome message.",
        "Judging creative answers using AI consensus.",
        "Checking only simple numbers.",
      ],
      correct: 1,
    },
    {
      title: "Question 6: Natural Language",
      question: "Why is natural language useful for Intelligent Contracts?",
      options: [
        "It prevents users from writing answers.",
        "It only works with wallet balances.",
        "It allows contracts to evaluate human-readable input.",
      ],
      correct: 2,
    },
    {
      title: "Question 7: Community XP",
      question: "What is the fairest way to distribute XP in this game?",
      options: [
        "Give XP based on correct answers and completion time.",
        "Give XP randomly.",
        "Give all XP to the first player.",
      ],
      correct: 0,
    },
    {
      title: "Question 8: Multiplayer Use Case",
      question: "Why is GenLayer suitable for multiplayer community games?",
      options: [
        "It only supports single-player apps.",
        "It supports fair judging for challenges that are not purely mathematical.",
        "It removes all game rules.",
      ],
      correct: 1,
    },
    {
      title: "Question 9: Consensus",
      question: "What should happen when AI outputs need validation?",
      options: [
        "The game should ignore all answers.",
        "Only the fastest player should decide.",
        "Validators should help confirm the most reliable result.",
      ],
      correct: 2,
    },
    {
      title: "Question 10: Final GenLayer Round",
      question: "Which phrase best describes GenLayer’s role in this game?",
      options: [
        "An AI-powered coordination layer for fair judgment and consensus.",
        "A normal frontend styling tool.",
        "A file storage app.",
      ],
      correct: 0,
    },
    {
      title: "Question 11: GenLayer Leadership",
      question: "Who is the co-founder and CTO of GenLayer?",
      options: ["Vitalik Buterin", "Ivan Raskovsky", "Satoshi Nakamoto"],
      correct: 1,
    },
    {
      title: "Question 12: Core Technology",
      question: "What is at the heart of GenLayer’s core technology?",
      options: [
        "Proof of Work mining.",
        "Centralized API approval.",
        "Optimistic Democracy.",
      ],
      correct: 2,
    },
    {
      title: "Question 13: Consensus Design",
      question:
        "Optimistic Democracy is described as an enhanced version of which consensus mechanism?",
      options: ["Delegated Proof of Stake.", "Proof of History.", "Proof of Storage."],
      correct: 0,
    },
    {
      title: "Question 14: On-Chain AI Processing",
      question:
        "What does on-chain AI processing allow GenLayer validators to do?",
      options: [
        "Only send ETH between wallets.",
        "Connect to AI models for reasoning, natural language understanding, and predictions.",
        "Disable smart contracts completely.",
      ],
      correct: 1,
    },
    {
      title: "Question 15: AI Model Integration",
      question:
        "Which type of external systems can GenLayer validators connect to for complex reasoning?",
      options: [
        "Only normal calculator apps.",
        "Only image storage servers.",
        "Large Language Models and AI services.",
      ],
      correct: 2,
    },
    {
      title: "Question 16: Consensus-Backed Security",
      question: "Why do multiple validators vote on GenLayer outcomes?",
      options: [
        "To provide collective agreement and reliability.",
        "To hide every result from users.",
        "To make one validator control the network.",
      ],
      correct: 0,
    },
    {
      title: "Question 17: Intelligent Contract Ability",
      question: "What ability do Intelligent Contracts gain in GenLayer?",
      options: [
        "They can only store static text.",
        "They can understand natural language, process real-world data, and adapt to conditions.",
        "They can only create profile pictures.",
      ],
      correct: 1,
    },
    {
      title: "Question 18: Validator Software",
      question: "What does GenLayer validator software handle?",
      options: [
        "Only website design.",
        "Only social media login.",
        "Networking, block production, and transaction management.",
      ],
      correct: 2,
    },
    {
      title: "Question 19: Deterministic Transactions",
      question:
        "What are deterministic transactions in the GenLayer validator framework?",
      options: [
        "Random AI guesses with no verification.",
        "Typical blockchain transactions with predictable results.",
        "Transactions that cannot be checked.",
      ],
      correct: 1,
    },
    {
      title: "Question 20: Non-Deterministic Transactions",
      question: "What are non-deterministic transactions in GenLayer?",
      options: [
        "Transactions that use AI-driven logic like searching data, reasoning, or making inferences.",
        "Transactions that only transfer fixed token balances.",
        "Transactions that always fail automatically.",
      ],
      correct: 0,
    },
    {
      title: "Question 21: GenLayer Network Layers",
      question: "GenLayer operates with which two main layers?",
      options: [
        "Bitcoin Layer and Filecoin Layer.",
        "GenLayer RPC and GenLayer Chain.",
        "Frontend Layer and CSS Layer only.",
      ],
      correct: 1,
    },
    {
      title: "Question 22: GenLayer RPC",
      question: "What does the GenLayer RPC mainly handle?",
      options: [
        "Only image rendering.",
        "Only Discord username storage.",
        "Intelligent Contract operations using gen_* methods.",
      ],
      correct: 2,
    },
    {
      title: "Question 23: GenLayer Chain",
      question: "What is the GenLayer Chain responsible for?",
      options: [
        "Standard Ethereum operations through the underlying L2.",
        "Writing social media posts.",
        "Replacing all wallets.",
      ],
      correct: 0,
    },
    {
      title: "Question 24: App Architecture",
      question:
        "In a common GenLayer app, what does the frontend or backend usually do?",
      options: [
        "Own every consensus-critical decision alone.",
        "Collect user intent, display data, handle indexing, and prepare evidence.",
        "Replace validators completely.",
      ],
      correct: 1,
    },
    {
      title: "Question 25: Validator Verification",
      question:
        "What do GenLayer validators do in the common architecture pattern?",
      options: [
        "Randomly choose winners without checking evidence.",
        "Only change page colors.",
        "Independently verify the leader’s result using evidence and the equivalence principle.",
      ],
      correct: 2,
    },
  ];

  const currentChallenge = challenges[challengeIndex];

  const leaderboard = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.completionTime - b.completionTime;
  });

  const currentPlayer = players.find((player) => player.name === username);
  const hasAlreadyParticipated = currentPlayer?.submitted === true;

  useEffect(() => {
    socket.on("gameState", (data: { players?: Player[] }) => {
      setPlayers(data.players || []);
    });

    return () => {
      socket.off("gameState");
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace("#", "?"));
    const accessToken = params.get("access_token");

    if (accessToken) {
      fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then((res) => res.json())
        .then((user: { username?: string }) => {
          if (user.username) {
            setUsername(user.username);
            socket.emit("joinRoom", user.username);
            setJoined(true);
            window.history.replaceState({}, document.title, "/");
          }
        });
    }
  }, []);

  useEffect(() => {
    if (joined && gameStarted && timeLeft > 0 && !finished) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [joined, gameStarted, timeLeft, finished]);

  const loginWithDiscord = () => {
    const redirectUri = encodeURIComponent(
      "https://genlayer-prompt-battle.vercel.app"
    );

    window.location.href =
      `https://discord.com/oauth2/authorize` +
      `?client_id=${CLIENT_ID}` +
      `&response_type=token` +
      `&redirect_uri=${redirectUri}` +
      `&scope=identify`;
  };

  const startGame = () => {
    if (hasAlreadyParticipated) {
      setParticipationMessage(
        "You have already participated in this weekly game event. You can check the live leaderboard, but you cannot play again this week."
      );
      return;
    }

    setParticipationMessage("");
    setGameStarted(true);
  };

  const goHome = () => {
    setShowLeaderboard(false);

    if (finished || hasAlreadyParticipated) {
      setGameStarted(false);
    }
  };

  const handleSubmit = () => {
    if (selectedAnswer === null || submitted) return;

    if (selectedAnswer === currentChallenge.correct) {
      setScore((prev) => prev + 10);
    }

    setSubmitted(true);
  };

  const nextQuestion = () => {
    if (challengeIndex + 1 < challenges.length) {
      setChallengeIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setSubmitted(false);
      return;
    }

    const finalScore = score;
    const completionTime = GAME_DURATION - timeLeft;

    setFinished(true);

    console.log("Submitting to GenLayer contract:", GENLAYER_CONTRACT);

    socket.emit("submitFinalScore", {
      finalScore,
      completionTime,
    });
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const LeaderboardView = () => (
    <div className="card">
      <h2>🏆 Live Leaderboard</h2>

      <p className="footer">
        Ranking is based on score first. If scores are tied, faster completion time ranks higher.
      </p>

      <div className="leaderboard">
        {leaderboard.length === 0 ? (
          <p className="footer">No players on the leaderboard yet.</p>
        ) : (
          leaderboard.map((player, index) => (
            <div
              key={player.id}
              className={`player ${
                player.name === username ? "highlight" : ""
              }`}
            >
              <span>
                #{index + 1} {player.name}
              </span>

              <span>
                {player.score} / {MAX_SCORE}
                {player.submitted && ` • ${player.completionTime}s`}
              </span>
            </div>
          ))
        )}
      </div>

      <button onClick={goHome}>Back to Home</button>
    </div>
  );

  return (
    <div className="container">
      <h1>🎮 Prompt Battle Arena</h1>

      <p className="subtitle">Weekly GenLayer Community Challenge</p>

      {joined && (
        <div className="card" style={{ marginBottom: "18px" }}>
          <div className="topbar">
            <button onClick={goHome}>Home</button>

            <button onClick={() => setShowLeaderboard(true)}>
              Leaderboard
            </button>
          </div>
        </div>
      )}

      {showLeaderboard ? (
        <LeaderboardView />
      ) : !joined ? (
        <div className="card">
          <h2>Join With Discord</h2>

          <p className="footer">
            Connect your Discord account to enter the weekly GenLayer arena.
          </p>

          <button onClick={loginWithDiscord}>Continue with Discord</button>
        </div>
      ) : !gameStarted ? (
        <div className="card">
          <h2>Welcome, {username} 👋</h2>

          {hasAlreadyParticipated && (
            <div className="question">
              <p>
                You have already participated in this weekly game event.
              </p>

              <p>
                Your recorded score is {currentPlayer?.score} / {MAX_SCORE}
                {currentPlayer?.completionTime
                  ? ` and your completion time is ${currentPlayer.completionTime}s.`
                  : "."}
              </p>

              <p>
                You can check the live leaderboard, but you cannot replay this weekly event.
              </p>
            </div>
          )}

          {participationMessage && (
            <div className="question">
              <p>{participationMessage}</p>
            </div>
          )}

          <div className="question">
            <p>
              GenLayer is a Web3 protocol focused on Intelligent Contracts,
              AI-powered reasoning, and trustless adjudication.
            </p>

            <p>
              This game includes a deployed GenLayer Intelligent Contract for score tracking.
            </p>

            <h3>Game Rules</h3>

            <p>• You will answer 25 GenLayer-focused questions.</p>
            <p>• You have 5 minutes to complete the game.</p>
            <p>• Each correct answer gives 10 XP.</p>
            <p>• Incorrect answers give 0 score.</p>
            <p>• Maximum possible score is 250 XP.</p>
            <p>• Same score = faster completion time ranks higher.</p>
            <p>• Each Discord account can participate only once per weekly event.</p>
            <p>• Results are connected to a deployed GenLayer contract.</p>

            <p>Contract Address:</p>
            <p>{GENLAYER_CONTRACT}</p>
          </div>

          <button onClick={startGame}>PLAY</button>
        </div>
      ) : finished ? (
        <div className="card">
          <h2>🏆 Final Leaderboard</h2>

          <p className="footer">
            Your Final Score: {score} / {MAX_SCORE}
          </p>

          <div className="leaderboard">
            {leaderboard.map((player, index) => (
              <div
                key={player.id}
                className={`player ${
                  player.name === username ? "highlight" : ""
                }`}
              >
                <span>
                  #{index + 1} {player.name}
                </span>

                <span>
                  {player.score} / {MAX_SCORE}
                  {player.submitted && ` • ${player.completionTime}s`}
                </span>
              </div>
            ))}
          </div>

          <button onClick={goHome}>Back to Home</button>
        </div>
      ) : (
        <div className="card">
          <div className="topbar">
            <span>Room: {roomId}</span>

            <span>
              ⏱ {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
            </span>
          </div>

          <p className="footer">Logged in as: {username}</p>

          <p className="footer">
            Question {challengeIndex + 1} / {challenges.length}
          </p>

          <p className="footer">
            Current Score: {score} / {MAX_SCORE}
          </p>

          <h2>{currentChallenge.title}</h2>

          <div className="question">
            <p>{currentChallenge.question}</p>

            {currentChallenge.options.map((option, index) => (
              <label key={index}>
                <input
                  type="radio"
                  name="answer"
                  checked={selectedAnswer === index}
                  onChange={() => setSelectedAnswer(index)}
                  disabled={submitted}
                />

                {String.fromCharCode(65 + index)}. {option}
              </label>
            ))}
          </div>

          {!submitted ? (
            <button onClick={handleSubmit}>Submit Answer</button>
          ) : (
            <>
              <p className="footer">
                {selectedAnswer === currentChallenge.correct
                  ? "✅ Correct Answer"
                  : "❌ Incorrect Answer"}
              </p>

              <button onClick={nextQuestion}>
                {challengeIndex + 1 === challenges.length
                  ? "Finish Game"
                  : "Next Question"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}