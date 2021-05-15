const WebSocket = require('ws');
const uuid = require('uuid');
const redis = require("redis");
var fs = require('fs');

var config = JSON.parse(fs.readFileSync('/game_config/game_conf.json', 'utf8'));
const WEBSOCKET_PORT = parseInt(config.websocket.port);
const letterNumber = /^[0-9a-zA-Z]+$/;

const redis_client = redis.createClient(6379, 'redis');
const websocket_server = new WebSocket.Server({ port: WEBSOCKET_PORT });

not_implemented = () => { };

const MESSAGE_EVENT_HANDLERS = {
    // handle pose events
    p: async (socket, x, y, o) => {
        redis_client.xadd("player_actions:" + socket.gid, '*', "action", "p", "action_args", [socket.uid, x, y, o].join());
    },
    // handle click events
    c: async (socket, x, y, angle) => {
        redis_client.xadd("player_actions:" + socket.gid, '*', "action", "c", "action_args", [socket.uid, x, y, angle].join());
    },
    // handle leave events
    l: async (socket) => {
        redis_client.xadd("player_actions:" + socket.gid, '*', "action", "l", "action_args", [socket.uid].join());
    },
    // handle hit events
    hit: async (socket, enemy_uid) => {
        redis_client.xadd("player_actions:" + socket.gid, '*', "action", "hit", "action_args", [socket.uid, enemy_uid].join());
    },
    // handle respawn events
    r: async (socket) => {
        let random = Math.floor(Math.random() * config.world.spawns.length);
        let [x, y] = config.world.spawns[random];
        redis_client.xadd("player_actions:" + socket.gid, '*', "action", "r", "action_args", [socket.uid, x, y].join());
    },
    // handle join events
    j: async (socket) => {
        let random = Math.floor(Math.random() * config.world.spawns.length);
        let [x, y] = config.world.spawns[random];
        redis_client.xadd("player_actions:" + socket.gid, '*', "action", "j", "action_args", [socket.uid, x, y].join());
    },
    // handle uid request/response events
    uid: async (socket, uid, secret = "") => {
        redis_client.hgetall("GAME:" + socket.gid, (err, game) => {
            if (game != null && game['USER:' + uid] != undefined) {
                subscribe_player_actions(socket);
                socket.uid = uid;
                socket.send("uid;" + true);
            } else {
                redis_client.send_command("RG.TRIGGER", ["join_game", uid, socket.gid, secret], (err, data) => {
                    if (data != undefined && data != null) {
                        subscribe_player_actions(socket);
                        socket.uid = uid;
                        socket.send("uid;" + true);
                    } else {
                        socket.send("uid;" + false);
                        socket.close();
                    }
                })

            }
        })
    }
};




websocket_server.on('connection', (socket, req) => {
    load_game_id(req.url, socket);

    // Process incomming player websocket messages:
    socket.on('message', message => {
        let [action, payload] = message.split(";");
        try {
            func = (MESSAGE_EVENT_HANDLERS[action] || not_implemented)(socket, ...payload.split(','));
        }
        catch (err) {
            socket.close();
        }
    });
});



function load_game_id(url, socket) {
    // used to load game_id fro the url component
    gid = url.split("/").slice(-1)[0];
    if (!letterNumber.test(gid) || gid.length != 32) {
        socket.close();
    }
    socket.gid = gid;
}

function subscribe_player_actions(socket) {
    // Receive incomming messages from Redis:
    socket.subscription_client = redis.createClient(6379, 'redis');
    socket.subscription_client.subscribe(socket.gid);
    socket.subscription_client.on('message', (channel, message) => {
        socket.send(message);
    });

    // Handle on close event
    socket.on('close', () => {
        MESSAGE_EVENT_HANDLERS.l(socket);
        socket.subscription_client.quit();
    });
}