// ============================================================
// 单个座位的出牌区：展示该玩家最近一手牌 或「不出」气泡
// ============================================================

import type { PlayAction } from '@/types/game';
import { CardSprite } from './CardSprite';

interface SeatPlayAreaProps {
  play: PlayAction | null;
  direction: 'left' | 'right' | 'bottom';
  align?: 'start' | 'center' | 'end';
}

const DIR_ANIM = {
  left: 'animate-fly-left',
  right: 'animate-fly-right',
  bottom: 'animate-fly-bottom',
};

export function SeatPlayArea({ play, direction, align = 'center' }: SeatPlayAreaProps) {
  const justify = align === 'start' ? 'justify-start' : align === 'end' ? 'justify-end' : 'justify-center';

  // 底部出牌区：牌贴容器顶部，避免被下方手牌（选中时上浮）遮挡
  const vertical = direction === 'bottom' ? 'items-start' : 'items-center';

  return (
    <div className={`flex ${vertical} ${justify} min-h-[5.5rem] w-full`}>
      {!play ? null : play.pattern === null ? (
        // 「不出」气泡
        <div className="animate-bubble px-4 py-1.5 rounded-full bg-slate-700/90 border border-white/20 text-white/90 text-sm font-bold shadow-lg">
          不出
        </div>
      ) : (
        <div key={play.pattern.cards.map(c => c.id).join('|')} className={`flex items-center ${DIR_ANIM[direction]}`}>
          {play.pattern.cards.map((card, i) => (
            <div key={card.id} style={{ marginLeft: i === 0 ? 0 : -14 }}>
              <CardSprite card={card} small />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
