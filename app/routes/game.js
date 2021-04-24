const express = require('express');
const redis = require("redis");
var path = require('path');

websocket = require('../services/game_websocket');

let route_game = express.Router()
route_game.get('/', function (req, res) {
    res.sendFile('/public/views/game.html');
});


module.exports = route_game