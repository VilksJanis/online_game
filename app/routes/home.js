const express = require('express');
const path = require('path');
const uuid = require('uuid');


let route_home = express.Router()

route_home.get('/', function (req, res) {
    // Landing page
    res.sendFile(path.join(__basedir, 'views/home.html'));
});


module.exports = route_home