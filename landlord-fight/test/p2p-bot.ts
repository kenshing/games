// ============================================================
// P2P 联机实测机器人（注入房主页面运行）
// 作为纯网络玩家加入房间：自动叫分、自动出牌
// 暴露 window.__bots 供外部轮询状态
// ============================================================

import { Peer, type DataConnection } from 'peerjs';
import type { GameState, Seat, Card, BidAction } from '@/types/game';
import { createInitialState } from '@/lib/game-state';
import { generateCandidates } from '@/lib/plays';
import * as GS from '@/lib/game-state';

interface BotLog {
  ts: number;
  text: string;
}

interface Bot {
  name: string;
  seat: Seat | null;
  state: GameState | null;
  log: BotLog[];
  status: string;
  actionsSent: string[];
}

declare global {
  interface Window {
    __bots: Bot[];
    __startBots: (roomId: string, count: number) => Promise<string>;
  }
}

type NetMessage =
  | { type: 'join_request'; name: string }
  | { type: 'join_accept'; seat: Seat; players: { seat: Seat; name: string; isHost: boolean }[] }
  | { type: 'player_joined'; seat: Seat; name: string }
  | { type: 'start_game' }
  | { type: 'deal'; hands: Card[][]; bottom: Card[]; seatNames: string[] }
  | { type: 'bid'; seat: Seat; action: BidAction }
  | { type: 'play'; seat: Seat; cards: Card[] }
  | { type: 'pass'; seat: Seat }
  | { type: 'chat'; text: string; from: string };

function log(bot: Bot, text: string) {
  bot.log.push({ ts: Date.now(), text });
  if (bot.log.length > 200) bot.log.shift();
}

function maybeAct(bot: Bot, conn: DataConnection) {
  const s = bot.state;
  if (!s || bot.seat === null) return;

  if (s.phase === 'bidding' && s.bidTurn === bot.seat) {
    // 简单策略：没人叫就叫 1 分，有人叫了就叫 2，更高就不叫
    let action: BidAction = 0;
    if (s.bidCurrent === 0) action = 1;
    else if (s.bidCurrent === 1) action = 2;
    const next = GS.bid(s, bot.seat, action);
    if (next !== s) {
      bot.state = next;
      conn.send({ type: 'bid', seat: bot.seat, action } satisfies NetMessage as unknown);
      bot.actionsSent.push(`bid:${action}`);
      log(bot, `叫分 ${action}（当前最高 ${s.bidCurrent}）`);
      // 连锁：叫 3 分直接结束叫分进入出牌，可能立刻又轮到自己
      setTimeout(() => maybeAct(bot, conn), 300);
    }
    return;
  }

  if (s.phase === 'playing' && s.currentSeat === bot.seat) {
    const me = s.players[bot.seat];
    const target = s.lastValidPlay?.pattern ?? null;
    const cands = generateCandidates(me.hand, target);
    if (cands.length === 0) {
      const next = GS.pass(s, bot.seat);
      if (next !== s) {
        bot.state = next;
        conn.send({ type: 'pass', seat: bot.seat } satisfies NetMessage as unknown);
        bot.actionsSent.push('pass');
        log(bot, '不出');
      } else {
        log(bot, '⚠️ 无法 pass（轮到领出但无候选？）');
      }
      return;
    }
    // 出候选里最小的（候选生成器按从小到大排序）
    const cards = cands[0].cards;
    const next = GS.playCards(s, bot.seat, cards);
    if (next !== s) {
      bot.state = next;
      conn.send({ type: 'play', seat: bot.seat, cards } satisfies NetMessage as unknown);
      bot.actionsSent.push(`play:${cards.map(c => c.id).join(',')}`);
      log(bot, `出牌 ${cards.map(c => c.id).join(' ')}（剩 ${next.players[bot.seat!].hand.length} 张）`);
      if (next.phase === 'settled') {
        log(bot, `🏆 本局结束，胜者座位 ${next.winner}`);
      }
    } else {
      log(bot, `⚠️ 出牌被本地拒绝: ${cards.map(c => c.id).join(',')}`);
    }
  }
}

