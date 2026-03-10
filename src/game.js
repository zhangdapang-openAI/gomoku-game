/**
 * 张谷五子棋 - Phaser 3 版本
 * 制作人：张大胖 & AI助手
 * 版本：v1.0.0
 */

// 游戏配置
const CONFIG = {
    BOARD_SIZE: 15,
    CELL_SIZE: 36,
    PADDING: 30,
    COLORS: {
        BOARD: 0x2a2a3e,
        BOARD_LINE: 0x404060,
        STONE_GREEN: 0x00ff88,
        STONE_PURPLE: 0xa855f7,
        HIGHLIGHT: 0x00d4aa
    }
};

// 提示语库
const TIPS = {
    techniques: [
        "💡 技巧：抢占中心位置，控制主动权",
        "💡 技巧：注意形成活三，为进攻做准备",
        "💡 技巧：防守时优先堵住对方的活三",
        "💡 技巧：尝试形成双三，让对手防不胜防",
        "💡 技巧：边角相对安全，但中心更有利",
        "💡 技巧：观察对手潜在连线，提前阻断",
        "💡 技巧：进攻是最好的防守",
        "💡 技巧：注意四三杀法，一击必杀"
    ],
    encouragements: [
        "🌟 加油！每一步都是进步",
        "🌟 别慌，深思熟虑才能下出好棋",
        "🌟 相信自己，你能行的",
        "🌟 慢慢来，好棋不怕晚",
        "🌟 保持专注，胜利在望",
        "🌟 深呼吸，冷静分析局势",
        "🌟 你下得不错，继续保持"
    ]
};

// 全局游戏引用
let gameInstance = null;

class GomokuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GomokuScene' });
    }

    preload() {
        this.createStoneTexture('stone-green', CONFIG.COLORS.STONE_GREEN);
        this.createStoneTexture('stone-purple', CONFIG.COLORS.STONE_PURPLE);
        this.createHighlightTexture();
    }

    createStoneTexture(key, color) {
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        const size = CONFIG.CELL_SIZE - 4;
        
        // 阴影
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillCircle(size/2 + 2, size/2 + 2, size/2);
        
        // 棋子主体
        graphics.fillStyle(color, 1);
        graphics.fillCircle(size/2, size/2, size/2 - 1);
        
        // 高光
        graphics.fillStyle(0xffffff, 0.4);
        graphics.fillCircle(size/3, size/3, size/5);
        
        graphics.generateTexture(key, size, size);
    }

    createHighlightTexture() {
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        const size = CONFIG.CELL_SIZE;
        
        graphics.lineStyle(2, CONFIG.COLORS.HIGHLIGHT, 0.8);
        graphics.strokeRect(2, 2, size - 4, size - 4);
        
        graphics.generateTexture('highlight', size, size);
    }

    create() {
        // 初始化状态
        this.board = [];
        for (let i = 0; i < CONFIG.BOARD_SIZE; i++) {
            this.board[i] = [];
            for (let j = 0; j < CONFIG.BOARD_SIZE; j++) {
                this.board[i][j] = 0;
            }
        }
        
        this.currentPlayer = 1;
        this.moveHistory = [];
        this.moveCount = 0;
        this.isGameOver = false;
        this.lastMoveTime = Date.now();
        
        // 创建游戏元素
        this.createBoard();
        this.stones = this.add.group();
        this.hoverHighlight = this.add.image(0, 0, 'highlight').setVisible(false);
        
        // 设置输入
        this.setupInput();
        
        // 启动提示系统
        this.startTipSystem();
        
        // 更新UI
        this.updateUI();
        
        // 保存引用
        gameInstance = this;
    }

    createBoard() {
        const boardSize = CONFIG.BOARD_SIZE * CONFIG.CELL_SIZE;
        const totalSize = boardSize + CONFIG.PADDING * 2;
        
        // 棋盘背景
        this.add.rectangle(
            totalSize / 2,
            totalSize / 2,
            boardSize + 20,
            boardSize + 20,
            CONFIG.COLORS.BOARD
        );
        
        // 网格线
        const graphics = this.add.graphics();
        graphics.lineStyle(1, CONFIG.COLORS.BOARD_LINE);
        
        for (let i = 0; i < CONFIG.BOARD_SIZE; i++) {
            const pos = CONFIG.PADDING + i * CONFIG.CELL_SIZE;
            
            // 横线
            graphics.moveTo(CONFIG.PADDING, pos);
            graphics.lineTo(CONFIG.PADDING + boardSize - CONFIG.CELL_SIZE, pos);
            
            // 竖线
            graphics.moveTo(pos, CONFIG.PADDING);
            graphics.lineTo(pos, CONFIG.PADDING + boardSize - CONFIG.CELL_SIZE);
        }
        graphics.strokePath();
        
        // 星位
        const stars = [3, 7, 11];
        for (let r of stars) {
            for (let c of stars) {
                const x = CONFIG.PADDING + c * CONFIG.CELL_SIZE;
                const y = CONFIG.PADDING + r * CONFIG.CELL_SIZE;
                this.add.circle(x, y, 3, CONFIG.COLORS.BOARD_LINE);
            }
        }
    }

    setupInput() {
        // 点击落子
        this.input.on('pointerdown', (pointer) => {
            if (this.isGameOver) return;
            
            const pos = this.getGridPosition(pointer.x, pointer.y);
            if (pos && this.board[pos.row][pos.col] === 0) {
                this.placeStone(pos.row, pos.col);
            }
        });
        
        // 悬停效果
        this.input.on('pointermove', (pointer) => {
            if (this.isGameOver) return;
            
            const pos = this.getGridPosition(pointer.x, pointer.y);
            if (pos && this.board[pos.row][pos.col] === 0) {
                const x = CONFIG.PADDING + pos.col * CONFIG.CELL_SIZE;
                const y = CONFIG.PADDING + pos.row * CONFIG.CELL_SIZE;
                this.hoverHighlight.setPosition(x, y).setVisible(true);
            } else {
                this.hoverHighlight.setVisible(false);
            }
        });
    }

    getGridPosition(x, y) {
        const col = Math.round((x - CONFIG.PADDING) / CONFIG.CELL_SIZE);
        const row = Math.round((y - CONFIG.PADDING) / CONFIG.CELL_SIZE);
        
        if (row >= 0 && row < CONFIG.BOARD_SIZE && col >= 0 && col < CONFIG.BOARD_SIZE) {
            return { row, col };
        }
        return null;
    }

    placeStone(row, col) {
        // 放置棋子
        this.board[row][col] = this.currentPlayer;
        
        const x = CONFIG.PADDING + col * CONFIG.CELL_SIZE;
        const y = CONFIG.PADDING + row * CONFIG.CELL_SIZE;
        
        const stoneKey = this.currentPlayer === 1 ? 'stone-green' : 'stone-purple';
        const stone = this.add.image(x, y, stoneKey);
        stone.setScale(0);
        
        // 动画
        this.tweens.add({
            targets: stone,
            scale: 1,
            duration: 200,
            ease: 'Back.out'
        });
        
        this.stones.add(stone);
        
        // 记录
        this.moveHistory.push({ row, col, player: this.currentPlayer });
        this.moveCount++;
        this.lastMoveTime = Date.now();
        
        // 检查胜利
        if (this.checkWin(row, col)) {
            this.gameOver(this.currentPlayer);
            return;
        }
        
        // 检查平局
        if (this.moveCount >= CONFIG.BOARD_SIZE * CONFIG.BOARD_SIZE) {
            this.gameOver(0);
            return;
        }
        
        // 切换玩家
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        this.updateUI();
    }

    checkWin(row, col) {
        const player = this.board[row][col];
        const directions = [
            [[0, 1], [0, -1]],
            [[1, 0], [-1, 0]],
            [[1, 1], [-1, -1]],
            [[1, -1], [-1, 1]]
        ];
        
        for (let dir of directions) {
            let count = 1;
            for (let [dr, dc] of dir) {
                let r = row + dr, c = col + dc;
                while (r >= 0 && r < CONFIG.BOARD_SIZE && c >= 0 && c < CONFIG.BOARD_SIZE && this.board[r][c] === player) {
                    count++;
                    r += dr;
                    c += dc;
                }
            }
            if (count >= 5) return true;
        }
        return false;
    }

    gameOver(winner) {
        this.isGameOver = true;
        
        const modal = document.getElementById('gameOverModal');
        const title = document.getElementById('modalTitle');
        const message = document.getElementById('modalMessage');
        
        if (winner === 0) {
            title.textContent = '🤝 平局！';
            message.textContent = '双方势均力敌！';
        } else {
            const name = winner === 1 ? '绿方' : '紫方';
            title.textContent = '🎉 胜利！';
            message.textContent = `${name}获得胜利！`;
        }
        
        setTimeout(() => modal.classList.add('active'), 300);
    }

    undoMove() {
        if (this.moveHistory.length === 0 || this.isGameOver) return;
        
        const last = this.moveHistory.pop();
        this.board[last.row][last.col] = 0;
        
        const stones = this.stones.getChildren();
        if (stones.length > 0) {
            stones[stones.length - 1].destroy();
        }
        
        this.moveCount--;
        this.currentPlayer = last.player;
        this.updateUI();
    }

    restartGame() {
        // 清空棋盘数据
        for (let i = 0; i < CONFIG.BOARD_SIZE; i++) {
            for (let j = 0; j < CONFIG.BOARD_SIZE; j++) {
                this.board[i][j] = 0;
            }
        }
        
        // 清除棋子
        this.stones.clear(true, true);
        
        // 重置状态
        this.currentPlayer = 1;
        this.moveHistory = [];
        this.moveCount = 0;
        this.isGameOver = false;
        this.lastMoveTime = Date.now();
        
        // 隐藏弹窗
        document.getElementById('gameOverModal').classList.remove('active');
        
        this.updateUI();
    }

    updateUI() {
        const stoneEl = document.getElementById('currentStone');
        const playerEl = document.getElementById('currentPlayer');
        
        stoneEl.className = 'player-stone ' + (this.currentPlayer === 1 ? 'green' : 'purple');
        playerEl.textContent = (this.currentPlayer === 1 ? '绿方' : '紫方') + '回合';
        
        document.getElementById('turnIndicator').textContent = `第 ${this.moveCount + 1} 手`;
    }

    startTipSystem() {
        setInterval(() => {
            if (this.isGameOver) return;
            
            const elapsed = Date.now() - this.lastMoveTime;
            if (elapsed > 8000) {
                this.showTip();
            }
        }, 5000);
    }

    showTip() {
        const tipEl = document.getElementById('tipText');
        const type = Math.random() > 0.5 ? 'techniques' : 'encouragements';
        const tips = TIPS[type];
        const tip = tips[Math.floor(Math.random() * tips.length)];
        
        tipEl.textContent = tip;
        tipEl.className = 'tip-text ' + (type === 'techniques' ? 'technique' : 'encouragement');
    }
}

