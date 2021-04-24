const WebSocket = require('ws');
const uuid = require('uuid');

const WS_PORT = parseInt(process.env.WEBSOCKET_PORT);
const MESSAGE_EVENT_HANDLERS = {
    p: async (socket, x, y) => {
        redis_client.publish("game_instance", "p;" + [socket.uuid, x, y].join())
        console.log(x, y);
    },
    c: async (socket, x, y, angle) => {
        console.log(x, y, angle);
    },
    uuid: async (socket) => {
        socket.send("uuid;" + socket.uuid);
    },
    settings: async (event, callback) => {
        console.log("true");
    }
};


const websocket_server = new WebSocket.Server({ port: WS_PORT });

websocket_server.on('connection', socket => {
    const subscription_client = redis.createClient(6379, 'redis');
    subscription_client.subscribe('game_instance');
    socket.uuid = uuid.v4().replaceAll("-", "").slice(0, 8);


    // process messages
    socket.on('message', message => {
        let [action, payload] = message.split(";");
        MESSAGE_EVENT_HANDLERS[action](socket, ...payload.split(','));
    });

    subscription_client.on('message', (channel, message) => {
        socket.send(message);
    });

    socket.on('close', () => {
        redis_client.publish("game_instance", "disconnect;" + socket.uuid)
        subscription_client.quit();
    });
});