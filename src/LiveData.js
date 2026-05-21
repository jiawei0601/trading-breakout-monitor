import { Effects } from './Effects.js';
import { Engine }  from './Engine.js';

export const LiveData = {
  _prevTaiex:  null,
  _prevNasdaq: null,
  _pollTimer:  null,
  _failCount:  { TAIEX: 0, NASDAQ: 0 },
  MAX_FAILS:   3,

  init() {
    // 立即抓取一次
    this._pollAll();
    // 每 30 秒輪詢
    this._pollTimer = setInterval(() => this._pollAll(), 30000);
    this._updateStatus('⏳ 連線中...');
  },

  async _pollAll() {
    await Promise.all([
      this._fetchPrice('TAIEX',  '^TWII'),   // 台股加權指數
      this._fetchPrice('NASDAQ', '^NDX'),    // 那斯達克 100
    ]);
  },

  async _fetchPrice(market, symbol) {
    try {
      const res = await fetch(
        `/api/price?symbol=${encodeURIComponent(symbol)}`,
        { cache: 'no-cache', signal: AbortSignal.timeout(10000) }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      this._failCount[market] = 0;

      if (market === 'TAIEX')  this._applyTaiex(data);
      if (market === 'NASDAQ') this._applyNasdaq(data);

      this._updateStatus(`🟢 行情即時更新中 · ${new Date().toLocaleTimeString('zh-TW', { hour12: false })}`);
    } catch (err) {
      console.warn(`[LiveData] ${symbol} 失敗:`, err.message);
      this._failCount[market]++;
      if (this._failCount[market] >= this.MAX_FAILS) {
        this._updateStatus('⚠️ 行情源暫時不可用，已切換至 TradingView');
        if (market === 'TAIEX')  this._showTVFallback('tvFallback');
        if (market === 'NASDAQ') this._showTVFallback('tvFallbackNdx');
      }
    }
  },

  // ---- 更新台股 UI（紅漲・綠跌）----
  _applyTaiex(data) {
    const el       = document.getElementById('taiexLivePrice');
    const changeEl = document.getElementById('taiexLiveChange');
    const cardEl   = document.getElementById('taiexLiveCard');
    const subEl    = document.getElementById('taiexSub');
    if (!el) return;

    const price     = data.price;
    const changePct = data.changePct;
    const prev      = this._prevTaiex;
    const dir       = prev !== null ? (price > prev ? 'up' : price < prev ? 'down' : null) : null;

    const isUp = changePct >= 0;
    // 加權指數以整數點位顯示，加連這號
    el.textContent = Math.round(price).toLocaleString('zh-TW');
    if (dir) Effects.blinkPrice(el, dir, 'tw');

    if (changeEl) {
      const sign    = isUp ? '+' : '';
      const chgAmt  = data.changeAmt ?? 0;
      changeEl.textContent = `${sign}${chgAmt.toFixed(0)} (${sign}${changePct.toFixed(2)}%)`;
      changeEl.className   = `live-change ${isUp ? 'tw-up' : 'tw-down'}`;
    }

    // 近閾值黃燈
    const isNear = Engine.isNearThreshold(price, 'TAIEX');
    cardEl?.classList.toggle('near-threshold', isNear);

    // 市場狀態標籤
    if (subEl) {
      const stateMap = { REGULAR: '交易中', PRE: '盤前', POST: '盤後', CLOSED: '休市' };
      subEl.textContent = `台股加權指數 TAIEX ｜ ${stateMap[data.marketState] || data.marketState || ''} ｜ 昨收 ${Math.round(data.prevClose || 0).toLocaleString()}`;
    }

    this._prevTaiex = price;
  },

  // ---- 更新美股 UI（綠漲・紅跌）----
  _applyNasdaq(data) {
    const el       = document.getElementById('nasdaqLivePrice');
    const changeEl = document.getElementById('nasdaqLiveChange');
    const cardEl   = document.getElementById('nasdaqLiveCard');
    const subEl    = document.getElementById('nasdaqSub');
    if (!el) return;

    const price     = data.price;
    const changePct = data.changePct;
    const prev      = this._prevNasdaq;
    const dir       = prev !== null ? (price > prev ? 'up' : price < prev ? 'down' : null) : null;

    const isUp = changePct >= 0;
    el.textContent = price.toLocaleString('en-US', { minimumFractionDigits: 2 });
    if (dir) Effects.blinkPrice(el, dir, 'us');

    if (changeEl) {
      const sign = isUp ? '+' : '';
      changeEl.textContent = `${sign}${changePct.toFixed(2)}%`;
      changeEl.className   = `live-change ${isUp ? 'us-up' : 'us-down'}`;
    }

    const isNear = Engine.isNearThreshold(price, 'NASDAQ');
    cardEl?.classList.toggle('near-threshold', isNear);

    if (subEl) {
      const stateMap = { REGULAR: '交易中', PRE: '盤前', POST: '盤後', CLOSED: '休市' };
      subEl.textContent = `那斯達克 100 CFD ｜ ${stateMap[data.marketState] || data.marketState || ''} ｜ 昨收 ${(data.prevClose||0).toLocaleString()}`;
    }

    this._prevNasdaq = price;
  },

  _updateStatus(msg) {
    const el = document.getElementById('liveStatus');
    if (el) el.textContent = msg;
  },

  _showTVFallback(id) {
    const container = document.getElementById(id);
    if (!container || container.dataset.loaded) return;
    container.dataset.loaded = 'true';
    container.style.display  = 'block';
  }
};
