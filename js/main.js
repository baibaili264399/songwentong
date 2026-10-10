/* ============================================================
   《错位夜宵》主菜单 / 存档交互  v0.1.0
   ============================================================ */
(function (global) {
  'use strict';
  var GAL = global.GAL;
  var $ = GAL.$, $$ = GAL.$$;
  var Sfx = GAL.Sfx, Modal = GAL.Modal, Saves = GAL.Saves, Settings = GAL.Settings, fmt = GAL.fmt;

  /* ---------------- 剧本已迁移到 js/script.js（GAL.Chapters），演出由 js/vn.js 负责 ---------------- */

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
      'dust', 'boot', 'title-char-wrap', 'vn-box',
      'speaker', 'dialogue-text', 'caret', 'hud-chapter', 'hud-playtime', 'hud-line',
      'modal-slots', 'slots-title', 'slots-hint', 'slot-grid', 'auto-row', 'slots-storage', 'btn-wipe',
      'modal-settings', 'set-speed', 'set-speed-out', 'set-sfx', 'set-sfx-out', 'set-bgm',
      'set-sfx-enabled', 'set-autosave', 'set-smooth', 'btn-fullscreen', 'btn-reset-settings',
      'modal-about', 'modal-confirm', 'confirm-title', 'confirm-message', 'confirm-ok', 'confirm-cancel',
      'toast-layer'
    ].forEach(function (id) { el[id] = document.getElementById(id); });
  }

  /* ---------------- 屏幕切换 ---------------- */
  function setScreen(name) {
    state.screen = name;
    if (name !== 'game' && GAL.VN) GAL.VN.pause();
    el['screen-title'].classList.toggle('is-active', name === 'title');
    el['screen-game'].classList.toggle('is-active', name === 'game');
    if (name === 'game') state.enterGameAt = Date.now();
    document.body.classList.toggle('is-playing', name === 'game');
    if (dustApi) { if (name === 'title') dustApi.start(); else dustApi.stop(); }
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

  /* ---------------- 对话演出（由 js/vn.js 演出引擎接管） ---------------- */
  function vn() { return GAL.VN; }

  function startChapter(chapterId, step) {
    if (!vn()) { GAL.toast('演出引擎未加载', 'error'); return; }
    setScreen('game');
    vn().start(chapterId || (GAL.chapterOrder || ['ch1'])[0], step);
    autosave(true);
  }

  function advance() {
    if (Modal.isOpen()) return;
    if (vn()) vn().advance();
  }

  /* ---------------- 存档读写 ---------------- */
  function currentPayload() {
    var s = vn() ? vn().saveState() : {};
    s.playtime = state.playtime;
    return s;
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
    if (vn() && vn().isEnded()) return;
    Saves.write('auto', currentPayload());
    refreshTitleState();
    if (!silent) GAL.toast('已自动存档', 'ok');
  }

  function loadSlot(id) {
    var data = Saves.get(id);
    if (!data) { Sfx.error(); GAL.toast('该存档位是空的', 'warn'); return; }
    Sfx.confirm();
    Modal.closeAll();
    state.playtime = data.playtime || 0;
    startChapter(data.chapterId || data.scene || 'ch1', data.step || 0);
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
      ? '存档位置：浏览器本地存储 · 自动 1 位 + 快速 1 位 + 手动 6 位'
      : '⚠ 本地存储不可用，本次进度仅保留在当前页面';

    el['auto-row'].textContent = '';
    Saves.specialSlots.forEach(function (id) { el['auto-row'].appendChild(buildSlot(id)); });

    el['slot-grid'].textContent = '';
    Saves.manualSlots.forEach(function (id) { el['slot-grid'].appendChild(buildSlot(id)); });
  }

  function buildSlot(id) {
    var data = Saves.get(id);
    var isAuto = id === 'auto';
    var isQuick = id === 'quick';

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
    if (isAuto || isQuick) {
      var badge = document.createElement('span');
      badge.className = 'badge' + (isQuick ? ' badge-quick' : '');
      badge.textContent = isAuto ? 'AUTO' : 'QUICK';
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
    applySmooth();               /* 顺带把 set-smooth 勾选同步成实际生效值 */
    updateFullscreenLabel();
  }

  /* 流畅模式（省电）：关掉每帧都在花钱的模糊 / 常驻动画 / 横移镜头，并缩短淡入。
     未设置过（null）= 自动：触屏开、桌面关。实时判定，避免初始化顺序影响结果。 */
  function applySmooth() {
    var s = Settings.current();
    var on = (s.smoothMode === null || s.smoothMode === undefined)
      ? !!(GAL.Mobile && GAL.Mobile.isTouch)
      : !!s.smoothMode;
    document.body.classList.toggle('smooth-mode', on);
    if (el['set-smooth']) el['set-smooth'].checked = on;
    return on;
  }

  function updateFullscreenLabel() {
    var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    el['btn-fullscreen'].textContent = isFs ? '退出全屏' : '切换全屏';
  }

  /* ---------------- 交互绑定 ---------------- */
  var actions = {
    'new': function () {
      Sfx.confirm();
      state.playtime = 0;
      startChapter('ch1', 0);
    },
    'continue': function () {
      var latest = Saves.latest();
      if (!latest) { Sfx.error(); GAL.toast('还没有任何存档', 'warn'); return; }
      loadSlot(latest.slot);
    },
    'load': function () { openSlots('load'); },
    'slots': function () { openSlots('manage'); },
    'settings': function () { openSettings(); },
    'about': function () { Sfx.confirm(); Modal.open('modal-about'); },
    'game-save': function () { openSlots('save'); },
    'game-load': function () { openSlots('load'); },
    'to-title': function () { goTitle(); },
    /* 快速存读档 → 独立 quick 存档位 */
    'vn-qsave': function () {
      if (state.screen !== 'game') { Sfx.error(); GAL.toast('当前没有进行中的游戏', 'warn'); return; }
      doSave('quick');
    },
    'vn-qload': function () {
      if (!Saves.get('quick')) { Sfx.error(); GAL.toast('还没有快速存档', 'warn'); return; }
      loadSlot('quick');
    }
  };

  function openSettings() {
    Sfx.click();
    if (vn()) vn().pause();
    applySettingsToUI();
    Modal.open('modal-settings');
  }

  function goTitle() {
    if (state.screen === 'game') {
      if (vn()) vn().pause();
      autosave(false);
    }
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
      var name = trigger.getAttribute('data-action');
      var fn = actions[name] || (GAL.VN && GAL.VN.actions ? GAL.VN.actions[name] : null);
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

    var smooth = el['set-smooth'];
    if (smooth) {
      smooth.addEventListener('change', function () {
        Settings.set('smoothMode', this.checked);
        applySmooth();
        GAL.toast(this.checked ? '流畅模式：开（更省电，关闭模糊与横移）' : '流畅模式：关（画面更华丽，但更耗电）', 'ok');
      });
    }

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
        else if (key === 'ArrowLeft') { e.preventDefault(); if (vn()) vn().back(); }
        else if (key === 's' || key === 'S') { e.preventDefault(); openSlots('save'); }
        else if (key === 'l' || key === 'L') { e.preventDefault(); openSlots('load'); }
        else if (key === 'a' || key === 'A') { e.preventDefault(); if (vn()) vn().toggleAuto(); }
        else if (key === 'k' || key === 'K') { e.preventDefault(); if (vn()) vn().toggleSkip(); }
        else if (key === 'h' || key === 'H') { e.preventDefault(); if (vn()) vn().actions['vn-log'](); }
      }
    });
  }

  /* ---------------- 粒子背景 ----------------
     只在标题页跑：剧情页根本看不见它，之前却一直在每帧重绘（手机上一直烧 CPU/GPU）。 */
  var dustApi = null;

  function initDust() {
    var canvas = el['dust'];
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var motes = [], w = 1, h = 1;
    var raf = 0, running = false, last = 0;
    var isTouch = !!(GAL.Mobile && GAL.Mobile.isTouch);
    var minGap = isTouch ? 34 : 0;          /* 触屏降到 ~30fps */
    var density = isTouch ? 40 : 24;

    function measure() {
      var rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn() {
      var count = Math.round(w / density) + (isTouch ? 10 : 16);
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

    function active() {
      return !document.hidden &&
        el['screen-title'] && el['screen-title'].classList.contains('is-active');
    }

    function frame(ts) {
      if (!active()) { running = false; raf = 0; return; }
      raf = global.requestAnimationFrame(frame);
      if (minGap && ts - last < minGap) return;
      last = ts;

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
    }

    function start() {
      if (running || !active()) return;
      running = true;
      last = 0;
      raf = global.requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
    }

    measure();
    spawn();
    global.addEventListener('resize', function () { measure(); spawn(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (state.screen === 'title') start();
    });

    dustApi = { start: start, stop: stop };
    start();
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
    /* 移动端：借这次真实用户手势进入全屏并尝试锁定横屏（必须在手势回调里调用） */
    if (GAL.Mobile) GAL.Mobile.requestImmersive();
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
    /* 对外暴露给 vn.js / 脚本层使用 */
    GAL.openSettings = openSettings;
    GAL.applySmooth = applySmooth;
    if (GAL.VN) GAL.VN.onFinish = goTitle;
    applyDebugHash();
  }

  /* 开发用锚点（用 '-' 组合）：
       mobile / desktop  强制环境（用于在桌面浏览器预览手机布局）
       fit               把舞台钉成固定 880px 宽，便于在任意窗口里截手机版布局图
       stepN             直接从第一章第 N 步开始（截某一幕用），例如 step12
       其余：skipboot / game / save / load / manage / settings / about / selftest / measure
     例：#mobile-fit-step12 = 手机布局 + 固定舞台 + 跳到第 12 步 */
  function applyDebugHash() {
    var raw = (global.location.hash || '').replace('#', '');
    if (!raw) return;
    document.documentElement.classList.add('gal-shot'); /* 关闭过渡，便于静态截图 */

    var parts = raw.split('-');
    var wantFit = parts.indexOf('fit') >= 0;
    parts = parts.filter(function (p) { return p !== 'fit'; });

    if (parts[0] === 'mobile') { if (GAL.Mobile) GAL.Mobile.force('mobile'); parts.shift(); }
    else if (parts[0] === 'desktop') { if (GAL.Mobile) GAL.Mobile.force('desktop'); parts.shift(); }

    var hash = parts.join('-') || 'skipboot';
    if (wantFit) el['stage'].style.setProperty('--sw', '880px');

    var stepMatch = /^step(\d+)$/.exec(hash);
    var jumpStep = stepMatch ? parseInt(stepMatch[1], 10) : null;

    global.setTimeout(function () {
      enterBoot();
      if (hash === 'selftest') { runSelfTest(); return; }
      if (hash === 'measure') { measureLayout(); return; }
      if (hash === 'bgtest') { runBgTest(); return; }
      if (jumpStep !== null) { startChapter('ch1', jumpStep); return; }
      if (hash === 'game') actions['new']();
      else if (hash === 'log') {
        var spd = Settings.current().textSpeed;
        Settings.set('textSpeed', 100);
        actions['new']();
        for (var i = 0; i < 8; i++) if (GAL.VN) GAL.VN.advance();
        Settings.set('textSpeed', spd);
        if (GAL.VN) {
          GAL.VN.actions['vn-log']();
          document.body.setAttribute('data-loglen', String(GAL.VN.state.log.length));
          document.body.setAttribute('data-logfirst', (GAL.VN.state.log[0] || {}).text || '(空)');
        }
      }
      else if (hash === 'save') openSlots('save');
      else if (hash === 'load') openSlots('load');
      else if (hash === 'manage') openSlots('manage');
      else if (hash === 'settings') actions['settings']();
      else if (hash === 'about') actions['about']();
    }, 60);
  }

  /* 背景加载自检：故意让 Image 永远不回调，验证"图没到也必须把图层指过去" */
  function runBgTest() {
    var log = [];
    var RealImage = global.Image;
    Settings.set('textSpeed', 100);

    /* 1) 正常情况：能立刻拿到图 */
    startChapter('ch1', 5);
    global.setTimeout(function () {
      var on = pickOnLayer();
      log.push('正常加载: ' + (on && /bg-bench-close/.test(on.style.backgroundImage) ? 'PASS' : 'FAIL'));

      /* 2) 模拟图片永远加载不出来（不触发 onload / onerror） */
      global.Image = function () {
        var self = this;
        this.onload = null;
        this.onerror = null;
        Object.defineProperty(this, 'src', { set: function () {}, get: function () { return ''; } });
        return self;
      };
      GAL.VN.start('ch1', 0);
      GAL.VN.state.index = 8;    /* 停在第 8 步（bg-path 的前一句），下一步就是切图 */
      GAL.VN.advance();
      global.setTimeout(function () {
        var on2 = pickOnLayer();
        var url = on2 ? on2.style.backgroundImage : '';
        log.push('图卡住时翻页: ' + (/bg-path/.test(url) ? 'PASS' : 'FAIL') + ' (' + url.slice(0, 46) + ')');
        global.Image = RealImage;

        /* 3) 点"上一句"只能把状态倒回去，不能重放章节卡 / 白闪 */
        GAL.VN.start('ch1', 13);
        GAL.VN.back();
        global.setTimeout(function () {
          var card = document.getElementById('vn-card');
          var flash = document.getElementById('vn-flash');
          var bad = card.classList.contains('is-on') || flash.classList.contains('is-on');
          log.push('上一句不重放章节卡/白闪: ' + (bad ? 'FAIL' : 'PASS'));

          var failed = log.filter(function (l) { return l.indexOf('FAIL') > -1; }).length;
          document.body.setAttribute('data-bgtest', 'FAILED=' + failed + ' || ' + log.join(' || '));
        }, 400);
      }, 2000);
    }, 1500);
  }

  function pickOnLayer() {
    var a = document.getElementById('vn-bg-a');
    var b = document.getElementById('vn-bg-b');
    if (a && a.classList.contains('is-on')) return a;
    if (b && b.classList.contains('is-on')) return b;
    return a || b;
  }

  /* 布局量测（开发用）：把关键元素的实际几何写进 body[data-measure] */
  function measureLayout() {
    var report = {
      viewport: global.innerWidth + 'x' + global.innerHeight,
      bodyClass: document.body.className,
      stageW: Math.round(el['stage'].getBoundingClientRect().width)
    };
    [['#rotate-hint', 'hint'], ['.rotate-inner', 'inner'], ['.rotate-text', 'text'],
     ['.menu', 'menu'], ['.menu-item', 'menuItem'], ['.text-box', 'textbox'],
     ['.panel-wide', 'panelWide']].forEach(function (pair) {
      var node = document.querySelector(pair[0]);
      if (!node) { report[pair[1]] = 'none'; return; }
      var r = node.getBoundingClientRect();
      var cs = global.getComputedStyle(node);
      report[pair[1]] = Math.round(r.width) + 'x' + Math.round(r.height)
        + '@' + Math.round(r.left) + ',' + Math.round(r.top)
        + ' fs=' + cs.fontSize + ' disp=' + cs.display;
    });
    document.body.setAttribute('data-measure', JSON.stringify(report));
  }

  /* 端到端自检：校验剧情推进 / 存档 / 读档 / 设置链路（结果写入 body[data-selftest]） */
  function runSelfTest() {
    var log = [];
    function check(name, cond) { log.push((cond ? 'PASS' : 'FAIL') + ' :: ' + name); }
    var V = GAL.VN;

    Settings.set('textSpeed', 100);          /* 瞬显，保证推进是同步的 */
    Saves.clear();
    check('清空后无存档', Saves.count() === 0 && !Saves.latest());
    check('剧本已加载', !!(GAL.Chapters && GAL.Chapters.ch1 && GAL.Chapters.ch1.steps.length > 10));

    actions['new']();
    check('开始游戏后进入第一章', V.state.chapterId === 'ch1' && state.screen === 'game');
    check('进入后自动存档已写入', !!Saves.get('auto'));

    var start = V.state.index;
    V.advance(); V.advance(); V.advance();
    var at = V.state.index;
    check('点击可推进剧情', at > start);

    var payload = currentPayload();
    check('存档负载含章节与步号', payload.chapterId === 'ch1' && typeof payload.step === 'number' && payload.total > 0);

    Saves.write('3', payload);
    check('手动存档写入 slot3', !!Saves.get('3') && Saves.get('3').step === at);

    V.start('ch1', 0);
    var head = V.state.steps[V.state.index] || {};
    check('重置到章节开头（前情提要那一句）', V.state.index < at && head.who === '前情提要');
    loadSlot('3');
    check('读档回到保存的那一步', V.state.index === at && state.screen === 'game');

    actions['vn-qsave']();
    check('快速存档写入 quick', !!Saves.get('quick'));
    check('存档总数 = 3（auto/quick/3）', Saves.count() === 3);
    check('latest 指向最新存档', (Saves.latest() || {}).slot === 'quick');

    V.setAuto(true);
    V.setSkip(true);
    check('自动/跳过互斥', V.state.skip === true && V.state.auto === false);
    V.setSkip(false);

    V.state.index = 0;
    V.repeat();
    V.advance();
    check('回想与推进不报错', V.state.index > 0);

    Saves.remove('3');
    check('删除存档 slot3', !Saves.get('3') && Saves.count() === 2);

    check('设置写入且瞬显生效', Settings.current().textSpeed === 100 && GAL.textDelay() === 0);
    Settings.reset();
    check('恢复默认设置', Settings.current().textSpeed === 55 && GAL.textDelay() > 0);

    Saves.clear();
    check('清空全部存档', Saves.count() === 0 && !Saves.latest());
    V.pause();
    setScreen('title');

    var failed = log.filter(function (l) { return l.indexOf('FAIL') === 0; }).length;
    document.body.setAttribute('data-selftest', 'TOTAL=' + log.length + ' FAILED=' + failed + ' || ' + log.join(' || '));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  GAL.debug = { state: state, Saves: Saves, VN: GAL.VN };
})(window);
