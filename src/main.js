// ===========================
// main.js — 應用程式進入點與 UI 渲染
// ===========================
import { Store }   from './Store.js';
import { Engine, STATES, THRESHOLDS } from './Engine.js';
import { Effects } from './Effects.js';
import { LiveData } from './LiveData.js';

// ---- 突破事件處理 ----
Engine.on('breakout', ({ market, state }) => {
  let color1, color2, label, ambientKey;
  if (state === STATES.TAIEX.BULL_BREAKOUT) {
    color1 = '#ef4444'; color2 = '#fbbf24';
    label  = '🔴 台股多頭突破！連 2 日收盤 > 42,500 — 解鎖多頭戰術';
    ambientKey = 'taiex-bull';
  } else if (state === STATES.TAIEX.BEAR_BREAKOUT) {
    color1 = '#10b981'; color2 = '#06b6d4';
    label  = '🟢 台股空頭破底！連 2 日收盤 < 38,500 — 解鎖空頭戰術';
    ambientKey = 'taiex-bear';
  } else if (state === STATES.NASDAQ.BULL_BREAKOUT) {
    color1 = '#10b981'; color2 = '#34d399';
    label  = '🟢 NASDAQ 多頭突破！連 2 日收盤 > 26,800 — 解鎖買入 TQQQ';
    ambientKey = 'nasdaq-bull';
  } else {
    color1 = '#ef4444'; color2 = '#f97316';
    label  = '🔴 NASDAQ 空頭破位！連 2 日收盤 < 25,000 — 解鎖買入 SQQQ';
    ambientKey = 'nasdaq-bear';
  }

  Effects.triggerParticleExplosion(color1, color2);
  Effects.triggerNeonOverlay(color1, label);
  Effects.setAmbientGlow(ambientKey);
  renderStatusBadges();
  renderActionPanel();
});

Engine.on('stateChange', () => {
  renderStatusBadges();
  renderActionPanel();
  updateAmbient();
});

// ---- 背景微光更新 ----
function updateAmbient() {
  const { taiex, nasdaq } = { taiex: Engine.taiexState, nasdaq: Engine.nasdaqState };
  const isAnyBreakout = [STATES.TAIEX.BULL_BREAKOUT, STATES.TAIEX.BEAR_BREAKOUT,
                          STATES.NASDAQ.BULL_BREAKOUT, STATES.NASDAQ.BEAR_BREAKOUT].includes(taiex) ||
                        [STATES.NASDAQ.BULL_BREAKOUT, STATES.NASDAQ.BEAR_BREAKOUT].includes(nasdaq);
  if (!isAnyBreakout) Effects.setAmbientGlow('neutral');
}

// ---- 狀態徽章渲染 ----
function renderStatusBadges() {
  const taiex  = Engine.taiexState;
  const nasdaq = Engine.nasdaqState;

  const taiexEl  = document.getElementById('taiexStateBadge');
  const nasdaqEl = document.getElementById('nasdaqStateBadge');

  const labels = {
    [STATES.TAIEX.CONSOLIDATING]: { text: '🟡 箱型盤整中', cls: 'badge-neutral' },
    [STATES.TAIEX.BULL_BREAKOUT]: { text: '🔴 多頭突破！', cls: 'badge-tw-bull' },
    [STATES.TAIEX.BEAR_BREAKOUT]: { text: '🟢 空頭破底！', cls: 'badge-tw-bear' },
    [STATES.NASDAQ.WAITING]:       { text: '🟡 空手等待中', cls: 'badge-neutral' },
    [STATES.NASDAQ.BULL_BREAKOUT]: { text: '🟢 多頭突破！', cls: 'badge-us-bull' },
    [STATES.NASDAQ.BEAR_BREAKOUT]: { text: '🔴 空頭破位！', cls: 'badge-us-bear' },
  };

  if (taiexEl)  { const l = labels[taiex];  taiexEl.textContent  = l.text; taiexEl.className  = `state-badge ${l.cls}`; }
  if (nasdaqEl) { const l = labels[nasdaq]; nasdaqEl.textContent = l.text; nasdaqEl.className = `state-badge ${l.cls}`; }
}

