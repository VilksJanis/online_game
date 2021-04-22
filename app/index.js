const ws = require('ws');
const uuid = require('uuid');
const redis = require("redis");

const redis_client = redis.createClient(6379, 'redis');

const ACTION_REGISTER = 'register';
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



const WS = new ws.Server({ port: 8082 });

const express = require('express')
const app = express();
const port = 8080;

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.listen(port, () => {
  console.log(`Node.js backend running on: http://localhost:${port} !`)
});


WS.on('connection', socket => {
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
    subscription_client.quit();
  });
});


// https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications
// https://github.com/websockets/ws
// https://github.com/engineer-man/math-arena/blob/master/gateway/gateway.js
// https://github.com/B3L7/phaser3-tilemap-pack