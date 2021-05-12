const WebSocket = require('ws');
const uuid = require('uuid');
const redis = require("redis");
const redis_client = redis.createClient(6379, 'redis');

const letterNumber = /^[0-9a-zA-Z]+$/;
not_implemented = () => { };

const WS_PORT = parseInt(process.env.WEBSOCKET_PORT);
const MESSAGE_EVENT_HANDLERS = {
    p: async (socket, x, y) => {
        redis_client.xadd("player_actions:" + socket.gid, '*', "action", "p", "action_args", [socket.uid, x, y].join());
    },
    c: async (socket, x, y, angle) => {
        redis_client.xadd("player_actions:" + socket.gid, '*', "action", "c", "action_args", [socket.uid, x, y, angle].join());
    },
    u: async (socket, x, y, angle) => {
        redis_client.xadd("player_actions:" + socket.gid, '*', "action", "u", "action_args", [socket.uid, x, y, angle].join());
    },
    l: async (socket) => {
        redis_client.xadd("player_actions:" + socket.gid, '*', "action", "l", "action_args", [socket.uid].join());
    },
    uid: async (socket, uid, secret="") => {
        redis_client.hgetall("GAME:"+socket.gid,(err, game) => {
            if (game['user__'+uid] != undefined) {
                socket.uid = uid;
                socket.send("uid;" + true);
                subscribe_player_actions(socket);
            } else {
                redis_client.send_command("RG.TRIGGER", ["join_game", uid, socket.gid, secret], (err, data) => {
                    if (data != undefined && data != null) {
                        socket.uid = uid;
                        socket.send("uid;" + true);
                        subscribe_player_actions(socket);    
                    } else {
                        socket.send("uid;" + false);
                        socket.close();
                    }
                })

            }
        })
    }
};


const websocket_server = new WebSocket.Server({ port: WS_PORT });

websocket_server.on('connection', (socket, req) => {
    load_gid(req.url, socket);

    // Process incomming player websocket messages:
    socket.on('message', message => {
        let [action, payload] = message.split(";");
        func = (MESSAGE_EVENT_HANDLERS[action] || not_implemented)(socket, ...payload.split(','));
    });
});



function load_gid(url, socket) {
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