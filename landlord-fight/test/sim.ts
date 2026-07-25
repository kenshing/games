// 逻辑模拟测试：AI 三方自对弈 N 局，验证状态机稳健性
import { createInitialState, startGame, bid, playCards, pass, settleRound, currentMultiplier } from '../src/lib/game-state';
import { aiBidDecision, aiPlayDecision } from '../src/lib/ai';
import { generateCandidates } from '../src/lib/plays';
import { detectPattern, canBeat } from '../src/lib/cards';

let failures = 0;
const fail = (msg) => { failures++; console.error('FAIL:', msg); };

let totalRounds = 0;
let bombs = 0, springs = 0, rockets = 0;

for (let iter = 0; iter < 300; iter++) {
  let state = startGame(createInitialState());
  let guard = 0;

  // 叫分阶段
  while (state.phase === 'bidding' && guard++ < 20) {
    const seat = state.bidTurn;
    const action = aiBidDecision(state, seat);
    const next = bid(state, seat, action);
    if (next === state) { fail(`bid rejected at iter ${iter}`); break; }
    state = next;
  }
  if (state.phase !== 'playing') { fail(`no playing phase iter ${iter} phase=${state.phase}`); continue; }

  // 出牌阶段
  guard = 0;
  while (state.phase === 'playing' && guard++ < 400) {
    const seat = state.currentSeat;
    const hand = state.players[seat].hand;
    const decision = aiPlayDecision(state, seat);

    let next;
    if (decision.length === 0) {
      next = pass(state, seat);
      if (next === state) { fail(`pass rejected iter ${iter} seat ${seat} lastValid=${!!state.lastValidPlay}`); break; }
    } else {
      // 验证决策合法性
      const ids = new Set(hand.map(c => c.id));
      if (!decision.every(c => ids.has(c.id))) { fail(`AI played cards not in hand iter ${iter}`); break; }
      const pat = detectPattern(decision);
      if (!pat) { fail(`AI played invalid pattern iter ${iter}: ${decision.map(c=>c.id).join(',')}`); break; }
      const target = state.lastValidPlay?.pattern ?? null;
      if (target && !canBeat(pat, target)) { fail(`AI play cannot beat target iter ${iter}`); break; }
      next = playCards(state, seat, decision);
      if (next === state) { fail(`play rejected iter ${iter}`); break; }
    }
    state = next;
  }

  if (state.phase !== 'settled') { fail(`round did not settle iter ${iter} phase=${state.phase} guard=${guard}`); continue; }

  // 结算
  state = settleRound(state);
  if (state.phase !== 'gameover' || !state.roundResult) { fail(`settle failed iter ${iter}`); continue; }

  const r = state.roundResult;
  const sum = r.scoreDelta.reduce((a, b) => a + b, 0);
  if (sum !== 0) fail(`score delta not zero-sum iter ${iter}: ${sum}`);
  const expectedMult = r.bidValue * Math.pow(2, r.bombCount) * (r.spring ? 2 : 1);
  if (r.multiplier !== expectedMult) fail(`multiplier mismatch iter ${iter}: ${r.multiplier} != ${expectedMult}`);
  if (r.bombCount > 0) bombs++;
  if (r.spring) springs++;
  totalRounds++;
}

// 候选生成器抽查：随机手牌 + 随机目标，生成的候选必须全部合法
import { createDeck, shuffle } from '../src/lib/cards';
for (let iter = 0; iter < 200; iter++) {
  const deck = shuffle(createDeck());
  const hand = deck.slice(0, 17);
  const rest = deck.slice(17, 34);
  const targetCands = generateCandidates(rest, null);
  const target = targetCands.length > 0 ? targetCands[Math.floor(Math.random() * targetCands.length)].pattern : null;
  const cands = generateCandidates(hand, target);
  for (const c of cands) {
    const pat = detectPattern(c.cards);
    if (!pat) { fail(`candidate has invalid pattern: ${c.cards.map(x=>x.id).join(',')}`); continue; }
    if (target && !canBeat(pat, target)) fail(`candidate cannot beat target ${target.type}/${target.mainValue}: ${pat.type}/${pat.mainValue}`);
  }
}

console.log(`完成 ${totalRounds} 局模拟；含炸弹局 ${bombs}，春天/反春局 ${springs}`);
console.log(failures === 0 ? '✅ 全部通过' : `❌ ${failures} 个失败`);
process.exit(failures === 0 ? 0 : 1);
