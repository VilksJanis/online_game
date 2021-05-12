import uuid
import json
from datetime import datetime

SECONDS_IN_DAY = 60 * 60 * 24


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


class CreateNewGameFunctionBuilder(BaseFunctionBuilder):
    def __init__(self):
        super().__init__(command_name='create_new_game')


    def register_command(self):
        """
            Registers create_new_game redis gears fucntion to redis.
            For each generate_new_game call creates a new HASH under game namespace:
                GAME:[g_id] owner [uid], secret [hash], private [bool], playercount [int]
            Returns:
                redis key [GAME:g_id]
            Trigger example:
                RG.TRIGGER create_new_game USER:123 1 secret123
        """

        def subcall(user, private=0, secret=""):
            g_id = uuid.uuid4().hex
            key = f"GAME:{g_id}"

            execute("HSET", key, "owner", user, "secret", str(secret), "private", int(private), "playercount", 0)
            execute("EXPIRE", key, SECONDS_IN_DAY)

            return g_id
        (
            GB('CommandReader')
            .map(lambda x: subcall(*x[1:]))
            .register(trigger=self.command_name, mode='sync')
        )


class CreateUserFunctionBuilder(BaseFunctionBuilder):
    def __init__(self):
        super().__init__(command_name='create_new_user')
        

    def register_command(self):
        """
            Registers create_new_user redis gears fucntion to redis.
            For each create_new_user call creates a new HASH under user namespace:
                USER:[u_id] name [str], settings [str], secret [str]
            Returns:
                redis key [USER:u_id]
            Trigger example:
                RG.TRIGGER create_new_user hhaa Player1 '' aahh
        """

        def subcall(uid, name, settings='{}', secret=""):
            key = f"USER:{uid}"

            execute("HSET", key, "name", name, "setttings", settings, "secret", str(secret))
            execute("EXPIRE", key, SECONDS_IN_DAY * 30)

            return key
        (
            GB('CommandReader')
            .map(lambda x: subcall(*x[1:]))
            .register(trigger=self.command_name)
        )


database_functions = [
    CreateNewGameFunctionBuilder(),
    CreateUserFunctionBuilder()
]

for db_function in database_functions:
    if not db_function.is_registered():
        db_function.register_command()