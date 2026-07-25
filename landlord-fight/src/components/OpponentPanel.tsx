// ============================================================
// 对手面板：头像 + 身份 + 剩余牌 + 倒计时 + 背面牌堆
// ============================================================

import type { Role } from '@/types/game';
import { CountdownRing } from './CountdownRing';

interface OpponentPanelProps {
  name: string;
  avatar: string;
  role: Role | null;
  cardCount: number;
  isActive: boolean;
  secondsLeft?: number;
  side: 'left' | 'right';
}

export function OpponentPanel({ name, avatar, role, cardCount, isActive, secondsLeft, side }: OpponentPanelProps) {
  return (
    <div className={`flex flex-col gap-2 ${side === 'left' ? 'items-start' : 'items-end'}`}>
      <div className={`flex items-center gap-2 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
        {/* 头像 */}
        <div className="relative">
          <div
            className={`
              w-14 h-14 rounded-full flex items-center justify-center text-3xl
              border-2 select-none
              ${role === 'landlord'
                ? 'bg-gradient-to-br from-amber-200 to-amber-500 border-yellow-300'
                : 'bg-gradient-to-br from-sky-200 to-sky-500 border-sky-300'}
              ${isActive ? 'animate-turn-glow' : ''}
            `}
          >
            {avatar}
          </div>
          {role === 'landlord' && (
            <span className="absolute -top-2 -right-1 text-lg drop-shadow">👑</span>
          )}
          {/* 剩余牌数徽章 */}
          <span className="absolute -bottom-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow">
            {cardCount}
          </span>
        </div>

        {/* 名字 + 身份 */}
        <div className={`flex flex-col ${side === 'right' ? 'items-end' : 'items-start'}`}>
          <span className="text-white text-sm font-medium drop-shadow">{name}</span>
          {role && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                role === 'landlord' ? 'bg-yellow-400 text-yellow-950' : 'bg-emerald-400 text-emerald-950'
              }`}
            >
              {role === 'landlord' ? '地主' : '农民'}
            </span>
          )}
        </div>

        {/* 倒计时 */}
        {isActive && secondsLeft !== undefined && (
          <CountdownRing seconds={secondsLeft} total={15} size={40} />
        )}
      </div>

      {/* 背面牌堆（扇形少量展示 + 计数） */}
      <div className={`flex ${side === 'right' ? 'flex-row-reverse' : ''} pl-1`}>
        {Array.from({ length: Math.min(cardCount, 6) }).map((_, i) => (
          <div
            key={i}
            className="w-7 h-10 rounded border border-blue-400/60 bg-gradient-to-br from-blue-600 to-indigo-800 shadow-sm"
            style={{ marginLeft: i === 0 ? 0 : -18 }}
          />
        ))}
        {cardCount > 6 && (
          <span className="text-white/60 text-xs self-center ml-2">×{cardCount}</span>
        )}
      </div>
    </div>
  );
}
