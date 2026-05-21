# Trading Breakout Monitor

> 台美股區間突破與紀律監控儀表板 — Glassmorphism 暗黑質感，由 Gemma4 AI 輔助架構設計

## 🚀 功能亮點

- **即時行情**：Finnhub WebSocket 串流 0050.TW + NDX，自動降級 Yahoo Finance 輪詢 → TradingView Widget
- **狀態機引擎**：自動判斷台股連 2 日突破 42,500 / 38,500 與 NASDAQ 連 2 日突破 26,800 / 25,000
- **粒子爆炸 + 全螢幕霓虹警告**：首次突破時觸發 Canvas 粒子動畫與邊框霓虹警示
- **Glassmorphism UI**：`#0b0f19` 底色 + 呼吸燈背景微光，狀態自動切換金/紅/綠
- **在地化漲跌色系**：台股 紅漲綠跌 / 美股 綠漲紅跌
- **localStorage 日誌**：自 2026/05/20 起逐日記錄，含 Checkbox 紀律狀態
- **Gemma4 AI 面板**：本地 Gemma4-26B 即時盤面解讀

## 📁 檔案結構

```
trading-breakout-monitor/
├── index.html        # 主頁面 + DOM 結構
├── style.css         # 完整 Glassmorphism 樣式系統
└── src/
    ├── main.js       # 應用程式進入點 + UI 渲染
    ├── Store.js      # localStorage CRUD 資料層
    ├── Engine.js     # 有限狀態機 + 突破判定邏輯
    ├── Effects.js    # Canvas 粒子 + 霓虹特效
    └── LiveData.js   # 即時行情串接模組
```

## 🌐 執行方式

由於使用 ES Modules，需透過 HTTP 伺服器開啟：

```powershell
# 方法 1：npx serve
npx serve .

# 方法 2：Python
python -m http.server 8080

# 方法 3：VS Code Live Server 擴充功能
```

開啟後造訪 `http://localhost:3000` 或 `http://localhost:8080`

## 🔧 突破條件設定

| 市場 | 多頭突破 | 空頭破底 | 觸發行動 |
|------|---------|---------|---------|
| 台股 TAIEX | 連 2 日 > 42,500 | 連 2 日 < 38,500 | 小台/避險 |
| NASDAQ | 連 2 日 > 26,800 | 連 2 日 < 25,000 | TQQQ/SQQQ |

## 🎨 設計系統

- **底色**：`#0b0f19`
- **卡片**：`rgba(17,24,39,0.72)` + `backdrop-filter: blur(18px)`
- **盤整狀態**：金色呼吸燈 `#f59e0b`
- **台股多頭**：紅色微光 `#ef4444`
- **美股多頭**：綠色微光 `#10b981`
