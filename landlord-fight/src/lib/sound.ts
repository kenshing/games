// ============================================================
// 满意斗地主 - 音效引擎
// WebAudio 合成音效 + 中文语音播报（无需任何音频资源文件）
// ============================================================

let audioCtx: AudioContext | null = null;
let soundEnabled = true;
let voiceEnabled = true;

export function setSoundEnabled(v: boolean) { soundEnabled = v; }
export function setVoiceEnabled(v: boolean) {
  voiceEnabled = v;
  if (!v) {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    stopVoice();
  }
}
export function isSoundEnabled() { return soundEnabled; }
export function isVoiceEnabled() { return voiceEnabled; }

function ctx(): AudioContext | null {
  if (!soundEnabled) return null;
  try {
    if (!audioCtx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

// ---- 基础合成工具 ----
function tone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15, when = 0, slideTo?: number, dest?: AudioNode) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(dest ?? c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function noise(duration: number, volume = 0.2, when = 0, filterFreq = 1200, type: BiquadFilterType = 'lowpass') {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime + when;
  const len = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFreq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t);
}

// ============================================================
// 具名音效
// ============================================================

/** 选牌「嗒」 */
export function sfxSelect() {
  tone(880, 0.05, 'triangle', 0.12);
}

/** 出牌「啪」甩牌声 */
export function sfxPlayCards() {
  noise(0.08, 0.35, 0, 3000, 'bandpass');
  tone(220, 0.08, 'square', 0.08, 0, 110);
}

/** 发牌（连续小牌声） */
export function sfxDeal() {
  for (let i = 0; i < 8; i++) {
    noise(0.05, 0.12, i * 0.07, 4000, 'bandpass');
  }
}

/** 叫分按钮 */
export function sfxClick() {
  tone(660, 0.06, 'triangle', 0.1);
}

/** 炸弹爆炸 */
export function sfxBomb() {
  noise(0.6, 0.5, 0, 500);
  tone(90, 0.55, 'sine', 0.4, 0, 40);
  tone(55, 0.6, 'sawtooth', 0.2, 0.05, 30);
}

/** 王炸（更夸张的爆炸 + 上升音） */
export function sfxRocket() {
  tone(200, 0.3, 'sawtooth', 0.15, 0, 800);
  noise(0.9, 0.55, 0.15, 400);
  tone(70, 0.8, 'sine', 0.45, 0.15, 35);
}

/** 飞机掠过 */
export function sfxPlane() {
  tone(300, 0.7, 'sawtooth', 0.1, 0, 900);
  noise(0.7, 0.15, 0, 1500, 'highpass');
}

/** 倒计时最后 3 秒滴答 */
export function sfxTick() {
  tone(1200, 0.06, 'square', 0.08);
}

/** 胜利旋律 */
export function sfxWin() {
  const notes = [523, 659, 784, 1047, 784, 1047];
  notes.forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, i * 0.13));
}

/** 失败旋律 */
export function sfxLose() {
  const notes = [392, 330, 262, 196];
  notes.forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, i * 0.18));
}

/** 轮到你了 */
export function sfxYourTurn() {
  tone(740, 0.09, 'sine', 0.12);
  tone(988, 0.12, 'sine', 0.12, 0.1);
}

// ============================================================
// 喜庆背景音乐（五声音阶欢快循环，WebAudio 实时合成）
// ============================================================

let bgmEnabled = true;
let bgmTimer: number | null = null;
let bgmStep = 0;
let bgmNextTime = 0;

export function setBgmEnabled(v: boolean) {
  bgmEnabled = v;
  if (!v) stopBGM();
  else startBGM();
}
export function isBgmEnabled() { return bgmEnabled; }

const EIGHTH = 0.235; // ≈128 BPM 的八分音符
// 五声音阶欢乐旋律（0 = 休止），4 小节 × 8 个八分音符
const C5 = 523.25, D5 = 587.33, E5 = 659.26, G5 = 783.99, A5 = 880, C6 = 1046.5, D6 = 1174.7;
const MELODY = [
  E5, G5, A5, G5, E5, D5, E5, G5,
  A5, G5, A5, C6, D6, C6, A5, 0,
  E5, G5, A5, G5, E5, G5, A5, C6,
  A5, G5, E5, D5, C5, 0, 0, 0,
];
// 每小节根音（C - Am - F - G 走向的简化五声版）
const BASS = [130.81, 110.0, 87.31, 98.0];

