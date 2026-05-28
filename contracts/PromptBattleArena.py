# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class PromptBattleArena(gl.Contract):
    last_player: str
    last_score: str
    last_completion_time: str

    def __init__(self):
        self.last_player = ""
        self.last_score = "0"
        self.last_completion_time = "0"

    @gl.public.write
    def submit_score(self, player_name: str, score: str, completion_time: str):
        self.last_player = player_name
        self.last_score = score
        self.last_completion_time = completion_time

    @gl.public.view
    def get_last_result(self) -> str:
        return (
            self.last_player
            + "|"
            + self.last_score
            + "|"
            + self.last_completion_time
        )