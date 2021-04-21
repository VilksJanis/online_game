const ACTION_REGISTER = 'register';
const ACTION_UPDATE_STATE = 'update';
const ACTION_EDIT_SETTINGS = 'settings';


const ws = require('ws');
const uuid = require('uuid');



const WS = new ws.Server({ port: 8082 });


const express = require('express')
const app = express();
const port = 8080;

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.listen(port, () => {
  console.log(`Node.js backend running on: http://localhost:${port} !`)
});


WS.on('connection', socket => {
  socket.uuid = uuid.v4().replaceAll("-", "").slice(0, 16);

  socket.send(JSON.stringify({
    code: ACTION_REGISTER,
    payload: {
      uuid: socket.uuid
    }
  }));


  // process messages
  socket.on('message', message => {
    let [x, y, angle, clicked] = message.split(",");
    console.log(socket.uuid, x, y, angle, clicked);
  });


  socket.on('close', () => {
    console.log('ws closed')
  });
});


// https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications
// https://github.com/websockets/ws
// https://github.com/engineer-man/math-arena/blob/master/gateway/gateway.js
// https://github.com/B3L7/phaser3-tilemap-pack