// DEFINE GAME CONSTANTS:
const playerSprite = '/sprites/player_shooter.png';
const otherPlayerSprite = '/sprites/player_2.png';
const projectile = '/sprites/projectile.png'
const box = '/images/blue_square_50_50.png';

const playerMoveSpeedAx = 400;
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
  p: async (uid, x, y, o) => {
    // position event
    if (UID != uid) {
      enemy_poses(uid, x, y, o)
    }
  },
  c: async (uid, x, y, angle) => {
    // click event
    if (UID != uid) {
      enemy_shoots(uid, x, y, angle)
    }
  },
  r: async (uid, x, y) => {
    // respawn event
    respawn_player(uid, x, y)
  },
  hit: async (uid) => {
    // hit event
    if (UID != uid) {
      if (enemies[uid] != undefined) {
        enemies[uid].disableBody(true, true);
      }
    } else {
      player.disableBody(true, true);

      let gameOverText = game.scene.scenes[0].add.text(player.x, player.y, 'OUCH!', { fontSize: '64px', fill: '#fff' });
      gameOverText.setDepth(1);
    
      const gameOverButton = game.scene.scenes[0].add.text(player.x - 60, player.y + 65, 'Respawn!', { fontSize: '64px', fill: '#fff' })
      gameOverButton.setInteractive({ useHandCursor: true })
        .on('pointerover', () => enterButtonHoverState(gameOverButton))
        .on('pointerout', () => enterButtonRestState(gameOverButton))
        .on('pointerup', () => respawnRequest(gameOverButton, gameOverText)); 
    }

  },
  score: async (score) => {
    // score event
    console.log(score)
  },
  l: async (uid) => {
    // leave event
    if (enemies[uid] != undefined) {
      enemies[uid].destroy();
    }
  },
  j: async (uid, x, y) => {
    // player join event
    spawn_player(uid, x, y);
  },
  uid: async (is_valid) => {
    // uid request response event
    if (!is_valid) {
      unset_identity();
      window.location.href = "/"
    }
  },
  gid: async (is_valid) => {
    // gid response event
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

// GLOBAL GAME VARIABLES:
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
  this.load.spritesheet('projectile', projectile, { frameWidth: 24, frameHeight: 8 });
  this.load.image('box', box);
}

// GAME CREATE CALL;
function create() {

  // DEFINE WORLD / WORLD BOUNDS
  this.physics.world.setBounds(0, 0, 2000, 2000, 1);            // set outer bounds
  this.physics.world.on('worldbounds', onWorldBounds);          // set event when objects collide with outer walls
  var bound_rect = this.add.rectangle(1000, 1000, 6000, 6000);  // draw rectangle around bounds
  bound_rect.setStrokeStyle(4000, 0x343a40);                     // stylize


  // DEFINE PLAYER 
  player = this.physics.add.sprite(0, 0, 'player');
  player.setScale(1.5, 1.5);
  player.setVisible(false);
  player.last_shot = 0;
  this.cameras.main.startFollow(player);
  webSocket.send("j;"); // receive position


  // DEFINE OBSTACLES
  platforms = this.physics.add.staticGroup();
  platform_coords = [[600, 400], [300, 600], [700, 250], [1000, 1000], [1200, 700],
  [1200, 250], [700, 1800], [397, 1700], [1700, 250], [1500, 397],
  [1500, 1800], [1700, 1500], [397, 700], [1800, 250], [1800, 700]];

  // SPAWN OBSTACLES
  platform_coords.forEach(([x, y]) => {
    platforms.create(x, y, 'box');
  })


  // DEFINE PROJECTILES
  projectiles = this.physics.add.group({
    classType: Projectile,
    runChildUpdate: true,
    collideWorldBounds: false,
  });

  //  DEFINE COLLIDERS
  player.body.collideWorldBounds = true;

  this.physics.add.collider(player, platforms);
  this.physics.add.collider(projectiles, player, onPlayerHit);
  this.physics.add.collider(projectiles, platforms, onProjectileHit);


  this.anims.create({
    key: 'shoot',
    frames: this.anims.generateFrameNumbers('player', { start: 0, end: 10 }),
    frameRate: 30,
    repeat: 0
  });


  // DEFINE CONTROLS:
  arrows = this.input.keyboard.createCursorKeys();
  wasd = this.input.keyboard.addKeys({ 'W': Phaser.Input.Keyboard.KeyCodes.W, 'S': Phaser.Input.Keyboard.KeyCodes.S, 'A': Phaser.Input.Keyboard.KeyCodes.A, 'D': Phaser.Input.Keyboard.KeyCodes.D });
  cursors = { ...arrows, ...wasd };

  cursors.check_pressed_up = function () { return this.up.isDown || this.W.isDown };
  cursors.check_pressed_down = function () { return this.down.isDown || this.S.isDown };
  cursors.check_pressed_left = function () { return this.left.isDown || this.A.isDown };
  cursors.check_pressed_right = function () { return this.right.isDown || this.D.isDown };


  // DEFINE INTERACTION EVENTS:
  this.input.on('pointermove', function (pointer) {
    let angle = Phaser.Math.Angle.Between(player.x, player.y, pointer.x + this.cameras.main.scrollX, pointer.y + this.cameras.main.scrollY);
    player.setRotation(angle - Math.PI / 2);
  }, this);

  this.input.on("pointerdown", function (pointer) {
    if (player.last_shot > 250 && player.active) {
      let angle = Phaser.Math.Angle.Between(player.x, player.y, pointer.x + this.cameras.main.scrollX, pointer.y + this.cameras.main.scrollY);
      var projectile = projectiles.get();
      if (projectile) {
        projectile.setScale(2, 2);
        projectile.shoot(player, angle - Math.PI);
        player.last_shot = 0;
      }

      send_click(pointer.x + this.cameras.main.scrollX, pointer.y + this.cameras.main.scrollY, angle);
      player.anims.play('shoot', true);
    }
  }, this);

  this.events.on('postupdate', function () {
    send_pose(player.x, player.y, player.rotation);
  });

}

