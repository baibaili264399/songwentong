/* ============================================================
   《错位夜宵》剧本文档（剧本数据层）
   步骤类型：
     card      章节卡   { card, sub, hold }
     bg        背景     { bg, pos, dur, pan, blur }
     cg        CG 特写  { cg, mode:'inset'|'full', dur, pos }
     cgOff     关闭 CG
     char      立绘     { char, pos, dur } / { char: null }
     flash     闪光     { flash:'white'|'black', dur }
     shake     震屏     { shake: 强度, dur }
     fx        特效     { fx: 'glitch' | 'glow' | 'glowOff' | 'flashbackOn' | 'flashbackOff' }
     text      台词     { text, who, kind:'inner'|'say'|'action'|'narration'|'memory'|'inner-strong' }
     wait      自动等待 { wait }
     end       章节结束 { end:{ title, sub } }
   ============================================================ */
(function (global) {
  'use strict';
  var GAL = global.GAL || (global.GAL = {});

  var S = 'assets/scene/';

  GAL.Chapters = {

    /* ---------------- 第一章 · 醒在别人的身体里 ---------------- */
    'ch1': {
      id: 'ch1',
      title: '第一章 · 醒在别人的身体里',
      place: '大学校园 · 林荫道旁的长椅',
      steps: [
        /* --- 前情一笔带过：通关 → 拼好饭 → 中毒 → 穿越（用实拍的深夜房间当底） --- */
        { bg: S + 'bg-room-night.webp', pos: '50% 42%', dur: 1600 },
        { text: '熬夜通关了那款 galgame——余额 11.30 元，点了份 9.9 元的拼好饭炸鸡。第一口咬下去，刺耳的耳鸣，眼前一黑。', who: '前情提要', kind: 'memory' },
        { flash: 'white', dur: 420 },
        { fx: 'flashbackOff' },

        { card: '第一章', sub: '醒在别人的身体里', hold: 2000 },
        { bg: S + 'bg-bench-close.webp', pos: '50% 62%', dur: 1500 },

        { text: '我去……，给我干哪来了……', who: '男主', kind: 'inner' },
        { text: '一只手抬起来，死死按住太阳穴，眉头紧锁。', kind: 'action' },
        { text: '头好疼……', who: '男主', kind: 'say' },

        { bg: S + 'bg-path.webp', pos: '50% 55%', dur: 1400, pan: 'left' },
        { text: '缓缓抬起头，眼神恍惚，茫然地向四周来回观望。', kind: 'action' },
        { text: '镜头缓缓扫过林荫步道——不远处是通向图书馆的路口，隔着树丛隐约露出一角雷锋雕像。路上零星有下课走动的学生。', kind: 'narration' },

        { bg: S + 'bg-bench-close.webp', pos: '50% 58%', dur: 700, shake: 13 },
        { text: '刚刚扫视完周围，一阵强烈的眩晕再度袭来。', kind: 'narration' },
        { text: '男主的身子轻轻一晃，后背重重靠住长椅靠背。', kind: 'action' },

        { fx: 'glitch', dur: 900 },
        { text: '不会吧……难道我穿越到刚刚打完的那款游戏里面了！？', who: '男主', kind: 'inner-strong' },
        { text: '又头晕……', who: '男主', kind: 'inner' },

        { cg: S + 'cg-phone-dark.webp', mode: 'inset', dur: 700 },
        { text: '慌忙伸手摸进口袋，掏出裤兜里的智能手机。拇指划开锁屏。', kind: 'action' },
        { cg: S + 'cg-phone.webp', mode: 'inset', dur: 450, zoom: true },
        { text: '【屏幕特写】白天的日期与时间——已经不再是现实里的深夜两点多。', kind: 'narration' },

        { cgOff: true },
        { flash: 'white', dur: 380 },
        { text: '盯着屏幕上的时间，现实的记忆瞬间翻涌冲进脑海——', who: '男主', kind: 'inner' },

        { fx: 'flashbackOn' },
        { text: '深夜的出租屋，显示器幽幽的白光，通关字幕还在缓缓滚动。', kind: 'memory' },
        { text: '熬夜打通的那款 galgame。手机余额：11.30 元。', kind: 'memory' },
        { text: '那份 9.9 元的错位拼好饭炸鸡——咬下第一口之后，是刺耳的耳鸣，然后重重摔倒在地。', kind: 'memory' },
        { fx: 'flashbackOff' },

        { flash: 'white', dur: 320 },
        { text: '紧接着，属于这具原生身体的记忆也开始涌入——本校的学生、课程、日常的校园生活。', kind: 'narration' },

        { fx: 'glow' },
        { text: '就在这时，一股无形的力量自心底扩散开来。', kind: 'narration' },

        { end: { title: '第一章 · 待续', sub: '下一段：林荫道上的第一个身影' } }
      ]
    }
  };

  /* 便于以后加章节：返回章节列表顺序 */
  GAL.chapterOrder = ['ch1'];
})(window);
