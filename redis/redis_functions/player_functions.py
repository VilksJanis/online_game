import json

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
            registration_data = dict(zip(data['RegistrationData'][0::2], data['RegistrationData'][1::2]))
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
        GB('StreamReader', self.command_name).foreach(lambda message: self.parse_action(message["key"], message["value"])).register(self.command_name)

    def parse_action(self, stream_name, payload):
        """
        Handle incoming player action. 
        Arguments:
            stream_name [GAME:gid]
            payload [str]  
        """
        gid = stream_name.split(":")[1]

        # Publish the action to other game instance users via PubSub:
        execute('PUBLISH', gid, f"{payload['action']};{payload['action_args']}")

        # Parse the command to update game state:
        self.action_mapping.get(payload["action"], self.not_implemented)(gid, *payload["action_args"].split(","))


    def move(self, _, uid, x, y):
        """
        Handle player move event.
        """
        self.not_implemented(_)

    def click(self, _, uid, x, y, angle):
        """
        Handle player main key pressed event.
        """
        self.not_implemented(_)

    def orientation(self, _, angle):
        """
        Handle player orientation change event.
        """
        return

    def use(self, _, uid, x, y, angle):
        """
        Handle player use key pressed event.
        """
        self.not_implemented(_)

    def message(self, _, uid, scope, message):
        """
        Handle player message event.
        """
        self.not_implemented(_)

    def join(self, gid, uid):
        """
        Handle player leave event.
            Execute Redis gears function `leave_game`            
        """

        return


    def leave(self, gid, uid):
        """
        Handle player leave event.
            Execute Redis gears function `leave_game`            
        """

        execute("RG.TRIGGER", "leave_game", uid, gid)

    def not_implemented(self, _):
        return

player_functions = [
    ParsePlayerFunctionBuilder()
]

for player_function in player_functions:
    if not player_function.is_registered():
        player_function.register_command()