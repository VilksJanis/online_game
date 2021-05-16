import json
import math
from collections import defaultdict
from datetime import datetime

class BaseFunctionBuilder():
    def __init__(self, command_name):

        self.command_name = command_name

    def is_registered(self):
        """
            Determines if function is already registered in redis database.
            Makes a `RG.DUMPREGISTRATIONS` call. Seeks for match between self.command_name and RegistrationData arguments.

            Returns:
                is registered (boolean)
        """
        dumped_registrations = execute("RG.DUMPREGISTRATIONS")

        if not dumped_registrations:
            return False

        for registration in dumped_registrations:
            data = dict(zip(registration[0::2], registration[1::2]))
            registration_data = dict(
                zip(data['RegistrationData'][0::2], data['RegistrationData'][1::2]))
            if self.command_name in registration_data['args']:
                return True

        return False

    def register_command(self):
        """
            Registers a redis gears function to redis.
            This is a super class placeholder function meant to be overridden.

            Raises:
                NotImplementedError()
        """
        raise NotImplementedError(self.__class__.__name__)


class ParsePlayerFunctionBuilder(BaseFunctionBuilder):
    def __init__(self):
        super().__init__(command_name='player_actions*')

        self.games_states = defaultdict(lambda: dict(
            time_created=datetime.now().timestamp() * 1000,
            players=defaultdict(lambda: dict(
                x=0,
                y=0,
                orientation=0,
                score=0,
                respawns=0,
            )),
            obstacles=[],
            projectiles=[],
        ))

        self.action_mapping = {
            "p":    self.pose,
            "c":    self.click,
            "r":    self.respawn,
            "hit":  self.hit,
            "l":    self.leave,
            "j":    self.join
        }

    def register_command(self):
        GB('StreamReader', self.command_name).foreach(lambda message: self.parse_action(
            message["key"], message["value"])).register(self.command_name)

    def parse_action(self, stream_name, payload):
        """
        Handle incoming player action. 
        Arguments:
            stream_name [GAME:game_id]
            action_args [str] (csv)  
        """
        state_dump = json.dumps(self.games_states)
        game_id = stream_name.split(":")[1]

        self.ts = datetime.now().timestamp() * 1000
        self.clean_state(game_id)

        should_publish = self.action_mapping.get(payload["action"], self.not_implemented)(game_id, *payload["action_args"].split(","))

        if should_publish:
            execute('PUBLISH', game_id, f"{payload['action']};{payload['action_args']}")

        execute("XADD", f"games_states:{game_id}", "MAXLEN", "~", "100000", "*", "state", state_dump)

    def pose(self, game_id, user_id, x, y, o):
        """
        Handle player pose event.
        Pose consists of position and angle (o - orientation) of the player

        return True if it is necessary to update (always)
        """
        player = self.games_states[game_id]["players"][user_id]
        player["x"] = int(x) if y is not None else 0
        player["y"] = int(y) if y is not None else 0
        player["orientation"] = float(o)

        return True

    def click(self, game_id, user_id, x, y, o):
        """
        Handle player main key pressed event.
        """
        player = self.games_states[game_id]["players"][user_id]

        self.games_states[game_id]["projectiles"].append({
            "timestamp": self.ts,   # server time
            "x": player["x"] if player['x'] is not None else 9999,
            "y": player["y"] if player['y'] is not None else 9999,
            "orientation": o,       # radians
            "ttl": 2000,            # ms
            "speed": 1,             # px/ms
            "user_id": user_id
        })

        return True


    def hit(self, game_id, user_id, enemy_user_id):
        """
        Determines if the projectile has hit a user [user_id]
        Extrapolates projectile position based on when projectile has spawned, and the time now.
        Publishes a hit even if target is hit.
        """
        projectiles = self.games_states[game_id]["projectiles"]
        player = self.games_states[game_id]["players"][enemy_user_id]

        for projectile in projectiles:
            time_diff = self.ts - projectile['timestamp']
            orientation = float(projectile["orientation"])
            x = projectile['x'] + ( math.cos(orientation) * (projectile['speed'] * time_diff) )
            y = projectile['y'] + ( math.sin(orientation) * (projectile['speed'] * time_diff) )


            if abs(player['x'] - x < 50) and abs(player['y'] - y < 50):
                self.games_states[game_id]['players'][projectile['user_id']]['score'] += 1
                execute('PUBLISH', game_id, f"hit;{enemy_user_id}")
                return False
        return False

    def respawn(self, game_id, user_id, x, y):
        player = self.games_states[game_id]["players"][user_id]

        player["respawns"] = player["respawns"] + 1
        player["x"] = x
        player["y"] = y

        return True

    def join(self, game_id, user_id, x, y):
        """
        Handle player join event.

        Add user to the game instance
        """
        self.games_states[game_id]["players"][user_id]
        return True

    def leave(self, game_id, user_id):
        """
        Handle player leave event.
            Execute Redis gears function `leave_game`            
        """
        del self.games_states[game_id]["players"][user_id]
        execute("RG.TRIGGER", "leave_game", user_id, game_id)
        return True

    def clean_state(self, game_id):
        projectiles = self.games_states[game_id]["projectiles"]
        self.games_states[game_id]["projectiles"] = [projectile for projectile in projectiles if (
            projectile["timestamp"] + projectile["ttl"]) >= self.ts]

    def not_implemented(self, *args, **kwargs):
        return False


player_functions = [
    ParsePlayerFunctionBuilder()
]

for player_function in player_functions:
    if not player_function.is_registered():
        player_function.register_command()
