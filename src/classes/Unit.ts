import Phaser from 'phaser';

export default class Unit extends Phaser.GameObjects.Sprite {
  // グリッド上の座標（ピクセルではない）
  gridX: number;
  gridY: number;
  // パラメータ
  isPlayer: boolean; // true=自軍(青), false=敵軍(赤)
  moveRange: number; // 移動力
  isMoving: boolean; // 移動アニメーション中か

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, isPlayer: boolean) {
    // 画面上の初期位置を計算 (1マス64pxの半分32を足して中心に)
    super(scene, x * 64 + 32, y * 64 + 32, texture);
    
    this.gridX = x;
    this.gridY = y;
    this.isPlayer = isPlayer;
    this.moveRange = 5; // とりあえず全員移動力5
    this.isMoving = false;

    // 見た目の設定
    this.setOrigin(0.5);
    this.displayWidth = 50; // 少し小さくしてマスに収める
    this.displayHeight = 50;

    // 色分け（画像がないので色で区別）
    // 自軍＝青、敵軍＝赤
    if (isPlayer) {
      this.setTint(0x4444ff); 
    } else {
      this.setTint(0xff4444);
    }

    // シーンに追加
    scene.add.existing(this);
  }

  // グリッド座標をピクセル座標に変換して移動
  moveTo(targetX: number, targetY: number, callback?: () => void) {
    this.isMoving = true;
    this.gridX = targetX;
    this.gridY = targetY;

    this.scene.tweens.add({
      targets: this,
      x: targetX * 64 + 32,
      y: targetY * 64 + 32,
      duration: 300, // 0.3秒で移動
      ease: 'Power2',
      onComplete: () => {
        this.isMoving = false;
        if (callback) callback();
      }
    });
  }
}
