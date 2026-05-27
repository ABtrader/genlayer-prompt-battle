# Prompt Battle Arena
# GenLayer Intelligent Contract concept
#
# Based on GenLayer's idea of trustless adjudication:
# AI-validator consensus resolves outcomes that need judgment,
# not just fixed code.

class PromptBattleArena:
    def __init__(self):
        self.room_id = "GL-ROOM-21"
        self.week = 1

        self.challenge = {
            "title": "Gamer Recruitment Challenge",
            "objective": "Choose the best explanation that would convince a Web2 gamer to join GenLayer.",
            "option_a": "GenLayer is only a normal blockchain for sending tokens.",
            "option_b": "GenLayer lets AI-powered Intelligent Contracts judge creative actions fairly through validator consensus.",
            "option_c": "GenLayer is only a wallet app for gamers.",
            "correct_answer": "B",
        }

        self.players = []
        self.submissions = {}
        self.leaderboard = []

    def join_room(self, player_name):
        if player_name not in self.players:
            self.players.append(player_name)

        return {
            "status": "joined",
            "room_id": self.room_id,
            "player": player_name,
        }

    def get_challenge(self):
        return self.challenge

    def submit_answer(self, player_name, selected_option):
        if player_name not in self.players:
            raise Exception("Player must join the room before submitting.")

        if selected_option not in ["A", "B", "C"]:
            raise Exception("Invalid option. Choose A, B, or C.")

        self.submissions[player_name] = selected_option

        return {
            "status": "submitted",
            "player": player_name,
            "answer": selected_option,
        }

    def judge_submissions(self):
        """
        In a real GenLayer Intelligent Contract, this is where subjective AI
        evaluation would happen.

        For this MVP, the contract checks objective answers.

        Future version:
        - Players submit natural-language explanations
        - GenLayer AI validators judge clarity, creativity, and usefulness
        - Optimistic Democracy confirms the final ranking
        - XP is distributed based on the agreed leaderboard
        """

        results = []

        for player, answer in self.submissions.items():
            if answer == self.challenge["correct_answer"]:
                score = 100
                reason = "Correct answer. Shows strong understanding of GenLayer Intelligent Contracts and AI-validator consensus."
            else:
                score = 50
                reason = "Incorrect answer. Needs better understanding of GenLayer's role in subjective AI-powered adjudication."

            results.append({
                "player": player,
                "answer": answer,
                "score": score,
                "reason": reason,
            })

        results.sort(key=lambda item: item["score"], reverse=True)
        self.leaderboard = results

        return self.leaderboard

    def get_leaderboard(self):
        return self.leaderboard