function startOneBot(roomId: string, name: string): Promise<string> {
  const bot: Bot = { name, seat: null, state: null, log: [], status: 'init', actionsSent: [] };
  window.__bots.push(bot);

  return new Promise((resolve, reject) => {
    const myId = `bot_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const peer = new Peer(myId, {
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      debug: 0,
    });

    peer.on('open', () => {
      bot.status = 'peer-open';
      log(bot, `peer 已连接信令服务器: ${myId}`);
      const conn = peer.connect(roomId, { reliable: true });

      conn.on('open', () => {
        bot.status = 'connected';
        log(bot, `已连接房主 ${roomId}，发送加入请求`);
        conn.send({ type: 'join_request', name } satisfies NetMessage as unknown);
      });

      conn.on('data', (raw: unknown) => {
        const msg = raw as NetMessage;
        switch (msg.type) {
          case 'join_accept': {
            bot.seat = msg.seat;
            bot.status = `joined seat ${msg.seat}`;
            log(bot, `✅ 加入成功，座位 ${msg.seat}，玩家: ${msg.players.map(p => p.name).join('/')}`);
            resolve(`ok seat ${msg.seat}`);
            break;
          }
          case 'player_joined': {
            log(bot, `玩家加入: ${msg.name} (座位 ${msg.seat})`);
            break;
          }
          case 'start_game': {
            log(bot, '收到 start_game');
            break;
          }
          case 'deal': {
            const base = createInitialState();
            const players = base.players.map((p, i) => ({
              ...p,
              name: msg.seatNames[i] ?? p.name,
              hand: msg.hands[i],
              role: null,
            }));
            bot.state = {
              ...base,
              players,
              deck: msg.bottom,
              phase: 'bidding',
              bidTurn: 0,
              currentSeat: 0,
              roundCount: 1,
            };
            log(bot, `🂠 收到发牌：${msg.hands[bot.seat!].length} 张 — ${msg.hands[bot.seat!].map(c => c.id).join(' ')}`);
            setTimeout(() => maybeAct(bot, conn), 400);
            break;
          }
          case 'bid': {
            if (!bot.state) return;
            bot.state = GS.bid(bot.state, msg.seat, msg.action);
            log(bot, `座位 ${msg.seat} 叫分 ${msg.action} → bidTurn=${bot.state.bidTurn} phase=${bot.state.phase}`);
            setTimeout(() => maybeAct(bot, conn), 400);
            break;
          }
          case 'play': {
            if (!bot.state) return;
            const before = bot.state;
            bot.state = GS.playCards(bot.state, msg.seat, msg.cards);
            if (bot.state === before) {
              log(bot, `⚠️ 座位 ${msg.seat} 的出牌与本地状态不符（已忽略）`);
            } else {
              log(bot, `座位 ${msg.seat} 出 ${msg.cards.map(c => c.id).join(' ')} → current=${bot.state.currentSeat}`);
            }
            setTimeout(() => maybeAct(bot, conn), 400);
            break;
          }
          case 'pass': {
            if (!bot.state) return;
            bot.state = GS.pass(bot.state, msg.seat);
            log(bot, `座位 ${msg.seat} 不出 → current=${bot.state.currentSeat}`);
            setTimeout(() => maybeAct(bot, conn), 400);
            break;
          }
          case 'chat': {
            log(bot, `💬 ${msg.from}: ${msg.text}`);
            break;
          }
        }
      });

      conn.on('close', () => {
        bot.status = 'closed';
        log(bot, '与房主连接断开');
      });

      conn.on('error', (err: Error) => {
        bot.status = `error: ${err.message}`;
        log(bot, `连接错误: ${err.message}`);
      });
    });

    peer.on('error', (err: Error) => {
      bot.status = `peer-error: ${err.message}`;
      log(bot, `peer 错误: ${err.message}`);
      reject(err);
    });
  });
}

window.__bots = [];
window.__startBots = async (roomId: string, count: number) => {
  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    // 串行加入，保证座位分配确定（先加 seat1 后加 seat2）
    const r = await startOneBot(roomId, `机器人${i === 0 ? '小刚' : '小丽'}`);
    results.push(r);
  }
  return results.join('; ');
};
