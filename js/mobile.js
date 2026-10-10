/* ============================================================
   《错位夜宵》移动端适配
   - 触摸设备识别：body.is-touch → 放大字号与触控热区
   - 竖屏兜底：body.needs-rotate → 显示"请横屏"覆盖层（iOS 无法强制横屏时用）
   - 首次点击接管：进入全屏 + 锁定横屏（Android Chrome / Edge 可用）
   ============================================================ */
(function (global) {
  'use strict';
  var GAL = global.GAL || (global.GAL = {});
  var doc = global.document;
  var body = doc.body;

  var forced = null; /* 'mobile' | 'desktop' | null */

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
    allowPortrait: false,

    /* 供调试锚点强制切换：#mobile / #desktop */
    force: function (mode) {
      forced = (mode === 'mobile' || mode === 'desktop') ? mode : null;
      this.apply();
    },

    apply: function () {
      this.isTouch = detectTouch();
      body.classList.toggle('is-touch', this.isTouch);
      this.syncOrientation();
    },

    syncOrientation: function () {
      var portrait = mq('(orientation: portrait)', global.innerHeight > global.innerWidth);
      body.classList.toggle('is-portrait', portrait);
      body.classList.toggle('needs-rotate', this.isTouch && portrait && !this.allowPortrait);
    },

    /* 竖屏也能玩（用户主动选择后的降级） */
    playInPortrait: function () {
      this.allowPortrait = true;
      body.classList.add('allow-portrait');
      this.syncOrientation();
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
          if (p && p.catch) p.catch(function () { /* 用户拒绝或环境不支持，静默 */ });
        } catch (e) { /* ignore */ }
      }
      /* 全屏生效后再锁方向，否则部分浏览器会直接拒绝 */
      global.setTimeout(function () { Mobile.lockLandscape(); }, 180);
    },

    lockLandscape: function () {
      var so = global.screen && (global.screen.orientation || global.screen.mozOrientation);
      if (!so || typeof so.lock !== 'function') return false;
      try {
        var p = so.lock('landscape');
        if (p && p.catch) p.catch(function () { /* iOS / 非全屏时会被拒绝 */ });
        return true;
      } catch (e) { return false; }
    },

    isFullscreen: function () {
      return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
    }
  };

  function bind() {
    Mobile.apply();

    global.addEventListener('resize', function () { Mobile.syncOrientation(); });
    global.addEventListener('orientationchange', function () {
      global.setTimeout(function () { Mobile.syncOrientation(); }, 260);
    });

    var hint = doc.getElementById('rotate-hint');
    if (hint) {
      hint.addEventListener('click', function (e) {
        if (e.target.closest('[data-rotate-skip]')) return;
        Mobile.requestImmersive();
      });
    }
    var skip = doc.querySelector('[data-rotate-skip]');
    if (skip) {
      skip.addEventListener('click', function (e) {
        e.stopPropagation();
        Mobile.playInPortrait();
        if (GAL.toast) GAL.toast('已切换为竖屏模式（体验可能不佳）', 'warn');
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
