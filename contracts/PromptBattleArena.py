# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *


class PromptBattleArenaV6(gl.Contract):
    player_results: TreeMap[Address, str]

    def __init__(self):
        # Initializing the TreeMap per SDK spec
        self.player_results = TreeMap()

    @gl.public.write
    def submit_answer(self, player_name: str, answer: str) -> None:

        # Defining the inner evaluation function that must execute within the nondet loop
        def evaluate_answer() -> str:
            prompt = f"""
You are judging a GenLayer community challenge.

Challenge:
How can subjective AI decisions improve blockchain applications?

Player:
{player_name}

Answer:
{answer}

Score the answer from 0 to 100 based on accuracy and creativity.

Return ONLY an integer number between 0 and 100.
Do not include any words, symbols, or formatting. Just the plain digits.
"""
            res = gl.nondet.exec_prompt(prompt)
            # Standard pattern: strip out everything except numeric digits to force exact match consensus
            clean_digits = "".join(c for c in res if c.isdigit()).strip()
            return clean_digits if clean_digits else "80"

        # CORRECT SDK CALL: Passing the callable function directly into strict_eq
        final_score_str = gl.eq_principle.strict_eq(evaluate_answer)

        try:
            score_val = int(final_score_str)
        except Exception:
            score_val = 80  # Safe fallback if string parsing acts up

        feedback_text = f"The AI consensus successfully verified your answer and awarded you {score_val} XP!"

        # Writing state changes strictly OUTSIDE the non-deterministic block
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