// ===========================
// Store.js — 資料層 (localStorage CRUD)
// ===========================
const STORAGE_KEY = 'trading_breakout_monitor_v1';

const DEFAULT_ENTRY = (date) => ({
  date,
  taiexPrice: null,
  taiexVolume: null,
  nasdaqPrice: null,
  checkVolumeShrink: false,
  checkBoxRange: false,
  checkVixStable: false,
  note: ''
});

export const Store = {
  _data: null,

  _load() {
    if (this._data) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this._data = raw ? JSON.parse(raw) : { entries: [] };
      if (!Array.isArray(this._data.entries)) this._data = { entries: [] };
    } catch (e) {
      console.warn('[Store] 讀取失敗，重置資料', e);
      this._data = { entries: [] };
    }
  },

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.error('[Store] 儲存失敗', e);
    }
  },

  getAll() {
    this._load();
    return [...this._data.entries].sort((a, b) => a.date.localeCompare(b.date));
  },

  getByDate(date) {
    this._load();
    return this._data.entries.find(e => e.date === date) || null;
  },

  upsert(date, patch) {
    this._load();
    const idx = this._data.entries.findIndex(e => e.date === date);
    if (idx >= 0) {
      this._data.entries[idx] = { ...this._data.entries[idx], ...patch };
    } else {
      this._data.entries.push({ ...DEFAULT_ENTRY(date), ...patch });
    }
    this._save();
    return this.getByDate(date);
  },

  // 取最近 N 筆有價格紀錄的資料（用於狀態機判斷）
  getRecentPriced(n = 2) {
    const all = this.getAll().filter(e => e.taiexPrice !== null && e.taiexPrice !== '');
    return all.slice(-n);
  },

  getRecentNasdaqPriced(n = 2) {
    const all = this.getAll().filter(e => e.nasdaqPrice !== null && e.nasdaqPrice !== '');
    return all.slice(-n);
  },

  // 預填從 2026/05/20 起的交易日框架
  initTradingDays() {
    this._load();
    const start = new Date('2026-05-20');
    const today = new Date();
    today.setHours(0,0,0,0);
    const cursor = new Date(start);
    while (cursor <= today) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) { // 跳過週末
        const dateStr = cursor.toISOString().split('T')[0];
        if (!this._data.entries.find(e => e.date === dateStr)) {
          this._data.entries.push(DEFAULT_ENTRY(dateStr));
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    this._save();
  },

  // 注入測試用歷史數據
  seedHistoricalData() {
    this._load();
    const seed = [
      { date: '2026-05-20', taiexPrice: 41200, taiexVolume: 3800, nasdaqPrice: 26200, checkVolumeShrink: true, checkBoxRange: true, checkVixStable: true, note: '量縮盤整，靜待訊號' },
      { date: '2026-05-21', taiexPrice: 41450, taiexVolume: 3600, nasdaqPrice: 26350, checkVolumeShrink: true, checkBoxRange: true, checkVixStable: true, note: '維持箱內，觀望' },
    ];
    seed.forEach(s => {
      if (!this._data.entries.find(e => e.date === s.date)) {
        this._data.entries.push(s);
      } else {
        const idx = this._data.entries.findIndex(e => e.date === s.date);
        this._data.entries[idx] = { ...this._data.entries[idx], ...s };
      }
    });
    this._save();
  }
};
