// ============================================================
// 倒计时闹钟（满意斗地主经典 ⏰）
// ============================================================

interface CountdownRingProps {
  seconds: number;
  total: number;
  size?: number;
}

export function CountdownRing({ seconds, total, size = 44 }: CountdownRingProps) {
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = Math.max(0, seconds / total);
  const danger = seconds <= 5;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.15)" strokeWidth={3} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={danger ? '#ef4444' : '#facc15'}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <span
        className={`absolute font-bold tabular-nums ${danger ? 'animate-timer-danger' : 'text-white'}`}
        style={{ fontSize: size * 0.38 }}
      >
        {seconds}
      </span>
    </div>
  );
}
