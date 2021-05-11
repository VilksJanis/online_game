from datetime import datetime
import time
MAX_PLAYERS_IN_GAME = 4


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


class FindGameFunctionBuilder(BaseFunctionBuilder):
    def __init__(self):
        super().__init__(command_name='find_game')
        

    def register_command(self):
        """
            Determines finds public server to join to.

            Arguments:
                user
            Returns:
                redis key [GAME:g_id]
            Trigger example:
                RG.TRIGGER find_game USER:123

        """
        def query():
           return execute(
                "FT.SEARCH",                                            # redis search query
                "GAME",                                                 # namespace
                f"'(@playercount:[0 {MAX_PLAYERS_IN_GAME - 1}])'",      # find GAMES that are not full (player count from 0 to max_count-1)
                "SORTBY", "playercount", "DESC",                        # order fullest games first
                "LIMIT", "0", "1")                                      # offset 0 take 1
            # "[1, 'GAME:f627c6d1cbd74be2a9569c3f7259dfa1', ['playercount', '0', 'owner', 'USER:123', 'secret', 'secret123', 'private', '1']]"


        def find_game(u_id):
            game = query()
            if game != [0] and type(game) == list:
                return game[1].split(":")[1]

            # CREATE A NEW GAME IF THERE ARE NO GAMES
            execute("RG.TRIGGER", "create_new_game", f"USER:{u_id}")

            # Since execute("RG.TRIGGER") behaves similarly to async, we need let the execute 
            # TODO: ask redis gurus how to best deal with this
            time.sleep(0.0001)

            new_game = query()
            if new_game != [0] and type(new_game) == list:
                return new_game[1].split(":")[1]

            return new_game

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
                 - Assings User to the Room.
                 - Increments playercount
                 - Publishes a notification
            Arguments:
                user, game (optional), secret (optional)
            Returns:
                redis key [GAME:g_id]
            Trigger example:
                RG.TRIGGER join_game USER:123 GAME:123
                RG.TRIGGER join_game USER:123 GAME:123 secret123

        """

        def assign_to_game(u_id, g_id):          
            execute("HINCRBY", g_id, "playercount", 1)                       # increase the playercount
            execute("HSET", g_id, u_id, int(datetime.now().timestamp()))     # add user reference to the game


        def is_authorized(user, game, secret):
            # TODO: IMPLEMENT AUTHORIZATION
            return True

        def subcall(u_id, g_id=None, secret=None):
            if not is_authorized(u_id, g_id, secret):
                return False

            assign_to_game(u_id, g_id)

            return g_id

        (
            GB('CommandReader')
            .map(lambda x: subcall(*x[1:]))
            .register(trigger=self.command_name)
        )


game_functions = [
    JoinGameFunctionBuilder(),
    FindGameFunctionBuilder()
]

for game_function in game_functions:
    if not game_function.is_registered():
        game_function.register_command()