function bgmSchedule() {
  const c = audioCtx;
  if (!c || !soundEnabled || !bgmEnabled) return;
  while (bgmNextTime < c.currentTime + 0.6) {
    const step = bgmStep % MELODY.length;
    const bar = Math.floor(step / 8);
    const when = Math.max(0, bgmNextTime - c.currentTime);
    const m = MELODY[step];
    if (m > 0) tone(m, EIGHTH * 0.92, 'triangle', 0.045, when);
    if (step % 4 === 0) tone(BASS[bar], EIGHTH * 3.4, 'sine', 0.042, when);
    if (step % 2 === 1) noise(0.035, 0.012, when, 7000, 'highpass');
    bgmStep++;
    bgmNextTime += EIGHTH;
  }
}

/** 开始背景音乐（需在一次用户手势后调用，重复调用幂等） */
export function startBGM() {
  if (!bgmEnabled || !soundEnabled || bgmTimer !== null) return;
  const c = ctx();
  if (!c) return;
  bgmStep = 0;
  bgmNextTime = c.currentTime + 0.08;
  bgmTimer = window.setInterval(bgmSchedule, 180);
}

export function stopBGM() {
  if (bgmTimer !== null) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

// ============================================================
// 中文语音播报（Web Speech API）
// ============================================================

let voiceCache: SpeechSynthesisVoice | null | undefined;

function pickChineseVoice(): SpeechSynthesisVoice | null {
  if (voiceCache !== undefined) return voiceCache;
  if (!('speechSynthesis' in window)) { voiceCache = null; return null; }
  const voices = window.speechSynthesis.getVoices();
  const zh = voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith('zh'));
  if (zh.length === 0) { voiceCache = null; return null; }
  // 1) iOS/macOS 的增强版音色最自然
  const enhanced = zh.find(v => /enhanced|premium|神经网络/i.test(v.name));
  if (enhanced) { voiceCache = enhanced; return enhanced; }
  // 2) 口碑较好的中文音色名单
  const preferred = ['Tingting', 'Ting-Ting', '婷婷', 'Mei-Jia', 'Meijia', '美佳', 'Sinji', '欣欣', 'Lilian', 'Xiaoxiao', 'Yunxi', 'Tianyi', 'Google 普通话', 'Google 國語'];
  for (const name of preferred) {
    const v = zh.find(x => x.name.includes(name));
    if (v) { voiceCache = v; return v; }
  }
  voiceCache = zh[0];
  return voiceCache;
}

// 预热语音列表（部分浏览器异步加载）
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => { voiceCache = undefined; pickChineseVoice(); };
}

/** 播报一句中文；自动加入轻微语调抖动，听起来不那么机械 */
export function speak(text: string, opts?: { rate?: number; pitch?: number }) {
  if (!voiceEnabled || !('speechSynthesis' in window)) return;
  try {
    const clean = text.replace(/[^一-龥a-zA-Z0-9，。！？、]/g, '');
    if (!clean) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'zh-CN';
    const v = pickChineseVoice();
    if (v) u.voice = v;
    // 抖动：每句 ±6% 语速、±8% 音高，避免「机器人复读」感
    const rateJitter = 0.97 + Math.random() * 0.06;
    const pitchJitter = 0.96 + Math.random() * 0.08;
    u.rate = Math.min(2, (opts?.rate ?? 1.05) * rateJitter);
    u.pitch = Math.min(2, (opts?.pitch ?? 1.08) * pitchJitter);
    u.volume = 1.0;
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}

// ============================================================
// 真人感语音包播放（TTS 预生成音频，失败时回退 speechSynthesis）
// ============================================================

const VOICE_BASE = `${import.meta.env.BASE_URL}voice/`;
const clipCache = new Map<string, HTMLAudioElement>();
let currentClip: HTMLAudioElement | null = null;

/** 播放语音包音频；加载/播放失败时回退到 speechSynthesis 朗读 fallback 文本 */
export function playClip(key: string, fallbackText?: string, opts?: { rate?: number; pitch?: number }) {
  if (!voiceEnabled) return;
  try {
    let a = clipCache.get(key);
    if (!a) {
      a = new Audio(`${VOICE_BASE}${key}.mp3`);
      a.preload = 'auto';
      clipCache.set(key, a);
    }
    if (currentClip && currentClip !== a) currentClip.pause();
    a.currentTime = 0;
    currentClip = a;
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => { if (fallbackText) speak(fallbackText, opts); });
    }
    a.onerror = () => { if (fallbackText) speak(fallbackText, opts); };
  } catch {
    if (fallbackText) speak(fallbackText, opts);
  }
}

