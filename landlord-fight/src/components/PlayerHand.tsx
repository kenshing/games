// ============================================================
// 底部玩家手牌（点击 + 滑牌选择）
// ============================================================

import { useMemo, useRef, type PointerEvent } from 'react';
import type { Card } from '@/types/game';
import { CardSprite } from './CardSprite';
import { sfxSelect } from '@/lib/sound';

interface PlayerHandProps {
  hand: Card[];
  selected: Card[];
  disabled?: boolean;
  onToggleCard: (card: Card) => void;
  onRangeSelect: (cards: Card[]) => void;
}

export function PlayerHand({ hand, selected, disabled, onToggleCard, onRangeSelect }: PlayerHandProps) {
  const selectedIds = useMemo(() => new Set(selected.map(c => c.id)), [selected]);
  const dragStart = useRef<number | null>(null);
  const startX = useRef(0);
  const didDrag = useRef(false);

  // 横向拖动超过该阈值才算「滑牌」，否则视为单击（防手抖误触）
  const DRAG_THRESHOLD = 10;

  const handlePointerDown = (index: number, e: PointerEvent) => {
    if (disabled) return;
    dragStart.current = index;
    startX.current = e.clientX;
    didDrag.current = false;
  };

  const handlePointerEnter = (index: number, e: PointerEvent) => {
    if (disabled || dragStart.current === null) return;
    if (index === dragStart.current && !didDrag.current) return;
    // 手牌重叠度高，单击时几像素的抖动不该触发范围重选
    if (Math.abs(e.clientX - startX.current) < DRAG_THRESHOLD) return;
    didDrag.current = true;
    const [a, b] = [Math.min(dragStart.current, index), Math.max(dragStart.current, index)];
    onRangeSelect(hand.slice(a, b + 1));
    sfxSelect();
  };

  const handlePointerUp = (index: number) => {
    if (disabled) return;
    // 只有按下和松手在同一张牌上才算单击；拖到邻牌松手不误触
    if (dragStart.current === index && !didDrag.current) {
      onToggleCard(hand[index]);
      sfxSelect();
    }
    dragStart.current = null;
    didDrag.current = false;
  };

  const handlePointerLeave = () => {
    dragStart.current = null;
    didDrag.current = false;
  };

  return (
    <div
      className="flex items-end justify-center px-4 pb-1 select-none touch-none"
      onPointerLeave={handlePointerLeave}
    >
      {hand.map((card, i) => {
        const isSelected = selectedIds.has(card.id);
        // 动态重叠：牌越多叠得越紧
        const overlap = hand.length > 15 ? -34 : hand.length > 12 ? -28 : hand.length > 8 ? -20 : -10;
        return (
          <div
            key={card.id}
            style={{ marginLeft: i === 0 ? 0 : overlap }}
            className="transition-transform"
            onPointerDown={(e) => handlePointerDown(i, e)}
            onPointerEnter={(e) => handlePointerEnter(i, e)}
            onPointerUp={() => handlePointerUp(i)}
          >
            <CardSprite
              card={card}
              selected={isSelected}
              disabled={disabled}
            />
          </div>
        );
      })}
    </div>
  );
}
