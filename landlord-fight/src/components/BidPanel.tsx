// ============================================================
// 叫分面板（满意斗地主风格）
// ============================================================

import { Button } from '@/components/ui/button';
import type { BidAction } from '@/types/game';
import { sfxClick } from '@/lib/sound';

interface BidPanelProps {
  currentBid: number;
  onBid: (bid: BidAction) => void;
  disabled?: boolean;
}

export function BidPanel({ currentBid, onBid, disabled }: BidPanelProps) {
  return (
    <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
      <div className="text-white/70 text-sm">
        当前最高: {currentBid > 0 ? <span className="text-yellow-300 font-bold">{currentBid} 分</span> : '无人叫分'}
      </div>
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="bg-transparent border-white/40 text-white hover:bg-white/10 px-7 py-6 text-base rounded-xl"
          onClick={() => { sfxClick(); onBid(0); }}
          disabled={disabled}
        >
          不叫
        </Button>
        {[1, 2, 3].map(b => (
          <Button
            key={b}
            variant="outline"
            className={`
              px-7 py-6 text-base rounded-xl font-bold
              ${b <= currentBid ? 'opacity-40 cursor-not-allowed bg-transparent border-white/20 text-white/60' : ''}
              ${b === 3 && b > currentBid
                ? 'bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-400 hover:to-amber-600 text-amber-950 border-amber-300 shadow-lg shadow-amber-500/30'
                : b > currentBid
                  ? 'bg-transparent border-yellow-400/60 text-yellow-300 hover:bg-yellow-500/20'
                  : 'bg-transparent border-white/20'}
            `}
            onClick={() => { sfxClick(); onBid(b as BidAction); }}
            disabled={disabled || b <= currentBid}
          >
            {b} 分
          </Button>
        ))}
      </div>
    </div>
  );
}
