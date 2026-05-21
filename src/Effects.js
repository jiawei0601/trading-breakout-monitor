// ===========================
// Effects.js — Canvas 粒子爆炸 + 全螢幕霓虹警告
// ===========================

export const Effects = {
  _canvas: null,
  _ctx: null,
  _particles: [],
  _animId: null,
  _overlayTimeout: null,

  init() {
    this._canvas = document.getElementById('particleCanvas');
    if (!this._canvas) return;
    this._ctx = this._canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());
  },

  _resize() {
    if (!this._canvas) return;
    this._canvas.width  = window.innerWidth;
    this._canvas.height = window.innerHeight;
  },

  // 粒子爆炸特效
  triggerParticleExplosion(color1, color2) {
    if (!this._ctx) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.18;
    const count = 120;

    for (let i = 0; i < count; i++) {
      const angle  = (Math.PI * 2 / count) * i + Math.random() * 0.3;
      const speed  = 3 + Math.random() * 7;
      const size   = 2 + Math.random() * 5;
      const life   = 60 + Math.floor(Math.random() * 60);
      const color  = Math.random() > 0.5 ? color1 : color2;
      this._particles.push({ x: cx, y: cy, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed - 2, size, color, life, maxLife: life, opacity: 1 });
    }

    if (!this._animId) this._loop();
  },

  _loop() {
    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    this._particles = this._particles.filter(p => p.life > 0);

    this._particles.forEach(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.15; // 重力
      p.vx *= 0.98;
      p.life--;
      p.opacity = p.life / p.maxLife;

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle   = p.color;
      ctx.shadowBlur  = 12;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.opacity, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    if (this._particles.length > 0) {
      this._animId = requestAnimationFrame(() => this._loop());
    } else {
      this._animId = null;
      ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
  },

  // 全螢幕霓虹邊框警告
  triggerNeonOverlay(color, label) {
    const overlay = document.getElementById('neonOverlay');
    const labelEl = document.getElementById('neonLabel');
    if (!overlay) return;
    clearTimeout(this._overlayTimeout);

    overlay.style.setProperty('--neon-color', color);
    if (labelEl) labelEl.textContent = label;
    overlay.classList.add('active');
    overlay.style.animation = 'none';
    void overlay.offsetWidth; // reflow
    overlay.style.animation = '';

    this._overlayTimeout = setTimeout(() => {
      overlay.classList.remove('active');
    }, 4500);
  },

  // 背景環境微光色切換
  setAmbientGlow(colorVar) {
    // colorVar: 'gold' | 'taiex-bull' | 'taiex-bear' | 'nasdaq-bull' | 'nasdaq-bear'
    const body = document.body;
    body.setAttribute('data-market-state', colorVar);
  },

  // 價格閃爍
  blinkPrice(el, direction, market) {
    // direction: 'up' | 'down'
    // market: 'tw' | 'us'
    if (!el) return;
    let colorClass;
    if (market === 'tw') {
      colorClass = direction === 'up' ? 'blink-red' : 'blink-green';
    } else {
      colorClass = direction === 'up' ? 'blink-green' : 'blink-red';
    }
    el.classList.remove('blink-red', 'blink-green');
    void el.offsetWidth;
    el.classList.add(colorClass);
    setTimeout(() => el.classList.remove('blink-red', 'blink-green'), 400);
  }
};
