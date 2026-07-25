// ============================================================
// 主游戏桌 - 满意斗地主体验版
// 整合：单机 + P2P 联机 / 语音音效 / 倒计时 / 倍数 / 特效
// ============================================================

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Card, GameState, Seat, BidAction } from '@/types/game';
import {
  createInitialState, startGame, bid, playCards, pass, settleRound,
  getHint, getHintCount, currentMultiplier,
} from '@/lib/game-state';
import { createDeck, shuffle, dealCards, sortHand } from '@/lib/cards';
import { generateCandidates } from '@/lib/plays';
import { aiBidDecision, aiPlayDecision } from '@/lib/ai';
import { P2PManager, type NetMessage } from '@/lib/p2p';
import {
  speak, voiceBid, voicePass, voicePattern, voiceLeftCards, voiceLandlord,
  sfxDeal, sfxPattern, sfxWin, sfxLose, sfxYourTurn, sfxTick,
  setSoundEnabled, setVoiceEnabled, setBgmEnabled, startBGM,
  QUICK_CHATS, CHAT_REPLIES,
} from '@/lib/sound';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardSprite } from './CardSprite';
import { PlayerHand } from './PlayerHand';
import { OpponentPanel } from './OpponentPanel';
import { SeatPlayArea } from './SeatPlayArea';
import { BidPanel } from './BidPanel';
import { GameControls } from './GameControls';
import { PatternBanner, type BannerEvent } from './PatternBanner';
import { SettlementModal } from './SettlementModal';
import { CardCounter } from './CardCounter';
import { CountdownRing } from './CountdownRing';
import { DealOverlay } from './DealOverlay';
import { BottomCardsFly } from './BottomCardsFly';
import { FestivalBackdrop } from './FestivalBackdrop';

type AppMode = 'menu' | 'offline' | 'online_lobby' | 'online_playing';

const AVATARS = ['🧑‍🌾', '👩‍🌾', '👲'];
const TURN_SECONDS = 60;

