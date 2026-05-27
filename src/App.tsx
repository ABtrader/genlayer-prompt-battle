import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("http://localhost:3001");
const CLIENT_ID = "1509214466540044298";
const GAME_DURATION = 300;

export default function App() {
  const [joined, setJoined] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [username, setUsername] = useState("");
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [players, setPlayers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);

  const roomId = "GL-WEEKLY-ARENA";

  const challenges = [
    {
      title: "Question 1: Intelligent Contracts",
      question: "What makes GenLayer Intelligent Contracts different from traditional smart contracts?",
      options: [
        "They can reason with AI and evaluate subjective information.",
        "They only transfer tokens between wallets.",
        "They are used only for storing images.",
      ],
      correct: 0,
    },
    {
      title: "Question 2: Optimistic Democracy",
      question: "What is the main role of Optimistic Democracy in GenLayer?",
      options: [
        "To let one admin decide every result.",
        "To help validators reach agreement on AI-generated outputs.",
        "To stop users from joining applications.",
      ],
      correct: 1,
    },
    {
      title: "Question 3: AI Validators",
      question: "Why are AI validators useful in GenLayer?",
      options: [
        "They help judge outcomes that require reasoning and interpretation.",
        "They replace all frontend developers.",
        "They only count button clicks.",
      ],
      correct: 0,
    },
    {
      title: "Question 4: Trustless Adjudication",
      question: "What does trustless adjudication mean?",
      options: [
        "A single host secretly chooses the winner.",
        "Players are ranked randomly.",
        "Results can be judged fairly without trusting one central person.",
      ],
      correct: 2,
    },
    {
      title: "Question 5: Subjective Judging",
      question: "Which task best shows GenLayer’s strength?",
      options: [
        "Judging creative answers using AI consensus.",
        "Displaying a fixed welcome message.",
        "Checking only simple numbers.",
      ],
      correct: 0,
    },
    {
      title: "Question 6: Natural Language",
      question: "Why is natural language useful for Intelligent Contracts?",
      options: [
        "It allows contracts to evaluate human-readable input.",
        "It prevents users from writing answers.",
        "It only works with wallet balances.",
      ],
      correct: 0,
    },
    {
      title: "Question 7: Community XP",
      question: "What is the fairest way to distribute XP in this game?",
      options: [
        "Give XP randomly.",
        "Give all XP to the first player.",
        "Give XP based on correct answers and completion time.",
      ],
      correct: 2,
    },
    {
      title: "Question 8: Multiplayer Use Case",
      question: "Why is GenLayer suitable for multiplayer community games?",
      options: [
        "It supports fair judging for challenges that are not purely mathematical.",
        "It only supports single-player apps.",
        "It removes all game rules.",
      ],
      correct: 0,
    },
    {
      title: "Question 9: Consensus",
      question: "What should happen when AI outputs need validation?",
      options: [
        "The game should ignore all answers.",
        "Validators should help confirm the most reliable result.",
        "Only the fastest player should decide.",
      ],
      correct: 1,
    },
    {
      title: "Question 10: Final GenLayer Round",
      question: "Which phrase best describes GenLayer’s role in this game?",
      options: [
        "A normal frontend styling tool.",
        "A file storage app.",
        "An AI-powered coordination layer for fair judgment and consensus.",
      ],
      correct: 2,
    },
  ];

  const currentChallenge = challenges[challengeIndex];

  useEffect(() => {
    socket.on("gameState", (data) => {
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
        .then((user) => {
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
    const redirectUri = encodeURIComponent("http://localhost:5173");

    window.location.href =
      `https://discord.com/oauth2/authorize` +
      `?client_id=${CLIENT_ID}` +
      `&response_type=token` +
      `&redirect_uri=${redirectUri}` +
      `&scope=identify`;
  };

  const handleSubmit = () => {
    if (selectedAnswer === null) return;

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

    const finalScore =
      selectedAnswer === currentChallenge.correct ? score + 10 : score;

    const completionTime = GAME_DURATION - timeLeft;

    setScore(finalScore);
    setFinished(true);

    socket.emit("submitFinalScore", {
      finalScore,
      completionTime,
    });
  };

  const leaderboard = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.completionTime - b.completionTime;
  });

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="container">
      <h1>🎮 Prompt Battle Arena</h1>

      <p className="subtitle">Weekly GenLayer Community Challenge</p>

      {!joined ? (
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

          <div className="question">
            <p>
              GenLayer is a Web3 protocol focused on Intelligent Contracts,
              AI-powered reasoning, and trustless adjudication. It helps
              decentralized applications handle decisions that need judgment,
              such as natural language evaluation, subjective scoring, and
              AI-validator consensus.
            </p>

            <p>
              In this weekly arena, you will test your understanding of
              GenLayer, Optimistic Democracy, AI validators, and how subjective
              decisions can work in Web3 games.
            </p>

            <h3>Game Rules</h3>

            <p>• You will answer 10 GenLayer-focused questions.</p>
            <p>• You have 5 minutes to complete the game.</p>
            <p>• Each correct answer gives 10 XP.</p>
            <p>• Incorrect answers give 0 score.</p>
            <p>
              • Ranking is based on total correct answers first. If players
              have the same score, the faster completion time ranks higher.
            </p>
            <p>
              • Your final score will appear on the live leaderboard after
              finishing the game.
            </p>
          </div>

          <button onClick={() => setGameStarted(true)}>PLAY</button>
        </div>
      ) : finished ? (
        <div className="card">
          <h2>🏆 Final Leaderboard</h2>

          <p className="footer">Your Final Score: {score}</p>
          <p className="footer">
            Tie-break rule: same score = faster completion time ranks higher.
          </p>

          <div className="leaderboard">
            {leaderboard.map((player, index) => (
              <div
                key={player.id}
                className={`player ${player.name === username ? "highlight" : ""}`}
              >
                <span>
                  #{index + 1} {player.name}
                </span>

                <span>
                  {player.score}
                  {player.submitted && ` • ${player.completionTime}s`}
                </span>
              </div>
            ))}
          </div>
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
          <p className="footer">Question {challengeIndex + 1} / 10</p>
          <p className="footer">Current Score: {score}</p>

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