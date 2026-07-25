// ============================================================
// 单张扑克牌组件
// ============================================================

import { memo } from 'react';
import type { Card } from '@/types/game';
import { VALUE_DISPLAY } from '@/lib/cards';

interface CardSpriteProps {
  card: Card;
  selected?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  small?: boolean;
  onClick?: () => void;
}

function CardSpriteInner({ card, selected, disabled, hidden, small, onClick }: CardSpriteProps) {
  if (hidden) {
    return (
      <div
        className={`
          relative rounded-lg border-2 border-slate-600
          bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900
          flex items-center justify-center select-none
          shadow-md
          ${small ? 'w-10 h-14 text-xs' : 'w-16 h-22 md:w-18 md:h-24 text-base'}
        `}
      >
        <div className="absolute inset-1 rounded border border-blue-500/30" />
        <div className="absolute inset-2 rounded border border-blue-400/20" />
        <span className="text-white/20 text-2xl">🃏</span>
      </div>
    );
  }

  const isRed = card.suit === '♥' || card.suit === '♦';
  const isJoker = card.suit === 'joker';
  const colorClass = isJoker ? 'text-yellow-500' : isRed ? 'text-red-500' : 'text-slate-800';

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`
        relative rounded-lg border bg-white select-none cursor-pointer
        transition-all duration-150 ease-out
        ${selected ? '-translate-y-4 shadow-xl ring-2 ring-yellow-400 z-10' : 'hover:-translate-y-1 shadow-md'}
        ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
        ${small ? 'w-10 h-14 text-xs' : 'w-14 h-20 md:w-16 md:h-22 text-sm md:text-base'}
      `}
    >
      {/* 左上角 */}
      <div className={`absolute top-0.5 left-1 font-bold leading-none ${colorClass}`}>
        <div>{isJoker ? (card.value === 16 ? '小' : '大') : VALUE_DISPLAY[card.value]}</div>
        {!isJoker && <div className="text-xs">{card.suit}</div>}
      </div>

      {/* 中心图案 */}
      <div className={`absolute inset-0 flex items-center justify-center ${colorClass}`}>
        {isJoker ? (
          <span className="text-xl md:text-2xl">🃏</span>
        ) : (
          <span className="text-2xl md:text-3xl">{card.suit}</span>
        )}
      </div>

      {/* 右下角（倒置） */}
      <div className={`absolute bottom-0.5 right-1 font-bold leading-none rotate-180 ${colorClass}`}>
        <div>{isJoker ? (card.value === 16 ? '小' : '大') : VALUE_DISPLAY[card.value]}</div>
        {!isJoker && <div className="text-xs">{card.suit}</div>}
      </div>
    </div>
  );
}

export const CardSprite = memo(CardSpriteInner);
