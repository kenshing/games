// ============================================================
// 游戏控制按钮（出牌/不出/提示）欢乐斗地主风格大按钮
// ============================================================

import { Button } from '@/components/ui/button';
import { sfxClick } from '@/lib/sound';

interface GameControlsProps {
  canPlay: boolean;
  canPass: boolean;
  hintCount: number;
  onPlay: () => void;
  onPass: () => void;
  onHint: () => void;
  disabled?: boolean;
}

export function GameControls({ canPlay, canPass, hintCount, onPlay, onPass, onHint, disabled }: GameControlsProps) {
  return (
    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <Button
        variant="outline"
        className="bg-transparent border-white/40 text-white hover:bg-white/10 px-5 py-6 text-base rounded-xl"
        onClick={() => { sfxClick(); onHint(); }}
        disabled={disabled}
      >
        💡 提示{hintCount > 1 ? `(${hintCount})` : ''}
      </Button>
      {canPass && (
        <Button
          variant="outline"
          className="bg-transparent border-red-400/60 text-red-300 hover:bg-red-500/20 px-7 py-6 text-base rounded-xl font-bold"
          onClick={() => { sfxClick(); onPass(); }}
          disabled={disabled}
        >
          不出
        </Button>
      )}
      <Button
        variant="default"
        className="bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-400 hover:to-amber-600 text-amber-950 font-black px-10 py-6 text-lg rounded-xl shadow-lg shadow-amber-500/30"
        onClick={() => { sfxClick(); onPlay(); }}
        disabled={disabled || !canPlay}
      >
        出牌
      </Button>
    </div>
  );
}
