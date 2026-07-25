// ============================================================
// 记牌器：显示每个点数剩余未见的牌数
// ============================================================

import { useMemo } from 'react';
import type { Card, PlayAction } from '@/types/game';

interface CardCounterProps {
  myHand: Card[];
  history: PlayAction[];
}

const DISPLAY_ORDER: { value: number; label: string }[] = [
  { value: 17, label: '大王' },
  { value: 16, label: '小王' },
  { value: 15, label: '2' },
  { value: 14, label: 'A' },
  { value: 13, label: 'K' },
  { value: 12, label: 'Q' },
  { value: 11, label: 'J' },
  { value: 10, label: '10' },
  { value: 9, label: '9' },
  { value: 8, label: '8' },
  { value: 7, label: '7' },
  { value: 6, label: '6' },
  { value: 5, label: '5' },
  { value: 4, label: '4' },
  { value: 3, label: '3' },
];

export function CardCounter({ myHand, history }: CardCounterProps) {
  const remaining = useMemo(() => {
    const counts = new Map<number, number>();
    for (const d of DISPLAY_ORDER) counts.set(d.value, d.value >= 16 ? 1 : 4);
    // 减去我手里的
    for (const c of myHand) counts.set(c.value, (counts.get(c.value) ?? 0) - 1);
    // 减去已打出的
    for (const action of history) {
      if (!action.pattern) continue;
      for (const c of action.pattern.cards) {
        counts.set(c.value, (counts.get(c.value) ?? 0) - 1);
      }
    }
    return counts;
  }, [myHand, history]);

  return (
    <div className="flex items-center justify-center gap-[3px] px-2 py-1 bg-black/30 rounded-lg mx-auto w-fit">
      {DISPLAY_ORDER.map(({ value, label }) => {
        const left = remaining.get(value) ?? 0;
        return (
          <div
            key={value}
            className={`flex flex-col items-center w-7 leading-tight ${
              left === 0 ? 'opacity-25' : ''
            }`}
          >
            <span className={`text-[11px] font-bold ${value >= 16 ? 'text-red-400' : 'text-white/85'}`}>
              {label}
            </span>
            <span className={`text-[11px] font-mono ${left === 0 ? 'text-white/40 line-through' : 'text-yellow-300'}`}>
              {left}
            </span>
          </div>
        );
      })}
    </div>
  );
}
