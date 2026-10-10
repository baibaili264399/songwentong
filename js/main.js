/* ============================================================
   《错位夜宵》主菜单 / 存档交互  v0.1.0
   ============================================================ */
(function (global) {
  'use strict';
  var GAL = global.GAL;
  var $ = GAL.$, $$ = GAL.$$;
  var Sfx = GAL.Sfx, Modal = GAL.Modal, Saves = GAL.Saves, Settings = GAL.Settings, fmt = GAL.fmt;

  /* ---------------- 序章占位剧本（正式脚本见 docs/序章脚本.md） ---------------- */
  var SCRIPT = {
    chapter: '序章 · 错位夜宵',
    lines: [
      { speaker: '男主', text: '「呼……终于通关了。」' },
      { speaker: '男主', text: '熬到这个点，眼睛都快睁不开了。向后靠在电竞椅上，长长伸一个懒腰——骨头咔咔响。' },
      { speaker: '',     text: '（肚子「咕——」地响了一声。深夜的房间只剩显示器幽幽的白光。）' },
      { speaker: '男主', text: '「好饿。看看余额还剩多少……」' },
      { speaker: '男主', text: '「11.30 元。……行吧，就那个 9.9 的拼好饭炸鸡套餐。」' },
      { speaker: '',     text: '（点击下单。画面慢慢变黑，黑屏转场，跳过外卖等待的几十分钟。）' },
      { speaker: '',     text: '（深夜楼道，手电筒的微光。拖鞋声、塑料袋沙沙声。回房，关门。）' },
      { speaker: '男主', text: '（撕开包装，迫不及待咬下一大口。很香，很脆——）' },
      { speaker: '',     text: '（突如其来的刺耳耳鸣灌满大脑！世界色彩瞬间扭曲、错位、撕裂，眩晕砸落意识。）' },
      { speaker: '男主', text: '「啊——！」' },
      { speaker: '',     text: '【穿越完成】短暂黑暗后，温柔的光、微风、树叶沙沙声缓慢填满视野。' },
      { speaker: '男主', text: '（内心震炸裂）不是做梦……我附身到「我刚刚通关的 Galgame」的原作男主身上了？！' },
      { speaker: '旁白', text: '—— 序章结束。第一章「校园日常」尚在制作中，本版本先把主菜单与存档系统跑通。' }
    ]
  };

  /* ---------------- 运行时状态 ---------------- */
  var state = {
    screen: 'title',
    booted: false,
    line: 0,
    fullText: '',
    typing: false,
    typeTimer: null,
    playtime: 0,
    slotMode: 'load',
    confirmOk: null
  };

  var el = {};

  /* ---------------- 元素缓存 ---------------- */
  function cacheEls() {
    [
      'stage', 'screen-title', 'screen-game', 'main-menu', 'side-latest', 'foot-store',
      'dust', 'boot', 'title-char-wrap', 'game-char', 'dialogue',
      'speaker', 'dialogue-text', 'caret', 'hud-chapter', 'hud-playtime', 'hud-line',
      'modal-slots', 'slots-title', 'slots-hint', 'slot-grid', 'auto-row', 'slots-storage', 'btn-wipe',
      'modal-settings', 'set-speed', 'set-speed-out', 'set-sfx', 'set-sfx-out', 'set-bgm',
      'set-sfx-enabled', 'set-autosave', 'btn-fullscreen', 'btn-reset-settings',
      'modal-about', 'modal-confirm', 'confirm-title', 'confirm-message', 'confirm-ok', 'confirm-cancel',
      'toast-layer'
    ].forEach(function (id) { el[id] = document.getElementById(id); });
  }

  /* ---------------- 屏幕切换 ---------------- */
  function setScreen(name) {
    state.screen = name;
    el['screen-title'].classList.toggle('is-active', name === 'title');
    el['screen-game'].classList.toggle('is-active', name === 'game');
    if (name === 'game') {
      state.enterGameAt = Date.now();
      autosave(true);
    }
    refreshTitleState();
  }

  /* ---------------- 标题状态刷新 ---------------- */
  function refreshTitleState() {
    var latest = Saves.latest();

    var cont = $('[data-action="continue"]', el['main-menu']);
    if (cont) {
      cont.disabled = !latest;
      cont.title = latest
        ? '从「' + Saves.label(latest.slot) + '」继续 · ' + fmt.relative(latest.savedAt)
        : '暂无存档，先开始新游戏';
    }

    if (el['side-latest']) {
      el['side-latest'].textContent = latest
        ? '「' + Saves.label(latest.slot) + '」' + (latest.chapter || '') + ' · ' + fmt.date(latest.savedAt) + '（' + fmt.relative(latest.savedAt) + '）'
        : '尚无存档记录 · 点击「开始游戏」进入序章';
    }

    if (el['foot-store']) {
      var ok = GAL.store.isPersistent();
      el['foot-store'].textContent = '存储：' + (ok ? '本地存储可用' : '仅当前会话');
      el['foot-store'].classList.toggle('is-memory', !ok);
    }
  }

  /* ---------------- 对话演出 ---------------- */
  function typeText(text) {
    var node = el['dialogue-text'];
    global.clearTimeout(state.typeTimer);
    node.textContent = '';
    state.fullText = text;
    el['caret'].classList.remove('is-on');

    var delay = GAL.textDelay();
    if (delay <= 0) { node.textContent = text; state.typing = false; el['caret'].classList.add('is-on'); return; }

    state.typing = true;
    var i = 0, tick = 0;
    (function step() {
      if (i >= text.length) { state.typing = false; el['caret'].classList.add('is-on'); return; }
      node.textContent += text.charAt(i++);
      if (++tick % 4 === 0) Sfx.type();
      state.typeTimer = global.setTimeout(step, delay);
    })();
  }

  function finishTyping() {
    global.clearTimeout(state.typeTimer);
    el['dialogue-text'].textContent = state.fullText;
    state.typing = false;
    el['caret'].classList.add('is-on');
  }

  function showLine(index) {
    var line = SCRIPT.lines[index];
    if (!line) return;
    state.line = index;

    el['hud-chapter'].textContent = SCRIPT.chapter;
    el['hud-line'].textContent = (index + 1) + ' / ' + SCRIPT.lines.length;

    var speaker = el['speaker'];
    if (line.speaker) {
      speaker.textContent = line.speaker;
      speaker.classList.remove('is-hidden');
    } else {
      speaker.textContent = '';
      speaker.classList.add('is-hidden');
    }
    typeText(line.text);
  }

  function advance() {
    if (Modal.isOpen()) return;
    if (state.typing) { finishTyping(); return; }
    if (state.line + 1 < SCRIPT.lines.length) {
      showLine(state.line + 1);
    } else {
      Sfx.error();
      GAL.toast('第一章尚未制作，先回标题继续打磨菜单吧', 'warn');
    }
  }

  /* ---------------- 存档读写 ---------------- */
  function currentPayload() {
    var line = SCRIPT.lines[state.line] || {};
    return {
      chapter: SCRIPT.chapter,
      speaker: line.speaker || '',
      text: line.text || '',
      line: state.line,
      total: SCRIPT.lines.length,
      progress: (state.line + 1) / SCRIPT.lines.length,
      playtime: state.playtime,
      scene: 'prologue'
    };
  }

  function doSave(id, silent) {
    if (state.screen !== 'game') {
      Sfx.error();
      GAL.toast('当前没有进行中的游戏', 'warn');
      return false;
    }
    var res = Saves.write(id, currentPayload());
    renderSlots();
    refreshTitleState();
    Sfx.confirm();
    if (!silent) {
      GAL.toast('已保存到「' + Saves.label(id) + '」' + (res.persisted ? '' : '（仅本次会话）'), 'ok');
    }
    return true;
  }

  function autosave(silent) {
    if (!Settings.current().autoSave) return;
    if (state.screen !== 'game') return;
    Saves.write('auto', currentPayload());
    refreshTitleState();
    if (!silent) GAL.toast('已自动存档', 'ok');
  }

  function loadSlot(id) {
    var data = Saves.get(id);
    if (!data) { Sfx.error(); GAL.toast('该存档位是空的', 'warn'); return; }
    Sfx.confirm();
    Modal.closeAll();
    state.line = Math.max(0, Math.min(data.line || 0, SCRIPT.lines.length - 1));
    state.playtime = data.playtime || 0;
    setScreen('game');
    showLine(state.line);
    GAL.toast('已读取「' + Saves.label(id) + '」 · ' + fmt.date(data.savedAt), 'ok');
  }

  /* ---------------- 存档面板 ---------------- */
  function openSlots(mode) {
    state.slotMode = mode;
    Sfx.click();
    renderSlots();
    Modal.open('modal-slots');
  }

  function renderSlots() {
    if (!el['slot-grid']) return;
    var mode = state.slotMode;
    var isSave = mode === 'save';
    var isManage = mode === 'manage';

    el['slots-title'].textContent = isSave ? '存档' : (isManage ? '存档管理' : '读取存档');
    el['slots-hint'].textContent = isSave
      ? '选择存档位写入当前进度（会覆盖该位原有数据）'
      : (isManage ? '点击存档位可展开详情，点击右上角 ✕ 删除该存档' : '选择一个存档位载入进度');
    el['slots-storage'].textContent = GAL.store.isPersistent()
      ? '存档位置：浏览器本地存储 · 自动 1 位 + 手动 6 位'
      : '⚠ 本地存储不可用，本次进度仅保留在当前页面';

    el['auto-row'].textContent = '';
    el['auto-row'].appendChild(buildSlot('auto'));

    el['slot-grid'].textContent = '';
    Saves.manualSlots.forEach(function (id) { el['slot-grid'].appendChild(buildSlot(id)); });
  }

  function buildSlot(id) {
    var data = Saves.get(id);
    var isAuto = id === 'auto';

    var card = document.createElement('div');
    card.className = 'slot' + (data ? '' : ' is-empty');
    card.dataset.slot = id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    var thumb = document.createElement('div');
    thumb.className = 'slot-thumb';
    if (data) {
      var img = document.createElement('img');
      img.src = 'assets/images/fish.png';
      img.alt = '';
      thumb.appendChild(img);
    } else {
      thumb.classList.add('is-none');
      thumb.textContent = 'EMPTY';
    }

    var info = document.createElement('div');
    info.className = 'slot-info';

    var name = document.createElement('div');
    name.className = 'slot-name';
    name.textContent = Saves.label(id);
    if (isAuto) {
      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'AUTO';
      name.appendChild(badge);
    }
    info.appendChild(name);

    if (data) {
      var chapter = document.createElement('div');
      chapter.className = 'slot-chapter';
      chapter.textContent = data.chapter || '序章 · 错位夜宵';
      info.appendChild(chapter);

      var preview = document.createElement('div');
      preview.className = 'slot-preview';
      preview.textContent = data.text || '（无台词记录）';
      info.appendChild(preview);

      var meta = document.createElement('div');
      meta.className = 'slot-meta';
      meta.textContent = fmt.date(data.savedAt) + ' · ' + fmt.relative(data.savedAt) + ' · 游玩 ' + fmt.duration(data.playtime);
      info.appendChild(meta);

      var detail = document.createElement('div');
      detail.className = 'slot-detail';
      detail.textContent = '进度：第 ' + ((data.line || 0) + 1) + ' / ' + (data.total || '?') + ' 句'
        + '　场景：' + (data.scene || 'prologue')
        + (data.speaker ? '　说话人：' + data.speaker : '');
      info.appendChild(detail);
    } else {
      var emptyTitle = document.createElement('div');
      emptyTitle.className = 'slot-chapter';
      emptyTitle.textContent = '空存档位';
      info.appendChild(emptyTitle);

      var tip = document.createElement('div');
      tip.className = 'slot-preview';
      tip.textContent = state.slotMode === 'save' ? '点击写入当前进度' : '暂无可读取的进度';
      info.appendChild(tip);
    }

    card.appendChild(thumb);
    card.appendChild(info);

    if (data && state.slotMode !== 'load') {
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'slot-del';
      del.textContent = '✕';
      del.title = '删除该存档';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        askDelete(id);
      });
      card.appendChild(del);
    }

    card.addEventListener('click', function () { onSlotClick(id, data); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSlotClick(id, data); }
    });
    card.addEventListener('mouseenter', function () { Sfx.hover(); });
    return card;
  }

  function onSlotClick(id, data) {
    var mode = state.slotMode;

    if (mode === 'manage') {
      if (!data) { Sfx.error(); GAL.toast('该存档位是空的'); return; }
      Sfx.click();
      var card = el['auto-row'].querySelector('[data-slot="' + id + '"]')
        || el['slot-grid'].querySelector('[data-slot="' + id + '"]');
      if (card) card.classList.toggle('is-expanded');
      return;
    }

    if (mode === 'load') {
      if (!data) { Sfx.error(); GAL.toast('该存档位是空的', 'warn'); return; }
      loadSlot(id);
      return;
    }

    /* 存档模式 */
    if (state.screen !== 'game') { Sfx.error(); GAL.toast('当前没有进行中的游戏', 'warn'); return; }
    if (data) {
      confirmDialog({
        title: '覆盖存档',
        message: '「' + Saves.label(id) + '」已存在 ' + fmt.date(data.savedAt) + ' 的存档（' + (data.chapter || '') + '），确定覆盖吗？',
        okText: '覆盖',
        danger: true,
        onOk: function () { doSave(id); Modal.close('modal-slots'); }
      });
    } else {
      doSave(id);
      Modal.close('modal-slots');
    }
  }

  function askDelete(id) {
    confirmDialog({
      title: '删除存档',
      message: '确定删除「' + Saves.label(id) + '」吗？该操作不可撤销。',
      okText: '删除',
      danger: true,
      onOk: function () {
        Saves.remove(id);
        renderSlots();
        refreshTitleState();
        GAL.toast('已删除「' + Saves.label(id) + '」', 'ok');
      }
    });
  }

  /* ---------------- 确认框 ---------------- */
  function confirmDialog(opts) {
    el['confirm-title'].textContent = opts.title || '确认';
    el['confirm-message'].textContent = opts.message || '';
    el['confirm-ok'].textContent = opts.okText || '确定';
    el['confirm-ok'].classList.toggle('btn-danger', !!opts.danger && !opts.okGhost);
    state.confirmOk = opts.onOk || null;
    Sfx.click();
    Modal.open('modal-confirm');
  }

  function resolveConfirm() {
    Modal.close('modal-confirm');
    var fn = state.confirmOk;
    state.confirmOk = null;
    if (typeof fn === 'function') fn();
  }

  function cancelConfirm() {
    state.confirmOk = null;
    Modal.close('modal-confirm');
    Sfx.cancel();
  }

  /* ---------------- 设置面板 ---------------- */
  function applySettingsToUI() {
    var s = Settings.current();
    el['set-speed'].value = s.textSpeed;
    el['set-speed-out'].textContent = s.textSpeed;
    el['set-sfx'].value = s.sfxVolume;
    el['set-sfx-out'].textContent = s.sfxVolume;
    el['set-bgm'].value = s.bgmVolume;
    el['set-sfx-enabled'].checked = !!s.sfxEnabled;
    el['set-autosave'].checked = !!s.autoSave;
    updateFullscreenLabel();
  }

  function updateFullscreenLabel() {
    var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    el['btn-fullscreen'].textContent = isFs ? '退出全屏' : '切换全屏';
  }

  /* ---------------- 交互绑定 ---------------- */
  var actions = {
    'new': function () {
      Sfx.confirm();
      state.line = 0;
      state.playtime = 0;
      setScreen('game');
      showLine(0);
      GAL.toast('开始新游戏 · 序章「错位夜宵」', 'ok');
    },
    'continue': function () {
      var latest = Saves.latest();
      if (!latest) { Sfx.error(); GAL.toast('还没有任何存档', 'warn'); return; }
      loadSlot(latest.slot);
    },
    'load': function () { openSlots('load'); },
    'slots': function () { openSlots('manage'); },
    'settings': function () { Sfx.click(); applySettingsToUI(); Modal.open('modal-settings'); },
    'about': function () { Sfx.confirm(); Modal.open('modal-about'); },
    'game-save': function () { openSlots('save'); },
    'game-load': function () { openSlots('load'); },
    'to-title': function () { goTitle(); }
  };

  function goTitle() {
    if (state.screen === 'game') autosave(false);
    Sfx.cancel();
    Modal.closeAll();
    setScreen('title');
    var first = $('.menu-item', el['main-menu']);
    if (first) first.focus();
  }

  function bindActions() {
    el['stage'].addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-action]');
      if (!trigger || trigger.disabled) return;
      var fn = actions[trigger.getAttribute('data-action')];
      if (fn) fn();
    });

    el['stage'].addEventListener('mouseover', function (e) {
      var trigger = e.target.closest('[data-action], .menu-item, .slot, .panel-close');
      if (!trigger) return;
      if (trigger === state.lastHover) return;
      state.lastHover = trigger;
      Sfx.hover();
    });
    el['stage'].addEventListener('mouseout', function () {
      state.lastHover = null;
    });
  }

  function bindGameScreen() {
    el['screen-game'].addEventListener('click', function (e) {
      if (e.target.closest('[data-action]')) return;
      advance();
    });
    el['screen-game'].addEventListener('mousedown', function () {
      el['screen-game'].classList.add('is-advancing');
      global.setTimeout(function () { el['screen-game'].classList.remove('is-advancing'); }, 160);
    });
  }

  function bindOverlays() {
    $$('.overlay').forEach(function (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target !== overlay) return;
        if (overlay.id === 'modal-confirm') { cancelConfirm(); return; }
        Sfx.cancel();
        Modal.close(overlay.id);
      });
    });

    $$('[data-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var overlay = btn.closest('.overlay');
        Sfx.cancel();
        if (overlay) Modal.close(overlay.id);
      });
    });
  }

  function bindSlotsPanel() {
    el['btn-wipe'].addEventListener('click', function () {
      confirmDialog({
        title: '清空全部存档',
        message: '将删除自动存档与全部手动存档（共 ' + Saves.count() + ' 条），确定继续吗？',
        okText: '全部清空',
        danger: true,
        onOk: function () {
          Saves.clear();
          renderSlots();
          refreshTitleState();
          GAL.toast('全部存档已清空', 'ok');
        }
      });
    });
  }

  function bindSettingsPanel() {
    el['set-speed'].addEventListener('input', function () {
      var v = parseInt(this.value, 10) || 0;
      el['set-speed-out'].textContent = v;
      Settings.set('textSpeed', v);
    });

    el['set-sfx'].addEventListener('input', function () {
      var v = parseInt(this.value, 10) || 0;
      el['set-sfx-out'].textContent = v;
      Settings.set('sfxVolume', v);
      Sfx.setVolume(v);
    });
    el['set-sfx'].addEventListener('change', function () { Sfx.confirm(); });

    el['set-bgm'].addEventListener('input', function () {
      Settings.set('bgmVolume', parseInt(this.value, 10) || 0);
    });

    el['set-sfx-enabled'].addEventListener('change', function () {
      Settings.set('sfxEnabled', this.checked);
      Sfx.setEnabled(this.checked);
      if (this.checked) Sfx.confirm();
    });

    el['set-autosave'].addEventListener('change', function () {
      Settings.set('autoSave', this.checked);
      GAL.toast(this.checked ? '已开启自动存档' : '已关闭自动存档', 'ok');
    });

    el['btn-fullscreen'].addEventListener('click', function () {
      var doc = document;
      var isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
      var root = doc.documentElement;
      try {
        if (isFs) {
          (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
        } else {
          (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
        }
      } catch (e) { GAL.toast('当前环境不支持全屏', 'warn'); }
    });

    ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (evt) {
      document.addEventListener(evt, updateFullscreenLabel);
    });

    el['btn-reset-settings'].addEventListener('click', function () {
      Settings.reset();
      Settings.applyAudio();
      applySettingsToUI();
      Sfx.confirm();
      GAL.toast('已恢复默认设置', 'ok');
    });

    el['confirm-ok'].addEventListener('click', resolveConfirm);
    el['confirm-cancel'].addEventListener('click', cancelConfirm);
  }

  function bindKeyboard() {
    document.addEventListener('keydown', function (e) {
      var key = e.key;

      if (!state.booted) {
        if (key === 'Enter' || key === ' ') { e.preventDefault(); enterBoot(); }
        return;
      }

      if (key === 'Escape') {
        var top = Modal.top();
        if (top) {
          e.preventDefault();
          if (top === 'modal-confirm') { cancelConfirm(); return; }
          Sfx.cancel();
          Modal.close(top);
          return;
        }
        if (state.screen === 'game') { e.preventDefault(); goTitle(); }
        return;
      }

      if (Modal.isOpen()) return;

      if (state.screen === 'title') {
        var items = $$('.menu-item', el['main-menu']).filter(function (b) { return !b.disabled; });
        if (!items.length) return;
        var idx = items.indexOf(document.activeElement);
        if (key === 'ArrowDown' || key === 'ArrowUp') {
          e.preventDefault();
          var step = key === 'ArrowDown' ? 1 : -1;
          var next = idx < 0 ? (step > 0 ? items[0] : items[items.length - 1])
                             : items[(idx + step + items.length) % items.length];
          Sfx.hover();
          next.focus();
        }
        return;
      }

      if (state.screen === 'game') {
        if (key === 'Enter' || key === ' ' || key === 'ArrowRight') { e.preventDefault(); advance(); }
        else if (key === 's' || key === 'S') { e.preventDefault(); openSlots('save'); }
        else if (key === 'l' || key === 'L') { e.preventDefault(); openSlots('load'); }
      }
    });
  }

  /* ---------------- 粒子背景 ---------------- */
  function initDust() {
    var canvas = el['dust'];
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var motes = [], w = 1, h = 1;

    function measure() {
      var rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn() {
      var count = Math.round(w / 24) + 16;
      motes = [];
      for (var i = 0; i < count; i++) {
        motes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.8 + 0.5,
          speed: Math.random() * 0.24 + 0.05,
          alpha: Math.random() * 0.45 + 0.10,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    measure();
    spawn();
    global.addEventListener('resize', function () { measure(); spawn(); });

    (function loop() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        m.y -= m.speed;
        m.phase += 0.012;
        m.x += Math.sin(m.phase) * 0.2;
        if (m.y < -8) { m.y = h + 8; m.x = Math.random() * w; }
        ctx.beginPath();
        ctx.fillStyle = 'rgba(178, 214, 255, ' + m.alpha.toFixed(3) + ')';
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      global.requestAnimationFrame(loop);
    })();
  }

  /* ---------------- 轻微视差 ---------------- */
  function initParallax() {
    var wrap = el['title-char-wrap'];
    if (!wrap) return;
    var sec = false;
    el['stage'].addEventListener('mousemove', function (e) {
      var rect = el['stage'].getBoundingClientRect();
      var nx = (e.clientX - rect.left) / rect.width - 0.5;
      var ny = (e.clientY - rect.top) / rect.height - 0.5;
      if (sec) return;
      sec = true;
      global.requestAnimationFrame(function () {
        sec = false;
        wrap.style.transform = 'translate3d(' + (-nx * 26).toFixed(2) + 'px,' + (-ny * 16).toFixed(2) + 'px,0)';
      });
    });
  }

  /* ---------------- 计时器 ---------------- */
  function initTimers() {
    global.setInterval(function () {
      if (state.screen !== 'game') return;
      state.playtime += 1;
      el['hud-playtime'].textContent = fmt.duration(state.playtime);
    }, 1000);

    global.setInterval(function () {
      if (state.screen !== 'game') return;
      if (Modal.isOpen()) return;
      autosave(true);
    }, 45000);
  }

  /* ---------------- 启动屏 ---------------- */
  function enterBoot() {
    if (state.booted) return;
    state.booted = true;
    Sfx.unlock();
    Sfx.confirm();
    el['boot'].classList.add('is-hidden');
    global.setTimeout(function () { el['boot'].style.display = 'none'; }, 700);
    if (!GAL.store.isPersistent()) {
      global.setTimeout(function () {
        GAL.toast('本地存储不可用：本次进度仅保存在当前页面', 'warn');
      }, 800);
    }
    var first = $('.menu-item', el['main-menu']);
    if (first) first.focus();
  }

  function bindBoot() {
    el['boot'].addEventListener('click', enterBoot);
    document.addEventListener('keydown', enterBoot, { once: true });
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    cacheEls();
    Settings.load();
    Settings.applyAudio();
    applySettingsToUI();
    initDust();
    initParallax();
    initTimers();
    bindActions();
    bindGameScreen();
    bindOverlays();
    bindSlotsPanel();
    bindSettingsPanel();
    bindKeyboard();
    bindBoot();
    refreshTitleState();
    el['hud-playtime'].textContent = fmt.duration(0);
    applyDebugHash();
  }

  /* 开发用锚点：#skipboot / #game / #save / #load / #manage / #settings / #about / #selftest */
  function applyDebugHash() {
    var hash = (global.location.hash || '').replace('#', '');
    if (!hash) return;
    document.documentElement.classList.add('gal-shot'); /* 关闭过渡，便于静态截图 */
    global.setTimeout(function () {
      enterBoot();
      if (hash === 'selftest') { runSelfTest(); return; }
      if (hash === 'game') actions['new']();
      else if (hash === 'save') openSlots('save');
      else if (hash === 'load') openSlots('load');
      else if (hash === 'manage') openSlots('manage');
      else if (hash === 'settings') actions['settings']();
      else if (hash === 'about') actions['about']();
    }, 60);
  }

  /* 端到端自检：校验存档 / 读档 / 设置链路（结果写入 body[data-selftest]） */
  function runSelfTest() {
    var log = [];
    function check(name, cond) { log.push((cond ? 'PASS' : 'FAIL') + ' :: ' + name); }

    Saves.clear();
    check('清空后无存档', Saves.count() === 0 && !Saves.latest());

    actions['new']();
    check('开始游戏后自动存档已写入', !!Saves.get('auto') && state.line === 0);

    state.line = 3;
    Saves.write('3', currentPayload());
    check('手动存档写入 slot3', !!Saves.get('3') && Saves.get('3').line === 3);
    check('存档总数 = 2', Saves.count() === 2);
    check('latest 指向最新存档', (Saves.latest() || {}).slot === '3');

    state.line = 0;
    loadSlot('3');
    check('读档后回到第 4 句', state.line === 3 && state.screen === 'game');

    autosave(false);
    check('自动存档覆盖 auto', (Saves.get('auto') || {}).line === 3);

    Saves.remove('3');
    check('删除存档 slot3', !Saves.get('3') && Saves.count() === 1);

    Settings.set('textSpeed', 100);
    check('设置写入且瞬显生效', Settings.current().textSpeed === 100 && GAL.textDelay() === 0);
    Settings.reset();
    check('恢复默认设置', Settings.current().textSpeed === 55 && GAL.textDelay() > 0);

    Saves.clear();
    check('清空全部存档', Saves.count() === 0 && !Saves.latest());
    setScreen('title');

    var failed = log.filter(function (l) { return l.indexOf('FAIL') === 0; }).length;
    document.body.setAttribute('data-selftest', 'TOTAL=' + log.length + ' FAILED=' + failed + ' || ' + log.join(' || '));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  GAL.debug = { state: state, SCRIPT: SCRIPT, Saves: Saves };
})(window);
