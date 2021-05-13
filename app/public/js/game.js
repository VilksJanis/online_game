// DEFINE GAME CONSTANTS:
const playerSprite = '/sprites/player_shooter.png';
const otherPlayerSprite = '/sprites/player_2.png';
const projectile = '/sprites/projectile.png'
const box = '/images/blue_square_50_50.png';

const playerMoveSpeedAx = 300;
const playerMoveSpeedDiagonal = (1.414 * playerMoveSpeedAx) / 2;

// WEBSOCKET PARSE PATH:
var loc = window.location, ws_uri;
if (loc.protocol === "https:") {
  ws_uri = "wss:";
} else {
  ws_uri = "ws:";
}
ws_uri += "//" + loc.hostname;
ws_uri += ':' + 8082;
ws_uri += loc.pathname;

// WEBSOCKET ESTABLISH CONNECTION:
var webSocket = new WebSocket(ws_uri);
webSocket.onopen = function (event) {
  UID = localStorage.getItem('UID');
  if (UID === null) {
    register();
  }
  webSocket.send("uid;" + UID + ',' + localStorage.getItem('SEC'));
};

webSocket.onmessage = function (event) {
  let [action, payload] = event.data.split(";");
  MESSAGE_EVENT_HANDLERS[action](...payload.split(','));
};

webSocket.onclose = function (event) {
  window.location.href = "/";
};

// MESSAGE EVENT DEFINITION:
const MESSAGE_EVENT_HANDLERS = {
  p: async (uid, x, y) => {
    if (UID != uid) {
      update_enemy_position(uid, x, y)
    } else {
      // do nothing
    }
  },
  c: async (uid, x, y, angle) => {
    if (UID != uid) {
      enemy_shoot(uid, x, y, angle)
    } else {
      // do nothing
    }
  },
  o: async (uid, angle) => {
    if (UID != uid) {
      update_enemy_orientation(uid, angle)
    } else {
      // do nothing
    }
  },
  u: async (uid, x, y, angle) => {
    console.log(x, y, angle);
  },
  l: async (uid) => {
    if (enemies[uid] != undefined) {
      enemies[uid].destroy();
    }
  },
  j: async (uid, x, y) => {
    spawn_player(uid, x, y);
  },
  uid: async (is_valid) => {
    if (!is_valid) {
      unset_identity();
      window.location.href = "/"
    }
  },
  gid: async (is_valid) => {
    if (!is_valid) {
      window.location.href = "/";
    }
  },
};

// PHASER INITIALIZATION CONFIG:
const CONFIG = {
  type: Phaser.CANVAS,
  parent: 'div_game',
  backgroundColor: '#6c757d',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { y: 0 }
    }
  },
  width: window.innerWidth,
  height: window.innerHeight,
  mode: Phaser.Scale.FIT,
  autoCenter: Phaser.Scale.CENTER_BOTH,
  scene: {
    init,
    preload,
    create,
    update,
  }
};

// INITIALIZE GAME:
const game = new Phaser.Game(CONFIG);


var player = null;
var platforms = null;
var enemies = {};
var last_x = null;
var last_y = null;

// GAME INIT CALL:
function init() {
  var canvas = this.sys.game.canvas;
}

// GAME PRELOAD CALL:
function preload() {

  // LOAD ALL ASSETS:
  this.load.path = "/assets";
  this.load.spritesheet('player', playerSprite, { frameWidth: 32, frameHeight: 32 });
  // this.load.spritesheet('other_player', otherPlayerSprite, { frameWidth: 32, frameHeight: 32 });
  this.load.spritesheet('projectile', projectile, { frameWidth: 24, frameHeight: 8 });
  this.load.image('box', box);
}


