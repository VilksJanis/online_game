const express = require('express');
var path = require('path');

require(__basedir + '/services/game_websocket')

let route_game = express.Router()
route_game.get('/', function (req, res) {
    res.sendFile(path.join(__basedir, 'views/game.html'));
});



module.exports = route_game