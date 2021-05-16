from datetime import datetime
import time
MAX_PLAYERS_IN_GAME = 1000


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


class FindGameFunctionBuilder(BaseFunctionBuilder):
    def __init__(self):
        super().__init__(command_name='find_game')

    def register_command(self):
        """
            Determines finds public server to join to.

            Arguments:
                user
            Returns:
                redis key [GAME:game_id]
            Trigger example:
                RG.TRIGGER find_game user1

        """
        def query():
            return execute(
                "FT.SEARCH", "GAME",
                # find GAMES that are not full (player count from 0 to max_count-1)
                f"'(@playercount:[0 {MAX_PLAYERS_IN_GAME - 1}])'",
                "SORTBY", "playercount", "DESC",                    # order fullest games first
                "LIMIT", "0", "1")                                  # offset 0 take 1

            # "[1, 'GAME:f627c6d1cbd74be2a9569c3f7259dfa1', ['playercount', '0', 'owner', 'USER:123', 'secret', 'secret123', 'private', '1']]"

        def find_game(user_id):
            game = query()
            if game != [0] and type(game) == list:
                return game[1].split(":")[1]

            # CREATE A NEW GAME IF THERE ARE NO GAMES
            game = execute("RG.TRIGGER", "create_new_game", f"USER:{user_id}")

            if game:
                return game[0]

        (
            GB('CommandReader')
            .map(lambda x: find_game(*x[1:]))
            .register(trigger=self.command_name)
        )


class JoinGameFunctionBuilder(BaseFunctionBuilder):
    def __init__(self):
        super().__init__(command_name='join_game')

    def register_command(self):
        """
            Determines best public server to join to.
                 - Assings User to the Game.
                 - Increments playercount
            Arguments:
                user, game, secret (optional)
            Returns:
                redis key [GAME:game_id]
            Trigger example:
                RG.TRIGGER join_game user1 game1
                RG.TRIGGER join_game user1 game1 secret123

        """

        def assign_to_game(user_id, game_id):
            # add user reference to the game
            execute("HSET", f"GAME:{game_id}", f"USER:{user_id}", int(datetime.now().timestamp()))
            execute("HINCRBY", f"GAME:{game_id}", "playercount", 1)

        def is_authorized(user_id, game_id, secret):
            return execute("RG.TRIGGER", "user_authorized", user_id, game_id, secret) 

        def subcall(user_id, game_id, secret=""):
            if not is_authorized(user_id, game_id, secret):
                return False

            assign_to_game(user_id, game_id)
            return game_id

        (
            GB('CommandReader')
            .map(lambda x: subcall(*x[1:]))
            .register(trigger=self.command_name)
        )


class LeaveGameFunctionBuilder(BaseFunctionBuilder):
    def __init__(self):
        super().__init__(command_name='leave_game')

    def register_command(self):
        """
            Determines best public server to join to.
                 - Removes USER to the ROOM.
                 - Decrements playercount
                 - Publishes a notification
            Arguments:
                user, game
            Returns:
                None
            Trigger example:
                RG.TRIGGER leave_game user1 game1
        """

        def subcall(user_id, game_id, secret=None):
            execute("HDEL", f"GAME:{game_id}", f"USER:{user_id}")
            execute("HINCRBY", f"GAME:{game_id}", "playercount", -1)

        (
            GB('CommandReader')
            .map(lambda x: subcall(*x[1:]))
            .register(trigger=self.command_name, mode='sync')
        )

class UserAuthorizedFunctionBuilder(BaseFunctionBuilder):
    def __init__(self):
        super().__init__(command_name='user_authorized')

    def register_command(self):
        """
            Determines if user can join the room
            Arguments:
                user, game
            Returns:
                Boolean
            Trigger example:
                RG.TRIGGER user_authorized user1 game1
        """

        def subcall(user_id, game_id, secret):
            return execute("HGET", f"GAME:{game_id}", "secret") == secret or execute("HGET", f"GAME:{game_id}", f"USER:{user_id}") != 'None' or execute("HGET", f"GAME:{game_id}", "owner") == f'USER:{user_id}'

        (
            GB('CommandReader')
            .map(lambda x: subcall(*x[1:]))
            .register(trigger=self.command_name, mode='sync')
        )


game_functions=[
    JoinGameFunctionBuilder(),
    LeaveGameFunctionBuilder(),
    FindGameFunctionBuilder(),
    UserAuthorizedFunctionBuilder()
]

for game_function in game_functions:
    if not game_function.is_registered():
        game_function.register_command()