// GAME CREATE CALL;
function create() {

  // DEFINE WORLD / WORLD BOUNDS
  this.physics.world.setBounds(0, 0, 2000, 2000, 5);            // set outer bounds
  this.physics.world.on('worldbounds', onWorldBounds);          // set event when objects collide with outer walls
  var bound_rect = this.add.rectangle(1000, 1000, 6000, 6000);  // draw rectangle around bounds
  bound_rect.setStrokeStyle(4000, 0x343a40);                     // stylize


  // DEFINE PLAYER 
  player = this.physics.add.sprite(0, 0, 'player');
  player.setVisible(false);
  player.body.collideWorldBounds = true;
  player.last_shot = 0;
  player.state_emit_timer = 0;
  this.cameras.main.startFollow(player);
  webSocket.send("j;"); // receive position

  // DEFINE OBSTACLES\
  platforms = this.physics.add.staticGroup();
  platforms.create(600, 400, 'box');
  platforms.create(300, 250, 'box');


  // DEFINE PROJECTILES
  projectiles = this.physics.add.group({
    classType: Projectile,
    runChildUpdate: true,
    collideWorldBounds: true,
  });

  //  DEFINE COLLIDERS
  this.physics.add.collider(player, platforms);
  this.anims.create({
    key: 'shoot',
    frames: this.anims.generateFrameNumbers('player', { start: 0, end: 10 }),
    frameRate: 30,
    repeat: 0
  });


  // DEFINE OVERLAPS:


  // DEFINE CONTROLS:
  arrows = this.input.keyboard.createCursorKeys();
  wasd = this.input.keyboard.addKeys({ 'W': Phaser.Input.Keyboard.KeyCodes.W, 'S': Phaser.Input.Keyboard.KeyCodes.S, 'A': Phaser.Input.Keyboard.KeyCodes.A, 'D': Phaser.Input.Keyboard.KeyCodes.D });
  cursors = { ...arrows, ...wasd };

  cursors.check_pressed_up = function () { return this.up.isDown || this.W.isDown };
  cursors.check_pressed_down = function () { return this.down.isDown || this.S.isDown };
  cursors.check_pressed_left = function () { return this.left.isDown || this.A.isDown };
  cursors.check_pressed_right = function () { return this.right.isDown || this.D.isDown };


  // DEFINE EVENTS:
  this.input.on('pointermove', function (pointer) {
    let angle = Phaser.Math.Angle.Between(player.x, player.y, pointer.x + this.cameras.main.scrollX, pointer.y + this.cameras.main.scrollY);
    send_angle(angle);
    player.setRotation(angle - Math.PI / 2);

  }, this);

  this.input.on("pointerdown", function (pointer) {
    if (player.last_shot > 250) {
      let angle = Phaser.Math.Angle.Between(player.x, player.y, pointer.x + this.cameras.main.scrollX, pointer.y + this.cameras.main.scrollY);
      var projectile = projectiles.get();
      if (projectile) {
        projectile.setScale(1.25, 1.5);
        projectile.shoot(player, angle - Math.PI);
        player.last_shot = 0;
      }

      send_click(pointer.x + this.cameras.main.scrollX, pointer.y + this.cameras.main.scrollY, angle);
      player.anims.play('shoot', true);
    }
  }, this);

  this.events.on('postupdate', function () {
    if (player.x != last_x || player.y != last_y) {
      send_movement_state(
        player.x,
        player.y,
      );
      last_x = player.x;
      last_y = player.y;
    }
  });

}

// GAME FRAME UPDATE CALL:
function update(time, delta) {
  var activity_detected = false;
  var xMovement = 0;
  var yMovement = 0;
  xMovement = cursors.check_pressed_left() ? -1 : cursors.check_pressed_right() ? 1 : 0;
  yMovement = cursors.check_pressed_up() ? -1 : cursors.check_pressed_down() ? 1 : 0;


  if (xMovement != 0 && yMovement != 0) {
    player.setVelocityX(xMovement * playerMoveSpeedDiagonal);
    player.setVelocityY(yMovement * playerMoveSpeedDiagonal);
  } else {
    player.setVelocityX(xMovement * playerMoveSpeedAx);
    player.setVelocityY(yMovement * playerMoveSpeedAx);
  }

  activity_detected = (2 * xMovement) + yMovement != 0 ? true : false;
  player.state_emit_timer += delta;

  if (player.state_emit_timer > 500) {
    send_movement_state(player.x, player.y);
    player.state_emit_timer = 0;
  }

  player.last_shot = player.last_shot + delta;
}


