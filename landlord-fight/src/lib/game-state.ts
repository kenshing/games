// ============================================================
// 斗地主 - 游戏状态机（含倍数 / 炸弹翻倍 / 春天结算）
// ============================================================

import type {
  GameState, Player, Seat, Card, CardPattern, BidAction, PlayAction, RoundResult,
} from '@/types/game';
import { createDeck, shuffle, dealCards, sortHand, detectPattern, canBeat } from './cards';
import { generateCandidates } from './plays';

export const DEFAULT_NAMES = ['玩家', '农民甲', '农民乙', 'AI地主', 'AI农民'];

// ---- 初始化空状态 ----
export function createInitialState(): GameState {
  return {
    phase: 'idle',
    players: [
      { seat: 0, name: '玩家', hand: [], role: null, isAI: false, isReady: true },
      { seat: 1, name: 'AI 甲', hand: [], role: null, isAI: true, isReady: true },
      { seat: 2, name: 'AI 乙', hand: [], role: null, isAI: true, isReady: true },
    ],
    landlordSeat: null,
    currentSeat: 0,
    bidTurn: 0,
    bidCurrent: 0,
    bidHighestSeat: null,
    lastPlay: null,
    lastValidPlay: null,
    tablePlays: [null, null, null],
    deck: [],
    scores: [0, 0, 0],
    roundCount: 0,
    passCount: 0,
    winner: null,
    history: [],
    bombCount: 0,
    landlordPlays: 0,
    peasantPlays: 0,
    roundResult: null,
  };
}

// ---- 开始新游戏：发牌 ----
export function startGame(state: GameState, names?: string[]): GameState {
  const deck = shuffle(createDeck());
  const { hands, bottom } = dealCards(deck);

  const players: Player[] = state.players.map((p, i) => ({
    ...p,
    name: names?.[i] ?? p.name,
    hand: sortHand(hands[i]),
    role: null,
    isReady: true,
  }));

  return {
    ...createInitialState(),
    players,
    deck: bottom,
    phase: 'bidding',
    bidTurn: 0,
    currentSeat: 0,
    roundCount: state.roundCount + 1,
    scores: [...state.scores],
  };
}

// ---- 叫分 ----
export function bid(state: GameState, seat: Seat, action: BidAction): GameState {
  if (state.phase !== 'bidding') return state;
  if (state.bidTurn !== seat) return state;

  const nextTurn = ((seat + 1) % 3) as Seat;
  let newState = { ...state };

  if (action === 0) {
    // 不叫：一圈没人叫分则重新发牌
    if (state.bidHighestSeat === null && nextTurn === 0) {
      return startGame(state);
    }
  } else {
    if (action > state.bidCurrent) {
      newState.bidCurrent = action;
      newState.bidHighestSeat = seat;
    }
  }

  // 叫分结束条件：有人叫3分，或轮了一圈
  const biddingDone = action === 3 || (nextTurn === 0 && state.bidHighestSeat !== null);

  if (biddingDone && newState.bidHighestSeat !== null) {
    const landlord = newState.bidHighestSeat;
    const newPlayers = state.players.map((p, i) => ({
      ...p,
      role: (i === landlord ? 'landlord' : 'peasant') as 'landlord' | 'peasant',
      hand: i === landlord ? sortHand([...p.hand, ...state.deck]) : p.hand,
    }));

    return {
      ...newState,
      players: newPlayers,
      landlordSeat: landlord,
      phase: 'playing',
      currentSeat: landlord,
      lastPlay: null,
      lastValidPlay: null,
      bidTurn: landlord,
    };
  }

  return {
    ...newState,
    bidTurn: nextTurn,
  };
}

