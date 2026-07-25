import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../App.css'

type Mode = 'pvp' | 'pve' | 'multi'
type Phase = 'menu' | 'names' | 'setup' | 'handoff' | 'play' | 'over'

const FLAVORS = [
  '甜的，是蜂蜜味 🍯',
  '有点上头，但还活着',
  '舌尖发麻……错觉吧',
  '嗯，普通的南瓜汁 🎃',
  '居然有点好喝？',
  '苦得皱眉，但人没事',
  '女巫往里加了跳跳糖 ✨',
  '喝出了桂花香 🌼',
  '凉飕飕的薄荷味',
  '像隔夜的梅子汤',
  '胃里咕嘟了一声，仅此而已',
  '这瓶过期了，但没毒',
]

const PUNISHMENTS = [
  '用播音腔朗读自己的外卖收货人姓名',
  '模仿女巫施法，绕场一周',
  '用屁股在空中写出「我有罪」三个字',
  '深情演唱一首儿歌，必须有感情',
  '学猫叫三声，每一声情绪递进',
  '保持微笑 30 秒，不许说话',
  '公开手机相册里最近的一张照片',
  '原地转十圈，然后走一条直线',
  '给最近一条朋友圈评论「说得太好了」',
  '用三种方言说「我下次再也不敢了」',
  '对着空气深情告白 15 秒',
  '模仿一种动物直到下局开始',
]

const AI_TAUNTS = [
  '咯咯咯……让我看看，哪一瓶比较顺眼呢……',
  '嗯……这瓶看起来很甜哦，你敢喝吗……',
  '我的毒药，可就藏在里面呢……',
  '别急嘛，女巫我呀，要慢慢挑……',
]

const PLAYER_COLORS = [
  { chip: 'border-fuchsia-300/60 bg-fuchsia-500/20 text-fuchsia-100', text: 'text-fuchsia-300' },
  { chip: 'border-lime-300/60 bg-lime-500/15 text-lime-100', text: 'text-lime-300' },
  { chip: 'border-amber-300/60 bg-amber-500/15 text-amber-100', text: 'text-amber-300' },
  { chip: 'border-sky-300/60 bg-sky-500/15 text-sky-100', text: 'text-sky-300' },
  { chip: 'border-rose-300/60 bg-rose-500/15 text-rose-100', text: 'text-rose-300' },
  { chip: 'border-cyan-300/60 bg-cyan-500/15 text-cyan-100', text: 'text-cyan-300' },
]

// 默认花名池（≤5字），进取名页时随机抽取、同局不重复
const DEFAULT_NAMES = [
  '含笑半步癫',
  '一日丧命散',
  '绝命毒师',
  '百毒不侵',
  '千杯不倒',
  '药不能停',
  '试毒小能手',
  '魔药课代表',
  '药水品鉴师',
  '坩埚大户',
  '见习女巫',
  '老巫婆',
  '毒奶一口',
  '解药商人',
  '大难不死',
  '满血复活',
  '多喝热水',
  '急支糖浆',
  '鹤顶红',
  '缓两步',
]

const pickDefaultNames = (n: number, exclude: string[] = []): string[] => {
  const pool = [...DEFAULT_NAMES.filter((x) => !exclude.includes(x))].sort(() => Math.random() - 0.5)
  return Array.from({ length: n }, (_, i) => pool[i % pool.length])
}

const BOTTLE_EMOJI = '🧪'

const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

// 预录语音文件路径（public/audio/ 下）
const audioUrl = (name: string) => `${import.meta.env.BASE_URL}audio/${name}`

