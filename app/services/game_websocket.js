const WebSocket = require('ws');
const uuid = require('uuid');
const redis = require("redis");
const redis_client = redis.createClient(6379, 'redis');

not_implemented = () => {};

const WS_PORT = parseInt(process.env.WEBSOCKET_PORT);
const MESSAGE_EVENT_HANDLERS = {
    p: async (socket, x, y) => {
        redis_client.xadd("player_actions:" + socket.gid, 'MAXLEN', '1000', '*', "action", "p", "action_args", [socket.uid, x, y].join());
    },
    c: async (socket, x, y, angle) => {
        console.log(x, y, angle);
    },
    uid: async (socket, uid, secret) => {
        // Receive UID from the client and validate it
        redis_client.hgetall("USER:"+uid, function(err, player_data) {
            if (player_data != null && player_data.secret == secret) {
                socket.uid = uid;
                socket.send("uid;"+true);
                socket.send("settings;" + player_data.settings);
            } else {
                socket.send("uid;"+false);
            }         
        });

    },
    settings: async (event, callback) => {
        console.log("true");
    }
};


const websocket_server = new WebSocket.Server({ port: WS_PORT });

websocket_server.on('connection', (socket, req) => {
    // Create new Redis client and subscribe to game events:
    gid = req.url.split("/").slice(-1)[0];
    socket.subscription_client = redis.createClient(6379, 'redis');
    socket.gid = gid;
    socket.subscription_client.subscribe(socket.gid);

    // Process incomming player websocker messages:
    socket.on('message', message => {
        let [action, payload] = message.split(";");
        func = (MESSAGE_EVENT_HANDLERS[action] || not_implemented )(socket, ...payload.split(','));
    });

    // Receive incomming messages from Redis:
    socket.subscription_client.on('message', (channel, message) => {
        socket.send(message);
    });

    socket.on('close', () => {
        redis_client.publish("game_instance", "disconnect;" + socket.uid)
        socket.subscription_client.quit();
    });
});