// ---- 行動面板渲染 ----
function renderActionPanel() {
  const taiex  = Engine.taiexState;
  const nasdaq = Engine.nasdaqState;
  const panel  = document.getElementById('actionPanel');
  if (!panel) return;

  const actions = [];

  if (taiex === STATES.TAIEX.BULL_BREAKOUT) {
    actions.push({ icon: '🔓', market: 'tw', label: '執行多頭戰術', desc: '可買入小台期貨 / 強勢個股', cls: 'action-tw-bull', locked: false });
  } else {
    actions.push({ icon: '🔒', market: 'tw', label: '多頭戰術（鎖定）', desc: `等待台股連 2 日收盤 > ${THRESHOLDS.TAIEX_BULL.toLocaleString()}`, cls: 'action-locked', locked: true });
  }

  if (taiex === STATES.TAIEX.BEAR_BREAKOUT) {
    actions.push({ icon: '🔓', market: 'tw', label: '執行空頭戰術', desc: '可放空小台 / 買入避險部位', cls: 'action-tw-bear', locked: false });
  } else if (taiex !== STATES.TAIEX.BULL_BREAKOUT) {
    actions.push({ icon: '🔒', market: 'tw', label: '空頭戰術（鎖定）', desc: `等待台股連 2 日收盤 < ${THRESHOLDS.TAIEX_BEAR.toLocaleString()}`, cls: 'action-locked', locked: true });
  }

  if (nasdaq === STATES.NASDAQ.BULL_BREAKOUT) {
    actions.push({ icon: '🔓', market: 'us', label: '買入 TQQQ', desc: '三倍做多那斯達克 100 ETF', cls: 'action-us-bull', locked: false });
  } else {
    actions.push({ icon: '🔒', market: 'us', label: 'TQQQ（鎖定）', desc: `等待 NASDAQ 連 2 日收盤 > ${THRESHOLDS.NASDAQ_BULL.toLocaleString()}`, cls: 'action-locked', locked: true });
  }

  if (nasdaq === STATES.NASDAQ.BEAR_BREAKOUT) {
    actions.push({ icon: '🔓', market: 'us', label: '買入 SQQQ', desc: '三倍做空那斯達克 100 ETF', cls: 'action-us-bear', locked: false });
  } else if (nasdaq !== STATES.NASDAQ.BULL_BREAKOUT) {
    actions.push({ icon: '🔒', market: 'us', label: 'SQQQ（鎖定）', desc: `等待 NASDAQ 連 2 日收盤 < ${THRESHOLDS.NASDAQ_BEAR.toLocaleString()}`, cls: 'action-locked', locked: true });
  }

  panel.innerHTML = actions.map(a => `
    <div class="action-card glass-card ${a.cls} ${a.locked ? 'locked' : 'unlocked'}">
      <span class="action-icon">${a.icon}</span>
      <div class="action-info">
        <div class="action-label">${a.label}</div>
        <div class="action-desc">${a.desc}</div>
      </div>
    </div>
  `).join('');
}

// ---- 統計面板渲染 ----
function renderStats() {
  const stats = Engine.getStats();
  const el = document.getElementById('statsBanner');
  if (!el) return;
  el.innerHTML = `
    <div class="stat-item"><span class="stat-value">${stats.totalDays}</span><span class="stat-label">交易日數</span></div>
    <div class="stat-divider"></div>
    <div class="stat-item"><span class="stat-value">${stats.shrinkRatio}%</span><span class="stat-label">量縮天數比</span></div>
    <div class="stat-divider"></div>
    <div class="stat-item"><span class="stat-value">${stats.avg5 !== '--' ? Number(stats.avg5).toLocaleString() : '--'}</span><span class="stat-label">近5日台股均價</span></div>
    <div class="stat-divider"></div>
    <div class="stat-item"><span class="stat-value">${stats.inBoxRatio}%</span><span class="stat-label">箱內整理比</span></div>
  `;
}

