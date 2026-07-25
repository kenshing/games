// ============================================================
// 牌型横幅特效：顺子 / 连对 / 飞机 / 炸弹 / 王炸 中央大字
// ============================================================

export interface BannerEvent {
  key: number;
  text: string;
  kind: 'normal' | 'bomb' | 'rocket' | 'plane';
}

const KIND_STYLE: Record<BannerEvent['kind'], string> = {
  normal: 'text-yellow-300 drop-shadow-[0_0_18px_rgba(250,204,21,0.8)]',
  plane: 'text-sky-300 drop-shadow-[0_0_18px_rgba(125,211,252,0.9)]',
  bomb: 'text-orange-400 drop-shadow-[0_0_22px_rgba(251,146,60,0.95)]',
  rocket: 'text-red-400 drop-shadow-[0_0_26px_rgba(248,113,113,1)]',
};

const KIND_EMOJI: Record<BannerEvent['kind'], string> = {
  normal: '',
  plane: '✈️ ',
  bomb: '💥 ',
  rocket: '🚀 ',
};

export function PatternBanner({ banner }: { banner: BannerEvent | null }) {
  if (!banner) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-30">
      <div
        key={banner.key}
        className={`animate-banner text-6xl md:text-7xl font-black tracking-widest ${KIND_STYLE[banner.kind]}`}
        style={{ WebkitTextStroke: '1px rgba(0,0,0,0.35)' }}
      >
        {KIND_EMOJI[banner.kind]}{banner.text}
      </div>
    </div>
  );
}
