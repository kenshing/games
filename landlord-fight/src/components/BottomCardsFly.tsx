// ============================================================
// 底牌过场动画：三张底牌从顶部飞向地主
// ============================================================

import { useEffect, useState } from 'react';
import type { Card } from '@/types/game';
import { CardSprite } from './CardSprite';

interface BottomCardsFlyProps {
  animKey: number;
  cards: Card[];
  target: 'bottom' | 'left' | 'right';
}

const TARGET_OFFSET: Record<BottomCardsFlyProps['target'], string> = {
  bottom: '72vh',
  left: '16vh',
  right: '16vh',
};

export function BottomCardsFly({ animKey, cards, target }: BottomCardsFlyProps) {
  const [phase, setPhase] = useState<'idle' | 'start' | 'fly'>('idle');

  useEffect(() => {
    if (animKey === 0) return;
    setPhase('start');
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('fly')));
    const t = setTimeout(() => setPhase('idle'), 1200);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [animKey]);

  if (phase === 'idle') return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {cards.map((card, i) => {
        const baseX = (i - 1) * 48;
        let transform = `translate(calc(-50% + ${baseX}px), 0) scale(1)`;
        let opacity = 1;
        if (phase === 'fly') {
          const y = TARGET_OFFSET[target];
          if (target === 'bottom') {
            transform = `translate(calc(-50% + ${baseX * 1.4}px), ${y}) scale(1.15)`;
          } else {
            const xSign = target === 'left' ? -1 : 1;
            transform = `translate(calc(-50% + ${xSign} * 36vw + ${baseX * 0.5}px), ${y}) scale(0.85)`;
          }
          opacity = 0;
        }
        return (
          <div
            key={card.id}
            className="bottom-fly absolute"
            style={{ left: '50%', top: 44, transform, opacity }}
          >
            <CardSprite card={card} small />
          </div>
        );
      })}
    </div>
  );
}
