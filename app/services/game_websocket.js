const WebSocket = require('ws');
const uuid = require('uuid');
const redis = require("redis");
const redis_client = redis.createClient(6379, 'redis');


const WS_PORT = parseInt(process.env.WEBSOCKET_PORT);
const MESSAGE_EVENT_HANDLERS = {
    p: async (socket, x, y) => {
        redis_client.xadd("player_actions__" + socket.gid, 'MAXLEN', '1000', '*', "action", "p", "action_args", [socket.uid, x, y].join());
    },
    c: async (socket, x, y, angle) => {
        console.log(x, y, angle);
    },
    uid: async (socket) => {
        socket.send("uid;" + socket.uid);
    },
    settings: async (event, callback) => {
        console.log("true");
    }
};


const websocket_server = new WebSocket.Server({ port: WS_PORT });

websocket_server.on('connection', socket => {

    socket.uid = uuid.v4().replaceAll("-", "").slice(0, 8);
    socket.gid = uuid.v4().replaceAll("-", "");

    // Create new Redis client and subscribe to game events:
    const subscription_client = redis.createClient(6379, 'redis');
    subscription_client.subscribe(socket.gid);

    // Process incomming player websocker messages:
    socket.on('message', message => {
        let [action, payload] = message.split(";");
        MESSAGE_EVENT_HANDLERS[action](socket, ...payload.split(','));
    });

    // Receive incomming messages from Redis:
    subscription_client.on('message', (channel, message) => {
        socket.send(message);
    });

    socket.on('close', () => {
        redis_client.publish("game_instance", "disconnect;" + socket.uid)
        subscription_client.quit();
    });
});