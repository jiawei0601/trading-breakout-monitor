// ===========================
// LiveData.js — 即時報價串接 (Finnhub WebSocket → Yahoo fallback → TradingView)
// ===========================
import { Effects } from './Effects.js';
import { Engine }  from './Engine.js';

const FINNHUB_TOKEN = 'demo'; // 若有 key 請替換

export const LiveData = {
  _ws: null,
  _prevTaiex:  null,
  _prevNasdaq: null,
  _retries: 0,
  _maxRetries: 3,
  _pollInterval: null,

  init() {
    this._connectFinnhub();
  },

  _connectFinnhub() {
    try {
      this._ws = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_TOKEN}`);
      this._ws.onopen = () => {
        console.log('[LiveData] Finnhub WS 已連線');
        // 訂閱 0050.TW 與 NDX
        this._ws.send(JSON.stringify({ type: 'subscribe', symbol: '0050.TW' }));
        this._ws.send(JSON.stringify({ type: 'subscribe', symbol: 'NDX' }));
        this._retries = 0;
      };
      this._ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'trade' && msg.data) {
            msg.data.forEach(trade => {
              if (trade.s === '0050.TW') this._updateTaiex(trade.p);
              if (trade.s === 'NDX')     this._updateNasdaq(trade.p);
            });
          }
        } catch (e) {}
      };
      this._ws.onerror = () => this._fallback();
      this._ws.onclose = () => {
        if (this._retries < this._maxRetries) { this._retries++; setTimeout(() => this._connectFinnhub(), 3000); }
        else this._fallback();
      };
    } catch (e) {
      this._fallback();
    }
  },

  // 降級：Yahoo Finance REST 輪詢（每 30 秒）
  _fallback() {
    console.warn('[LiveData] 降級為 Yahoo Finance 輪詢');
    this._updateStatus('⚠️ 使用降級行情源');
    this._pollYahoo();
    this._pollInterval = setInterval(() => this._pollYahoo(), 30000);
  },

  async _pollYahoo() {
    const symbols = ['0050.TW', '^NDX'];
    const corsProxy = 'https://api.allorigins.win/get?url=';
    for (const sym of symbols) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
        const res = await fetch(corsProxy + encodeURIComponent(url), { cache: 'no-cache' });
        const json = await res.json();
        const data = JSON.parse(json.contents);
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (sym === '0050.TW' && price) this._updateTaiex(price);
        if (sym === '^NDX'    && price) this._updateNasdaq(price);
      } catch (e) {
        console.warn('[LiveData] Yahoo 行情取得失敗', sym, e);
        this._showTradingViewFallback();
      }
    }
  },

  _updateTaiex(price) {
    const el = document.getElementById('taiexLivePrice');
    const changeEl = document.getElementById('taiexLiveChange');
    if (!el) return;

    const numPrice = parseFloat(price);
    const prev     = this._prevTaiex;
    const dir      = prev === null ? null : (numPrice > prev ? 'up' : numPrice < prev ? 'down' : null);

    el.textContent = numPrice.toLocaleString('zh-TW', { minimumFractionDigits: 2 });
    if (dir) Effects.blinkPrice(el, dir, 'tw');

    // 近閾值警告
    const isNear = Engine.isNearThreshold(numPrice, 'TAIEX');
    el.closest('.live-card')?.classList.toggle('near-threshold', isNear);

    // 計算漲跌幅（跟前次比）
    if (prev !== null) {
      const chgPct = ((numPrice - prev) / prev * 100).toFixed(2);
      const sign   = chgPct >= 0 ? '+' : '';
      if (changeEl) {
        changeEl.textContent = `${sign}${chgPct}%`;
        changeEl.className   = `live-change ${numPrice >= prev ? 'tw-up' : 'tw-down'}`;
      }
    }

    this._prevTaiex = numPrice;
    this._updateStatus('🟢 即時串流中');
  },

  _updateNasdaq(price) {
    const el = document.getElementById('nasdaqLivePrice');
    const changeEl = document.getElementById('nasdaqLiveChange');
    if (!el) return;

    const numPrice = parseFloat(price);
    const prev     = this._prevNasdaq;
    const dir      = prev === null ? null : (numPrice > prev ? 'up' : numPrice < prev ? 'down' : null);

    el.textContent = numPrice.toLocaleString('en-US', { minimumFractionDigits: 2 });
    if (dir) Effects.blinkPrice(el, dir, 'us');

    const isNear = Engine.isNearThreshold(numPrice, 'NASDAQ');
    el.closest('.live-card')?.classList.toggle('near-threshold', isNear);

    if (prev !== null) {
      const chgPct = ((numPrice - prev) / prev * 100).toFixed(2);
      const sign   = chgPct >= 0 ? '+' : '';
      if (changeEl) {
        changeEl.textContent = `${sign}${chgPct}%`;
        changeEl.className   = `live-change ${numPrice >= prev ? 'us-up' : 'us-down'}`;
      }
    }

    this._prevNasdaq = numPrice;
  },

  _updateStatus(msg) {
    const el = document.getElementById('liveStatus');
    if (el) el.textContent = msg;
  },

  _showTradingViewFallback() {
    const container = document.getElementById('tvFallback');
    if (!container || container.dataset.loaded) return;
    container.dataset.loaded = 'true';
    container.style.display  = 'block';
  }
};
