const express = require('express')
let route_home = express.Router()

route_home.get('/', function (req, res) {
    res.sendFile(path.join(__basedir, 'views/home.html'));
});



module.exports = route_home