// ============================================================
// 斗地主 - AI 策略引擎
// ============================================================

import type { GameState, Seat, Card, CardPattern, BidAction } from '@/types/game';
import { generateCandidates } from './plays';

/** 评估手牌强度（叫分用） */
export function evaluateHandStrength(hand: Card[]): number {
  let score = 0;
  const values = hand.map(c => c.value);
  const valueCount = new Map<number, number>();
  for (const v of values) valueCount.set(v, (valueCount.get(v) ?? 0) + 1);

  for (const v of values) {
    if (v >= 15) score += 4;
    else if (v >= 13) score += 2;
    else if (v >= 11) score += 1;
  }

  for (const [, count] of valueCount) {
    if (count === 4) score += 6;
  }

  if (values.includes(16) && values.includes(17)) score += 8;

  const sorted = [...new Set(values)].sort((a, b) => a - b);
  let consecutive = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1 && sorted[i] <= 14) consecutive++;
    else consecutive = 1;
    if (consecutive >= 5) { score += 2; break; }
  }

  return score;
}

/** AI 叫分决策 */
export function aiBidDecision(state: GameState, seat: Seat): BidAction {
  const hand = state.players[seat].hand;
  const strength = evaluateHandStrength(hand);
  const currentBid = state.bidCurrent;

  if (strength >= 20 && currentBid < 3) return 3;
  if (strength >= 14 && currentBid < 2) return 2;
  if (strength >= 8 && currentBid < 1) return 1;
  return 0;
}

const isBombPat = (p: CardPattern) => p.type === 'bomb' || p.type === 'rocket';

/** 首出（领出）策略：选最优组合，而不是只会出单张 */
function chooseLeadPlay(hand: Card[], enemyMinCards: number): Card[] {
  const cands = generateCandidates(hand, null);
  if (cands.length === 0) return [hand[hand.length - 1]];

  // 能一把出完直接出完
  const finish = cands.find(c => c.cards.length === hand.length);
  if (finish) return finish.cards;

  const nonBomb = cands.filter(c => !isBombPat(c.pattern));
  const pool = nonBomb.length > 0 ? nonBomb : cands;

  // 敌人只剩 1-2 张时，领出对子/三张，避免出单张被直接走掉
  const dangerSingle = enemyMinCards <= 1;

  // 优先级：顺子/连对/飞机（一次出很多张）> 三带 > 对子 > 单张
  const typeOrder: Record<string, number> = {
    plane_pair: 0, plane_single: 1, plane: 2,
    straight_pair: 3, straight: 4,
    triple_pair: 5, triple_single: 6, triple: 7,
    pair: 8, single: 9,
    quad_pair: 10, quad_single: 11,
  };

  const scored = pool
    .filter(c => !(dangerSingle && c.pattern.type === 'single'))
    .map(c => {
      const order = typeOrder[c.pattern.type] ?? 9;
      // 同类里出点数小的；出的张数越多越好
      const score = order * 1000 + c.pattern.mainValue * 10 - c.cards.length;
      return { c, score };
    })
    .sort((a, b) => a.score - b.score);

  if (scored.length > 0) return scored[0].c.cards;
  // 兜底：最小的非炸弹
  return (nonBomb[0] ?? cands[0]).cards;
}

/** AI 出牌决策；返回空数组表示不出 */
export function aiPlayDecision(state: GameState, seat: Seat): Card[] {
  const hand = state.players[seat].hand;
  const target = state.lastValidPlay?.pattern ?? null;
  const isLandlord = state.players[seat].role === 'landlord';
  const nextSeat = ((seat + 1) % 3) as Seat;
  const prevSeat = ((seat + 2) % 3) as Seat;

  const teammateSeat = state.players.findIndex(
    (p, i) => i !== seat && p.role === state.players[seat].role
  ) as Seat;

  const nextCards = state.players[nextSeat].hand.length;
  const prevCards = state.players[prevSeat].hand.length;
  const teammateCards = teammateSeat >= 0 ? state.players[teammateSeat].hand.length : 999;
  const isTeammateNearWin = teammateSeat >= 0 && teammateCards <= 2;

  const enemyMinCards = isLandlord
    ? Math.min(nextCards, prevCards)
    : state.players[state.landlordSeat ?? 0].hand.length;

  // ===== 领出 =====
  if (!target) {
    return chooseLeadPlay(hand, enemyMinCards);
  }

  const lastSeat = state.lastValidPlay!.seat;
  const isTeammatePlay = lastSeat === teammateSeat;

  // 队友出的牌且队友快赢了 → 放队友走
  if (!isLandlord && isTeammatePlay && isTeammateNearWin) return [];

  // ===== 获取所有能压的候选 =====
  const cands = generateCandidates(hand, target);
  if (cands.length === 0) return [];

  // 能直接出完 → 出完
  const finish = cands.find(c => c.cards.length === hand.length);
  if (finish) return finish.cards;

  const nonBomb = cands.filter(c => !isBombPat(c.pattern));

  // 队友出的牌：农民不压队友（除非自己也快走完了）
  if (!isLandlord && isTeammatePlay && hand.length > 3) return [];

  // 地主视角：下家农民只剩 1 张时必须管
  const nextIsEnemyNearWin = isLandlord
    ? nextCards <= 1
    : state.players[nextSeat].role === 'landlord' && nextCards <= 1;

  if (nextIsEnemyNearWin) {
    // 尽量用非炸弹管住；不行就炸弹
    if (nonBomb.length > 0) return nonBomb[nonBomb.length - 1].cards;
    return cands[0].cards;
  }

  // 普通情况：出最小能压的非炸弹
  if (nonBomb.length > 0) {
    // 如果上家快赢了（敌人），尽量压
    const prevIsEnemy = state.players[prevSeat].role !== state.players[seat].role;
    if (prevIsEnemy && prevCards <= 2 && !isTeammatePlay) {
      return nonBomb[0].cards;
    }
    // 地主被农民顶牌时要管；农民看情况
    if (isLandlord) return nonBomb[0].cards;
    // 农民：地主出的牌要试着管，但点数差太大且会拆散牌型时放
    const cheapest = nonBomb[0];
    if (state.players[lastSeat].role === 'landlord') {
      // 管牌但保留炸弹
      return cheapest.cards;
    }
    return cheapest.cards;
  }

  // 只剩炸弹能压：敌人快赢才炸
  const enemyNearWin = isLandlord
    ? Math.min(nextCards, prevCards) <= 2
    : state.players[state.landlordSeat ?? 0].hand.length <= 2;

  if (enemyNearWin) return cands[0].cards;

  // 否则保留炸弹，不出
  return [];
}
