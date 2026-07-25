// ============================================================
// 发牌过场动画：牌从中央牌堆轮流飞向三家
// ============================================================

import { useEffect, useState } from 'react';

const DIRECTIONS = ['anim-deal-bottom', 'anim-deal-right', 'anim-deal-left'] as const;
const CARD_COUNT = 15; // 视觉上一个牌叠即可，不用真发 51 张

export function DealOverlay({ animKey }: { animKey: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (animKey === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(t);
  }, [animKey]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" key={animKey}>
      {Array.from({ length: CARD_COUNT }).map((_, i) => (
        <div
          key={i}
          className={`absolute w-10 h-14 rounded border border-blue-400/70 bg-gradient-to-br from-blue-600 to-indigo-800 shadow-lg ${DIRECTIONS[i % 3]}`}
          style={{
            left: '50%',
            top: '42%',
            animationDelay: `${i * 55}ms`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}
