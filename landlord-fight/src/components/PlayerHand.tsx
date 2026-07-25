// ============================================================
// 底部玩家手牌（点击 + 滑牌选择）
// ============================================================

import { useMemo, useRef } from 'react';
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
  const didDrag = useRef(false);

  const handlePointerDown = (index: number) => {
    if (disabled) return;
    dragStart.current = index;
    didDrag.current = false;
  };

  const handlePointerEnter = (index: number) => {
    if (disabled || dragStart.current === null) return;
    if (index === dragStart.current && !didDrag.current) return;
    didDrag.current = true;
    const [a, b] = [Math.min(dragStart.current, index), Math.max(dragStart.current, index)];
    onRangeSelect(hand.slice(a, b + 1));
    sfxSelect();
  };

  const handlePointerUp = (index: number) => {
    if (disabled) return;
    if (dragStart.current !== null && !didDrag.current) {
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
            onPointerDown={() => handlePointerDown(i)}
            onPointerEnter={() => handlePointerEnter(i)}
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
