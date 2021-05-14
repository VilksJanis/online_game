import json
from collections import defaultdict
from datetime import datetime


game_state = defaultdict(lambda: dict(
    time_created=datetime.now().timestamp(),
    players=defaultdict(lambda: dict(
        x=None,
        y=None,
        orientation=None
    )),
    obstacles=[],
    projectiles=[],
))


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

        self.action_mapping = {
            "p": self.move,
            "c": self.click,
            "o": self.orientation,
            "u": self.use,
            "l": self.leave,
            "m": self.message,
            "j": self.join
        }

    def register_command(self):
        GB('StreamReader', self.command_name).foreach(lambda message: self.parse_action(
            message["key"], message["value"])).register(self.command_name)

    def parse_action(self, stream_name, payload):
        """
        Handle incoming player action. 
        Arguments:
            stream_name [GAME:gid]
            payload [str]  
        """
        gid = stream_name.split(":")[1]
        ts = datetime.now().timestamp() * 1000
        # Publish the action to other game instance users via PubSub:
        execute('PUBLISH', gid,
                f"{payload['action']};{payload['action_args']}")

        # Parse the command to update game state:
        self.clean_state(gid,ts)

        self.action_mapping.get(payload["action"], self.not_implemented)(
            gid, *payload["action_args"].split(","))

        state_dump = json.dumps(game_state)
        execute('PUBLISH', "backend_debug", state_dump)
        execute("XADD", f"game_state:{gid}", "*", "state", state_dump)


    def move(self, gid, uid, x, y):
        """
        Handle player move event.
        """
        game_state[gid]["players"][uid]["x"] = x
        game_state[gid]["players"][uid]["y"] = y


    def click(self, gid, uid, x, y, angle):
        """
        Handle player main key pressed event.
        """
        player = game_state[gid]["players"][uid]

        game_state[gid]["projectiles"].append({
            "timestamp": datetime.now().timestamp() * 1000,
            "x": player["x"],
            "y": player["y"],
            "orientation": angle,
            "ttl": 2000,
            "speed": 1000, # px/s
        })

    def orientation(self, gid, uid, angle):
        """
        Handle player orientation change event.
        """
        game_state[gid]["players"][uid]["orientation"] = angle


    def use(self, gid, uid, x, y, angle):
        """
        Handle player use key pressed event.
        """
        self.not_implemented(gid)

    def message(self, gid, uid, scope, message):
        """
        Handle player message event.
        """
        self.not_implemented(gid)

    def join(self, gid, uid, x, y):
        """
        Handle player leave event.
            Execute Redis gears function `leave_game`            
        """
        game_state[gid]["players"][uid]
        return

    def leave(self, gid, uid):
        """
        Handle player leave event.
            Execute Redis gears function `leave_game`            
        """
        del game_state[gid]["players"][uid]
        execute("RG.TRIGGER", "leave_game", uid, gid)
        return

    def clean_state(self, gid, ts):
        projectiles = game_state[gid]["projectiles"]
        game_state[gid]["projectiles"] = [projectile for projectile in projectiles if (projectile["timestamp"] + projectile["ttl"])  >= ts]
    

    def not_implemented(self, _):
        return



player_functions = [
    ParsePlayerFunctionBuilder()
]

for player_function in player_functions:
    if not player_function.is_registered():
        player_function.register_command()
