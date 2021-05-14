global.__basedir = __dirname;

const express = require('express');
const home = require('./routes/home.js');
const game = require('./routes/game.js');
const api = require('./routes/api.js');
const redis = require("redis");

var fs = require('fs');

var config = JSON.parse(fs.readFileSync('/game_config/game_conf.json', 'utf8'));

if (config.debug == 1) {
  subscription_client = redis.createClient(6379, 'redis');
  subscription_client.subscribe("backend_debug");
  subscription_client.on('message', (channel, message) => {
      console.log("DEBUG: ", message)
  });  
}

const BACKEND_HOST = config.backend.host;
const BACKEND_PORT = parseInt(config.backend.port);

const app = express();
app.use(express.json())
app.use('/', home);
app.use('/game', game)
app.use('/api', api)
app.use(express.static('./public'));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'views/home.html'));
});

app.listen(BACKEND_PORT, () => {
  console.log(`node running: http://${BACKEND_HOST}:${BACKEND_PORT}`)
});



// https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications
// https://github.com/websockets/ws
// https://github.com/engineer-man/math-arena/blob/master/gateway/gateway.js
// https://github.com/B3L7/phaser3-tilemap-pack