// ============================================================
// 斗地主 - 核心牌型引擎
// ============================================================

import type { Card, CardValue, CardSuit, CardPattern } from '@/types/game';

// ---- 牌面显示映射 ----
export const VALUE_DISPLAY: Record<number, string> = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2',
  16: '🃏', 17: '🃏',
};

export const VALUE_NAME: Record<number, string> = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2',
  16: '小王', 17: '大王',
};

// ---- 创建一副牌 ----
export function createDeck(): Card[] {
  const suits: CardSuit[] = ['♠', '♥', '♣', '♦'];
  const values: CardValue[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const value of values) {
      deck.push({ value, suit, id: `${suit}${value}` });
    }
  }

  deck.push({ value: 16, suit: 'joker', id: 'joker-black' });
  deck.push({ value: 17, suit: 'joker', id: 'joker-red' });
  return deck;
}

// ---- 洗牌 ----
export function shuffle(deck: Card[]): Card[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- 发牌 ----
export function dealCards(deck: Card[]): { hands: [Card[], Card[], Card[]]; bottom: Card[] } {
  const hands: [Card[], Card[], Card[]] = [[], [], []];
  for (let i = 0; i < 51; i++) hands[i % 3].push(deck[i]);
  return { hands, bottom: deck.slice(51) };
}

// ---- 排序手牌（降序） ----
export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => b.value - a.value);
}

// ---- 统计牌值出现次数 ----
function countValues(cards: Card[]): Map<CardValue, number> {
  const map = new Map<CardValue, number>();
  for (const c of cards) map.set(c.value, (map.get(c.value) ?? 0) + 1);
  return map;
}

// ---- 获取指定次数的牌值列表 ----
function valuesByCount(countMap: Map<CardValue, number>, count: number): CardValue[] {
  return Array.from(countMap.entries())
    .filter(([, c]) => c === count)
    .map(([v]) => v)
    .sort((a, b) => b - a);
}

// ---- 判断是否为连续序列 ----
function isConsecutive(values: CardValue[], minLen: number): boolean {
  if (values.length < minLen) return false;
  if (values.some(v => v > 14)) return false; // 2和王不能参与
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] - values[i] !== 1) return false;
  }
  return true;
}

// ---- 核心：牌型判断 ----
export function detectPattern(cards: Card[]): CardPattern | null {
  if (cards.length === 0) return null;
  const n = cards.length;
  const countMap = countValues(cards);
  const counts = Array.from(countMap.values());
  const sortedValues = Array.from(countMap.keys()).sort((a, b) => b - a);

  // 王炸
  if (n === 2 && cards.some(c => c.value === 16) && cards.some(c => c.value === 17)) {
    return { type: 'rocket', mainValue: 17, cards };
  }

  // 炸弹
  if (n === 4 && counts[0] === 4) {
    return { type: 'bomb', mainValue: sortedValues[0], cards };
  }

  // 单张
  if (n === 1) return { type: 'single', mainValue: cards[0].value, cards };

  // 对子
  if (n === 2 && counts[0] === 2) return { type: 'pair', mainValue: sortedValues[0], cards };

  // 三张
  if (n === 3 && counts[0] === 3) return { type: 'triple', mainValue: sortedValues[0], cards };

  // 三带一
  if (n === 4 && counts.includes(3) && counts.includes(1)) {
    return { type: 'triple_single', mainValue: valuesByCount(countMap, 3)[0], cards };
  }

  // 三带二
  if (n === 5 && counts.includes(3) && counts.includes(2)) {
    return { type: 'triple_pair', mainValue: valuesByCount(countMap, 3)[0], cards };
  }

  // 顺子
  if (n >= 5 && counts.every(c => c === 1) && isConsecutive(sortedValues, 5)) {
    return { type: 'straight', mainValue: sortedValues[0], cards, length: n };
  }

  // 连对
  if (n >= 6 && n % 2 === 0 && counts.every(c => c === 2)) {
    const vals = valuesByCount(countMap, 2);
    if (isConsecutive(vals, 3)) return { type: 'straight_pair', mainValue: vals[0], cards, length: n / 2 };
  }

  // 飞机
  const triples = valuesByCount(countMap, 3);
  if (triples.length >= 2) {
    const consecutiveTriples: CardValue[] = [];
    for (let i = 0; i < triples.length; i++) {
      if (i === 0 || triples[i - 1] - triples[i] === 1) consecutiveTriples.push(triples[i]);
      else break;
    }
    if (consecutiveTriples.length >= 2 && isConsecutive(consecutiveTriples, 2)) {
      const planeLen = consecutiveTriples.length;
      const extraCards = n - planeLen * 3;

      if (extraCards === 0) {
        return { type: 'plane', mainValue: consecutiveTriples[0], cards, length: planeLen };
      }

      if (extraCards === planeLen) {
        const nonTripleCount = Array.from(countMap.entries())
          .filter(([v]) => !consecutiveTriples.includes(v))
          .reduce((sum, [, c]) => sum + c, 0);
        if (nonTripleCount === planeLen) {
          return { type: 'plane_single', mainValue: consecutiveTriples[0], cards, length: planeLen };
        }
      }

      if (extraCards === planeLen * 2) {
        const pairCount = valuesByCount(countMap, 2).length + valuesByCount(countMap, 4).length * 2;
        if (pairCount >= planeLen) {
          return { type: 'plane_pair', mainValue: consecutiveTriples[0], cards, length: planeLen };
        }
      }
    }
  }

  // 四带二
  if (counts.includes(4)) {
    const quadValue = valuesByCount(countMap, 4)[0];
    const remaining = n - 4;
    if (remaining === 2 && counts.filter(c => c === 1).length === 2) {
      return { type: 'quad_single', mainValue: quadValue, cards };
    }
    if (remaining === 4 && (valuesByCount(countMap, 2).length >= 2 || valuesByCount(countMap, 4).length >= 1)) {
      return { type: 'quad_pair', mainValue: quadValue, cards };
    }
  }

  return null;
}

// ---- 牌型大小比较 ----
export function canBeat(pattern: CardPattern, target: CardPattern | null): boolean {
  if (!target) return true;

  const a = pattern;
  const b = target;

  if (a.type === 'rocket') return true;
  if (b.type === 'rocket') return false;

  if (a.type === 'bomb' && b.type !== 'bomb') return true;
  if (b.type === 'bomb' && a.type !== 'bomb') return false;

  if (a.type !== b.type) return false;
  if ((a.length ?? 1) !== (b.length ?? 1)) return false;

  return a.mainValue > b.mainValue;
}

// ---- 获取牌面显示文本 ----
export function getCardDisplay(card: Card): string {
  if (card.suit === 'joker') return '🃏';
  return `${card.suit}${VALUE_DISPLAY[card.value]}`;
}
