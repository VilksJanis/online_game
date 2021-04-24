const express = require('express');
const redis = require("redis");
var path = require('path');


let route_game = express.Router()
route_game.get('/', function (req, res) {
    res.sendFile(path.join(__basedir, 'views/game.html'));
});



module.exports = route_game