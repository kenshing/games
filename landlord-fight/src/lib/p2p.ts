// ============================================================
// P2P 联机管理器 (PeerJS)
// ============================================================

import { Peer, type DataConnection } from 'peerjs';
import type { GameState, Seat, Card, BidAction } from '@/types/game';

export type NetMessage =
  | { type: 'join_request'; name: string }
  | { type: 'join_accept'; seat: Seat; players: { seat: Seat; name: string; isHost: boolean }[]; count: number }
  | { type: 'player_joined'; seat: Seat; name: string; count: number }
  | { type: 'start_game' }
  | { type: 'deal'; hands: Card[][]; bottom: Card[]; seatNames: string[] }
  | { type: 'bid'; seat: Seat; action: BidAction }
  | { type: 'play'; seat: Seat; cards: Card[] }
  | { type: 'pass'; seat: Seat }
  | { type: 'chat'; text: string; from: string }
  | { type: 'sync'; state: GameState }
  | { type: 'ready'; seat: Seat }
  | { type: 'disconnect'; seat: Seat };

type ConnectionState = 'idle' | 'hosting' | 'connecting' | 'connected';

export class P2PManager {
  peer: Peer | null = null;
  connections: Map<string, DataConnection> = new Map();
  mySeat: Seat = 0;
  isHost = false;
  roomId = '';
  state: ConnectionState = 'idle';
  playerNames: string[] = ['我', '玩家2', '玩家3'];

  private msgCallback: ((msg: NetMessage) => void) | null = null;
  private statusCallback: ((status: string) => void) | null = null;

  // ---- 创建房间（成为房主）----
  async hostRoom(onStatus?: (s: string) => void): Promise<string> {
    this.statusCallback = onStatus ?? null;
    this.isHost = true;
    this.mySeat = 0;
    this.state = 'hosting';

    // 生成 6 位房间号
    this.roomId = Math.floor(100000 + Math.random() * 900000).toString();

    return new Promise((resolve, reject) => {
      this.peer = new Peer(this.roomId, {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        debug: 1,
      });

      this.peer.on('open', () => {
        this._status(`房间已创建: ${this.roomId}`);
        resolve(this.roomId);
      });

      this.peer.on('connection', (conn) => {
        this._handleIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        this._status(`错误: ${err.message}`);
        reject(err);
      });
    });
  }

  // ---- 加入房间 ----
  async joinRoom(roomId: string, myName: string, onStatus?: (s: string) => void): Promise<void> {
    this.statusCallback = onStatus ?? null;
    this.isHost = false;
    this.roomId = roomId;
    this.state = 'connecting';
    this.playerNames[0] = myName;

    return new Promise((resolve, reject) => {
      // 生成随机自己的 ID
      const myId = `guest_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      this.peer = new Peer(myId, {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        debug: 1,
      });

      this.peer.on('open', () => {
        this._status('正在连接房间...');
        const conn = this.peer!.connect(roomId, { reliable: true });

        conn.on('open', () => {
          this.connections.set(roomId, conn);
          this.state = 'connected';
          this._status('已连接到房间');
          // 发送加入请求
          this.send({ type: 'join_request', name: myName });
          resolve();
        });

        conn.on('data', (data: unknown) => {
          this._onMessage(data as NetMessage);
        });

        conn.on('close', () => {
          this._status('连接已断开');
          this.connections.delete(roomId);
        });

        conn.on('error', (err) => {
          this._status(`连接错误: ${err.message}`);
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        this._status(`错误: ${err.message}`);
        reject(err);
      });
    });
  }

  // ---- 处理来自客户端的连接 ----
  private _handleIncomingConnection(conn: DataConnection) {
    conn.on('open', () => {
      this._status(`新玩家连接: ${conn.peer}`);
    });

    conn.on('data', (data: unknown) => {
      const msg = data as NetMessage;
      if (msg.type === 'join_request') {
        // 分配座位（2 或 1）
        const newSeat: Seat = this.connections.size >= 1 ? 2 : 1;
        this.playerNames[newSeat] = msg.name;
        this.connections.set(conn.peer, conn);
        const count = this.connections.size + 1;

        // 发送确认
        conn.send({
          type: 'join_accept',
          seat: newSeat,
          players: this.playerNames.map((n, i) => ({ seat: i as Seat, name: n, isHost: i === 0 })),
          count,
        } as NetMessage);

        // 通知其他玩家 + 房主自己的 UI
        this.broadcast({ type: 'player_joined', seat: newSeat, name: msg.name, count }, conn.peer);
        this._onMessage({ type: 'player_joined', seat: newSeat, name: msg.name, count });
        this._status(`${msg.name} 加入，座位 ${newSeat}`);
      } else {
        // 转发给所有其他玩家
        this._onMessage(msg);
        this.broadcast(msg, conn.peer);
      }
    });

    conn.on('close', () => {
      this._status(`玩家断开: ${conn.peer}`);
      this.connections.delete(conn.peer);
    });
  }

  // ---- 广播消息 ----
  broadcast(msg: NetMessage, excludePeer?: string) {
    for (const [peerId, conn] of this.connections) {
      if (peerId !== excludePeer && conn.open) {
        conn.send(msg);
      }
    }
  }

  // ---- 发送消息 ----
  send(msg: NetMessage) {
    // 如果是房主，直接处理；否则发给房主
    if (this.isHost) {
      this._onMessage(msg);
    } else {
      for (const [, conn] of this.connections) {
        if (conn.open) {
          conn.send(msg);
          break;
        }
      }
    }
  }

  // ---- 设置消息回调 ----
  onMessage(cb: (msg: NetMessage) => void) {
    this.msgCallback = cb;
  }

  private _onMessage(msg: NetMessage) {
    if (this.msgCallback) this.msgCallback(msg);
  }

  private _status(s: string) {
    if (this.statusCallback) this.statusCallback(s);
  }

  // ---- 清理 ----
  destroy() {
    for (const [, conn] of this.connections) conn.close();
    this.connections.clear();
    this.peer?.destroy();
    this.peer = null;
    this.state = 'idle';
  }

  // 获取连接的玩家数
  getPlayerCount(): number {
    return this.connections.size + 1;
  }
}
