const heightOutput = document.querySelector('#height');
const widthOutput = document.querySelector('#width');
const playerSprite = 'assets/sprites/player.png';
const box = 'assets/images/blue_square_50_50.png';

const playerMoveSpeedAx = 160;
const playerMoveSpeedDiagonal = (1.414 * playerMoveSpeedAx) / 2 ;
function reportWindowSize() {
  heightOutput.textContent =document.getElementById('div_game');
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
      frames: [ { key: 'player', frame: 4 } ],
      frameRate: 20
  });

  this.anims.create({
      key: 'right',
      frames: this.anims.generateFrameNumbers('player', { start: 5, end: 8 }),
      frameRate: 10,
      repeat: -1
  });

  cursors = this.input.keyboard.createCursorKeys();
  this.cameras.main.startFollow(player);
}   



function update() {
  var xMovement = 0;
  var yMovement = 0;
  
  xMovement = cursors.left.isDown ? -1 : cursors.right.isDown? 1 : 0;
  yMovement = cursors.up.isDown ? -1 : cursors.down.isDown ? 1 : 0;
  

  if (xMovement != 0 && yMovement !=0) {
    player.setVelocityX(xMovement * playerMoveSpeedDiagonal);
    player.setVelocityY(yMovement * playerMoveSpeedDiagonal);
    player.anims.play('right', true);
  } else {
    player.setVelocityX(xMovement * playerMoveSpeedAx);
    player.setVelocityY(yMovement * playerMoveSpeedAx);
    player.anims.play('right', true);

  }

  
}



function render() {
  this.debug.spriteInfo(s, 20, 32);
}