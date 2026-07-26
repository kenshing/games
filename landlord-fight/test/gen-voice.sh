#!/bin/bash
# 满意斗地主 · 真人感语音包批量生成（TTS 插件）
# 用法: bash test/gen-voice.sh [起始序号] — 幂等，已存在的文件跳过
TOOL="/Users/kenshin/Library/Application Support/kimi-desktop/daimon-share/daimon/runtime/kimi-code/home/plugins/managed/audio_generation/scripts/audio_generation_tool.py"
VOICE="At6gj9vUVdJhTriBsuxE"  # 开朗中文女声
OUT="$(dirname "$0")/../public/voice"
mkdir -p "$OUT"

declare -a LINES=(
  # 叫分
  "bid-0|不叫" "bid-1|一分" "bid-2|两分" "bid-3|三分！"
  # 不出
  "pass-0|不出" "pass-1|要不起" "pass-2|过" "pass-3|不要"
  # 组合牌型
  "pat-rocket|王炸！" "pat-bomb|炸弹！" "pat-plane|飞机！" "pat-straight|顺子！"
  "pat-straight_pair|连对！" "pat-triple_single|三带一" "pat-triple_pair|三带二" "pat-quad|四带二"
  # 单张（斗地主叫法：勾圈凯尖）
  "single-3|三" "single-4|四" "single-5|五" "single-6|六" "single-7|七"
  "single-8|八" "single-9|九" "single-10|十" "single-11|勾" "single-12|圈"
  "single-13|凯" "single-14|尖" "single-15|二" "single-16|小王" "single-17|大王"
  # 对子
  "pair-3|对三" "pair-4|对四" "pair-5|对五" "pair-6|对六" "pair-7|对七"
  "pair-8|对八" "pair-9|对九" "pair-10|对十" "pair-11|对勾" "pair-12|对圈"
  "pair-13|对凯" "pair-14|对尖" "pair-15|对二"
  # 三张
  "triple-3|三个三" "triple-4|三个四" "triple-5|三个五" "triple-6|三个六" "triple-7|三个七"
  "triple-8|三个八" "triple-9|三个九" "triple-10|三个十" "triple-11|三个勾" "triple-12|三个圈"
  "triple-13|三个凯" "triple-14|三个尖" "triple-15|三个二"
  # 剩牌播报
  "left-1|我就剩一张牌啦！" "left-2|我就剩两张牌了！"
  # 胜负
  "win|胜利！" "lose|失败啦"
  # 快捷聊天
  "chat-0|快点啊，等到花儿都谢了" "chat-1|你的牌打得也太好了" "chat-2|不要吵了，专心玩游戏吧"
  "chat-3|大家好，很高兴见到各位" "chat-4|不要走，决战到天亮" "chat-5|咱们友谊第一，比赛第二"
  "chat-6|哼，看我的厉害"
)

START=${1:-0}
TOTAL=${#LINES[@]}
OK=0; FAIL=0
for ((i=START; i<TOTAL; i++)); do
  KEY="${LINES[$i]%%|*}"
  TEXT="${LINES[$i]#*|}"
  FILE="$OUT/$KEY.mp3"
  if [ -s "$FILE" ]; then echo "[$((i+1))/$TOTAL] 跳过 $KEY（已存在）"; OK=$((OK+1)); continue; fi
  if python3 "$TOOL" speech --text "$TEXT" --voice-id "$VOICE" --output "$FILE" >/dev/null 2>&1 && [ -s "$FILE" ]; then
    echo "[$((i+1))/$TOTAL] ✅ $KEY — $TEXT"
    OK=$((OK+1))
  else
    echo "[$((i+1))/$TOTAL] ❌ 失败 $KEY — $TEXT"
    FAIL=$((FAIL+1))
  fi
  sleep 0.3
done
echo "完成: 成功 $OK, 失败 $FAIL, 目录 $OUT"
