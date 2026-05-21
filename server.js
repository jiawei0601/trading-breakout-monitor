// ========================================================
// server.js — Trading Breakout Monitor 後端伺服器
// Express + Yahoo Finance API + Gemini 2.5 Pro
// 部署目標：Railway
// ========================================================

const express  = require('express');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 8765;

app.use(express.json());

// ── 靜態檔案服務（HTML/CSS/JS）──────────────────────────
app.use(express.static(path.join(__dirname, '.')));

// ── 健康檢查 ───────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── /api/price — 伺服器端抓取 Yahoo Finance（無 CORS 問題）──
app.get('/api/price', async (req, res) => {
  const symbol = req.query.symbol || '0050.TW';

  // 動態 import node-fetch（ESM 模組）
  const { default: fetch } = await import('node-fetch');

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=false`;

  // 備用 URL（Yahoo Finance v2）
  const urlV2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=false`;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Referer': 'https://finance.yahoo.com'
  };

  // 嘗試 query1 → query2
  for (const targetUrl of [url, urlV2]) {
    try {
      const response = await fetch(targetUrl, {
        headers,
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) continue;
      const data = await response.json();

      const result = data?.chart?.result?.[0];
      if (!result) continue;

      const meta   = result.meta;
      const quotes = result.indicators?.quote?.[0];

      // 取最新 1 分鐘收盤 or regularMarketPrice
      let price     = meta.regularMarketPrice;
      let prevClose = meta.previousClose || meta.chartPreviousClose;
      const currency = meta.currency || 'TWD';

      if (quotes?.close) {
        const closes = quotes.close.filter(v => v !== null && v > 0);
        if (closes.length > 0) price = closes[closes.length - 1];
      }

      const changeAmt = prevClose ? (price - prevClose) : 0;
      const changePct = prevClose ? ((price - prevClose) / prevClose * 100) : 0;

      return res.json({
        symbol,
        price:     parseFloat(price.toFixed(4)),
        prevClose: parseFloat((prevClose || 0).toFixed(4)),
        changeAmt: parseFloat(changeAmt.toFixed(4)),
        changePct: parseFloat(changePct.toFixed(4)),
        currency,
        marketState:   meta.marketState,
        exchangeName:  meta.exchangeName,
        regularMarketTime: meta.regularMarketTime,
        source: 'yahoo-finance',
        ts: new Date().toISOString()
      });
    } catch (err) {
      console.warn(`[price] ${targetUrl} 失敗:`, err.message);
    }
  }

  res.status(502).json({ error: '行情抓取失敗', symbol, ts: new Date().toISOString() });
});

// ── /api/gemini — Gemini 2.5 Pro AI 分析端點 ───────────
app.post('/api/gemini', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '伺服器未設定 GEMINI_API_KEY 環境變數' });
  }

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: '請提供 prompt 欄位' });
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        temperature:    0.4,
        maxOutputTokens: 1024,
        responseMimeType: 'text/plain'
      }
    });

    const result = await model.generateContent(prompt);
    const text   = result.response.text();

    res.json({ text, model: 'gemini-2.5-pro', ts: new Date().toISOString() });
  } catch (err) {
    console.error('[gemini] 錯誤:', err.message);
    res.status(500).json({ error: err.message || 'Gemini API 呼叫失敗' });
  }
});

// ── SPA fallback（所有未匹配路由回傳 index.html）──────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── 啟動 ───────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Trading Breakout Monitor 伺服器啟動`);
  console.log(`   Port:     ${PORT}`);
  console.log(`   Gemini:   ${process.env.GEMINI_API_KEY ? '✅ 已設定' : '❌ 未設定 GEMINI_API_KEY'}`);
  console.log(`   Node.js:  ${process.version}`);
  console.log(`   時間:     ${new Date().toLocaleString('zh-TW')}`);
});
