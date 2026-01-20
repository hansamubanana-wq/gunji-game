import Phaser from 'phaser';
import Unit from '../classes/Unit';

// マスの種類
const TILE_SIZE = 64;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 11;

export default class BattleScene extends Phaser.Scene {
  // ゲームの状態管理
  private units: Unit[] = [];
  private selectedUnit: Unit | null = null;
  private movementLayer: Phaser.GameObjects.Graphics | null = null;
  private cursor: Phaser.GameObjects.Rectangle | null = null;
  
  // 簡易マップデータ (0:平地, 1:壁)
  // 1が並んでいるところは移動できません
  private mapData = [
    [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0],
    [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0],
    [0,1,1,1,0, 0,0,0,0,0, 0,0,0,1,1, 1,0,0,0,0], // 壁あり
    [0,1,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 1,0,0,0,0],
    [0,1,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 1,0,0,0,0],
    [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0], // 中央広場
    [0,0,0,1,1, 1,1,0,0,0, 0,0,0,0,0, 0,0,0,0,0],
    [0,0,0,1,0, 0,1,0,0,0, 0,0,0,0,0, 0,0,0,0,0],
    [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0],
    [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0],
    [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0],
  ];

  // 移動可能範囲を記録する配列
  private validMoves: {x: number, y: number}[] = [];

  constructor() {
    super('BattleScene');
  }

  preload() {
    // 仮の画像を生成（白い四角）
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0xffffff);
    graphics.fillRect(0, 0, 64, 64);
    graphics.generateTexture('box', 64, 64);
  }

  create() {
    // 1. マップ描画
    this.drawMap();

    // 2. 移動範囲表示用のレイヤー作成
    this.movementLayer = this.add.graphics();

    // 3. ユニット配置 (x, y, 味方か)
    this.createUnit(4, 5, true);  // 主人公（青）
    this.createUnit(3, 6, true);  // 味方（青）
    this.createUnit(15, 5, false); // 敵（赤）
    this.createUnit(16, 4, false); // 敵（赤）

    // 4. カーソル作成（黄色い枠）
    this.cursor = this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE).setStrokeStyle(4, 0xffff00).setOrigin(0);
    this.cursor.setVisible(false);

    // 5. タップ/クリックイベント設定
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handleInput(pointer);
    });
  }

  // --- システム詳細処理 ---

  private createUnit(x: number, y: number, isPlayer: boolean) {
    const unit = new Unit(this, x, y, 'box', isPlayer);
    this.units.push(unit);
  }

  private drawMap() {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x333333); // グリッド線の色

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tileX = x * TILE_SIZE;
        const tileY = y * TILE_SIZE;

        // 壁なら塗りつぶす
        if (this.mapData[y][x] === 1) {
          graphics.fillStyle(0x444444); // 壁の色
          graphics.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);
        }
        // グリッド線を描く
        graphics.strokeRect(tileX, tileY, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  private handleInput(pointer: Phaser.Input.Pointer) {
    // タッチ座標をグリッド座標に変換
    const x = Math.floor(pointer.x / TILE_SIZE);
    const y = Math.floor(pointer.y / TILE_SIZE);

    // 範囲外なら無視
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return;

    // カーソル移動
    this.cursor?.setPosition(x * TILE_SIZE, y * TILE_SIZE);
    this.cursor?.setVisible(true);

    // 既にユニットを選択中で、移動範囲内をタップした -> 移動実行
    if (this.selectedUnit && this.validMoves.some(m => m.x === x && m.y === y)) {
      this.moveSelectedUnit(x, y);
      return;
    }

    // ユニットをクリックしたか判定
    const clickedUnit = this.units.find(u => u.gridX === x && u.gridY === y);

    if (clickedUnit) {
      if (clickedUnit.isPlayer) {
        // 味方を選択 -> 移動範囲計算
        this.selectUnit(clickedUnit);
      } else {
        // 敵を選択 -> 単に情報を見るだけ（今回は選択解除）
        this.clearSelection();
      }
    } else {
      // 何もない場所をクリック -> 選択解除
      this.clearSelection();
    }
  }

  private selectUnit(unit: Unit) {
    if (unit.isMoving) return;
    
    this.selectedUnit = unit;
    this.calculateMoveRange(unit);
  }

  private clearSelection() {
    this.selectedUnit = null;
    this.movementLayer?.clear();
    this.validMoves = [];
  }

  // 重要：FEのような移動範囲計算（BFSアルゴリズム）
  private calculateMoveRange(unit: Unit) {
    this.movementLayer?.clear();
    this.validMoves = [];

    // 移動コストマップの初期化
    const dist: number[][] = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(-1));
    const queue: {x: number, y: number, steps: number}[] = [];

    // スタート地点
    dist[unit.gridY][unit.gridX] = 0;
    queue.push({ x: unit.gridX, y: unit.gridY, steps: 0 });

    const directions = [ {x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0} ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      // 移動力が限界なら次へ
      if (current.steps >= unit.moveRange) continue;

      for (const dir of directions) {
        const nx = current.x + dir.x;
        const ny = current.y + dir.y;

        // マップ外チェック
        if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
        
        // 壁チェック
        if (this.mapData[ny][nx] === 1) continue;

        // 敵ユニットがいるかチェック（通り抜け不可）
        const enemy = this.units.find(u => u.gridX === nx && u.gridY === ny && !u.isPlayer);
        if (enemy) continue;

        // まだ未到達なら更新
        if (dist[ny][nx] === -1 || dist[ny][nx] > current.steps + 1) {
          dist[ny][nx] = current.steps + 1;
          queue.push({ x: nx, y: ny, steps: current.steps + 1 });
          this.validMoves.push({ x: nx, y: ny });
        }
      }
    }

    // 青いマスを描画
    this.movementLayer!.fillStyle(0x0000ff, 0.4); // 青色、半透明
    for (const p of this.validMoves) {
      // 自分の位置は塗らない
      if (p.x === unit.gridX && p.y === unit.gridY) continue;
      this.movementLayer!.fillRect(p.x * TILE_SIZE, p.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  private moveSelectedUnit(x: number, y: number) {
    if (!this.selectedUnit) return;

    // 移動先に味方がいたら移動できない（簡易的な判定）
    const existingUnit = this.units.find(u => u.gridX === x && u.gridY === y);
    if (existingUnit && existingUnit !== this.selectedUnit) return;

    // 移動アニメーション開始
    this.selectedUnit.moveTo(x, y, () => {
      // 移動完了後の処理
      this.clearSelection();
    });
    
    // 表示上の青マスを即消す
    this.movementLayer?.clear();
  }
}