// 初始化游戏
function initGame() {
    const container = document.getElementById('game-container');
    const size = Math.min(window.innerWidth - 40, window.innerHeight - 350, 600);
    CONFIG.CELL_SIZE = Math.floor((size - CONFIG.PADDING * 2) / CONFIG.BOARD_SIZE);
    
    const config = {
        type: Phaser.AUTO,
        width: CONFIG.CELL_SIZE * CONFIG.BOARD_SIZE + CONFIG.PADDING * 2,
        height: CONFIG.CELL_SIZE * CONFIG.BOARD_SIZE + CONFIG.PADDING * 2,
        parent: 'game-container',
        backgroundColor: 'transparent',
        scene: GomokuScene,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
        }
    };
    
    new Phaser.Game(config);
}

// 页面加载完成后启动
window.addEventListener('load', initGame);

// 响应式调整
window.addEventListener('resize', () => {
    if (gameInstance) {
        const size = Math.min(window.innerWidth - 40, window.innerHeight - 350, 600);
        CONFIG.CELL_SIZE = Math.floor((size - CONFIG.PADDING * 2) / CONFIG.BOARD_SIZE);
        gameInstance.scale.resize(
            CONFIG.CELL_SIZE * CONFIG.BOARD_SIZE + CONFIG.PADDING * 2,
            CONFIG.CELL_SIZE * CONFIG.BOARD_SIZE + CONFIG.PADDING * 2
        );
    }
});
