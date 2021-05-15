global.__basedir = __dirname;

const express = require('express');
const home = require('./routes/home.js');
const game = require('./routes/game.js');
const api = require('./routes/api.js');
var fs = require('fs');

var config = JSON.parse(fs.readFileSync('/game_config/game_conf.json', 'utf8'));

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