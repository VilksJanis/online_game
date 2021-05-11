global.__basedir = __dirname;

const APP_PORT = parseInt(process.env.APP_PORT);

const express = require('express');
const home = require('./routes/home.js');
const game = require('./routes/game.js');
const api = require('./routes/api.js');


const app = express();
app.use(express.json())
app.use('/', home);
app.use('/game', game)
app.use('/api', api)
app.use(express.static('./public'));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'views/home.html'));
});

app.listen(APP_PORT, () => {
  console.log(`node running: http://localhost:${APP_PORT}`)
});



// https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications
// https://github.com/websockets/ws
// https://github.com/engineer-man/math-arena/blob/master/gateway/gateway.js
// https://github.com/B3L7/phaser3-tilemap-pack