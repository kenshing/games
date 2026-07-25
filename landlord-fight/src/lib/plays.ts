// ============================================================
// 出牌候选生成器（AI / 提示 / 超时托管 共用）
// 按牌值分组结构化生成，避免暴力枚举 2^n 组合
// ============================================================

import type { Card, CardValue, CardPattern } from '@/types/game';
import { detectPattern, canBeat } from './cards';

/** 按牌值分组（值 -> 该值的牌） */
function groupByValue(hand: Card[]): Map<CardValue, Card[]> {
  const map = new Map<CardValue, Card[]>();
  for (const c of hand) {
    const list = map.get(c.value) ?? [];
    list.push(c);
    map.set(c.value, list);
  }
  return map;
}

/** 取每组的 n 张（不足 n 张跳过） */
function take(map: Map<CardValue, Card[]>, value: CardValue, n: number): Card[] {
  return (map.get(value) ?? []).slice(0, n);
}

interface Candidate {
  cards: Card[];
  pattern: CardPattern;
}

/**
 * 生成所有能压过 target 的候选出牌，已按「代价」从低到高排序：
 * 同类型先出小点数的；炸弹/王炸排在最后（保留）。
 * target 为 null 时生成首出候选（含组合牌型）。
 */
export function generateCandidates(hand: Card[], target: CardPattern | null): Candidate[] {
  const groups = groupByValue(hand);
  const values = Array.from(groups.keys()).sort((a, b) => a - b); // 升序
  const out: Candidate[] = [];

  const push = (cards: Card[]) => {
    const pattern = detectPattern(cards);
    if (pattern && (!target || canBeat(pattern, target))) {
      out.push({ cards, pattern });
    }
  };

  if (!target) {
    // ===== 首出：生成所有合理牌型 =====
    // 单张
    for (const v of values) push(take(groups, v, 1));
    // 对子
    for (const v of values) if (groups.get(v)!.length >= 2) push(take(groups, v, 2));
    // 三张
    for (const v of values) if (groups.get(v)!.length >= 3) push(take(groups, v, 3));
    // 三带一 / 三带二
    for (const v of values) {
      if (groups.get(v)!.length < 3) continue;
      const triple = take(groups, v, 3);
      for (const w of values) {
        if (w === v) continue;
        push([...triple, ...take(groups, w, 1)]);
        if (groups.get(w)!.length >= 2) push([...triple, ...take(groups, w, 2)]);
      }
    }
    // 顺子（5+ 连续单张，不含 2 和王）
    const straightVals = values.filter(v => v <= 14);
    for (let len = 5; len <= Math.min(12, straightVals.length); len++) {
      for (let i = 0; i + len <= straightVals.length; i++) {
        const window = straightVals.slice(i, i + len);
        if (window[len - 1] - window[0] !== len - 1) continue;
        push(window.flatMap(v => take(groups, v, 1)));
      }
    }
    // 连对（3+ 连续对子）
    const pairVals = values.filter(v => v <= 14 && groups.get(v)!.length >= 2);
    for (let len = 3; len <= pairVals.length; len++) {
      for (let i = 0; i + len <= pairVals.length; i++) {
        const window = pairVals.slice(i, i + len);
        if (window[len - 1] - window[0] !== len - 1) continue;
        push(window.flatMap(v => take(groups, v, 2)));
      }
    }
    // 飞机（2+ 连续三张，及带翅膀）
    const tripleVals = values.filter(v => v <= 14 && groups.get(v)!.length >= 3);
    for (let len = 2; len <= tripleVals.length; len++) {
      for (let i = 0; i + len <= tripleVals.length; i++) {
        const window = tripleVals.slice(i, i + len);
        if (window[len - 1] - window[0] !== len - 1) continue;
        const body = window.flatMap(v => take(groups, v, 3));
        push(body); // 纯飞机
        // 飞机带单：挑最小的 len 张散牌
        const singles = values.filter(v => !window.includes(v)).flatMap(v => take(groups, v, 1));
        if (singles.length >= len) push([...body, ...singles.slice(0, len)]);
        // 飞机带对：挑最小的 len 个对子
        const pairs = values.filter(v => !window.includes(v) && groups.get(v)!.length >= 2)
          .flatMap(v => take(groups, v, 2));
        if (pairs.length >= len * 2) push([...body, ...pairs.slice(0, len * 2)]);
      }
    }
    // 四带二
    for (const v of values) {
      if (groups.get(v)!.length !== 4) continue;
      const quad = take(groups, v, 4);
      const singles = values.filter(w => w !== v).flatMap(w => take(groups, w, 1));
      if (singles.length >= 2) push([...quad, ...singles.slice(0, 2)]);
      const pairs = values.filter(w => w !== v && groups.get(w)!.length >= 2)
        .flatMap(w => take(groups, w, 2));
      if (pairs.length >= 4) push([...quad, ...pairs.slice(0, 4)]);
    }
  } else {
    // ===== 压牌：只生成能压过的 =====
    const t = target;
    const mv = t.mainValue;

    switch (t.type) {
      case 'single':
        for (const v of values) if (v > mv) push(take(groups, v, 1));
        break;
      case 'pair':
        for (const v of values) if (v > mv && groups.get(v)!.length >= 2) push(take(groups, v, 2));
        break;
      case 'triple':
        for (const v of values) if (v > mv && groups.get(v)!.length >= 3) push(take(groups, v, 3));
        break;
      case 'triple_single': {
        for (const v of values) {
          if (v <= mv || groups.get(v)!.length < 3) continue;
          const triple = take(groups, v, 3);
          // 带最小的一张散牌（不拆对子优先单张）
          const singleVals = values.filter(w => w !== v && groups.get(w)!.length === 1);
          const otherVals = values.filter(w => w !== v);
          const kick = singleVals[0] ?? otherVals[0];
          if (kick !== undefined) push([...triple, ...take(groups, kick, 1)]);
        }
        break;
      }
      case 'triple_pair': {
        for (const v of values) {
          if (v <= mv || groups.get(v)!.length < 3) continue;
          const triple = take(groups, v, 3);
          const pairVals = values.filter(w => w !== v && groups.get(w)!.length >= 2 && groups.get(w)!.length <= 3);
          const allPairs = values.filter(w => w !== v && groups.get(w)!.length >= 2);
          const kick = pairVals[0] ?? allPairs[0];
          if (kick !== undefined) push([...triple, ...take(groups, kick, 2)]);
        }
        break;
      }
      case 'straight': {
        const len = t.length ?? t.cards.length;
        const straightVals = values.filter(v => v <= 14);
        for (let i = 0; i + len <= straightVals.length; i++) {
          const window = straightVals.slice(i, i + len);
          if (window[len - 1] - window[0] !== len - 1) continue;
          if (window[len - 1] > mv) push(window.flatMap(v => take(groups, v, 1)));
        }
        break;
      }
      case 'straight_pair': {
        const len = t.length ?? t.cards.length / 2;
        const pairVals = values.filter(v => v <= 14 && groups.get(v)!.length >= 2);
        for (let i = 0; i + len <= pairVals.length; i++) {
          const window = pairVals.slice(i, i + len);
          if (window[len - 1] - window[0] !== len - 1) continue;
          if (window[len - 1] > mv) push(window.flatMap(v => take(groups, v, 2)));
        }
        break;
      }
      case 'plane': case 'plane_single': case 'plane_pair': {
        const len = t.length ?? 2;
        const needSingle = t.type === 'plane_single' ? len : 0;
        const needPair = t.type === 'plane_pair' ? len * 2 : 0;
        const tripleVals = values.filter(v => v <= 14 && groups.get(v)!.length >= 3);
        for (let i = 0; i + len <= tripleVals.length; i++) {
          const window = tripleVals.slice(i, i + len);
          if (window[len - 1] - window[0] !== len - 1) continue;
          if (window[len - 1] <= mv) continue;
          const body = window.flatMap(v => take(groups, v, 3));
          if (t.type === 'plane') { push(body); continue; }
          if (needSingle > 0) {
            const singles = values.filter(v => !window.includes(v)).flatMap(v => take(groups, v, 1));
            if (singles.length >= needSingle) push([...body, ...singles.slice(0, needSingle)]);
          }
          if (needPair > 0) {
            const pairs = values.filter(v => !window.includes(v) && groups.get(v)!.length >= 2)
              .flatMap(v => take(groups, v, 2));
            if (pairs.length >= needPair) push([...body, ...pairs.slice(0, needPair)]);
          }
        }
        break;
      }
      case 'quad_single': {
        for (const v of values) {
          if (v <= mv || groups.get(v)!.length !== 4) continue;
          const quad = take(groups, v, 4);
          const singles = values.filter(w => w !== v).flatMap(w => take(groups, w, 1));
          if (singles.length >= 2) push([...quad, ...singles.slice(0, 2)]);
        }
        break;
      }
      case 'quad_pair': {
        for (const v of values) {
          if (v <= mv || groups.get(v)!.length !== 4) continue;
          const quad = take(groups, v, 4);
          const pairs = values.filter(w => w !== v && groups.get(w)!.length >= 2)
            .flatMap(w => take(groups, w, 2));
          if (pairs.length >= 4) push([...quad, ...pairs.slice(0, 4)]);
        }
        break;
      }
      case 'bomb': case 'rocket':
        // 只有更大的炸弹或王炸能压
        break;
      default:
        break;
    }
  }

  // 炸弹和王炸（任何情况都可能需要，追加在末尾）
  if (!target || (target.type !== 'rocket')) {
    const bombs: Candidate[] = [];
    for (const v of values) {
      if (groups.get(v)!.length === 4) {
        const cards = take(groups, v, 4);
        const pattern = detectPattern(cards);
        if (pattern && (!target || canBeat(pattern, target))) bombs.push({ cards, pattern });
      }
    }
    bombs.sort((a, b) => a.pattern.mainValue - b.pattern.mainValue);
    out.push(...bombs);

    if (groups.has(16 as CardValue) && groups.has(17 as CardValue)) {
      const rocket = [...take(groups, 16 as CardValue, 1), ...take(groups, 17 as CardValue, 1)];
      const pattern = detectPattern(rocket);
      if (pattern && (!target || canBeat(pattern, target))) out.push({ cards: rocket, pattern });
    }
  }

  // 去重（同样的 id 集合）
  const seen = new Set<string>();
  const unique = out.filter(c => {
    const key = c.cards.map(x => x.id).sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 排序：非炸弹在前；同张数优先「不拆结构」（不拆对子/三张），再按主值升序；
  // 炸弹按大小，王炸垫底
  const isBomb = (c: Candidate) => c.pattern.type === 'bomb' || c.pattern.type === 'rocket';
  // 拆结构代价：候选中「用了但没用完」的牌值组数（单张从对子里抽 = 拆对子）
  const breakCost = (c: Candidate) => {
    const used = new Map<CardValue, number>();
    for (const card of c.cards) used.set(card.value, (used.get(card.value) ?? 0) + 1);
    let cost = 0;
    for (const [v, n] of used) {
      const total = groups.get(v)?.length ?? n;
      if (n < total) cost++;
    }
    return cost;
  };
  unique.sort((a, b) => {
    const ab = isBomb(a), bb = isBomb(b);
    if (ab !== bb) return ab ? 1 : -1;
    if (a.cards.length !== b.cards.length) return a.cards.length - b.cards.length;
    const ac = breakCost(a), bc = breakCost(b);
    if (ac !== bc) return ac - bc;
    return a.pattern.mainValue - b.pattern.mainValue;
  });

  return unique;
}

/** 找一手能压过 target 的最小出牌；找不到返回 null */
export function findMinBeat(hand: Card[], target: CardPattern | null): Card[] | null {
  const cands = generateCandidates(hand, target);
  return cands.length > 0 ? cands[0].cards : null;
}