// GAME FRAME UPDATE CALL
function update(time, delta) {
  // movement functionality
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
  player.last_shot = player.last_shot + delta;
}


// OUTGOING PLAYER EVENTS
function send_pose(x, y, angle) {
  webSocket.send("p;" + [parseInt(x), parseInt(y), angle.toFixed(4)].join());
}

function send_click(x, y, angle) {
  webSocket.send("c;" + [parseInt(x), parseInt(y), angle.toFixed(4)].join());
}


// INCOMMING ENEMY EVENTS
function enemy_poses(uid, x, y, o) {
  if (enemies[uid] != undefined) {
    enemy = enemies[uid];
    enemy.setPosition(parseInt(x), parseInt(y));
    enemies[uid].setRotation(parseFloat(o));

  } else {
    enemy = add_enemy(uid);
    enemy.setPosition(parseInt(x), parseInt(y));
    enemy.setRotation(parseFloat(o));
  }
}

function enemy_shoots(uid, x, y, angle) {
  var projectile = projectiles.get();

  if (projectile && enemies[uid].active) {
    projectile.setScale(2, 2);
    projectile.shoot(enemies[uid], parseFloat(angle) - Math.PI);
    enemies[uid].anims.play('shoot', true);
    player.last_shot = 0;
  }
}


// ADD ENEMY GAME OBJECT
function add_enemy(uid) {
  // ADD SPRITE
  sprite = game.scene.scenes[0].physics.add.sprite(0, 0, 'player');
  sprite.setScale(1.5, 1.5);
  sprite.name = uid;
  enemies[uid] = sprite;

  // ADD COLLIDERS
  game.scene.scenes[0].physics.add.collider(sprite, platforms);
  game.scene.scenes[0].physics.add.collider(sprite, player);
  game.scene.scenes[0].physics.add.collider(sprite, projectiles, onEnemyHit);

  return sprite
}

// SPAWN FUNCTIONALITY
function spawn_self(x, y) {
  player.setPosition(parseInt(x), parseInt(y));
  player.setVisible(true);
}

function spawn_enemy(uid, x, y) {
  enemy = add_enemy(uid);
  enemy.setPosition(parseInt(x), parseInt(y));
  player.setVisible(true);

}

function spawn_player(uid, x, y) {
  if (UID != uid) {
    spawn_enemy(uid, x, y);
  } else {
    spawn_self(x, y);
  }
}


// RESPAWN FUNCTIONALITY
function respawn_self(x, y) {
  player.setPosition(parseInt(x), parseInt(y));
  player.setVisible(true);
  player.enableBody(true, player.x, player.y, true, true);
}

function respawn_enemy(uid, x, y) {
  if (enemies[uid] != undefined) {
    enemy = add_enemy(uid);
  }
  enemies[uid].setPosition(parseInt(x), parseInt(y))
  enemies[uid].setVisible(true);
  enemies[uid].enableBody(true, enemies[uid].x, enemies[uid].y, true, true);
}

function respawn_player(uid, x, y) {
  if (UID != uid) {
    respawn_enemy(uid, x, y);
  } else {
    respawn_self(x, y);
  }
}


// COLLIDER EVENT CALLS:
function onProjectileHit(projectile, object) {
  projectile.disableBody(true, true);
}

function onEnemyHit(object,projectile) {
  webSocket.send("hit;" + object.name);
  projectile.disableBody(true, true);
}

function onPlayerHit(object, projectile) {
  projectile.disableBody(true, true);
}

function onWorldBounds(body) {
  var p = body.gameObject;
  p.setActive(false);
  p.setVisible(false);
}



// GAME OVER DIALOG:
function enterButtonHoverState(b) {
  b.setStyle({ fill: '#ff0' });
};

function enterButtonRestState(b) {
  b.setStyle({ fill: '#fff' });
};

function respawnRequest(gameOverButton, gameOverText) {
  webSocket.send("r;");
  gameOverButton.setVisible(false)
  gameOverText.setVisible(false)
}


// PROJECTILE DEFINITION:
var Projectile = new Phaser.Class({
  Extends: Phaser.Physics.Arcade.Sprite,
  initialize: function Projectile(scene) {

    Phaser.GameObjects.Sprite.call(this, scene, 0, 0, 'projectile');
    this.lifespan = 0;
    scene.anims.create({
      key: 'projectile_shoot',
      frames: scene.anims.generateFrameNumbers('projectile', { start: 0, end: 5 }),
      frameRate: 24,
      repeat: -1
    });

    this.anims.play('projectile_shoot', true);
    this.setDepth(-1);

  },

  shoot: function (_player, angle) {
    this.enableBody( // Enable physics body
      true, // Reset body and game object, at (x, y)
      _player.x,
      _player.y,
      true, // Activate sprite
      true  // Show sprite
    );

    this.setRotation(angle);
    const vx = Math.cos(this.rotation - Math.PI) * 40
    const vy = Math.sin(this.rotation - Math.PI) * 40

    this.setPosition(_player.x + vx, _player.y + vy);

    game.scene.scenes[0].physics.velocityFromRotation(this.rotation - Math.PI, 1000, this.body.velocity)
    this.lifespan = 2000;
  },

  update: function (time, delta) {
    this.lifespan -= delta;
    if (this.lifespan <= 0) {
      this.disableBody( // Stop and disable physics body
        true, // Deactivate sprite (active=false)
        true  // Hide sprite (visible=false)
      );
    }
  }
});