/** 停止当前语音播报（关闭语音时调用） */
export function stopVoice() {
  if (currentClip) { currentClip.pause(); currentClip = null; }
}

// ============================================================
// 满意斗地主经典语音
// ============================================================

import type { CardPattern } from '@/types/game';
import { VALUE_NAME } from './cards';

const PASS_LINES = ['不出', '要不起', '过', '不要'];

export function voiceBid(action: number) {
  playClip(`bid-${action}`, action === 0 ? '不叫' : `${['', '一', '二', '三'][action]}分`);
}

export function voicePass() {
  const i = Math.floor(Math.random() * PASS_LINES.length);
  playClip(`pass-${i}`, PASS_LINES[i], { pitch: 0.92, rate: 0.98 });
}

export function voicePattern(pattern: CardPattern) {
  switch (pattern.type) {
    case 'rocket': playClip('pat-rocket', '王炸！', { pitch: 1.45, rate: 1.3 }); break;
    case 'bomb': playClip('pat-bomb', '炸弹！', { pitch: 1.35, rate: 1.25 }); break;
    case 'plane': case 'plane_single': case 'plane_pair': playClip('pat-plane', '飞机！', { pitch: 1.2, rate: 1.15 }); break;
    case 'straight': playClip('pat-straight', '顺子！', { pitch: 1.15 }); break;
    case 'straight_pair': playClip('pat-straight_pair', '连对！', { pitch: 1.15 }); break;
    case 'triple': playClip(`triple-${pattern.mainValue}`, `三个${VALUE_NAME[pattern.mainValue]}`); break;
    case 'triple_single': playClip('pat-triple_single', '三带一'); break;
    case 'triple_pair': playClip('pat-triple_pair', '三带二'); break;
    case 'quad_single': case 'quad_pair': playClip('pat-quad', '四带二'); break;
    case 'pair': playClip(`pair-${pattern.mainValue}`, `对${VALUE_NAME[pattern.mainValue]}`); break;
    case 'single': playClip(`single-${pattern.mainValue}`, VALUE_NAME[pattern.mainValue]); break;
  }
}

/** 牌型对应的音效 */
export function sfxPattern(pattern: CardPattern) {
  sfxPlayCards();
  switch (pattern.type) {
    case 'rocket': sfxRocket(); break;
    case 'bomb': sfxBomb(); break;
    case 'plane': case 'plane_single': case 'plane_pair': sfxPlane(); break;
    default: break;
  }
}

export function voiceLeftCards(n: number) {
  if (n === 1) playClip('left-1', '我就剩一张牌啦', { pitch: 1.25, rate: 1.2 });
  else if (n === 2) playClip('left-2', '我就剩两张牌了', { pitch: 1.2, rate: 1.15 });
}

export function voiceWin() {
  playClip('win', '胜利！');
}

export function voiceLose() {
  playClip('lose', '失败了');
}

/** 快捷聊天/AI 回话：已知台词走语音包，动态文本回退 TTS */
const CHAT_CLIP: Record<string, string> = {
  '快点啊，等到花儿都谢了': 'chat-0',
  '你的牌打得也太好了': 'chat-1',
  '不要吵了，专心玩游戏吧': 'chat-2',
  '大家好，很高兴见到各位': 'chat-3',
  '不要走，决战到天亮': 'chat-4',
  '咱们友谊第一，比赛第二': 'chat-5',
  '哼，看我的厉害': 'chat-6',
};

export function voiceChat(text: string) {
  const key = CHAT_CLIP[text];
  if (key) playClip(key, text);
  else speak(text);
}

export function voiceLandlord(name: string) {
  speak(`${name}是地主`);
}

export const QUICK_CHATS = [
  '快点啊，等到花儿都谢了',
  '你的牌打得也太好了',
  '不要吵了，专心玩游戏吧',
  '大家好，很高兴见到各位',
  '不要走，决战到天亮',
  '咱们友谊第一，比赛第二',
];

export const CHAT_REPLIES = [
  '你的牌打得也太好了',
  '不要走，决战到天亮',
  '快点啊，等到花儿都谢了',
  '哼，看我的厉害',
];
