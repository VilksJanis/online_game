const express = require('express');
const path = require('path');
const redis = require("redis");

require(__basedir + '/services/game_websocket');

const redis_client = redis.createClient(6379, 'redis');

let route_game = express.Router();

route_game.get('/', function (req, res) {
    res.sendFile(path.join(__basedir, 'views/game.html'));
});


route_game.post('/find', function (req, res, next) {
    // API to find a ready game instance
    redis_client.send_command("RG.TRIGGER", ["find_game", req.body.uid], (err, data) => {
        if (data != undefined && data != null && data[0] != "None") {
            res.send(data[0])
        } else {
            res.send(false);
        }
    });
});


route_game.post('/instances/:g_id', function (req, res) {
    // API to POST join command to the found game_instance  
    redis_client.send_command("RG.TRIGGER", ["join_game", req.body.uid, req.params.g_id], (err, data) => {
        if (data != undefined && data != null && data[0] != 0) {
            res.send('/game/instances/'+req.params.g_id);
        } else {
            res.send("false");
        }
    });
});


route_game.get('/instances/:g_id', function (req, res) {
    // game instance endpoint
    res.sendFile(path.join(__basedir, 'views/game.html'));
});
  
  

module.exports = route_game;