// ============================================================
// 节日夜空背景：星空 / 烟花 / 灯笼 / 地平线暖光 / 金边牌桌
// 纯 CSS 装饰，无任何图片资源
// ============================================================

const STARS: [number, number][] = [
  [6, 8], [14, 18], [22, 6], [31, 14], [40, 5], [47, 16],
  [55, 8], [63, 15], [71, 5], [79, 17], [87, 9], [94, 14],
  [10, 28], [36, 24], [58, 26], [83, 27],
];

export function FestivalBackdrop({ rim = false }: { rim?: boolean }) {
  return (
    <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
      {/* 夜空 → 晚霞 → 牌桌绿 渐变 */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#101f4b_0%,#1d3a8f_30%,#4a5aa8_52%,#9c6b30_72%,#0b4a35_92%,#063b2a_100%)]" />

      {/* 星星 */}
      {STARS.map(([x, y], i) => (
        <span
          key={i}
          className="absolute text-yellow-100 animate-twinkle select-none"
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i * 0.37) % 2.4}s`, fontSize: `${9 + (i % 3) * 4}px` }}
        >
          ✦
        </span>
      ))}

      {/* 烟花 */}
      <span className="absolute left-[13%] top-[9%] text-4xl animate-firework select-none">🎆</span>
      <span
        className="absolute right-[12%] top-[5%] text-5xl animate-firework select-none"
        style={{ animationDelay: '1.4s' }}
      >
        🎇
      </span>
      <span
        className="absolute left-[46%] top-[3%] text-3xl animate-firework select-none"
        style={{ animationDelay: '2.5s' }}
      >
        ✨
      </span>

      {/* 红灯笼 */}
      <span className="absolute left-[2.5%] top-0 text-5xl animate-sway select-none drop-shadow-[0_0_14px_rgba(239,68,68,0.55)]">🏮</span>
      <span
        className="absolute right-[2.5%] top-0 text-5xl animate-sway select-none drop-shadow-[0_0_14px_rgba(239,68,68,0.55)]"
        style={{ animationDelay: '0.9s' }}
      >
        🏮
      </span>

      {/* 地平线暖光 */}
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-[radial-gradient(ellipse_60%_55%_at_50%_88%,rgba(251,191,36,0.22),transparent_70%)]" />

      {/* 金边牌桌椭圆 */}
      {rim && (
        <div
          className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 w-[74%] h-[54%] rounded-[50%]
            border-[7px] border-amber-500/75
            bg-[radial-gradient(ellipse_at_center,rgba(16,120,78,0.55),rgba(6,60,42,0.55))]
            shadow-[0_0_70px_rgba(251,191,36,0.28),inset_0_0_90px_rgba(0,0,0,0.4)]"
        />
      )}
    </div>
  );
}
