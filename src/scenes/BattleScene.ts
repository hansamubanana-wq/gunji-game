import Phaser from 'phaser';

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }
  preload() {}
  create() {
    const { width, height } = this.scale;
    
    this.add.text(width / 2, height / 2, 'Combat System Initialized', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.add.grid(width / 2, height / 2, width, height, 64, 64, 0x00b9f2, 0.2);
  }
  update() {}
}
