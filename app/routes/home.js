const express = require('express');
const path = require('path');
const uuid = require('uuid');
const redis = require("redis");

const redis_client = redis.createClient(6379, 'redis');


let route_home = express.Router()

route_home.get('/', function (req, res) {
    res.sendFile(path.join(__basedir, 'views/home.html'));
});


module.exports = route_home