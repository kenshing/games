// ============================================================
// 斗地主 - 核心类型定义
// ============================================================

/** 扑克牌数值 (3~17)，3最小，大王最大 */
export type CardValue = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17;

/** 花色 */
export type CardSuit = '♠' | '♥' | '♣' | '♦' | 'joker';

/** 单张扑克牌 */
export interface Card {
  value: CardValue;
  suit: CardSuit;
  id: string; // 唯一标识，如 "♠3", "joker-red"
}

/** 玩家座位 */
export type Seat = 0 | 1 | 2;

/** 玩家角色 */
export type Role = 'landlord' | 'peasant';

/** 玩家信息 */
export interface Player {
  seat: Seat;
  name: string;
  hand: Card[];
  role: Role | null;
  isAI: boolean;
  isReady: boolean;
}

/** 牌型分类 */
export type CardPatternType =
  | 'single'      // 单张
  | 'pair'        // 对子
  | 'triple'      // 三张
  | 'triple_single' // 三带一
  | 'triple_pair'   // 三带二
  | 'straight'    // 顺子
  | 'straight_pair' // 连对
  | 'plane'       // 飞机（不带翅膀）
  | 'plane_single' // 飞机带单
  | 'plane_pair'   // 飞机带对
  | 'bomb'        // 炸弹
  | 'rocket'      // 王炸
  | 'quad_single'  // 四带二（单）
  | 'quad_pair'    // 四带二（对）
  | 'invalid';    // 无效

/** 牌型 */
export interface CardPattern {
  type: CardPatternType;
  mainValue: CardValue; // 主牌值（用于比较大小）
  cards: Card[];        // 实际出的牌
  length?: number;      // 顺子/连对长度
}

/** 游戏阶段 */
export type GamePhase =
  | 'idle'       // 等待开始
  | 'bidding'    // 叫分阶段
  | 'playing'    // 出牌阶段
  | 'settled'    // 回合结束
  | 'gameover';  // 游戏结束

/** 叫分动作 */
export type BidAction = 0 | 1 | 2 | 3; // 0=不叫, 1/2/3=叫分

/** 出牌动作 */
export interface PlayAction {
  seat: Seat;
  pattern: CardPattern | null; // null = 不出
}

/** 本局结算明细 */
export interface RoundResult {
  winner: Seat;
  winnerRole: Role;
  base: number;        // 底分
  bidValue: number;    // 叫分倍数
  bombCount: number;   // 炸弹/王炸数量（每个 ×2）
  spring: 'spring' | 'reverse' | null; // 春天 / 反春（×2）
  multiplier: number;  // 总倍数
  scoreDelta: number[]; // 每人积分变化
}

/** 游戏状态（可序列化，用于P2P同步） */
export interface GameState {
  phase: GamePhase;
  players: Player[];
  landlordSeat: Seat | null;
  currentSeat: Seat;
  bidTurn: Seat;
  bidCurrent: number; // 当前最高分
  bidHighestSeat: Seat | null;
  lastPlay: PlayAction | null;
  lastValidPlay: PlayAction | null; // 最后一个有效出牌（用于压牌参考）
  tablePlays: (PlayAction | null)[]; // 每个座位当前桌面展示的出牌/不出
  deck: Card[]; // 底牌
  scores: number[]; // 各玩家得分
  roundCount: number;
  passCount: number; // 连续不出次数
  winner: Seat | null;
  history: PlayAction[];
  bombCount: number;   // 本局炸弹/王炸次数
  landlordPlays: number; // 地主出牌次数（反春判定）
  peasantPlays: number;  // 农民出牌总次数（春天判定）
  roundResult: RoundResult | null;
}

/** P2P 消息类型 */
export type P2PMessageType =
  | 'join'
  | 'ready'
  | 'start'
  | 'bid'
  | 'play'
  | 'pass'
  | 'sync'
  | 'chat'
  | 'reconnect';

export interface P2PMessage {
  type: P2PMessageType;
  payload: unknown;
  from: string;
  timestamp: number;
}

/** 游戏配置 */
export interface GameConfig {
  maxRounds: number;
  enableAI: boolean;
  aiDelay: number; // AI思考延迟(ms)
  soundEnabled: boolean;
}

export const DEFAULT_CONFIG: GameConfig = {
  maxRounds: 10,
  enableAI: true,
  aiDelay: 1200,
  soundEnabled: true,
};
