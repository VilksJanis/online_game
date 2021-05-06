import json

class ParsePlayerCommandBuilder():
    def __init__(self):
        self.stream = 'player_actions*'
        self.action_mapping = {
            "p": self.move,
            "c": self.click
        }

    def register_command(self):
        GB('StreamReader', self.stream).foreach(lambda message: self.parse_action(message["key"], message["value"])).register(self.stream)

    def parse_action(self, stream_name, payload):
        # Publish the action to other game instance users via PubSub:
        execute('PUBLISH', stream_name.split("__")[1], f"{payload['action']};{payload['action_args']}")

        # Parse the command to receive an updated game state:
        new_state = self.action_mapping[payload["action"]](*payload["action_args"].split(","))

        # Update the internal game state:
        self.update_state(new_state)
    

    def is_registered(self):
        dumped_registrations = execute("RG.DUMPREGISTRATIONS")
    
        if not dumped_registrations:
            return False

        for registration in dumped_registrations:
            data = dict(zip(registration[0::2], registration[1::2]))
            registration_data = dict(zip(data['RegistrationData'][0::2], data['RegistrationData'][1::2]))
            return self.stream in registration_data['args']
    
    def move(self, uuid, x, y):
        pass

    def click(self, uuid, x, y):
        pass


    def update_state(self, new_state):
        pass




player_functions = [
    ParsePlayerCommandBuilder()
]

for player_function in player_functions:
    if not player_function.is_registered():
        player_function.register_command()