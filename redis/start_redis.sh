#!/bin/bash

# Preload redis server with necessary modules, and wait for it to initialize
redis-server --daemonize yes --loadmodule /var/opt/redislabs/lib/modules/redisgears.so PythonHomeDir /opt/redislabs/lib/modules/python3 && sleep 1

# Save state
cat /functions/game/player_functions.py | redis-cli -x RG.PYEXECUTE

redis-cli save
redis-cli shutdown

redis-server --loadmodule /var/opt/redislabs/lib/modules/redisgears.so PythonHomeDir /opt/redislabs/lib/modules/python3