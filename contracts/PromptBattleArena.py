# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *


class PromptBattleArenaV7(gl.Contract):
    player_results: TreeMap[Address, str]

    def __init__(self):
        self.player_results = TreeMap()

    @gl.public.write
    def submit_answer(self, player_name: str, answer: str) -> None:

        def evaluate_answer() -> str:
            prompt = f"""
You are judging a GenLayer community challenge.

Challenge:
How can subjective AI decisions improve blockchain applications?

Player:
{player_name}

Answer:
{answer}

Evaluate the response quality and assign ONE of these letter grades:
- "A" for excellent, deep, accurate, and creative answers.
- "B" for good, accurate answers that lack extreme depth.
- "C" for poor, empty, incomplete, or completely off-topic answers (e.g., placeholder text like "just for game").

Return ONLY the single letter: A, B, or C.
Do not include any other words, symbols, or formatting. Just the plain capital letter.
"""
            res = gl.nondet.exec_prompt(prompt)
            clean_letter = "".join(c for c in res if c.isalpha()).strip().upper()
            return clean_letter if clean_letter in ["A", "B", "C"] else "C"

        # The AI nodes will easily agree on a single letter (A, B, or C)
        final_grade = gl.eq_principle.strict_eq(evaluate_answer)

        # Map the consensus grade back to high-value XP scores
        if final_grade == "A":
            score_val = 95
        elif final_grade == "B":
            score_val = 75
        else:
            score_val = 0  # Off-topic or joke submissions get 0 XP

        feedback_text = f"The AI consensus successfully verified your answer and awarded you {score_val} XP!"

        self.player_results[gl.message.sender_address] = json.dumps(
            {
                "player": player_name,
                "answer": answer,
                "score": score_val,
                "feedback": feedback_text,
            }
        )

    @gl.public.view
    def get_result(self, account_address: str) -> str:
        return self.player_results.get(Address(account_address), "{}")

    @gl.public.view
    def get_my_result(self) -> str:
        return self.player_results.get(gl.message.sender_address, "{}")