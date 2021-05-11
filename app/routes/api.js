const express = require('express');
const path = require('path');
const uuid = require('uuid');
const redis = require("redis");

const redis_client = redis.createClient(6379, 'redis');

let route_api = express.Router()

route_api.get('/register', function (req, res, next) {
    let secret = uuid.v4().replaceAll("-", "");
    let uid = uuid.v4().replaceAll("-", "").slice(0,8);

    redis_client.send_command("RG.TRIGGER", ["create_new_user", uid, "Player1", "", secret]);

    res.send(JSON.stringify({
        "uid": uid,
        "secret": secret
    }));
});

module.exports = route_api