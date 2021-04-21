const heightOutput = document.querySelector('#height');
const widthOutput = document.querySelector('#width');
const playerSprite = 'assets/sprites/player.png';
const box = 'assets/images/blue_square_50_50.png';

const playerMoveSpeedAx = 200;
const playerMoveSpeedDiagonal = (1.414 * playerMoveSpeedAx) / 2;
function reportWindowSize() {
  heightOutput.textContent = document.getElementById('div_game');
  widthOutput.textContent = window.innerWidth;
}

var platforms;



window.onresize = reportWindowSize;
window.addEventListener('resize', reportWindowSize);


var config = {
  type: Phaser.CANVAS,
  parent: 'div_game',
  backgroundColor: '#198754',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { y: 0 }
    }
  },
  width: 1024,
  height: 768,
  scene: {
    init,
    preload,
    create,
    update,
    render
  }
};

const game = new Phaser.Game(config);


function init() {
  var canvas = this.sys.game.canvas;
  var fullscreen = this.sys.game.device.fullscreen;

  state_emit_timer = 0;
  last_player_angle = 0;

  if (!fullscreen.available) {
    return;
  }

  startBtn = document.getElementById('fullscreen');

  startBtn.addEventListener('click', function () {
    if (document.fullscreenElement) { return; }
    canvas[fullscreen.request]();
  });
}

function preload() {
  this.load.spritesheet('player', playerSprite, { frameWidth: 32, frameHeight: 32 });
  this.load.image('box', box);
}

function create() {
  player = this.physics.add.sprite(100, 450, 'player');
  platforms = this.physics.add.staticGroup();

  platforms.create(600, 400, 'box');
  platforms.create(100, 250, 'box');

  this.physics.add.collider(player, platforms);


  this.anims.create({
    key: 'left',
    frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
    frameRate: 10,
    repeat: -1
  });

  this.anims.create({
    key: 'turn',
    frames: [{ key: 'player', frame: 4 }],
    frameRate: 20
  });

  this.anims.create({
    key: 'right',
    frames: this.anims.generateFrameNumbers('player', { start: 5, end: 7 }),
    frameRate: 10,
    repeat: -1
  });

  arrows = this.input.keyboard.createCursorKeys();
  wasd = this.input.keyboard.addKeys({ 'W': Phaser.Input.Keyboard.KeyCodes.W, 'S': Phaser.Input.Keyboard.KeyCodes.S, 'A': Phaser.Input.Keyboard.KeyCodes.A, 'D': Phaser.Input.Keyboard.KeyCodes.D });
  cursors = { ...arrows, ...wasd };

  cursors.check_pressed_up = function () { return this.up.isDown || this.W.isDown };
  cursors.check_pressed_down = function () { return this.down.isDown || this.S.isDown };
  cursors.check_pressed_left = function () { return this.left.isDown || this.A.isDown };
  cursors.check_pressed_right = function () { return this.right.isDown || this.D.isDown };

  this.input.on('pointermove', function (pointer) {
    let angle = Phaser.Math.Angle.Between(player.x, player.y, pointer.x + this.cameras.main.scrollX, pointer.y + this.cameras.main.scrollY);
    player.angle = angle;
  }, this);

  this.input.on("pointerdown", function (pointer){
    send_movement_state(
      player.x,
      player.y,
      Phaser.Math.Angle.Between(player.x, player.y, pointer.x + this.cameras.main.scrollX, pointer.y + this.cameras.main.scrollY),
      1,
      )
  }, this);

  this.cameras.main.startFollow(player);
}


function update(time, delta) {
  var activity_detected = false;
  var xMovement = 0;
  var yMovement = 0;
  xMovement = cursors.check_pressed_left() ? -1 : cursors.check_pressed_right() ? 1 : 0;
  yMovement = cursors.check_pressed_up() ? -1 : cursors.check_pressed_down() ? 1 : 0;

  if (cursors.shift.isDown) {
    xMovement = xMovement * 2;
    yMovement = yMovement * 2;
  }

  if (xMovement != 0 && yMovement != 0) {
    player.setVelocityX(xMovement * playerMoveSpeedDiagonal);
    player.setVelocityY(yMovement * playerMoveSpeedDiagonal);
    player.anims.play('right', true);
  } else {
    player.setVelocityX(xMovement * playerMoveSpeedAx);
    player.setVelocityY(yMovement * playerMoveSpeedAx);
    player.anims.play('right', true);
  }

  activity_detected = xMovement + yMovement != 0 ? true : last_player_angle != player.angle ? true : false;
  state_emit_timer += delta;

  if (state_emit_timer >= 1000 || activity_detected) {
    send_movement_state(
      player.x,
      player.y,
      player.angle,
      0
    );
    state_emit_timer = 0;
    last_player_angle = player.angle;
  }
}


function render() {
  this.debug.spriteInfo(s, 20, 32);
}


function send_movement_state(x,y,angle,clicked) {
  webSocket.send([Math.round(x),Math.round(y),angle.toFixed(4), clicked].join());
}

function send_action(x,y,angle,action) {
  console.log(x,y,angle,action);
}