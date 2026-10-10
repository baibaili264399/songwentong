/* ============================================================
   《错位夜宵》VN 演出引擎
   负责：背景交叉淡入 / CG 特写 / 立绘 / 打字机 / 自动 / 跳过 /
        回想(REPEAT) / 前后翻(◀▶) / 记录(LOG) / 特效 / 存档状态导出
   ============================================================ */
(function (global) {
  'use strict';
  var GAL = global.GAL;
  var $ = GAL.$, $$ = GAL.$$;
  var Sfx = GAL.Sfx, fmt = GAL.fmt;

  var el = {};
  function cache() {
    ['screen-game', 'vn-bg-a', 'vn-bg-b', 'vn-chars', 'vn-cg', 'vn-cg-img',
     'vn-flash', 'vn-glitch', 'vn-glow', 'vn-flashback', 'vn-card', 'vn-card-title', 'vn-card-sub',
     'speaker', 'dialogue-text', 'caret', 'vn-box', 'vn-name',
     'hud-chapter', 'hud-playtime', 'hud-line',
     'modal-log', 'log-body', 'toast-layer'].forEach(function (id) {
      el[id] = document.getElementById(id);
    });
  }

  var state = {
    chapterId: null,
    chapterTitle: '',
    steps: [],
    index: 0,
    fullText: '',
    typing: false,
    typeTimer: null,
    auto: false,
    skip: false,
    timer: null,
    waitTimer: null,
    bgSlot: 0,
    ended: false,
    cardTimer: null,
    seen: {},
    log: [],
    textTotal: 0
  };

  /* ---------------- 小工具 ---------------- */
  function clearTimers() {
    global.clearTimeout(state.timer);
    global.clearTimeout(state.waitTimer);
    state.timer = state.waitTimer = null;
  }

  function textSteps(list) {
    return (list || state.steps).filter(function (s) { return typeof s.text === 'string'; });
  }

  function progressOf(index) {
    var texts = textSteps();
    var n = 0;
    for (var i = 0; i <= index && i < state.steps.length; i++) {
      if (typeof state.steps[i].text === 'string') n++;
    }
    return { now: Math.min(n, texts.length), total: texts.length };
  }

  function updateProgress() {
    if (!el['hud-line']) return;
    var p = progressOf(state.index);
    el['hud-line'].textContent = p.now + ' / ' + p.total;
  }

  /* ---------------- 素材缓存 / 预加载 ----------------
     开章就把本章用到的图全部拉一遍，玩家读到那一句时基本已经就绪；
     切换背景 / CG 时如果图还没到，会等它到了再切（并显示"读取素材中"），不会先黑一下。 */
  var assets = {};
  var pendingLoads = 0;
  var bgSeq = 0, cgSeq = 0;

  function bumpLoading(delta) {
    pendingLoads = Math.max(0, pendingLoads + delta);
    if (el['screen-game']) el['screen-game'].classList.toggle('is-loading', pendingLoads > 0);
  }

  function ensure(url, cb) {
    if (!url) { if (cb) cb(false); return; }
    var entry = assets[url];
    if (entry) {
      if (entry.status === 'loading') { if (cb) entry.cbs.push(cb); }
      else if (cb) cb(entry.status === 'ok');
      return;
    }
    entry = assets[url] = { status: 'loading', cbs: cb ? [cb] : [] };
    var settled = false;

    function done(ok) {
      if (settled) return;
      settled = true;
      entry.status = ok ? 'ok' : 'fail';
      bumpLoading(-1);
      var list = entry.cbs;
      entry.cbs = [];
      list.forEach(function (fn) { try { fn(ok); } catch (e) { /* ignore */ } });
    }

    var img = new global.Image();
    img.onload = function () { done(true); };
    img.onerror = function () { done(false); };
    global.setTimeout(function () { done(false); }, 15000);   /* 超时兜底，绝不把剧情卡死 */
    bumpLoading(1);
    img.src = url;
  }

  function preloadChapter() {
    var wanted = {};
    state.steps.forEach(function (s) {
      if (s.bg) wanted[s.bg] = 1;
      if (s.cg) wanted[s.cg] = 1;
      if (s.char) wanted[s.char] = 1;
    });
    Object.keys(wanted).forEach(function (u) { ensure(u); });
  }

  /* ---------------- 视觉层 ---------------- */
  function setBg(step, instant) {
    var mine = ++bgSeq;
    if (instant) { applyBg(step, true); return; }
    ensure(step.bg, function (ok) {
      if (ok && mine === bgSeq) applyBg(step, false);
    });
  }

  function applyBg(step, instant) {
    var layers = [el['vn-bg-a'], el['vn-bg-b']];
    var cur = layers[state.bgSlot];
    var next = layers[1 - state.bgSlot];
    var dur = instant ? 0 : (step.dur || 900);

    next.style.transitionDuration = dur + 'ms';
    cur.style.transitionDuration = dur + 'ms';
    next.style.backgroundImage = 'url("' + step.bg + '")';
    next.style.backgroundPosition = step.pos || '50% 50%';
    next.classList.remove('is-pan');

    /* 触发重排，保证 pan 动画能重新播放 */
    void next.offsetWidth;
    if (!instant && step.pan) next.classList.add('is-pan');

    next.classList.add('is-on');
    if (dur === 0) {
      cur.classList.remove('is-on');
    } else {
      global.setTimeout(function () { cur.classList.remove('is-on'); }, 40);
    }
    state.bgSlot = 1 - state.bgSlot;
  }

  function setCg(step, instant) {
    var mine = ++cgSeq;
    if (instant) { applyCg(step, true); return; }
    ensure(step.cg, function (ok) {
      if (ok && mine === cgSeq) applyCg(step, false);
    });
  }

  function applyCg(step, instant) {
    var node = el['vn-cg'];
    el['vn-cg-img'].src = step.cg;
    node.dataset.mode = step.mode || 'inset';
    node.style.transitionDuration = (instant ? 0 : (step.dur || 600)) + 'ms';
    node.classList.remove('is-zoom');
    void node.offsetWidth;
    node.classList.add('is-on');
    if (!instant && step.zoom) node.classList.add('is-zoom');
    if (!instant) Sfx.click();
  }

  function closeCg(instant) {
    cgSeq++;
    var node = el['vn-cg'];
    node.style.transitionDuration = (instant ? 0 : 420) + 'ms';
    node.classList.remove('is-on', 'is-zoom');
  }

  function setChar(step, instant) {
    var layer = el['vn-chars'];
    if (!step.char) { layer.innerHTML = ''; return; }
    layer.innerHTML = '';
    var img = document.createElement('img');
    img.src = step.char;
    img.className = 'vn-char';
    img.alt = '';
    if (step.pos) img.style.right = step.pos;
    layer.appendChild(img);
    if (!instant) Sfx.click();
  }

  function flash(color, dur) {
    var node = el['vn-flash'];
    node.dataset.color = color || 'white';
    node.style.transitionDuration = '90ms';
    node.classList.add('is-on');
    global.setTimeout(function () {
      node.style.transitionDuration = (dur || 340) + 'ms';
      node.classList.remove('is-on');
    }, 90);
  }

  function shake(power) {
    var stage = el['screen-game'];
    stage.style.setProperty('--shake', (power || 10) + 'px');
    stage.classList.remove('is-shake');
    void stage.offsetWidth;
    stage.classList.add('is-shake');
    global.setTimeout(function () { stage.classList.remove('is-shake'); }, 620);
    if (Sfx && Sfx.error) Sfx.error();
  }

  function setFx(kind, dur) {
    if (kind === 'glitch') {
      var g = el['vn-glitch'];
      g.classList.remove('is-on');
      void g.offsetWidth;
      g.classList.add('is-on');
      global.setTimeout(function () { g.classList.remove('is-on'); }, dur || 900);
    } else if (kind === 'glow') {
      el['vn-glow'].classList.add('is-on');
    } else if (kind === 'glowOff') {
      el['vn-glow'].classList.remove('is-on');
    } else if (kind === 'flashbackOn') {
      el['vn-flashback'].classList.add('is-on');
      el['screen-game'].classList.add('is-flashback');
    } else if (kind === 'flashbackOff') {
      el['vn-flashback'].classList.remove('is-on');
      el['screen-game'].classList.remove('is-flashback');
    }
  }

  function showCard(step, instant) {
    global.clearTimeout(state.cardTimer);   /* 清掉上一次卡片残留的收起定时器，避免刚显示就被关掉 */
    state.cardTimer = null;
    var card = el['vn-card'];
    el['vn-card-title'].textContent = step.card || '';
    el['vn-card-sub'].textContent = step.sub || '';
    card.style.transitionDuration = (instant ? 0 : 420) + 'ms';
    card.classList.add('is-on');
    if (!instant) el['screen-game'].classList.add('is-card');
  }

  function hideCard(instant) {
    global.clearTimeout(state.cardTimer);
    state.cardTimer = null;
    var card = el['vn-card'];
    card.style.transitionDuration = (instant ? 0 : 420) + 'ms';
    card.classList.remove('is-on');
    el['screen-game'].classList.remove('is-card');
  }

  function resetVisual() {
    bgSeq++;                       /* 作废还没回来的背景加载回调 */
    [el['vn-bg-a'], el['vn-bg-b']].forEach(function (l) {
      l.classList.remove('is-on', 'is-pan');
      l.style.backgroundImage = '';
      l.style.transitionDuration = '0ms';
    });
    state.bgSlot = 0;
    closeCg(true);
    el['vn-chars'].innerHTML = '';
    el['vn-glitch'].classList.remove('is-on');
    el['vn-glow'].classList.remove('is-on');
    el['vn-flashback'].classList.remove('is-on');
    el['vn-flash'].classList.remove('is-on');
    el['screen-game'].classList.remove('is-flashback', 'is-card', 'is-shake');
    el['speaker'].classList.add('is-hidden');
    el['dialogue-text'].textContent = '';
    el['caret'].classList.remove('is-on');
    hideCard(true);
  }

  /* ---------------- 执行步骤 ---------------- */
  function applyVisual(step, instant) {
    if (step.card != null) showCard(step, instant);
    if (step.bg) setBg(step, instant);
    if (step.cg) setCg(step, instant);
    if (step.cgOff) closeCg(instant);
    if (step.char !== undefined) setChar(step, instant);
    if (step.flash) flash(step.flash, step.dur);
    if (step.shake) shake(step.shake);
    if (step.fx) setFx(step.fx, step.dur);
    if (step.card != null) {
      /* 章节卡播完自动收掉 */
      state.cardTimer = global.setTimeout(function () { hideCard(false); }, instant ? 0 : (step.hold || 1800));
    }
  }

  /* 从 index 开始推进，直到停在需要点击的台词上 */
  function exec(index, instant) {
    clearTimers();
    var guard = 0;
    while (index < state.steps.length) {
      if (guard++ > 500) break;
      var step = state.steps[index];

      if (typeof step.text === 'string') {
        state.index = index;
        renderText(step, instant);
        return true;
      }

      if (step.end) {
        state.index = index;
        showEnd(step.end);
        return false;
      }

      /* 章节卡：先单独停留 hold 毫秒，再接下一句（点击可提前跳过） */
      if (step.card != null && !instant && step.hold) {
        applyVisual(step, false);
        state.index = index;
        state.waitTimer = global.setTimeout(function () { exec(index + 1, false); }, step.hold);
        return false;
      }

      if (typeof step.wait === 'number' && !instant) {
        applyVisual(step, false);
        state.index = index;
        state.waitTimer = global.setTimeout(function () { exec(index + 1, false); }, step.wait);
        return false;
      }

      applyVisual(step, instant);
      index++;
    }
    state.index = state.steps.length;
    showEnd(null);
    return false;
  }

  /* ---------------- 台词 ---------------- */
  function renderText(step, instant) {
    state.fullText = step.text;
    state.ended = false;
    var kind = step.kind || (step.who ? 'say' : 'narration');
    var nameEl = el['speaker'];

    if (step.who) {
      nameEl.textContent = step.who;
      nameEl.classList.remove('is-hidden');
      nameEl.dataset.kind = kind;
    } else {
      nameEl.textContent = '';
      nameEl.classList.add('is-hidden');
    }

    var box = el['vn-box'];
    box.dataset.kind = kind;
    box.classList.remove('is-ended');

    if (!state.seen[state.index]) {
      state.seen[state.index] = true;
      state.log.push({ who: step.who || '', kind: kind, text: step.text, index: state.index });
    }

    updateProgress();

    var delay = (instant || state.skip) ? 0 : GAL.textDelay();
    var node = el['dialogue-text'];
    global.clearTimeout(state.typeTimer);
    node.textContent = '';
    el['caret'].classList.remove('is-on');

    if (delay <= 0) {
      node.textContent = step.text;
      state.typing = false;
      el['caret'].classList.add('is-on');
      onLineDone();
      return;
    }

    state.typing = true;
    var i = 0, tick = 0;
    (function step_() {
      if (i >= step.text.length) {
        state.typing = false;
        el['caret'].classList.add('is-on');
        onLineDone();
        return;
      }
      node.textContent += step.text.charAt(i++);
      if (++tick % 4 === 0 && Sfx && Sfx.type) Sfx.type();
      state.typeTimer = global.setTimeout(step_, delay);
    })();
  }

  function finishTyping() {
    global.clearTimeout(state.typeTimer);
    el['dialogue-text'].textContent = state.fullText;
    state.typing = false;
    el['caret'].classList.add('is-on');
    onLineDone(true);
  }

  /* 一句显示完成后：处理 自动 / 跳过 */
  function onLineDone(wasFinish) {
    clearTimeout(state.timer);
    if (state.ended) return;
    if (state.skip) {
      state.timer = global.setTimeout(function () { advance(); }, 90);
    } else if (state.auto && !wasFinish) {
      var wait = 700 + state.fullText.length * 62;
      state.timer = global.setTimeout(function () { advance(); }, wait);
    } else if (state.auto && wasFinish) {
      var w2 = 500 + state.fullText.length * 40;
      state.timer = global.setTimeout(function () { advance(); }, w2);
    }
  }

  /* ---------------- 章节结束 ---------------- */
  function showEnd(info) {
    clearTimers();
    state.ended = true;
    state.typing = false;
    var box = el['vn-box'];
    box.classList.add('is-ended');
    el['caret'].classList.remove('is-on');
    var title = (info && info.title) || '本章结束';
    var sub = (info && info.sub) || '';
    el['speaker'].classList.add('is-hidden');
    el['dialogue-text'].textContent = '（本章结束 · 点击画面返回标题）';
    showCard({ card: title, sub: sub, hold: 2600 }, false);
    el['screen-game'].classList.remove('is-card');   /* 结尾保留提示行 */
    updateProgress();
  }

  /* ---------------- 对外的操作 ---------------- */
  function advance() {
    if (state.ended) {
      if (typeof GAL.VN.onFinish === 'function') GAL.VN.onFinish();
      return;
    }
    if (state.typing) { finishTyping(); return; }
    Sfx.click();
    exec(state.index + 1, false);
  }

  function back() {
    var i = state.index - 1;
    while (i >= 0 && typeof state.steps[i].text !== 'string') i--;
    if (i < 0) { GAL.toast('已经是第一句了'); Sfx.error(); return; }
    Sfx.cancel();
    replayTo(i);
    exec(i, false);
  }

  function replayTo(target) {
    resetVisual();
    state.log = [];
    state.seen = {};
    for (var i = 0; i < target && i < state.steps.length; i++) {
      var s = state.steps[i];
      if (typeof s.text === 'string') {
        state.seen[i] = true;
        state.log.push({ who: s.who || '', kind: s.kind || (s.who ? 'say' : 'narration'), text: s.text, index: i });
        continue;
      }
      if (s.end) continue;
      applyVisual(s, true);
    }
  }

  function repeat() {
    var step = state.steps[state.index];
    if (!step || typeof step.text !== 'string') { Sfx.error(); return; }
    Sfx.click();
    renderText(step, false);
  }

  function setAuto(on) {
    state.auto = !!on;
    if (state.auto) state.skip = false;
    $$('[data-action="vn-auto"]').forEach(function (b) { b.classList.toggle('is-active', state.auto); });
    $$('[data-action="vn-skip"]').forEach(function (b) { b.classList.toggle('is-active', state.skip); });
    GAL.toast(state.auto ? '自动播放：开' : '自动播放：关');
    if (state.auto && !state.typing) onLineDone(true);
  }

  function setSkip(on) {
    state.skip = !!on;
    if (state.skip) state.auto = false;
    $$('[data-action="vn-auto"]').forEach(function (b) { b.classList.toggle('is-active', state.auto); });
    $$('[data-action="vn-skip"]').forEach(function (b) { b.classList.toggle('is-active', state.skip); });
    GAL.toast(state.skip ? '跳过中……' : '跳过：关');
    if (state.skip) {
      if (state.typing) finishTyping();
      else advance();
    }
  }

  function pause() {
    clearTimers();
  }

  function renderLog() {
    var body = el['log-body'];
    if (!body) return;
    body.textContent = '';
    if (!state.log.length) {
      var empty = document.createElement('p');
      empty.className = 'log-empty';
      empty.textContent = '还没有已读的台词。';
      body.appendChild(empty);
      return;
    }
    state.log.forEach(function (item, i) {
      var row = document.createElement('div');
      row.className = 'log-row';
      row.dataset.kind = item.kind;
      var who = document.createElement('span');
      who.className = 'log-who';
      who.textContent = item.who || '旁白';
      var txt = document.createElement('span');
      txt.className = 'log-text';
      txt.textContent = item.text;
      row.appendChild(who);
      row.appendChild(txt);
      body.appendChild(row);
      if (i === state.log.length - 1) {
        global.setTimeout(function () { row.scrollIntoView({ block: 'nearest' }); }, 30);
      }
    });
    global.setTimeout(function () { body.scrollTop = body.scrollHeight; }, 40);
  }

  /* ---------------- 存档接口 ---------------- */
  function saveState() {
    var step = state.steps[state.index] || {};
    var p = progressOf(state.index);
    return {
      chapterId: state.chapterId,
      chapter: state.chapterTitle,
      step: state.index,
      speaker: step.who || '',
      text: step.text || state.fullText || '',
      kind: step.kind || '',
      line: Math.max(0, p.now - 1),
      total: p.total,
      progress: p.total ? p.now / p.total : 0,
      scene: state.chapterId
    };
  }

  function start(chapterId, step) {
    cache();
    var chapters = GAL.Chapters || {};
    var ch = chapters[chapterId] || chapters[(GAL.chapterOrder || [])[0]];
    if (!ch) { GAL.toast('剧本缺失', 'error'); return; }
    if (!chapters[chapterId]) chapterId = ch.id;

    state.chapterId = ch.id;
    state.chapterTitle = ch.title;
    state.steps = ch.steps;
    state.auto = state.skip = false;
    state.ended = false;
    state.log = [];
    state.seen = {};
    $$('[data-action="vn-auto"],[data-action="vn-skip"]').forEach(function (b) { b.classList.remove('is-active'); });

    if (el['hud-chapter']) el['hud-chapter'].textContent = ch.title;

    preloadChapter();              /* 本章素材提前拉，读到那一句时基本已就绪 */

    var target = (typeof step === 'number' && step >= 0 && step < ch.steps.length) ? step : 0;
    if (target > 0) {
      replayTo(target);
      exec(target, false);
    } else {
      resetVisual();
      exec(0, false);
    }
    updateProgress();
  }

  var VN = {
    state: state,
    cache: cache,
    start: start,
    advance: advance,
    back: back,
    repeat: repeat,
    setAuto: setAuto,
    setSkip: setSkip,
    toggleAuto: function () { setAuto(!state.auto); },
    toggleSkip: function () { setSkip(!state.skip); },
    pause: pause,
    renderLog: renderLog,
    saveState: saveState,
    onFinish: null,
    isEnded: function () { return state.ended; },
    actions: {
      'vn-repeat': function () { repeat(); },
      'vn-auto': function () { VN.toggleAuto(); },
      'vn-skip': function () { VN.toggleSkip(); },
      'vn-config': function () { GAL.VN.pause(); Sfx.click(); GAL.openSettings && GAL.openSettings(); },
      'vn-log': function () { renderLog(); Sfx.click(); GAL.Modal.open('modal-log'); },
      'vn-back': function () { back(); },
      'vn-forward': function () { advance(); }
    }
  };
  GAL.VN = VN;
})(window);
