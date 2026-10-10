/* ============================================================
   《错位夜宵》移动端适配
   - 触摸设备识别：body.is-touch → 放大字号与触控热区
   - 横屏兜底：竖屏时给 body 加 force-landscape，由 CSS 把整个 #app 旋转 90°。
     这样即使系统锁了旋转方向、或在微信内置浏览器里（都不给方向锁权限），
     用户把手机转过来也照样是横屏全屏游玩。
   - 全屏 / 方向锁：能在用户手势里调用就顺手调用，失败也不影响上面这条兜底。
   ============================================================ */
(function (global) {
  'use strict';
  var GAL = global.GAL || (global.GAL = {});
  var doc = global.document;

  var forced = null;          /* 'mobile' | 'desktop' | null（调试锚点用） */
  var barDismissed = false;
  var barTimer = null;

  function mq(query, fallback) {
    try { return !!global.matchMedia(query).matches; } catch (e) { return fallback; }
  }

  function detectTouch() {
    if (forced === 'mobile') return true;
    if (forced === 'desktop') return false;
    if (mq('(pointer: coarse)', false)) return true;
    if (mq('(hover: none)', false)) return true;
    if ('ontouchstart' in global) return true;
    if (global.navigator && global.navigator.maxTouchPoints > 0) return true;
    return false;
  }

  var Mobile = {
    isTouch: false,
    isPortrait: false,

    /* 调试锚点：#mobile / #desktop */
    force: function (mode) {
      forced = (mode === 'mobile' || mode === 'desktop') ? mode : null;
      this.apply();
    },

    apply: function () {
      var body = doc.body;
      if (!body) return;
      this.isTouch = detectTouch();
      body.classList.toggle('is-touch', this.isTouch);
      try {
        body.classList.toggle('is-wechat', /MicroMessenger/i.test(global.navigator.userAgent || ''));
      } catch (e) { /* ignore */ }
      this.syncOrientation();
      /* 触屏判定会影响"流畅模式"的自动值，通知主控重算（main.js 可能还没加载，存在才调） */
      if (typeof GAL.applySmooth === 'function') GAL.applySmooth();
    },

    syncOrientation: function () {
      var body = doc.body;
      if (!body) return;
      var portrait = mq('(orientation: portrait)', global.innerHeight > global.innerWidth);
      this.isPortrait = portrait;

      /* 竖屏就把画面转过来（纯 CSS，永远有效） */
      body.classList.toggle('is-portrait', portrait);
      body.classList.toggle('force-landscape', this.isTouch && portrait);

      /* 提示条：只在竖屏且用户没关掉时出现 */
      var showBar = this.isTouch && portrait && !barDismissed;
      body.classList.toggle('show-rotate-bar', showBar);
      if (showBar) {
        global.clearTimeout(barTimer);
        barTimer = global.setTimeout(function () { Mobile.dismissBar(); }, 12000);
      }
    },

    dismissBar: function () {
      barDismissed = true;
      global.clearTimeout(barTimer);
      doc.body.classList.remove('show-rotate-bar');
    },

    /* 必须在用户手势回调里调用 */
    requestImmersive: function () {
      if (!this.isTouch) return;
      var el = doc.documentElement;
      var already = doc.fullscreenElement || doc.webkitFullscreenElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req && !already) {
        try {
          var p = req.call(el);
          if (p && p.catch) p.catch(function () { /* 微信/ iOS 会拒绝，忽略即可 */ });
        } catch (e) { /* ignore */ }
      }
      global.setTimeout(function () { Mobile.lockLandscape(); }, 180);
    },

    lockLandscape: function () {
      var so = global.screen && (global.screen.orientation || global.screen.mozOrientation);
      if (!so || typeof so.lock !== 'function') return false;
      try {
        var p = so.lock('landscape');
        if (p && p.catch) p.catch(function () { /* 非全屏时会被拒绝 */ });
        return true;
      } catch (e) { return false; }
    },

    isFullscreen: function () {
      return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
    }
  };

  /* 先在解析阶段跑一次（脚本在 body 末尾），尽量减少竖屏布局的闪一下 */
  Mobile.apply();

  function bind() {
    Mobile.apply();

    global.addEventListener('resize', function () { Mobile.syncOrientation(); });
    global.addEventListener('orientationchange', function () {
      global.setTimeout(function () { Mobile.syncOrientation(); }, 260);
    });

    var fsBtn = doc.getElementById('rotate-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        Mobile.requestImmersive();
      });
    }
    var skip = doc.querySelector('[data-rotate-skip]');
    if (skip) {
      skip.addEventListener('click', function (e) {
        e.stopPropagation();
        Mobile.dismissBar();
      });
    }

    /* 手机上误双击会缩放，屏蔽掉双击缩放 */
    var lastTouch = 0;
    doc.addEventListener('touchend', function (e) {
      var now = Date.now();
      if (now - lastTouch < 320) e.preventDefault();
      lastTouch = now;
    }, { passive: false });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', bind);
  else bind();

  GAL.Mobile = Mobile;
})(window);
