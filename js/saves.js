/* ============================================================
   《错位夜宵》存档 / 设置数据层
   存档位：auto（自动存档） + quick（快速存档） + 1~6（手动存档）
   ============================================================ */
(function (global) {
  'use strict';
  var GAL = global.GAL;

  /* ---------------- 存档 ---------------- */
  var SAVE_KEY = 'gal.saves.v1';
  var MANUAL_SLOTS = ['1', '2', '3', '4', '5', '6'];
  var SPECIAL_SLOTS = ['auto', 'quick'];

  var Saves = {
    allSlots: SPECIAL_SLOTS.concat(MANUAL_SLOTS),
    specialSlots: SPECIAL_SLOTS.slice(),
    manualSlots: MANUAL_SLOTS.slice(),

    label: function (id) {
      if (id === 'auto') return '自动存档';
      if (id === 'quick') return '快速存档';
      return '存档 ' + id;
    },

    all: function () {
      var data = GAL.store.read(SAVE_KEY, {});
      return (data && typeof data === 'object') ? data : {};
    },

    get: function (id) {
      var data = this.all();
      return data[id] || null;
    },

    count: function () {
      var data = this.all(), n = 0, self = this;
      this.allSlots.forEach(function (id) { if (data[id]) n++; });
      return n;
    },

    write: function (id, payload) {
      var data = this.all();
      var prev = data[id] || null;
      var maxSeq = 0;
      Object.keys(data).forEach(function (k) {
        if (data[k] && typeof data[k].seq === 'number' && data[k].seq > maxSeq) maxSeq = data[k].seq;
      });
      var entry = {
        slot: id,
        seq: maxSeq + 1,          /* 单调递增序号：同毫秒内存档也能正确判定先后 */
        chapterId: payload.chapterId || payload.scene || 'ch1',
        step: typeof payload.step === 'number' ? payload.step : 0,
        kind: payload.kind || '',
        chapter: payload.chapter || '第一章 · 醒在别人的身体里',
        speaker: payload.speaker || '',
        text: payload.text || '',
        line: typeof payload.line === 'number' ? payload.line : 0,
        total: payload.total || 0,
        progress: typeof payload.progress === 'number' ? payload.progress : 0,
        playtime: payload.playtime || 0,
        scene: payload.scene || 'prologue',
        savedAt: Date.now(),
        createdAt: prev ? (prev.createdAt || prev.savedAt) : Date.now(),
        playCount: prev ? (prev.playCount || 1) : 1
      };
      data[id] = entry;
      var ok = GAL.store.write(SAVE_KEY, data);
      return { entry: entry, persisted: ok };
    },

    remove: function (id) {
      var data = this.all();
      if (!data[id]) return false;
      delete data[id];
      GAL.store.write(SAVE_KEY, data);
      return true;
    },

    clear: function () {
      GAL.store.remove(SAVE_KEY);
    },

    latest: function () {
      var data = this.all(), best = null;
      this.allSlots.forEach(function (id) {
        var item = data[id];
        if (!item) return;
        if (!best) { best = item; return; }
        var a = item.savedAt || 0, b = best.savedAt || 0;
        if (a > b || (a === b && (item.seq || 0) > (best.seq || 0))) best = item;
      });
      return best;
    }
  };
  GAL.Saves = Saves;

  /* ---------------- 设置 ---------------- */
  var SETTINGS_KEY = 'gal.settings.v1';
  var DEFAULTS = {
    textSpeed: 55,   /* 0 = 最慢, 100 = 瞬间显示 */
    sfxVolume: 60,
    sfxEnabled: true,
    bgmVolume: 40,
    autoSave: true,
    smoothMode: null /* null = 按设备自动（触屏默认开） */
  };

  var current = null;

  var Settings = {
    defaults: function () {
      var copy = {};
      Object.keys(DEFAULTS).forEach(function (k) { copy[k] = DEFAULTS[k]; });
      return copy;
    },
    load: function () {
      var saved = GAL.store.read(SETTINGS_KEY, null);
      var merged = this.defaults();
      if (saved && typeof saved === 'object') {
        Object.keys(DEFAULTS).forEach(function (k) {
          if (k === 'smoothMode') {
            if (typeof saved[k] === 'boolean') merged[k] = saved[k];
            return;
          }
          if (typeof saved[k] === typeof DEFAULTS[k]) merged[k] = saved[k];
        });
      }
      /* smoothMode 保持 null = 自动（渲染时按设备判定），不在这里固化 */
      current = merged;
      return merged;
    },
    current: function () {
      if (!current) this.load();
      return current;
    },
    set: function (key, value) {
      var data = this.current();
      if (!(key in DEFAULTS)) return data;
      data[key] = value;
      GAL.store.write(SETTINGS_KEY, data);
      return data;
    },
    reset: function () {
      current = this.defaults();
      GAL.store.write(SETTINGS_KEY, current);
      return current;
    },
    applyAudio: function () {
      var s = this.current();
      GAL.Sfx.setEnabled(s.sfxEnabled);
      GAL.Sfx.setVolume(s.sfxVolume);
    }
  };
  GAL.Settings = Settings;

  /* 文字速度 → 逐字延迟（毫秒） */
  GAL.textDelay = function () {
    var speed = GAL.Settings.current().textSpeed;
    if (speed >= 100) return 0;
    return Math.round(46 - speed * 0.44); /* 0 → 46ms, 99 → ~2ms */
  };
})(window);
