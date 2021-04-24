const express = require('express')
let route_home = express.Router()

route_home.get('/', function (req, res) {
    res.send("home")
});



module.exports = route_home