// ---- 日誌時間線渲染 ----
function renderTimeline() {
  const entries = Store.getAll();
  const tl = document.getElementById('timeline');
  if (!tl) return;

  tl.innerHTML = entries.map(entry => {
    const hasData   = entry.taiexPrice !== null && entry.taiexPrice !== '';
    const dateLabel = formatDate(entry.date);
    const taiexStr  = hasData ? Number(entry.taiexPrice).toLocaleString() : '--';
    const nasdaqStr = entry.nasdaqPrice ? Number(entry.nasdaqPrice).toLocaleString() : '--';
    const volStr    = entry.taiexVolume ? `${entry.taiexVolume} 億` : '--';
    const volOk     = entry.taiexVolume !== null && parseFloat(entry.taiexVolume) <= 4200;

    // 判斷台股方向色
    const prevEntries = Store.getAll().filter(e => e.taiexPrice && e.date < entry.date);
    const prev = prevEntries.length > 0 ? parseFloat(prevEntries[prevEntries.length - 1].taiexPrice) : null;
    const dir  = prev !== null && hasData ? (parseFloat(entry.taiexPrice) > prev ? 'tw-up' : 'tw-down') : '';

    return `
    <div class="timeline-item ${hasData ? 'has-data' : 'empty'}" data-date="${entry.date}">
      <div class="timeline-dot ${hasData ? 'dot-filled' : 'dot-empty'}"></div>
      <div class="timeline-card glass-card ${hasData ? 'filled-card' : 'empty-card'}" onclick="toggleEntry('${entry.date}')">
        <div class="entry-header">
          <span class="entry-date">${dateLabel}</span>
          ${hasData ? `
            <span class="entry-taiex ${dir}">${taiexStr}</span>
            <span class="entry-vol ${volOk ? 'vol-ok' : 'vol-high'}">${volStr}</span>
            <span class="entry-nasdaq">${nasdaqStr}</span>
          ` : `<span class="entry-empty-hint">點擊輸入數據 ✏️</span>`}
          <span class="entry-toggle">▼</span>
        </div>
        <div class="entry-body" id="body-${entry.date}" style="display:none">
          <div class="entry-form">
            <div class="form-row">
              <label>台股收盤價<input type="number" id="tp-${entry.date}" value="${entry.taiexPrice ?? ''}" placeholder="41200" step="1"></label>
              <label>台股成交量（億）<input type="number" id="tv-${entry.date}" value="${entry.taiexVolume ?? ''}" placeholder="3800" step="10"></label>
              <label>NASDAQ 收盤價<input type="number" id="np-${entry.date}" value="${entry.nasdaqPrice ?? ''}" placeholder="26200" step="1"></label>
            </div>
            <div class="form-checks">
              <label class="check-label"><input type="checkbox" ${entry.checkVolumeShrink ? 'checked' : ''} id="cv-${entry.date}"> ✅ 量能萎縮（≤4200億）</label>
              <label class="check-label"><input type="checkbox" ${entry.checkBoxRange   ? 'checked' : ''} id="cb-${entry.date}"> ✅ 箱體內整理（40,800~41,800）</label>
              <label class="check-label"><input type="checkbox" ${entry.checkVixStable  ? 'checked' : ''} id="cw-${entry.date}"> ✅ VIX 平穩</label>
            </div>
            <div class="form-note">
              <textarea id="note-${entry.date}" placeholder="今日備忘 / 盤感...">${entry.note ?? ''}</textarea>
            </div>
            <div class="form-actions">
              <button class="btn-save" onclick="saveEntry('${entry.date}', event)">💾 儲存</button>
              <span class="save-hint" id="hint-${entry.date}"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
    `;
  }).join('');
}

// ---- 摺疊/展開日誌條目 ----
window.toggleEntry = function(date) {
  const body = document.getElementById(`body-${date}`);
  if (!body) return;
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  const toggleEl = body.closest('.timeline-card')?.querySelector('.entry-toggle');
  if (toggleEl) toggleEl.textContent = isHidden ? '▲' : '▼';
};

// ---- 儲存條目 ----
window.saveEntry = function(date, evt) {
  if (evt) evt.stopPropagation();
  const patch = {
    taiexPrice:        parseFloat(document.getElementById(`tp-${date}`)?.value) || null,
    taiexVolume:       parseFloat(document.getElementById(`tv-${date}`)?.value) || null,
    nasdaqPrice:       parseFloat(document.getElementById(`np-${date}`)?.value) || null,
    checkVolumeShrink: document.getElementById(`cv-${date}`)?.checked || false,
    checkBoxRange:     document.getElementById(`cb-${date}`)?.checked || false,
    checkVixStable:    document.getElementById(`cw-${date}`)?.checked || false,
    note:              document.getElementById(`note-${date}`)?.value || '',
  };
  Store.upsert(date, patch);

  // 重新評估狀態
  Engine.evaluate();
  renderTimeline();
  renderStats();
  renderStatusBadges();
  renderActionPanel();
  updateAmbient();

  const hint = document.getElementById(`hint-${date}`);
  if (hint) { hint.textContent = '✅ 已儲存'; setTimeout(() => { hint.textContent = ''; }, 2000); }
};

// ---- 日期格式化 ----
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['日','一','二','三','四','五','六'];
  return `${d.getMonth()+1}/${d.getDate()} (${days[d.getDay()]})`;
}

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded', () => {
  Store.initTradingDays();
  Store.seedHistoricalData();
  Effects.init();
  Engine.evaluate();
  renderStatusBadges();
  renderActionPanel();
  renderStats();
  renderTimeline();
  updateAmbient();
  LiveData.init();

  // 定時刷新統計（每分鐘）
  setInterval(() => {
    renderStats();
    Engine.evaluate();
    renderStatusBadges();
  }, 60000);

  // 標頭時鐘
  function updateClock() {
    const el = document.getElementById('headerClock');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString('zh-TW', { hour12: false });
  }
  updateClock();
  setInterval(updateClock, 1000);
});
