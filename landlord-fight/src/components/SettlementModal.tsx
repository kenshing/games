// ============================================================
// 结算弹窗：胜负 + 倍数明细 + 积分变化（欢乐斗地主风格）
// ============================================================

import type { RoundResult, Player, Seat } from '@/types/game';
import { Button } from '@/components/ui/button';

interface SettlementModalProps {
  result: RoundResult;
  players: Player[];
  mySeat: Seat;
  isOnline: boolean;
  onRestart: () => void;
  onBackToMenu: () => void;
}

export function SettlementModal({ result, players, mySeat, isOnline, onRestart, onBackToMenu }: SettlementModalProps) {
  const myRole = players[mySeat].role;
  const iWon = myRole === result.winnerRole;
  const myDelta = result.scoreDelta[mySeat];

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-[26rem] max-w-[92vw] rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-90 duration-300">
        {/* 头部 */}
        <div
          className={`py-6 text-center ${
            iWon
              ? 'bg-gradient-to-b from-amber-300 to-amber-500'
              : 'bg-gradient-to-b from-slate-500 to-slate-700'
          }`}
        >
          <div className="text-5xl mb-1">{iWon ? '🏆' : '😢'}</div>
          <div className={`text-3xl font-black tracking-widest ${iWon ? 'text-yellow-900' : 'text-white'}`}>
            {iWon ? '胜 利' : '失 败'}
          </div>
          <div className={`text-sm mt-1 ${iWon ? 'text-yellow-900/70' : 'text-white/70'}`}>
            {result.winnerRole === 'landlord' ? '地主获胜' : '农民获胜'}
            {result.spring === 'spring' && ' · 春天！🌸'}
            {result.spring === 'reverse' && ' · 反春！🌸'}
          </div>
        </div>

        {/* 倍数明细 */}
        <div className="bg-emerald-950/95 px-6 py-4 text-sm">
          <div className="flex justify-between text-white/70 py-1">
            <span>底分</span><span className="text-white font-medium">{result.base}</span>
          </div>
          <div className="flex justify-between text-white/70 py-1">
            <span>叫分</span><span className="text-yellow-300 font-medium">× {result.bidValue}</span>
          </div>
          {result.bombCount > 0 && (
            <div className="flex justify-between text-white/70 py-1">
              <span>炸弹 × {result.bombCount}</span>
              <span className="text-orange-400 font-medium">× {Math.pow(2, result.bombCount)}</span>
            </div>
          )}
          {result.spring && (
            <div className="flex justify-between text-white/70 py-1">
              <span>{result.spring === 'spring' ? '春天' : '反春'}</span>
              <span className="text-pink-300 font-medium">× 2</span>
            </div>
          )}
          <div className="border-t border-white/10 mt-2 pt-2 flex justify-between">
            <span className="text-white font-bold">总倍数</span>
            <span className="text-yellow-300 font-black text-lg">× {result.multiplier}</span>
          </div>
        </div>

        {/* 积分变化 */}
        <div className="bg-emerald-900/95 px-6 py-3">
          {players.map((p, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <span className={`text-sm ${i === mySeat ? 'text-yellow-300 font-bold' : 'text-white/80'}`}>
                {p.name}{i === mySeat && '（我）'}
                <span className="text-xs text-white/40 ml-1">
                  {p.role === 'landlord' ? '地主' : '农民'}
                </span>
              </span>
              <span className={`font-mono font-bold ${result.scoreDelta[i] >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {result.scoreDelta[i] >= 0 ? '+' : ''}{result.scoreDelta[i]}
              </span>
            </div>
          ))}
        </div>

        {/* 操作 */}
        <div className="bg-emerald-950/95 px-6 py-4 flex gap-3">
          {!isOnline && (
            <Button
              className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-bold text-lg py-6"
              onClick={onRestart}
            >
              🔄 再来一局
            </Button>
          )}
          <Button
            variant="outline"
            className={`${isOnline ? 'flex-1' : ''} bg-transparent border-white/30 text-white hover:bg-white/10 py-6`}
            onClick={onBackToMenu}
          >
            返回大厅
          </Button>
        </div>

        <div className={`text-center pb-3 text-lg font-black ${myDelta >= 0 ? 'text-green-400' : 'text-red-400'} bg-emerald-950/95`}>
          本局 {myDelta >= 0 ? '赢' : '输'} {Math.abs(myDelta)} 分
        </div>
      </div>
    </div>
  );
}