function send_movement_state(x, y) {
  webSocket.send("p;" + [parseInt(x), parseInt(y)].join());
}

function send_click(x, y, angle) {
  webSocket.send("c;" + [parseInt(x), parseInt(y), angle.toFixed(4)].join());
}

function send_angle(angle) {
  webSocket.send("o;" + [angle.toFixed(4)].join());
}

function update_enemy_position(uid, x, y) {
  if (enemies[uid] != undefined) {
    enemies[uid].x = parseInt(x);
    enemies[uid].y = parseInt(y);
  } else {
    sprite = game.scene.scenes[0].physics.add.sprite(parseInt(x), parseInt(y), 'player');
    game.scene.scenes[0].physics.add.collider(player, platforms);
    enemies[uid] = sprite;
  }
}

function update_enemy_orientation(uid, angle) {
  if (enemies[uid] != undefined) {
    enemies[uid].setRotation(parseFloat(angle) - Math.PI / 2);
  }
}

function enemy_shoot(uid, x, y, angle) {
  var projectile = projectiles.get();

  if (projectile) {
    console.log("enemy shoot")
    projectile.setScale(1.25, 1.5);
    projectile.shoot(enemies[uid], parseFloat(angle) - Math.PI);
    enemies[uid].anims.play('shoot', true);

    player.last_shot = 0;
  }


}



function spawn_player(uid, x, y) {
  if (UID != uid) {
    // SPAWN ENEMY
    sprite = game.scene.scenes[0].physics.add.sprite(parseInt(x), parseInt(y), 'player');
    game.scene.scenes[0].physics.add.collider(player, platforms);
    enemies[uid] = sprite;
  } else {
    // SPAWN SELF
    player.setPosition(parseInt(x), parseInt(y))
    player.setVisible(true);
  }
}

function onWorldBounds(body) {
  var p = body.gameObject;
  p.setActive(false);
  p.setVisible(false);
}


var Projectile = new Phaser.Class({
  Extends: Phaser.Physics.Arcade.Sprite,
  initialize: function Projectile(scene) {

    Phaser.GameObjects.Sprite.call(this, scene, 0, 0, 'projectile');
    this.incX = 0;
    this.incY = 0;
    this.lifespan = 0;
    this.speed = Phaser.Math.GetSpeed(1000, 1);
    scene.anims.create({
      key: 'projectile_shoot',
      frames: scene.anims.generateFrameNumbers('projectile', { start: 0, end: 5 }),
      frameRate: 24,
      repeat: -1
    });

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.body.onWorldBounds = true;
    this.setBounce(1, 1)


    this.anims.play('projectile_shoot', true);
    this.setDepth(-1);
  },

  shoot: function (_player, angle) {
    this.setActive(true);
    this.setVisible(true);
    this.setPosition(_player.x, _player.y);
    this.setRotation(angle);
    this.incX = Math.cos(angle);
    this.incY = Math.sin(angle);
    this.lifespan = 1600;
  },

  update: function (time, delta) {
    this.lifespan -= delta;
    this.x -= this.incX * (this.speed * delta);
    this.y -= this.incY * (this.speed * delta);
    if (this.lifespan <= 0) {
      this.setActive(false);
      this.setVisible(false);
    }
  }
});


window.addEventListener('resize', () => {
  console.log(window.innerWidth, window.innerHeight)
  game.scale.resize(window.innerWidth, window.innerHeight);
});