// ---- sound engine ----
function useSound(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  // 语音双通道：voiceRef 放台词，announceRef 放回合宣言；互相让路，绝不叠播
  const voiceRef = useRef<HTMLAudioElement | null>(null)
  const announceRef = useRef<HTMLAudioElement | null>(null)
  const announceToken = useRef(0)

  const play = useCallback(
    (kind: 'pick' | 'confetti' | 'death' | 'win' | 'draw' | 'eliminate') => {
      if (!enabled) return
      try {
        if (!ctxRef.current) {
          const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          ctxRef.current = new AC()
        }
        const ctx = ctxRef.current
        const now = ctx.currentTime
        const tone = (freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.15) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = type
          osc.frequency.value = freq
          gain.gain.setValueAtTime(vol, now + start)
          gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur)
          osc.connect(gain).connect(ctx.destination)
          osc.start(now + start)
          osc.stop(now + start + dur)
        }
        if (kind === 'pick') tone(520, 0, 0.12, 'triangle', 0.08)
        if (kind === 'confetti') {
          // 撒花：快速上行琶音 + 闪亮尾音
          ;[1046, 1318, 1568, 2093].forEach((f, i) => tone(f, i * 0.07, 0.22, 'triangle', 0.1))
          tone(2637, 0.3, 0.35, 'sine', 0.07)
          tone(3136, 0.38, 0.4, 'sine', 0.05)
        }
        if (kind === 'death') {
          tone(300, 0, 0.4, 'sawtooth', 0.12)
          tone(200, 0.25, 0.5, 'sawtooth', 0.12)
          tone(120, 0.55, 0.7, 'sawtooth', 0.14)
        }
        if (kind === 'eliminate') {
          tone(392, 0, 0.3, 'square', 0.08)
          tone(311, 0.22, 0.45, 'square', 0.08)
        }
        if (kind === 'win') {
          tone(523, 0, 0.18)
          tone(659, 0.15, 0.18)
          tone(784, 0.3, 0.35)
        }
        if (kind === 'draw') {
          // 平局：滑稽的"哇哇"下行长音
          tone(349, 0, 0.5, 'sawtooth', 0.07)
          tone(330, 0.45, 0.5, 'sawtooth', 0.07)
          tone(311, 0.9, 0.9, 'sawtooth', 0.08)
        }
      } catch {
        /* audio unavailable */
      }
    },
    [enabled],
  )

  // 兜底：系统 TTS（尽量挑最自然的中文音色）；无论成败都保证触发 onEnd
  const speakTTS = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!enabled || !('speechSynthesis' in window)) {
        onEnd?.()
        return
      }
      try {
        window.speechSynthesis.cancel()
        const clean = text.replace(/[^一-龥a-zA-Z0-9，。！？、……]/g, '')
        if (!clean) {
          onEnd?.()
          return
        }
        const u = new SpeechSynthesisUtterance(clean)
        u.lang = 'zh-CN'
        const zh = window.speechSynthesis
          .getVoices()
          .filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('zh'))
        const preferred = ['Google 普通话', 'Google 國語', 'Ting-Ting', 'Tingting', '婷婷', 'Mei-Jia', 'Meijia', '美佳', 'Lilian', 'Sinji']
        let voice: SpeechSynthesisVoice | undefined
        for (const name of preferred) {
          voice = zh.find((v) => v.name.includes(name))
          if (voice) break
        }
        voice = voice ?? zh[0]
        if (voice) u.voice = voice
        u.rate = 1.05
        u.pitch = 1.1
        if (onEnd) {
          u.onend = () => onEnd()
          u.onerror = () => onEnd()
        }
        window.speechSynthesis.speak(u)
      } catch {
        onEnd?.()
      }
    },
    [enabled],
  )

  // 台词播放：先停掉所有在播的语音，保证同一时间只有一把声音
  const say = useCallback(
    (text: string, file?: string, onEnd?: () => void) => {
      if (!enabled) {
        onEnd?.()
        return
      }
      announceToken.current += 1 // 台词优先，宣告链作废
      announceRef.current?.pause()
      voiceRef.current?.pause()
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      if (file) {
        try {
          const a = new Audio(file)
          voiceRef.current = a
          if (onEnd) {
            a.onended = () => onEnd()
            a.onerror = () => onEnd()
          }
          a.play().catch(() => speakTTS(text, onEnd))
          return
        } catch {
          speakTTS(text, onEnd)
          return
        }
      }
      speakTTS(text, onEnd)
    },
    [enabled, speakTTS],
  )

  // 回合宣言：巫婆开场白 → 系统语音念名字 → 巫婆收尾，带令牌防止被打断后串音
  const announce = useCallback(
    (name: string) => {
      if (!enabled) return
      const token = ++announceToken.current
      announceRef.current?.pause()
      voiceRef.current?.pause()
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      const a = new Audio(audioUrl(`turn-intro-${Math.floor(Math.random() * 3)}.mp3`))
      announceRef.current = a
      a.onended = () => {
        if (announceToken.current !== token) return
        speakTTS(name, () => {
          if (announceToken.current !== token) return
          const tail = new Audio(audioUrl('turn-tail-0.mp3'))
          announceRef.current = tail
          tail.play().catch(() => {})
        })
      }
      a.play().catch(() => {
        if (announceToken.current === token) speakTTS(name)
      })
    },
    [enabled, speakTTS],
  )

  // 停止宣言（切换回合时清理残音），不影响台词通道
  const stopAnnounce = useCallback(() => {
    announceToken.current += 1
    announceRef.current?.pause()
  }, [])

  return { play, say, announce, stopAnnounce }
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('menu')
  const [mode, setMode] = useState<Mode>('pvp')
  const [count, setCount] = useState(16)
  const [players, setPlayers] = useState<string[]>(['玩家A', '玩家B'])
  const [nameInputs, setNameInputs] = useState<string[]>(['玩家A', '玩家B'])
  const [multiCount, setMultiCount] = useState(4)
  const [poisons, setPoisons] = useState<(number | null)[]>([null, null])
  const [alive, setAlive] = useState<boolean[]>([true, true])
  const [drunk, setDrunk] = useState<number[]>([])
  const [turn, setTurn] = useState(0)
  const [setter, setSetter] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [drinking, setDrinking] = useState<number | null>(null)
  const [celebrate, setCelebrate] = useState<number | null>(null)
  const [flavor, setFlavor] = useState('')
  const [taunt, setTaunt] = useState('')
  const [winner, setWinner] = useState<number | null>(null)
  const [deathIndex, setDeathIndex] = useState<number | null>(null)
  const [eliminated, setEliminated] = useState<number | null>(null)
  const [scores, setScores] = useState<number[]>([0, 0])
  const [punishment, setPunishment] = useState<string | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const timers = useRef<number[]>([])

  const { play, say, announce, stopAnnounce } = useSound(soundOn)

  // 预热系统语音列表，兜底 TTS 首次调用才能拿到音色
  useEffect(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices()
  }, [])

  // 双人/乱斗模式：轮到人类玩家时播放回合宣言（等上句台词说完再开口）
  useEffect(() => {
    if (mode === 'pve' || phase !== 'play') return
    if (drinking !== null || eliminated !== null) return
    const isFirstTurn = drunk.length === 0 && deathIndex === null
    const t = window.setTimeout(() => announce(players[turn]), isFirstTurn ? 700 : 2400)
    return () => {
      window.clearTimeout(t)
      stopAnnounce()
    }
  }, [phase, turn, drinking, eliminated, mode, drunk, deathIndex, announce, stopAnnounce, players])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const hue = useCallback((i: number) => (i * 47 + 13) % 360, [])
  const grid = useMemo(() => Array.from({ length: count }, (_, i) => i), [count])
  const playerCount = players.length

  const nextAliveFrom = (from: number, aliveList: boolean[]) => {
    let i = from
    do {
      i = (i + 1) % aliveList.length
    } while (!aliveList[i])
    return i
  }

  // ---- flow control ----
  const chooseMode = (m: Mode) => {
    setMode(m)
    if (m === 'pvp') setNameInputs(pickDefaultNames(2))
    else if (m === 'pve') setNameInputs(pickDefaultNames(1))
    else setNameInputs(pickDefaultNames(multiCount))
    setPhase('names')
  }

  const adjustMultiCount = (n: number) => {
    setMultiCount(n)
    setNameInputs((prev) => {
      const next = prev.slice(0, n)
      if (next.length < n) next.push(...pickDefaultNames(n - next.length, next))
      return next
    })
  }

  const confirmNames = () => {
    const used: string[] = []
    const fill = (raw: string | undefined) => {
      const v = raw?.trim() || pickDefaultNames(1, used)[0]
      used.push(v)
      return v
    }
    const finalNames = mode === 'pve' ? [fill(nameInputs[0]), '女巫'] : nameInputs.map((n) => fill(n))
    setPlayers(finalNames)
    setScores(Array(finalNames.length).fill(0))
    startGame(finalNames)
  }

  const startGame = (roster: string[]) => {
    setPoisons(Array(roster.length).fill(null))
    setAlive(Array(roster.length).fill(true))
    setDrunk([])
    setTurn(0)
    setSetter(0)
    setSelected(null)
    setDrinking(null)
    setCelebrate(null)
    setFlavor('')
    setTaunt('')
    setWinner(null)
    setDeathIndex(null)
    setEliminated(null)
    setPunishment(null)
    setPhase('setup')
  }

  const confirmPoison = () => {
    if (selected === null) return
    play('pick')
    const next = [...poisons]
    next[setter] = selected
    if (mode === 'pve') {
      let ai = Math.floor(Math.random() * count)
      while (ai === selected) ai = Math.floor(Math.random() * count)
      setPoisons([selected, ai])
      setSelected(null)
      setPhase('play')
      return
    }
    setPoisons(next)
    setSelected(null)
    if (setter < playerCount - 1) {
      setPhase('handoff')
    } else {
      setPhase('play')
    }
  }

  // ---- drink resolution ----
  const resolveDrink = useCallback(
    (idx: number, currentTurn: number, drunkList: number[], poisonList: (number | null)[], aliveList: boolean[]) => {
      const distinctPoisons = new Set(poisonList.filter((p) => p !== null)).size

      if (poisonList.includes(idx)) {
        // 💀 drank poison
        const newAlive = aliveList.map((a, i) => (i === currentTurn ? false : a))
        setAlive(newAlive)
        setDeathIndex(idx)
        const survivors = newAlive.filter(Boolean).length

        if (mode === 'multi' && survivors > 1) {
          play('eliminate')
          setEliminated(currentTurn)
          later(() => {
            setEliminated(null)
            setDeathIndex(null)
            setDrinking(null)
            setTurn(nextAliveFrom(currentTurn, newAlive))
          }, 2200)
        } else {
          play('death')
          const w = newAlive.findIndex(Boolean)
          setWinner(w === -1 ? null : w)
          later(() => {
            play('win')
            if (w !== -1) {
              setScores((s) => s.map((v, i) => (i === w ? v + 1 : v)))
            }
            setPhase('over')
          }, 1400)
        }
      } else {
        // 🎉 safe
        play('confetti')
        const fi = Math.floor(Math.random() * FLAVORS.length)
        const flavorFile = audioUrl(`flavor-${String(fi).padStart(2, '0')}.mp3`)
        setFlavor(FLAVORS[fi])
        setCelebrate(idx)
        later(() => setCelebrate(null), 900)
        const newDrunk = [...drunkList, idx]
        setDrunk(newDrunk)
        setDrinking(null)

        // 平局判定：所有非毒药都被喝光（风味台词说完再播报平局）
        if (newDrunk.length >= count - distinctPoisons) {
          say(FLAVORS[fi], flavorFile, () => {
            play('draw')
            setWinner(null)
            setPhase('over')
            say('安全药剂全被喝光啦，平局！你们都是生存大师！', audioUrl('draw.mp3'))
          })
          return
        }

        const nextTurn = nextAliveFrom(currentTurn, aliveList)
        setTurn(nextTurn)
        if (mode === 'pve' && nextTurn === 1) {
          // 风味台词说完，女巫再开口挑衅，挑衅完才挑瓶子——语音顺序播放不重叠
          say(FLAVORS[fi], flavorFile, () => {
            const ti = Math.floor(Math.random() * AI_TAUNTS.length)
            setTaunt(AI_TAUNTS[ti])
            say(AI_TAUNTS[ti], audioUrl(`taunt-${ti}.mp3`))
          })
          later(() => {
            const options = grid.filter((i) => !newDrunk.includes(i) && i !== poisonList[1])
            const choice = rand(options)
            setTaunt('')
            setDrinking(choice)
            play('pick')
            later(() => resolveDrink(choice, 1, newDrunk, poisonList, aliveList), 1000)
          }, 3400)
        } else {
          say(FLAVORS[fi], flavorFile)
        }
      }
    },
    [count, grid, mode, play, say],
  )

  const drink = (idx: number) => {
    if (drinking !== null || eliminated !== null || phase !== 'play') return
    if (mode === 'pve' && turn === 1) return
    setDrinking(idx)
    setFlavor('')
    play('pick')
    later(() => resolveDrink(idx, turn, drunk, poisons, alive), 900)
  }

  // 同步锁：防止快速连点启动多个滚动循环导致文字叠影
  const spinningRef = useRef(false)
  const spinPunishment = () => {
    if (spinningRef.current) return
    spinningRef.current = true
    setSpinning(true)
    let ticks = 0
    const total = 16 + Math.floor(Math.random() * 6)
    const tick = () => {
      setPunishment(rand(PUNISHMENTS))
      ticks += 1
      if (ticks < total) {
        timers.current.push(window.setTimeout(tick, 60 + ticks * 18))
      } else {
        spinningRef.current = false
        setSpinning(false)
      }
    }
    tick()
  }

  const rematch = () => startGame(players)

  // ---- bottle rendering ----
  const bottleCls = (i: number) => {
    const base = `bottle relative flex items-center justify-center rounded-2xl border ${
      count >= 36 ? 'text-2xl sm:text-4xl rounded-xl' : count >= 25 ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'
    } aspect-square select-none transition-all duration-200 cursor-pointer`
    if (deathIndex === i) return `${base} border-red-500/80 bg-red-950/60 scale-110 shadow-[0_0_30px_rgba(239,68,68,.6)]`
    if (drinking === i) return `${base} border-fuchsia-400/80 bg-fuchsia-950/50 animate-shake`
    if (drunk.includes(i)) return `${base} border-white/5 bg-white/[0.02] opacity-30 cursor-default`
    if (phase === 'setup' && selected === i)
      return `${base} border-lime-400 bg-lime-400/10 scale-105 shadow-[0_0_24px_rgba(163,230,53,.45)]`
    if (phase === 'over' && poisons.includes(i)) return `${base} border-red-400/60 bg-red-950/40 opacity-70`
    return `${base} border-purple-400/25 bg-white/[0.05] hover:bg-purple-400/15 hover:border-fuchsia-300/60 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(168,85,247,.35)]`
  }

  const bottleContent = (i: number) => {
    if (deathIndex === i) return '💀'
    if (drunk.includes(i)) return '🫙'
    if (phase === 'over' && poisons.includes(i)) return '☠️'
    if (phase === 'setup' && selected === i) return '☠️'
    return BOTTLE_EMOJI
  }

  const disabledGrid = drinking !== null || eliminated !== null || (phase === 'play' && mode === 'pve' && turn === 1)

  const turnColor = PLAYER_COLORS[turn % PLAYER_COLORS.length]

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,#2d1b4e_0%,#1a0b2e_45%,#0d0618_100%)] text-purple-50 overflow-x-hidden relative">
      {/* floating deco */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {['🫧', '✨', '🦇', '🌙', '🫧', '✨', '🕯️'].map((e, i) => (
          <span
            key={i}
            className="absolute text-2xl sm:text-3xl opacity-25 animate-float"
            style={{ left: `${8 + i * 14}%`, top: `${((i * 29) % 80) + 6}%`, animationDelay: `${i * 0.9}s`, animationDuration: `${5 + i}s` }}
          >
            {e}
          </span>
        ))}
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-8 sm:py-12 flex flex-col items-center gap-6">
        {/* header */}
        <header className="text-center">
          <div className="text-5xl sm:text-6xl mb-2">🧙‍♀️</div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-widest bg-gradient-to-r from-fuchsia-300 via-purple-200 to-lime-300 bg-clip-text text-transparent drop-shadow">
            女巫的毒药
          </h1>
          <p className="mt-2 text-purple-300/80 text-sm tracking-wider">藏好你的毒药 · 笑着看对方喝下去</p>
        </header>

        {/* sound toggle */}
        <button
          onClick={() => setSoundOn((s) => !s)}
          className="absolute top-4 right-4 text-xl opacity-70 hover:opacity-100 transition"
          title="音效与语音朗读开关"
        >
          {soundOn ? '🔊' : '🔇'}
        </button>

        {/* score bar */}
        {phase !== 'menu' && phase !== 'names' && scores.some((s) => s > 0) && (
          <div className="flex flex-wrap justify-center items-center gap-2 text-sm bg-white/5 border border-purple-400/20 rounded-full px-5 py-1.5">
            {players.map((p, i) => (
              <span key={i} className={`font-bold ${PLAYER_COLORS[i % PLAYER_COLORS.length].text}`}>
                {p} {scores[i]}
                {i < players.length - 1 && <span className="text-purple-500 font-normal"> · </span>}
              </span>
            ))}
          </div>
        )}

        {/* ===== MENU ===== */}
        {phase === 'menu' && (
          <div className="w-full flex flex-col gap-6 mt-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <button
                onClick={() => chooseMode('pvp')}
                className="rounded-3xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/15 to-purple-500/10 p-5 text-left hover:border-fuchsia-300/70 hover:from-fuchsia-500/25 transition-all hover:-translate-y-1"
              >
                <div className="text-4xl mb-3">🧑‍🤝‍🧑</div>
                <div className="text-lg font-bold text-fuchsia-200">双人对战</div>
                <p className="mt-1 text-xs text-purple-300/80">经典原版，互相藏毒</p>
              </button>
              <button
                onClick={() => chooseMode('pve')}
                className="rounded-3xl border border-lime-400/30 bg-gradient-to-br from-lime-500/10 to-emerald-500/5 p-5 text-left hover:border-lime-300/70 hover:from-lime-500/20 transition-all hover:-translate-y-1"
              >
                <div className="text-4xl mb-3">🧙‍♀️</div>
                <div className="text-lg font-bold text-lime-200">挑战女巫</div>
                <p className="mt-1 text-xs text-purple-300/80">单机模式，迎战 AI 女巫</p>
              </button>
              <button
                onClick={() => chooseMode('multi')}
                className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-5 text-left hover:border-amber-300/70 hover:from-amber-500/20 transition-all hover:-translate-y-1"
              >
                <div className="text-4xl mb-3">🎉</div>
                <div className="text-lg font-bold text-amber-200">多人乱斗</div>
                <p className="mt-1 text-xs text-purple-300/80">3~6 人围一圈，活到最后</p>
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="text-sm text-purple-300/70">药剂数量（越多越刺激）</div>
              <div className="flex gap-2">
                {[16, 25, 36].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`px-5 py-2 rounded-full border text-sm font-bold transition-all ${
                      count === n
                        ? 'border-fuchsia-300 bg-fuchsia-500/25 text-fuchsia-100 shadow-[0_0_16px_rgba(217,70,239,.35)]'
                        : 'border-purple-400/25 bg-white/5 text-purple-300 hover:bg-white/10'
                    }`}
                  >
                    {n} 瓶
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-purple-400/15 bg-black/20 p-5 text-sm text-purple-300/80 leading-relaxed">
              <div className="font-bold text-purple-200 mb-2">📜 玩法规则</div>
              ① 每人秘密选中一瓶作为自己的「毒药」<br />
              ② 轮流选一瓶喝掉，记得避开自己下毒的那瓶<br />
              ③ 喝到任何一瓶毒药的人出局；多人模式活到最后获胜<br />
              ④ 若所有安全药剂都被喝光，则平局 🤝<br />
              ⑤ 输家（或平局全员）转动惩罚轮盘 🎡
            </div>
          </div>
        )}

        {/* ===== NAMES ===== */}
        {phase === 'names' && (
          <div className="w-full flex flex-col items-center gap-6">
            <div className="text-center">
              <div className="text-lg font-bold text-purple-100">✍️ 给自己取个响亮的名号</div>
              <p className="text-sm text-purple-300/70 mt-1">响亮的名号能让毒药都怕你三分</p>
            </div>

            {mode === 'multi' && (
              <div className="flex flex-col items-center gap-2">
                <div className="text-sm text-purple-300/70">参战人数</div>
                <div className="flex gap-2">
                  {[3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => adjustMultiCount(n)}
                      className={`w-11 h-11 rounded-full border font-bold transition-all ${
                        multiCount === n
                          ? 'border-amber-300 bg-amber-500/25 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,.35)]'
                          : 'border-purple-400/25 bg-white/5 text-purple-300 hover:bg-white/10'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="w-full max-w-sm flex flex-col gap-3">
              {nameInputs.map((n, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`text-sm font-bold w-6 text-center ${PLAYER_COLORS[i % PLAYER_COLORS.length].text}`}>
                    {i + 1}
                  </span>
                  <input
                    value={n}
                    maxLength={8}
                    onChange={(e) =>
                      setNameInputs((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                    }
                    placeholder={`玩家${i + 1}`}
                    className="flex-1 rounded-xl border border-purple-400/30 bg-white/5 px-4 py-2.5 text-purple-50 placeholder-purple-400/40 outline-none focus:border-fuchsia-300/70 focus:bg-white/10 transition"
                  />
                </div>
              ))}
              {mode === 'pve' && (
                <div className="flex items-center gap-3 opacity-60">
                  <span className="text-sm font-bold w-6 text-center text-lime-300">2</span>
                  <div className="flex-1 rounded-xl border border-lime-400/20 bg-lime-500/5 px-4 py-2.5 text-lime-200">
                    女巫 🧙‍♀️（由 AI 扮演）
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmNames}
                className="px-10 py-3 rounded-full font-bold text-lg bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 shadow-[0_0_24px_rgba(168,85,247,.4)] transition-all"
              >
                开始熬制 ☠️
              </button>
              <button
                onClick={() => setPhase('menu')}
                className="px-6 py-3 rounded-full font-bold border border-purple-400/30 bg-white/5 hover:bg-white/10 transition-all"
              >
                返回
              </button>
            </div>
          </div>
        )}

        {/* ===== SETUP ===== */}
        {phase === 'setup' && (
          <div className="w-full flex flex-col items-center gap-5">
            <div className="text-center">
              <div className={`text-lg font-bold ${PLAYER_COLORS[setter % PLAYER_COLORS.length].text}`}>
                {players[setter]}，轮到你下毒了
              </div>
              <p className="text-sm text-purple-300/70 mt-1">
                {mode === 'pve' ? '🤫 女巫已经藏好了她的毒药' : '🤫 其他人请自觉回避'} · 悄悄点选一瓶
              </p>
            </div>
            <div className={`grid gap-2.5 sm:gap-3 w-full ${count >= 36 ? 'grid-cols-6' : count >= 25 ? 'grid-cols-5' : 'grid-cols-4'}`}>
              {grid.map((i) => (
                <button key={i} className={bottleCls(i)} onClick={() => { setSelected(i); play('pick') }}>
                  <span style={{ filter: selected === i ? 'none' : `hue-rotate(${hue(i)}deg)` }}>{bottleContent(i)}</span>
                </button>
              ))}
            </div>
            <button
              onClick={confirmPoison}
              disabled={selected === null}
              className="mt-2 px-10 py-3 rounded-full font-bold text-lg bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_24px_rgba(168,85,247,.4)] transition-all"
            >
              就是这瓶 ☠️
            </button>
          </div>
        )}

        {/* ===== HANDOFF ===== */}
        {phase === 'handoff' && (
          <div className="w-full flex flex-col items-center gap-6 py-16 text-center">
            <div className="text-6xl animate-bounce">📱</div>
            <div className="text-2xl font-bold text-purple-100">
              请把设备交给 <span className={PLAYER_COLORS[(setter + 1) % PLAYER_COLORS.length].text}>{players[setter + 1]}</span>
            </div>
            <p className="text-purple-300/70 text-sm">{players[setter]} 已藏好毒药，请回避 👀</p>
            <button
              onClick={() => { setSetter(setter + 1); setPhase('setup') }}
              className="px-10 py-3 rounded-full font-bold text-lg bg-gradient-to-r from-lime-500 to-emerald-600 hover:from-lime-400 hover:to-emerald-500 shadow-[0_0_24px_rgba(163,230,53,.35)] transition-all"
            >
              我是{players[setter + 1]}，继续 →
            </button>
          </div>
        )}

        {/* ===== PLAY ===== */}
        {phase === 'play' && (
          <div className="w-full flex flex-col items-center gap-5 relative">
            <div className="flex flex-col items-center gap-2">
              <div className={`px-6 py-2 rounded-full border font-bold text-lg transition-all ${turnColor.chip}`}>
                {drinking !== null ? '🍷 咕嘟咕嘟……' : `轮到 ${players[turn]} 喝药`}
              </div>
              {/* alive chips */}
              {playerCount > 2 && (
                <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                  {players.map((p, i) => (
                    <span
                      key={i}
                      className={`text-xs px-2.5 py-1 rounded-full border ${
                        alive[i]
                          ? i === turn
                            ? turnColor.chip
                            : 'border-purple-400/20 bg-white/5 text-purple-300'
                          : 'border-red-400/20 bg-red-950/30 text-red-300/60 line-through'
                      }`}
                    >
                      {alive[i] ? p : `💀 ${p}`}
                    </span>
                  ))}
                </div>
              )}
              {taunt && (
                <div className="text-sm text-lime-300/80 italic animate-pulse bg-lime-500/5 border border-lime-400/20 rounded-full px-4 py-1">
                  🧙‍♀️「{taunt}」
                </div>
              )}
              {flavor && drinking === null && <div className="text-sm text-lime-300/90">🎉 {flavor}</div>}
              <div className="text-xs text-purple-400/60">剩余 {count - drunk.length} 瓶 · 已喝 {drunk.length} 瓶</div>
            </div>

            <div className={`grid gap-2.5 sm:gap-3 w-full ${count >= 36 ? 'grid-cols-6' : count >= 25 ? 'grid-cols-5' : 'grid-cols-4'}`}>
              {grid.map((i) => (
                <button
                  key={i}
                  className={bottleCls(i)}
                  onClick={() => drink(i)}
                  disabled={disabledGrid || drunk.includes(i)}
                >
                  <span style={{ filter: `hue-rotate(${hue(i)}deg)` }}>{bottleContent(i)}</span>
                  {celebrate === i && <span className="absolute -top-2 -right-1 text-2xl animate-pop">🎉</span>}
                </button>
              ))}
            </div>
            <p className="text-xs text-purple-400/50">提示：别喝到自己下毒的那瓶，位置要靠脑子记 🧠</p>

            {/* elimination overlay */}
            {eliminated !== null && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-black/70 backdrop-blur-sm">
                <div className="text-center animate-pop">
                  <div className="text-7xl mb-3">💀</div>
                  <div className="text-2xl font-black text-red-300">{players[eliminated]} 喝到了毒药，出局！</div>
                  <p className="mt-2 text-purple-300/70 text-sm">场上还剩 {alive.filter(Boolean).length} 位勇士</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== OVER ===== */}
        {phase === 'over' && (
          <div className="w-full flex flex-col items-center gap-6">
            <div className="text-center">
              {winner === null ? (
                <>
                  <div className="text-6xl mb-3">🤝</div>
                  <div className="text-3xl font-black bg-gradient-to-r from-sky-200 to-cyan-300 bg-clip-text text-transparent">
                    平局！
                  </div>
                  <p className="mt-2 text-purple-300/80">所有安全药剂都被喝光了，人人都是生存大师</p>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-3">{mode === 'pve' && winner === 1 ? '🧙‍♀️' : '🏆'}</div>
                  <div className="text-3xl font-black bg-gradient-to-r from-amber-200 to-yellow-400 bg-clip-text text-transparent">
                    {players[winner]} {mode === 'multi' ? '活到了最后！' : '获胜！'}
                  </div>
                  <p className="mt-2 text-purple-300/80">
                    {mode === 'pve' && winner === 1 ? '女巫笑出了声 🧹' : '毒药从不失手 💀'}
                  </p>
                </>
              )}
            </div>

            {/* reveal poisons */}
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              {players.map((p, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/5 border border-purple-400/20 rounded-full px-4 py-1.5">
                  <span style={{ filter: `hue-rotate(${hue(poisons[i] ?? 0)}deg)` }} className="text-xl">☠️</span>
                  <span className="text-purple-300">
                    {p}的毒药：第 {(poisons[i] ?? 0) + 1} 瓶
                  </span>
                </div>
              ))}
            </div>

            {/* punishment wheel */}
            <div className="w-full rounded-3xl border border-red-400/30 bg-gradient-to-br from-red-950/40 to-purple-950/30 p-6 text-center">
              <div className="font-bold text-red-200 mb-3">
                🎡 惩罚轮盘 ·{' '}
                {winner === null
                  ? '平局也有代价，全员一起执行！'
                  : mode === 'multi'
                    ? '出局的倒霉蛋们请接招'
                    : `${players[players.findIndex((_, i) => i !== winner)]}请接招`}
              </div>
              <div
                className={`h-14 flex items-center justify-center text-center text-lg font-bold leading-snug px-4 overflow-hidden ${
                  spinning ? 'text-red-300' : 'text-amber-200'
                }`}
              >
                {punishment ?? '点击下方按钮，抽取社死惩罚'}
              </div>
              <button
                onClick={spinPunishment}
                disabled={spinning}
                className="mt-3 px-8 py-2.5 rounded-full font-bold bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 disabled:opacity-40 shadow-[0_0_20px_rgba(239,68,68,.4)] transition-all"
              >
                {spinning ? '转动中……' : punishment ? '再转一次 🎲' : '开始转动 🎡'}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={rematch}
                className="px-8 py-3 rounded-full font-bold bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 shadow-[0_0_24px_rgba(168,85,247,.4)] transition-all"
              >
                再来一局 🔄
              </button>
              <button
                onClick={() => setPhase('menu')}
                className="px-8 py-3 rounded-full font-bold border border-purple-400/30 bg-white/5 hover:bg-white/10 transition-all"
              >
                返回菜单
              </button>
            </div>
          </div>
        )}

        <footer className="mt-4 text-xs text-purple-500/50 tracking-wider">🧪 喝下的是勇气，活下来的是运气</footer>
      </div>
    </div>
  )
}
