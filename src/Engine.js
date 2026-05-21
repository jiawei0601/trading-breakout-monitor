// ===========================
// Engine.js — 狀態機判斷引擎
// ===========================
import { Store } from './Store.js';

// 突破閾值常數
export const THRESHOLDS = {
  TAIEX_BULL: 42500,
  TAIEX_BEAR: 38500,
  TAIEX_BOX_HIGH: 41800,
  TAIEX_BOX_LOW: 40800,
  NASDAQ_BULL: 26800,
  NASDAQ_BEAR: 25000,
  TAIEX_WARN_RANGE: 0.01,   // 接近 1% 觸發黃燈
  NASDAQ_WARN_RANGE: 0.01,
};

// 狀態常數
export const STATES = {
  TAIEX: {
    CONSOLIDATING: 'TAIEX_CONSOLIDATING',
    BULL_BREAKOUT:  'TAIEX_BULL_BREAKOUT',
    BEAR_BREAKOUT:  'TAIEX_BEAR_BREAKOUT',
  },
  NASDAQ: {
    WAITING:       'NASDAQ_WAITING',
    BULL_BREAKOUT: 'NASDAQ_BULL_BREAKOUT',
    BEAR_BREAKOUT: 'NASDAQ_BEAR_BREAKOUT',
  }
};

// 有限狀態機
class MarketStateMachine {
  constructor() {
    this.taiexState  = STATES.TAIEX.CONSOLIDATING;
    this.nasdaqState = STATES.NASDAQ.WAITING;
    this._listeners  = {};
  }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
    return this;
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(cb => cb(data));
  }

  evaluate() {
    const taiexEntries  = Store.getRecentPriced(2);
    const nasdaqEntries = Store.getRecentNasdaqPriced(2);

    // === 台股判斷 ===
    let newTaiex = STATES.TAIEX.CONSOLIDATING;
    if (taiexEntries.length >= 2) {
      const prices = taiexEntries.map(e => parseFloat(e.taiexPrice));
      const allBull = prices.every(p => p > THRESHOLDS.TAIEX_BULL);
      const allBear = prices.every(p => p < THRESHOLDS.TAIEX_BEAR);
      if (allBull) newTaiex = STATES.TAIEX.BULL_BREAKOUT;
      else if (allBear) newTaiex = STATES.TAIEX.BEAR_BREAKOUT;
    }

    // === 美股判斷 ===
    let newNasdaq = STATES.NASDAQ.WAITING;
    if (nasdaqEntries.length >= 2) {
      const prices = nasdaqEntries.map(e => parseFloat(e.nasdaqPrice));
      const allBull = prices.every(p => p > THRESHOLDS.NASDAQ_BULL);
      const allBear = prices.every(p => p < THRESHOLDS.NASDAQ_BEAR);
      if (allBull) newNasdaq = STATES.NASDAQ.BULL_BREAKOUT;
      else if (allBear) newNasdaq = STATES.NASDAQ.BEAR_BREAKOUT;
    }

    // === 偵測狀態轉換 ===
    const isNeutralTaiex  = [STATES.TAIEX.CONSOLIDATING].includes(this.taiexState);
    const isNeutralNasdaq = [STATES.NASDAQ.WAITING].includes(this.nasdaqState);
    const isBreakedTaiex  = [STATES.TAIEX.BULL_BREAKOUT, STATES.TAIEX.BEAR_BREAKOUT].includes(newTaiex);
    const isBreakedNasdaq = [STATES.NASDAQ.BULL_BREAKOUT, STATES.NASDAQ.BEAR_BREAKOUT].includes(newNasdaq);

    if (isNeutralTaiex && isBreakedTaiex) {
      this._emit('breakout', { market: 'TAIEX', state: newTaiex });
    }
    if (isNeutralNasdaq && isBreakedNasdaq) {
      this._emit('breakout', { market: 'NASDAQ', state: newNasdaq });
    }

    // 更新狀態
    if (this.taiexState !== newTaiex || this.nasdaqState !== newNasdaq) {
      this.taiexState  = newTaiex;
      this.nasdaqState = newNasdaq;
      this._emit('stateChange', { taiex: newTaiex, nasdaq: newNasdaq });
    }

    return { taiex: newTaiex, nasdaq: newNasdaq };
  }

  // 計算近期統計
  getStats() {
    const all = Store.getAll().filter(e => e.taiexPrice !== null && e.taiexPrice !== '');
    const recent5 = all.slice(-5);
    const shrinkDays = all.filter(e => e.taiexVolume !== null && parseFloat(e.taiexVolume) <= 4200).length;
    const shrinkRatio = all.length > 0 ? Math.round((shrinkDays / all.length) * 100) : 0;
    const avg5 = recent5.length > 0
      ? (recent5.reduce((s, e) => s + parseFloat(e.taiexPrice||0), 0) / recent5.length).toFixed(0)
      : '--';
    const inBox = all.filter(e => {
      const p = parseFloat(e.taiexPrice);
      return p >= THRESHOLDS.TAIEX_BOX_LOW && p <= THRESHOLDS.TAIEX_BOX_HIGH;
    }).length;
    return { shrinkRatio, avg5, inBoxRatio: all.length > 0 ? Math.round((inBox/all.length)*100) : 0, totalDays: all.length };
  }

  // 判斷即時報價是否接近閾值（黃燈警戒）
  isNearThreshold(price, market) {
    if (market === 'TAIEX') {
      const nearBull = Math.abs(price - THRESHOLDS.TAIEX_BULL) / THRESHOLDS.TAIEX_BULL < THRESHOLDS.TAIEX_WARN_RANGE;
      const nearBear = Math.abs(price - THRESHOLDS.TAIEX_BEAR) / THRESHOLDS.TAIEX_BEAR < THRESHOLDS.TAIEX_WARN_RANGE;
      return nearBull || nearBear;
    } else {
      const nearBull = Math.abs(price - THRESHOLDS.NASDAQ_BULL) / THRESHOLDS.NASDAQ_BULL < THRESHOLDS.NASDAQ_WARN_RANGE;
      const nearBear = Math.abs(price - THRESHOLDS.NASDAQ_BEAR) / THRESHOLDS.NASDAQ_BEAR < THRESHOLDS.NASDAQ_WARN_RANGE;
      return nearBull || nearBear;
    }
  }
}

export const Engine = new MarketStateMachine();