// ---- 出牌 ----
export function playCards(state: GameState, seat: Seat, cards: Card[]): GameState {
  if (state.phase !== 'playing') return state;
  if (state.currentSeat !== seat) return state;

  const player = state.players[seat];
  if (!player) return state;

  const handIds = new Set(player.hand.map(c => c.id));
  if (!cards.every(c => handIds.has(c.id))) return state;

  const pattern = detectPattern(cards);
  if (!pattern) {
    if (cards.length !== 0) return state;
    return pass(state, seat);
  }

  const target = state.lastValidPlay?.pattern ?? null;
  if (target && !canBeat(pattern, target)) return state;

  const cardIds = new Set(cards.map(c => c.id));
  const newHand = player.hand.filter(c => !cardIds.has(c.id));
  const newPlayers = state.players.map((p, i) =>
    i === seat ? { ...p, hand: newHand } : p
  );

  const action: PlayAction = { seat, pattern };
  const nextSeat = ((seat + 1) % 3) as Seat;

  const isBomb = pattern.type === 'bomb' || pattern.type === 'rocket';
  const isLandlord = player.role === 'landlord';

  const newTablePlays = [...state.tablePlays];
  newTablePlays[seat] = action;

  const shared = {
    players: newPlayers,
    lastPlay: action,
    lastValidPlay: action,
    tablePlays: newTablePlays,
    history: [...state.history, action],
    passCount: 0,
    bombCount: state.bombCount + (isBomb ? 1 : 0),
    landlordPlays: state.landlordPlays + (isLandlord ? 1 : 0),
    peasantPlays: state.peasantPlays + (isLandlord ? 0 : 1),
  };

  // 出完牌 → 本局结束
  if (newHand.length === 0) {
    return {
      ...state,
      ...shared,
      phase: 'settled',
      winner: seat,
    };
  }

  return {
    ...state,
    ...shared,
    currentSeat: nextSeat,
  };
}

// ---- 不出（Pass）----
export function pass(state: GameState, seat: Seat): GameState {
  if (state.phase !== 'playing') return state;
  if (state.currentSeat !== seat) return state;
  if (state.lastValidPlay === null) return state;

  const nextSeat = ((seat + 1) % 3) as Seat;
  const newPassCount = state.passCount + 1;
  const clearLast = newPassCount >= 2;

  const newTablePlays = [...state.tablePlays];
  newTablePlays[seat] = { seat, pattern: null };

  return {
    ...state,
    currentSeat: nextSeat,
    lastPlay: { seat, pattern: null },
    tablePlays: clearLast ? [null, null, null] : newTablePlays,
    passCount: clearLast ? 0 : newPassCount,
    lastValidPlay: clearLast ? null : state.lastValidPlay,
    history: [...state.history, { seat, pattern: null }],
  };
}

// ---- 当前实时倍数（结算前显示用）----
export function currentMultiplier(state: GameState): number {
  return (state.bidCurrent || 1) * Math.pow(2, state.bombCount);
}

// ---- 结算本局（满意斗地主计分：底分 × 叫分 × 炸弹翻倍 × 春天翻倍）----
export function settleRound(state: GameState, baseScore: number = 1): GameState {
  if (state.phase !== 'settled' || state.winner === null) return state;

  const winner = state.winner;
  const winnerRole = state.players[winner].role!;
  const isLandlordWin = winnerRole === 'landlord';

  // 春天：地主赢且两个农民一手牌都没出过
  // 反春：农民赢且地主只出过一手牌（首出后再没出过）
  let spring: RoundResult['spring'] = null;
  if (isLandlordWin && state.peasantPlays === 0) spring = 'spring';
  if (!isLandlordWin && state.landlordPlays <= 1) spring = 'reverse';

  const bidValue = state.bidCurrent || 1;
  const multiplier = bidValue * Math.pow(2, state.bombCount) * (spring ? 2 : 1);
  const points = baseScore * multiplier;

  const scoreDelta = [0, 0, 0];
  const newScores = [...state.scores];
  if (isLandlordWin) {
    scoreDelta[winner] = points * 2;
    state.players.forEach((p, i) => {
      if (p.role === 'peasant') scoreDelta[i] = -points;
    });
  } else {
    state.players.forEach((p, i) => {
      if (p.role === 'peasant') scoreDelta[i] = points;
      else scoreDelta[i] = -points * 2;
    });
  }
  for (let i = 0; i < 3; i++) newScores[i] += scoreDelta[i];

  const roundResult: RoundResult = {
    winner,
    winnerRole,
    base: baseScore,
    bidValue,
    bombCount: state.bombCount,
    spring,
    multiplier,
    scoreDelta,
  };

  return {
    ...state,
    scores: newScores,
    phase: 'gameover',
    roundResult,
  };
}

// ---- 获取提示候选列表（供「提示」按钮轮换使用）----
export function getHint(hand: Card[], lastValid: CardPattern | null, index: number = 0): Card[] {
  const cands = generateCandidates(hand, lastValid);
  if (cands.length === 0) return [];
  return cands[index % cands.length].cards;
}

/** 提示候选总数（用于轮换和显示） */
export function getHintCount(hand: Card[], lastValid: CardPattern | null): number {
  return generateCandidates(hand, lastValid).length;
}
