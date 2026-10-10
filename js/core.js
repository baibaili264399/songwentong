/* ============================================================
   《错位夜宵》核心工具层
   提供：DOM 助手 / 本地存储封装 / 合成音效 / Toast / 模态框 / 格式化
   ============================================================ */
(function (global) {
  'use strict';
  var GAL = global.GAL || (global.GAL = {});

  /* ---------------- DOM 助手 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  GAL.$ = $;
  GAL.$$ = $$;

  /* ---------------- 存储封装 ----------------
     优先 localStorage；file:// 或隐私模式下若不可用，自动退回内存存储。 */
  var memory = {};
  var persistent = (function () {
    try {
      var probe = '__gal_probe__';
      global.localStorage.setItem(probe, '1');
      global.localStorage.removeItem(probe);
      return true;
    } catch (e) { return false; }
  })();

  var store = {
    isPersistent: function () { return persistent; },
    read: function (key, fallback) {
      var raw = null;
      if (persistent) {
        try { raw = global.localStorage.getItem(key); } catch (e) { raw = null; }
      }
      if (raw == null && Object.prototype.hasOwnProperty.call(memory, key)) raw = memory[key];
      if (raw == null || raw === '') return fallback;
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    },
    write: function (key, value) {
      var raw;
      try { raw = JSON.stringify(value); } catch (e) { return false; }
      memory[key] = raw;
      if (!persistent) return false;
      try { global.localStorage.setItem(key, raw); return true; }
      catch (e) { persistent = false; return false; }
    },
    remove: function (key) {
      delete memory[key];
      if (!persistent) return;
      try { global.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };
  GAL.store = store;

  /* ---------------- 音效（WebAudio 实时合成，无需素材） ---------------- */
  var Sfx = (function () {
    var ctx = null, master = null;
    var enabled = true, volume = 0.6;

    function ensure() {
      if (ctx) return ctx;
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = volume * 0.4;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; }
      return ctx;
    }

    function tone(opt) {
      if (!enabled || volume <= 0) return;
      var c = ensure();
      if (!c) return;
      if (c.state === 'suspended' && c.resume) { try { c.resume(); } catch (e) { /* ignore */ } }
      var t0 = c.currentTime;
      var dur = opt.dur || 0.12;
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = opt.type || 'sine';
      osc.frequency.setValueAtTime(Math.max(40, opt.from), t0);
      if (opt.to && opt.to !== opt.from) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, opt.to), t0 + dur);
      }
      var peak = Math.max(0.0002, opt.gain || 0.2);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, dur * 0.3));
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    }

    return {
      hover:   function () { tone({ type: 'sine',     from: 900,  to: 1250, dur: 0.06, gain: 0.07 }); },
      click:   function () { tone({ type: 'triangle', from: 560,  to: 320,  dur: 0.10, gain: 0.16 }); },
      confirm: function () {
        tone({ type: 'sine', from: 523, to: 784, dur: 0.14, gain: 0.14 });
        global.setTimeout(function () { tone({ type: 'sine', from: 784, to: 1046, dur: 0.20, gain: 0.11 }); }, 85);
      },
      cancel:  function () { tone({ type: 'sine',   from: 440, to: 220, dur: 0.14, gain: 0.13 }); },
      error:   function () { tone({ type: 'square', from: 220, to: 120, dur: 0.16, gain: 0.07 }); },
      type:    function () { tone({ type: 'sine',   from: 1400, to: 1400, dur: 0.02, gain: 0.03 }); },
      setEnabled: function (v) { enabled = !!v; },
      setVolume: function (v) {
        volume = Math.max(0, Math.min(1, (v || 0) / 100));
        if (master) master.gain.value = volume * 0.4;
      },
      unlock: function () {
        var c = ensure();
        if (c && c.state === 'suspended' && c.resume) { try { c.resume(); } catch (e) { /* ignore */ } }
      }
    };
  })();
  GAL.Sfx = Sfx;

  /* ---------------- Toast ---------------- */
  function toast(message, type) {
    var layer = document.getElementById('toast-layer');
    if (!layer) return;
    var node = document.createElement('div');
    node.className = 'toast' + (type ? ' is-' + type : '');
    node.textContent = message;
    layer.appendChild(node);
    global.requestAnimationFrame(function () { node.classList.add('is-in'); });
    global.setTimeout(function () {
      node.classList.remove('is-in');
      global.setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 320);
    }, 2400);
  }
  GAL.toast = toast;

  /* ---------------- 模态框 ---------------- */
  var Modal = {
    open: function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.add('is-open');
      el.setAttribute('aria-hidden', 'false');
      var panel = $('.panel', el);
      if (panel && !panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
      global.setTimeout(function () { if (panel) { try { panel.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }, 30);
    },
    close: function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
    },
    isOpen: function () { return $$('.overlay.is-open').length > 0; },
    top: function () {
      var open = $$('.overlay.is-open');
      return open.length ? open[open.length - 1].id : null;
    },
    closeAll: function () { $$('.overlay.is-open').forEach(function (o) { Modal.close(o.id); }); }
  };
  GAL.Modal = Modal;

  /* ---------------- 格式化 ---------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function fmtDuration(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    return pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor(sec % 3600 / 60)) + ':' + pad(sec % 60);
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function fmtRelative(ts) {
    if (!ts) return '';
    var diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    return Math.floor(diff / 86400000) + ' 天前';
  }

  GAL.fmt = { pad: pad, duration: fmtDuration, date: fmtDate, relative: fmtRelative };
})(window);