export function GameTable() {
  // ===== 全局状态 =====
  const [mode, setMode] = useState<AppMode>('menu');
  const [game, setGame] = useState<GameState>(createInitialState());
  const [selected, setSelected] = useState<Card[]>([]);
  const [message, setMessage] = useState<string>('');
  const [banner, setBanner] = useState<BannerEvent | null>(null);
  const [shake, setShake] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [bgmOn, setBgmOn] = useState(true);
  const [counterOn, setCounterOn] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(TURN_SECONDS);
  const [dealKey, setDealKey] = useState(0);
  const [bottomFlyKey, setBottomFlyKey] = useState(0);

  // 联机相关
  const p2pRef = useRef<P2PManager | null>(null);
  const [roomId, setRoomId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [myName, setMyName] = useState('');
  const [mySeat, setMySeat] = useState<Seat>(0);
  const [isHost, setIsHost] = useState(false);
  const [netStatus, setNetStatus] = useState('');
  const [connectedPlayers, setConnectedPlayers] = useState(1);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;

  // ===== 清理 =====
  useEffect(() => {
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      p2pRef.current?.destroy();
    };
  }, []);

  // ============================================================
  // 中央音效/语音/特效：跟随游戏状态变化（单机联机通吃）
  // ============================================================

  // 出牌 / 不出
  useEffect(() => {
    const lp = game.lastPlay;
    if (!lp || game.phase === 'idle') return;
    const name = game.players[lp.seat].name;
    if (lp.pattern) {
      sfxPattern(lp.pattern);
      voicePattern(lp.pattern);
      setMessage(`${name} 出了「${getPatternName(lp.pattern)}」`);
      const remaining = game.players[lp.seat].hand.length;
      if (remaining === 1 || remaining === 2) {
        setTimeout(() => voiceLeftCards(remaining), 900);
      }
      // 横幅特效
      const t = lp.pattern.type;
      if (t === 'rocket') {
        setBanner({ key: game.history.length, text: '王 炸', kind: 'rocket' });
        setShake(true);
      } else if (t === 'bomb') {
        setBanner({ key: game.history.length, text: '炸 弹', kind: 'bomb' });
        setShake(true);
      } else if (t === 'plane' || t === 'plane_single' || t === 'plane_pair') {
        setBanner({ key: game.history.length, text: '飞 机', kind: 'plane' });
      } else if (t === 'straight') {
        setBanner({ key: game.history.length, text: '顺 子', kind: 'normal' });
      } else if (t === 'straight_pair') {
        setBanner({ key: game.history.length, text: '连 对', kind: 'normal' });
      }
    } else if (game.phase === 'playing') {
      voicePass();
      setMessage(`${name} 不出`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.lastPlay, game.history.length]);

  // 阶段变化
  useEffect(() => {
    if (game.phase === 'bidding') {
      sfxDeal();
      setBanner(null);
    }
    if (game.phase === 'playing' && game.landlordSeat !== null) {
      const landlord = game.players[game.landlordSeat];
      voiceLandlord(landlord.name);
      setMessage(`地主是 ${landlord.name}，由地主先出`);
    }
    if (game.phase === 'gameover' && game.roundResult) {
      const myRole = game.players[mySeat].role;
      if (myRole === game.roundResult.winnerRole) {
        sfxWin();
        setTimeout(() => speak('胜利！'), 300);
      } else {
        sfxLose();
        setTimeout(() => speak('失败了'), 300);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase]);

  // 横幅/震动自动消退
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 1450);
    return () => clearTimeout(t);
  }, [banner]);
  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(false), 600);
    return () => clearTimeout(t);
  }, [shake]);

  // 发牌动画：每次开局（roundCount 变化）触发
  useEffect(() => {
    if (game.roundCount > 0 && game.phase !== 'idle') setDealKey(k => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.roundCount]);

  // 底牌飞给地主：叫分结束进入出牌阶段时触发
  const prevPhaseRef = useRef(game.phase);
  useEffect(() => {
    if (prevPhaseRef.current === 'bidding' && game.phase === 'playing') {
      setBottomFlyKey(k => k + 1);
    }
    prevPhaseRef.current = game.phase;
  }, [game.phase]);

  // ============================================================
  // 倒计时：每个行动回合 60 秒，超时自动托管
  // ============================================================
  const isMyAction =
    (game.phase === 'bidding' && game.bidTurn === mySeat) ||
    (game.phase === 'playing' && game.currentSeat === mySeat);

  const secondsRef = useRef(TURN_SECONDS);

  useEffect(() => {
    secondsRef.current = TURN_SECONDS;
    setSecondsLeft(TURN_SECONDS);
    setHintIndex(0);
  }, [game.phase, game.currentSeat, game.bidTurn]);

  // 轮到我时提示音
  useEffect(() => {
    if (isMyAction && game.phase !== 'idle') sfxYourTurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyAction]);

  const timeoutRef = useRef<() => void>(() => {});
  useEffect(() => {
    timeoutRef.current = () => {
      const g = gameRef.current;
      if (g.phase === 'bidding' && g.bidTurn === mySeat) {
        applyBidRef.current(0);
        return;
      }
      if (g.phase === 'playing' && g.currentSeat === mySeat) {
        const hand = g.players[mySeat].hand;
        const target = g.lastValidPlay?.pattern ?? null;
        const cands = generateCandidates(hand, target);
        if (target && cands.length === 0) {
          applyPassRef.current();
        } else if (cands.length > 0) {
          applyPlayRef.current(cands[0].cards);
        }
      }
    };
  });

  useEffect(() => {
    if (!isMyAction) return;
    const timer = setInterval(() => {
      const cur = secondsRef.current;
      if (cur <= 1) {
        clearInterval(timer);
        setSecondsLeft(0);
        timeoutRef.current();
        return;
      }
      if (cur <= 4) sfxTick();
      secondsRef.current = cur - 1;
      setSecondsLeft(cur - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isMyAction, game.phase, game.currentSeat, game.bidTurn]);

  // ============================================================
  // 联机消息处理
  // ============================================================
  const handleNetMessage = useCallback((msg: NetMessage) => {
    switch (msg.type) {
      case 'join_accept': {
        setMySeat(msg.seat);
        setConnectedPlayers(msg.count ?? msg.players.length);
        const names = msg.players.map(p => p.name);
        setGame(prev => ({
          ...prev,
          players: prev.players.map((p, i) => ({ ...p, name: names[i] ?? p.name })),
        }));
        setNetStatus(`已加入，座位 ${msg.seat}`);
        break;
      }
      case 'player_joined': {
        setConnectedPlayers(prev => msg.count ?? prev + 1);
        setGame(prev => ({
          ...prev,
          players: prev.players.map((p, i) =>
            i === msg.seat ? { ...p, name: msg.name } : p
          ),
        }));
        setNetStatus(`${msg.name} 加入了`);
        break;
      }
      case 'start_game': {
        setMode('online_playing');
        setMessage('请叫分...');
        break;
      }
      case 'deal': {
        setGame(prev => {
          // 所有客户端都持有三家手牌：出牌校验（playCards）需要完整手牌
          const players = prev.players.map((p, i) => ({
            ...p,
            name: msg.seatNames[i] ?? p.name,
            hand: msg.hands[i],
            role: null,
          }));
          return {
            ...createInitialState(),
            players,
            deck: msg.bottom,
            phase: 'bidding' as const,
            bidTurn: 0 as Seat,
            currentSeat: 0 as Seat,
            roundCount: prev.roundCount + 1,
            scores: [...prev.scores],
          };
        });
        setSelected([]);
        setMessage('请叫分...');
        break;
      }
      case 'bid': {
        setGame(prev => bid(prev, msg.seat, msg.action));
        break;
      }
      case 'play': {
        setGame(prev => playCards(prev, msg.seat, msg.cards));
        break;
      }
      case 'pass': {
        setGame(prev => pass(prev, msg.seat));
        break;
      }
      case 'chat': {
        setMessage(`💬 ${msg.from}: ${msg.text}`);
        speak(msg.text);
        break;
      }
    }
  }, [mySeat]);

  // ===== 创建房间 =====
  const handleCreateRoom = useCallback(async () => {
    if (!myName.trim()) { setNetStatus('请输入名字'); return; }
    startBGM();
    const p2p = new P2PManager();
    p2pRef.current = p2p;
    p2p.onMessage(handleNetMessage);
    try {
      const id = await p2p.hostRoom(setNetStatus);
      setRoomId(id);
      setIsHost(true);
      setMySeat(0);
      setMode('online_lobby');
      setConnectedPlayers(1);
      setGame(prev => ({
        ...prev,
        players: prev.players.map((p, i) =>
          i === 0 ? { ...p, name: myName } : p
        ),
      }));
    } catch {
      setNetStatus('创建房间失败');
    }
  }, [myName, handleNetMessage]);

  // ===== 加入房间 =====
  const handleJoinRoom = useCallback(async () => {
    if (!myName.trim()) { setNetStatus('请输入名字'); return; }
    if (!joinCode.trim()) { setNetStatus('请输入房间号'); return; }
    startBGM();
    const p2p = new P2PManager();
    p2pRef.current = p2p;
    p2p.onMessage(handleNetMessage);
    try {
      await p2p.joinRoom(joinCode, myName, setNetStatus);
      setRoomId(joinCode);
      setIsHost(false);
      setMode('online_lobby');
    } catch {
      setNetStatus('加入房间失败');
    }
  }, [myName, joinCode, handleNetMessage]);

  // ===== 开始联机游戏（房主调用）=====
  const handleStartOnline = useCallback(() => {
    if (connectedPlayers < 2) { setNetStatus('至少需要2人'); return; }
    const d = shuffle(createDeck());
    const { hands, bottom } = dealCards(d);
    const sortedHands = hands.map(sortHand);
    const names = game.players.map(p => p.name);

    p2pRef.current?.broadcast({ type: 'start_game' });
    p2pRef.current?.broadcast({
      type: 'deal',
      hands: sortedHands,
      bottom,
      seatNames: names,
    });

    setGame(prev => ({
      ...createInitialState(),
      players: prev.players.map((p, i) => ({
        ...p,
        hand: sortedHands[i],
        role: null,
      })),
      deck: bottom,
      phase: 'bidding',
      bidTurn: 0,
      currentSeat: 0,
      roundCount: prev.roundCount + 1,
      scores: [...prev.scores],
    }));
    setMode('online_playing');
    setSelected([]);
    setMessage('请叫分...');
  }, [connectedPlayers, game.players, mySeat]);

  // ============================================================
  // 统一操作入口（单机/联机分发）
  // ============================================================
  const isOnline = mode === 'online_playing';

  const applyBid = useCallback((action: BidAction) => {
    const seat = isOnline ? mySeat : 0;
    const prev = gameRef.current;
    const next = bid(prev, seat, action);
    if (next === prev) return;
    voiceBid(action);
    if (isOnline) p2pRef.current?.broadcast({ type: 'bid', seat, action });
    setGame(next);
  }, [isOnline, mySeat]);

  const applyPlay = useCallback((cards: Card[]) => {
    const seat = isOnline ? mySeat : 0;
    const prev = gameRef.current;
    const next = playCards(prev, seat, cards);
    if (next === prev) { setMessage('牌型无效或压不过上家'); return; }
    if (isOnline) p2pRef.current?.broadcast({ type: 'play', seat, cards });
    setSelected([]);
    setHintIndex(0);
    setGame(next);
  }, [isOnline, mySeat]);

  const applyPass = useCallback(() => {
    const seat = isOnline ? mySeat : 0;
    const prev = gameRef.current;
    const next = pass(prev, seat);
    if (next === prev) return;
    if (isOnline) p2pRef.current?.broadcast({ type: 'pass', seat });
    setSelected([]);
    setHintIndex(0);
    setGame(next);
  }, [isOnline, mySeat]);

  const applyBidRef = useRef(applyBid);
  const applyPlayRef = useRef(applyPlay);
  const applyPassRef = useRef(applyPass);
  applyBidRef.current = applyBid;
  applyPlayRef.current = applyPlay;
  applyPassRef.current = applyPass;

  const handlePlayClick = useCallback(() => {
    if (selected.length === 0) { setMessage('请先选择要出的牌'); return; }
    applyPlay(selected);
  }, [selected, applyPlay]);

  const handleHint = useCallback(() => {
    const hand = game.players[mySeat].hand;
    const target = game.lastValidPlay?.pattern ?? null;
    const count = getHintCount(hand, target);
    if (count === 0) { setMessage('没有能出的牌，点击「不出」'); return; }
    const hint = getHint(hand, target, hintIndex);
    setSelected(hint);
    setHintIndex(i => (i + 1) % count);
    setMessage(count > 1 ? `第 ${(hintIndex % count) + 1}/${count} 个推荐` : '已选推荐牌型');
  }, [game, mySeat, hintIndex]);

  const toggleCard = useCallback((card: Card) => {
    setSelected(prev => {
      const exists = prev.find(c => c.id === card.id);
      if (exists) return prev.filter(c => c.id !== card.id);
      return [...prev, card];
    });
  }, []);

  const rangeSelect = useCallback((cards: Card[]) => {
    setSelected(cards);
  }, []);

  // ===== 快捷聊天 =====
  const handleQuickChat = useCallback((text: string) => {
    setChatOpen(false);
    if (isOnline) {
      p2pRef.current?.broadcast({ type: 'chat', from: game.players[mySeat].name, text });
      setMessage(`💬 我: ${text}`);
    } else {
      speak(text);
      setMessage(`💬 我: ${text}`);
      // AI 随机回一句
      setTimeout(() => {
        const reply = CHAT_REPLIES[Math.floor(Math.random() * CHAT_REPLIES.length)];
        const aiName = gameRef.current.players[1 + Math.floor(Math.random() * 2)].name;
        setMessage(`💬 ${aiName}: ${reply}`);
        speak(reply);
      }, 1200 + Math.random() * 1500);
    }
  }, [isOnline, game.players, mySeat]);

  // ============================================================
  // 单机模式
  // ============================================================
  const handleStartOffline = useCallback(() => {
    startBGM();
    setGame(prev => startGame(prev));
    setSelected([]);
    setMessage('请叫分...');
    setMode('offline');
  }, []);

  const handleRestart = useCallback(() => {
    setGame(prev => startGame(prev));
    setSelected([]);
    setMessage('新一局开始！请叫分...');
  }, []);

  // ===== AI 自动行动（仅单机模式）=====
  useEffect(() => {
    if (mode !== 'offline') return;

    if (game.phase === 'bidding' && game.players[game.bidTurn].isAI) {
      aiTimerRef.current = setTimeout(() => {
        const prev = gameRef.current;
        if (prev.phase !== 'bidding' || !prev.players[prev.bidTurn].isAI) return;
        const aiSeat = prev.bidTurn;
        const decision = aiBidDecision(prev, aiSeat);
        const next = bid(prev, aiSeat, decision);
        if (next === prev) return;
        voiceBid(decision);
        setGame(next);
      }, 900 + Math.random() * 700);
    }

    if (game.phase === 'playing' && game.players[game.currentSeat].isAI) {
      aiTimerRef.current = setTimeout(() => {
        const prev = gameRef.current;
        if (prev.phase !== 'playing' || !prev.players[prev.currentSeat].isAI) return;
        const aiSeat = prev.currentSeat;
        const decision = aiPlayDecision(prev, aiSeat);
        const next = decision.length === 0
          ? pass(prev, aiSeat)
          : playCards(prev, aiSeat, decision);
        if (next === prev) return;
        setGame(next);
      }, 1000 + Math.random() * 800);
    }
  }, [mode, game.phase, game.bidTurn, game.currentSeat]);

  // ===== 本局结算（单机/联机通用：各方状态一致，本地确定性结算即可）=====
  useEffect(() => {
    if (game.phase !== 'settled') return;
    const t = setTimeout(() => {
      const prev = gameRef.current;
      if (prev.phase !== 'settled') return;
      setGame(settleRound(prev));
    }, 1800);
    return () => clearTimeout(t);
  }, [game.phase]);

  // ===== 返回菜单 =====
  const handleBackToMenu = useCallback(() => {
    p2pRef.current?.destroy();
    p2pRef.current = null;
    setMode('menu');
    setGame(createInitialState());
    setSelected([]);
    setMessage('');
    setRoomId('');
    setJoinCode('');
    setNetStatus('');
    setBanner(null);
    setChatOpen(false);
  }, []);

  // ===== 音效开关 =====
  const toggleSound = useCallback(() => {
    setSoundOn(v => { setSoundEnabled(!v); return !v; });
  }, []);
  const toggleVoice = useCallback(() => {
    setVoiceOn(v => { setVoiceEnabled(!v); return !v; });
  }, []);
  const toggleBgm = useCallback(() => {
    setBgmOn(v => { setBgmEnabled(!v); return !v; });
  }, []);

  // ===== 判断当前是否可以操作 =====
  const canPass = game.phase === 'playing' && game.currentSeat === mySeat && game.lastValidPlay !== null;
  const canPlay = game.phase === 'playing' && game.currentSeat === mySeat && selected.length > 0;
  const hintCount = useMemo(() => {
    if (game.phase !== 'playing' || game.currentSeat !== mySeat) return 0;
    return getHintCount(game.players[mySeat].hand, game.lastValidPlay?.pattern ?? null);
  }, [game, mySeat]);

  const bottomSeat = mySeat;
  const rightSeat = ((mySeat + 1) % 3) as Seat; // 下家
  const leftSeat = ((mySeat + 2) % 3) as Seat;  // 上家

  const isSeatActive = (seat: Seat) =>
    (game.phase === 'playing' && game.currentSeat === seat) ||
    (game.phase === 'bidding' && game.bidTurn === seat);

  // ============================================================
  // 主菜单
  // ============================================================
  if (mode === 'menu') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-6 overflow-hidden relative">
        <FestivalBackdrop />
        {/* 装饰牌 */}
        <div className="absolute top-10 left-10 text-6xl opacity-20 -rotate-12 select-none">🂡</div>
        <div className="absolute bottom-16 right-12 text-6xl opacity-20 rotate-12 select-none">🂮</div>
        <div className="absolute top-16 right-16 text-5xl opacity-15 rotate-6 select-none">🃏</div>

        <div className="text-6xl mb-1 select-none">🃏</div>
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500 drop-shadow-lg tracking-wider">
          满意斗地主
        </h1>
        <p className="text-white/50 mb-4">经典三人斗地主 · AI 对战 · P2P 联机</p>

        <div className="flex flex-col gap-3 w-72">
          <Button
            className="bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-400 hover:to-amber-600 text-amber-950 font-black py-7 text-xl rounded-xl shadow-lg shadow-amber-500/30"
            onClick={handleStartOffline}
          >
            🤖 单机对战（2 AI）
          </Button>

          <div className="h-px bg-white/10 my-1" />

          <Input
            placeholder="输入你的名字"
            value={myName}
            onChange={e => setMyName(e.target.value)}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
          />

          <Button
            variant="outline"
            className="bg-transparent border-green-400/50 text-green-300 hover:bg-green-500/20 py-5"
            onClick={handleCreateRoom}
            disabled={!myName.trim()}
          >
            🏠 创建房间
          </Button>

          <div className="flex gap-2">
            <Input
              placeholder="房间号"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
            <Button
              variant="outline"
              className="bg-transparent border-blue-400/50 text-blue-300 hover:bg-blue-500/20 whitespace-nowrap"
              onClick={handleJoinRoom}
              disabled={!myName.trim() || !joinCode.trim()}
            >
              🔗 加入
            </Button>
          </div>
        </div>

        {netStatus && (
          <div className="text-white/60 text-sm mt-2">{netStatus}</div>
        )}
      </div>
    );
  }

  // ============================================================
  // 联机大厅
  // ============================================================
  if (mode === 'online_lobby') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-6 overflow-hidden relative">
        <FestivalBackdrop />
        <h2 className="text-2xl font-bold text-white">联机大厅</h2>

        <div className="bg-white/10 rounded-xl p-6 w-80 text-center">
          <div className="text-white/60 text-sm mb-1">房间号</div>
          <div className="text-3xl font-mono font-bold text-yellow-400 tracking-widest">{roomId}</div>
        </div>

        <div className="bg-white/10 rounded-xl p-4 w-80">
          <div className="text-white/60 text-sm mb-3">玩家列表 ({connectedPlayers}/3)</div>
          {game.players.map((p, i) => (
            <div key={i} className={`flex items-center gap-2 py-1.5 ${i === mySeat ? 'text-yellow-300' : 'text-white/80'}`}>
              <span className="text-lg">{AVATARS[i]}</span>
              <span className="font-medium">{p.name}</span>
              {i === mySeat && <span className="text-xs bg-yellow-500/30 px-1.5 rounded">我</span>}
              {i === 0 && isHost && <span className="text-xs bg-blue-500/30 px-1.5 rounded">房主</span>}
            </div>
          ))}
        </div>

        {isHost && (
          <Button
            className="bg-green-500 hover:bg-green-600 text-green-950 font-bold px-8 py-5 text-lg"
            onClick={handleStartOnline}
            disabled={connectedPlayers < 2}
          >
            🃏 开始游戏 ({connectedPlayers}/3)
          </Button>
        )}

        {!isHost && (
          <div className="text-white/50 text-sm">等待房主开始游戏...</div>
        )}

        <div className="text-white/40 text-sm">{netStatus}</div>

        <Button variant="ghost" className="text-white/40 hover:text-white" onClick={handleBackToMenu}>
          ← 返回菜单
        </Button>
      </div>
    );
  }

  // ============================================================
  // 游戏界面（单机和联机共用）
  // ============================================================
  const multiplier = currentMultiplier(game);

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden relative ${shake ? 'animate-shake' : ''}`}
    >
      <FestivalBackdrop rim />
      {/* ===== 顶部信息栏 ===== */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/25 z-20">
        <div className="text-white/70 text-xs w-44">
          {isOnline && `房间 ${roomId} · `}第 {game.roundCount} 局
        </div>

        {/* 底牌 + 倍数 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-white/40 text-xs mr-1">底牌</span>
            {game.deck.map(c => (
              game.phase === 'bidding' || game.phase === 'idle'
                ? <CardSprite key={c.id} card={c} hidden small />
                : <CardSprite key={c.id} card={c} small />
            ))}
          </div>
          <div
            key={game.bombCount}
            className="animate-mult animate-gold-shine px-2.5 py-1 rounded-lg bg-gradient-to-b from-amber-400/30 to-red-500/25 border border-amber-400/50 text-amber-200 text-sm font-bold"
          >
            倍数 ×{multiplier}
          </div>
        </div>

        {/* 右侧开关 + 比分 */}
        <div className="flex items-center gap-1.5 w-44 justify-end">
          <button
            className={`px-1.5 py-1 rounded text-sm ${counterOn ? 'bg-yellow-500/30' : 'hover:bg-white/10'}`}
            title="记牌器"
            onClick={() => setCounterOn(v => !v)}
          >
            🧮
          </button>
          <button
            className="px-1.5 py-1 rounded text-sm hover:bg-white/10"
            title={soundOn ? '关闭音效' : '开启音效'}
            onClick={toggleSound}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <button
            className={`px-1.5 py-1 rounded text-sm ${bgmOn ? 'bg-amber-500/30' : 'hover:bg-white/10 opacity-60'}`}
            title={bgmOn ? '关闭背景音乐' : '开启背景音乐'}
            onClick={toggleBgm}
          >
            🎵
          </button>
          <button
            className="px-1.5 py-1 rounded text-sm hover:bg-white/10"
            title={voiceOn ? '关闭语音' : '开启语音'}
            onClick={toggleVoice}
          >
            {voiceOn ? '🗣️' : '🤐'}
          </button>
          <div className="text-white/60 text-[11px] ml-1 whitespace-nowrap">
            {game.players.map((p, i) => `${p.name}:${game.scores[i]}`).join(' · ')}
          </div>
          {isOnline && (
            <Button variant="ghost" size="sm" className="text-white/50 hover:text-white h-6 px-2" onClick={handleBackToMenu}>
              退出
            </Button>
          )}
        </div>
      </div>

      {/* 记牌器 */}
      {counterOn && game.phase !== 'idle' && (
        <div className="pt-1 z-10">
          <CardCounter myHand={game.players[mySeat].hand} history={game.history} />
        </div>
      )}

      {/* ===== 主牌桌区域 ===== */}
      <div className="flex-1 flex flex-col relative min-h-0">
        {/* 牌型横幅特效 */}
        <PatternBanner banner={banner} />

        {/* 发牌过场 */}
        <DealOverlay animKey={dealKey} />

        {/* 底牌飞给地主过场 */}
        <BottomCardsFly
          animKey={bottomFlyKey}
          cards={game.deck}
          target={game.landlordSeat === bottomSeat ? 'bottom' : game.landlordSeat === leftSeat ? 'left' : 'right'}
        />

        {/* 对手行：上家(左) / 下家(右) */}
        <div className="flex justify-between items-start px-4 pt-2">
          <OpponentPanel
            name={game.players[leftSeat].name}
            avatar={AVATARS[leftSeat]}
            role={game.players[leftSeat].role}
            cardCount={game.players[leftSeat].hand.length}
            isActive={isSeatActive(leftSeat)}
            secondsLeft={isSeatActive(leftSeat) && isOnline ? secondsLeft : undefined}
            side="left"
          />
          <OpponentPanel
            name={game.players[rightSeat].name}
            avatar={AVATARS[rightSeat]}
            role={game.players[rightSeat].role}
            cardCount={game.players[rightSeat].hand.length}
            isActive={isSeatActive(rightSeat)}
            secondsLeft={isSeatActive(rightSeat) && isOnline ? secondsLeft : undefined}
            side="right"
          />
        </div>

        {/* 对手出牌区 */}
        <div className="flex-1 flex items-start justify-between px-2 min-h-0">
          <div className="w-2/5 pl-4">
            <SeatPlayArea
              key={`l-${game.history.length}`}
              play={game.tablePlays[leftSeat]}
              direction="left"
              align="start"
            />
          </div>

          {/* 中央消息 */}
          <div className="flex-1 flex flex-col items-center justify-start pt-4">
            <div className="text-white/80 text-sm font-medium min-h-[1.5rem] text-center px-3 py-1 rounded-full bg-black/20">
              {message}
            </div>
          </div>

          <div className="w-2/5 pr-4">
            <SeatPlayArea
              key={`r-${game.history.length}`}
              play={game.tablePlays[rightSeat]}
              direction="right"
              align="end"
            />
          </div>
        </div>

        {/* 我的出牌区 */}
        <div className="px-8">
          <SeatPlayArea
            key={`b-${game.history.length}`}
            play={game.tablePlays[bottomSeat]}
            direction="bottom"
          />
        </div>

        {/* ===== 底部玩家区 ===== */}
        <div className="flex flex-col items-center gap-1.5 pb-2">
          {/* 我的信息 + 操作 */}
          <div className="flex items-center gap-4 min-h-[3.25rem]">
            {/* 快捷聊天 */}
            <div className="relative">
              <button
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-lg flex items-center justify-center"
                title="快捷聊天"
                onClick={() => setChatOpen(v => !v)}
              >
                💬
              </button>
              {chatOpen && (
                <div className="absolute bottom-11 left-0 w-64 bg-slate-800/95 border border-white/15 rounded-xl p-2 flex flex-col gap-1 z-30 shadow-xl">
                  {QUICK_CHATS.map(text => (
                    <button
                      key={text}
                      className="text-left text-white/85 text-sm px-2.5 py-1.5 rounded-lg hover:bg-white/10"
                      onClick={() => handleQuickChat(text)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 我的头像 */}
            <div className="relative">
              <div
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 select-none
                  ${game.players[bottomSeat].role === 'landlord'
                    ? 'bg-gradient-to-br from-amber-200 to-amber-500 border-yellow-300'
                    : 'bg-gradient-to-br from-sky-200 to-sky-500 border-sky-300'}
                  ${isMyAction ? 'animate-turn-glow' : ''}
                `}
              >
                {AVATARS[bottomSeat]}
              </div>
              {game.players[bottomSeat].role === 'landlord' && (
                <span className="absolute -top-2 -right-1 text-base drop-shadow">👑</span>
              )}
            </div>

            <div className="flex flex-col">
              <span className="text-white text-sm font-medium">
                {game.players[bottomSeat].name}
                {game.players[bottomSeat].role && (
                  <span
                    className={`ml-1.5 text-xs px-1.5 py-0.5 rounded font-bold ${
                      game.players[bottomSeat].role === 'landlord'
                        ? 'bg-yellow-400 text-yellow-950'
                        : 'bg-emerald-400 text-emerald-950'
                    }`}
                  >
                    {game.players[bottomSeat].role === 'landlord' ? '地主' : '农民'}
                  </span>
                )}
              </span>
              <span className="text-white/50 text-xs">{game.players[bottomSeat].hand.length} 张牌</span>
            </div>

            {/* 倒计时（轮到我时） */}
            {isMyAction && <CountdownRing seconds={secondsLeft} total={TURN_SECONDS} size={44} />}

            {/* 操作区 */}
            <div className="ml-2">
              {game.phase === 'idle' && !isOnline && (
                <Button
                  className="bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-400 hover:to-amber-600 text-amber-950 font-black px-10 py-6 text-lg rounded-xl shadow-lg"
                  onClick={handleStartOffline}
                >
                  🃏 开始游戏
                </Button>
              )}

              {game.phase === 'bidding' && game.bidTurn === bottomSeat && (
                <BidPanel currentBid={game.bidCurrent} onBid={applyBid} />
              )}

              {game.phase === 'playing' && game.currentSeat === bottomSeat && (
                <GameControls
                  canPlay={canPlay}
                  canPass={canPass}
                  hintCount={hintCount}
                  onPlay={handlePlayClick}
                  onPass={applyPass}
                  onHint={handleHint}
                />
              )}
            </div>
          </div>

          {/* 手牌 */}
          <PlayerHand
            hand={game.players[bottomSeat].hand}
            selected={selected}
            disabled={!isMyAction || game.phase !== 'playing'}
            onToggleCard={toggleCard}
            onRangeSelect={rangeSelect}
          />
        </div>
      </div>

      {/* ===== 结算弹窗 ===== */}
      {game.phase === 'gameover' && game.roundResult && (
        <SettlementModal
          result={game.roundResult}
          players={game.players}
          mySeat={mySeat}
          isOnline={isOnline}
          onRestart={handleRestart}
          onBackToMenu={handleBackToMenu}
        />
      )}
    </div>
  );
}

// ---- 辅助函数 ----
function getPatternName(pattern: { type: string }): string {
  const names: Record<string, string> = {
    single: '单张', pair: '对子', triple: '三张',
    triple_single: '三带一', triple_pair: '三带二',
    straight: '顺子', straight_pair: '连对',
    plane: '飞机', plane_single: '飞机带单', plane_pair: '飞机带对',
    bomb: '炸弹', rocket: '王炸',
    quad_single: '四带二', quad_pair: '四带二对',
  };
  return names[pattern.type] || pattern.type;
}
