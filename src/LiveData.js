// ===========================
// LiveData.js — 即時報價串接
// 策略：Finnhub WS → Yahoo Finance REST（多 CORS Proxy）→ TradingView Widget
// ===========================
import { Effects } from './Effects.js';
import { Engine }  from './Engine.js';

// 可用的 CORS Proxy 清單（依序嘗試）
const CORS_PROXIES = [
  url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

const YAHOO_SYMBOLS = { TAIEX: '0050.TW', NASDAQ: '^NDX' };
const FINNHUB_TOKEN = 'demo';

export const LiveData = {
  _ws: null,
  _prevTaiex:  null,
  _prevNasdaq: null,
  _retries:    0,
  _maxRetries: 2,
  _pollTimer:  null,
  _proxyIdx:   0,

  init() {
    // 先嘗試 Yahoo Finance，立刻更新一次
    this._pollYahoo();
    // 同時嘗試 Finnhub WebSocket（更即時）
    this._connectFinnhub();
    // 每 30 秒輪詢一次
    this._pollTimer = setInterval(() => this._pollYahoo(), 30000);
  },

  // ---- Finnhub WebSocket（選用，若成功可提供更即時報價）----
  _connectFinnhub() {
    try {
      this._ws = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_TOKEN}`);
      this._ws.onopen = () => {
        this._ws.send(JSON.stringify({ type: 'subscribe', symbol: '0050.TW' }));
        this._ws.send(JSON.stringify({ type: 'subscribe', symbol: 'NDX' }));
      };
      this._ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'trade' && msg.data) {
            msg.data.forEach(t => {
              if (t.s === '0050.TW') this._applyTaiex(t.p, true);
              if (t.s === 'NDX')     this._applyNasdaq(t.p, true);
            });
          }
        } catch {}
      };
      this._ws.onerror = () => {};
      this._ws.onclose = () => {
        if (this._retries < this._maxRetries) {
          this._retries++;
          setTimeout(() => this._connectFinnhub(), 5000);
        }
      };
    } catch {}
  },

  // ---- Yahoo Finance REST 輪詢 ----
  async _pollYahoo() {
    await Promise.all([
      this._fetchYahoo('TAIEX', YAHOO_SYMBOLS.TAIEX),
      this._fetchYahoo('NASDAQ', YAHOO_SYMBOLS.NASDAQ),
    ]);
  },

  async _fetchYahoo(market, symbol) {
    const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=false`;

    // 嘗試目前的 Proxy，失敗則換下一個
    for (let attempt = 0; attempt < CORS_PROXIES.length; attempt++) {
      const idx      = (this._proxyIdx + attempt) % CORS_PROXIES.length;
      const proxyUrl = CORS_PROXIES[idx](apiUrl);
      try {
        const res  = await fetch(proxyUrl, { cache: 'no-cache', signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;

        let json;
        const text = await res.text();

        // allorigins 包裝在 {contents:"..."}；codetabs 直接回傳 JSON
        try {
          const wrapper = JSON.parse(text);
          json = typeof wrapper.contents === 'string' ? JSON.parse(wrapper.contents) : wrapper;
        } catch {
          json = JSON.parse(text);
        }

        const meta  = json?.chart?.result?.[0]?.meta;
        if (!meta) continue;

        // 優先取最新 1 分鐘蠟燭收盤；否則取 regularMarketPrice
        const quotes = json?.chart?.result?.[0]?.indicators?.quote?.[0];
        let price = meta.regularMarketPrice;
        if (quotes?.close) {
          const closes = quotes.close.filter(v => v !== null);
          if (closes.length > 0) price = closes[closes.length - 1];
        }

        if (price === undefined || price === null) continue;

        this._proxyIdx = idx; // 記住成功的 Proxy
        if (market === 'TAIEX')  this._applyTaiex(price, false);
        if (market === 'NASDAQ') this._applyNasdaq(price, false);
        this._updateStatus('🟢 Yahoo Finance 輪詢中');
        return; // 成功，退出
      } catch (err) {
        console.warn(`[LiveData] ${symbol} proxy ${idx} 失敗:`, err?.message);
      }
    }

    // 所有 Proxy 失敗 → 顯示 TradingView 降級 Widget
    console.warn(`[LiveData] ${symbol} 所有行情源失敗，切換至 TradingView`);
    this._updateStatus('⚠️ 已降級至 TradingView');
    if (market === 'TAIEX')  this._showTVFallback('tvFallback');
    if (market === 'NASDAQ') this._showTVFallback('tvFallbackNdx');
  },

  // ---- 更新台股 UI ----
  _applyTaiex(rawPrice, fromWS) {
    const el       = document.getElementById('taiexLivePrice');
    const changeEl = document.getElementById('taiexLiveChange');
    const cardEl   = document.getElementById('taiexLiveCard');
    if (!el) return;

    const price = parseFloat(rawPrice);
    if (isNaN(price) || price <= 0) return;

    const prev = this._prevTaiex;
    const dir  = prev !== null ? (price > prev ? 'up' : price < prev ? 'down' : null) : null;

    el.textContent = price.toLocaleString('zh-TW', { minimumFractionDigits: 2 });
    if (dir) Effects.blinkPrice(el, dir, 'tw');

    // 漲跌幅（和前次報價比）
    if (prev !== null && dir) {
      const chgPct = ((price - prev) / prev * 100).toFixed(2);
      const sign   = price >= prev ? '+' : '';
      if (changeEl) {
        changeEl.textContent = `${sign}${chgPct}%`;
        changeEl.className   = `live-change ${price >= prev ? 'tw-up' : 'tw-down'}`;
      }
    }

    // 近閾值黃燈警戒
    const isNear = Engine.isNearThreshold(price, 'TAIEX');
    cardEl?.classList.toggle('near-threshold', isNear);

    this._prevTaiex = price;
    if (!fromWS) this._updateStatus('🟢 Yahoo Finance 輪詢中');
  },

  // ---- 更新美股 UI ----
  _applyNasdaq(rawPrice, fromWS) {
    const el       = document.getElementById('nasdaqLivePrice');
    const changeEl = document.getElementById('nasdaqLiveChange');
    const cardEl   = document.getElementById('nasdaqLiveCard');
    if (!el) return;

    const price = parseFloat(rawPrice);
    if (isNaN(price) || price <= 0) return;

    const prev = this._prevNasdaq;
    const dir  = prev !== null ? (price > prev ? 'up' : price < prev ? 'down' : null) : null;

    el.textContent = price.toLocaleString('en-US', { minimumFractionDigits: 2 });
    if (dir) Effects.blinkPrice(el, dir, 'us');

    if (prev !== null && dir) {
      const chgPct = ((price - prev) / prev * 100).toFixed(2);
      const sign   = price >= prev ? '+' : '';
      if (changeEl) {
        changeEl.textContent = `${sign}${chgPct}%`;
        changeEl.className   = `live-change ${price >= prev ? 'us-up' : 'us-down'}`;
      }
    }

    const isNear = Engine.isNearThreshold(price, 'NASDAQ');
    cardEl?.classList.toggle('near-threshold', isNear);

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
