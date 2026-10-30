const { useRef, useCallback, useEffect } = React;

/* ---------- shared tilt engine (card movement only) ---------- */

function useTilt(maxTilt) {
  const wrapRef = useRef(null);
  const state = useRef({ tx: 0, ty: 0, cx: 0, cy: 0, raf: null, running: false, last: 0 });

  const apply = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const s = state.current;
    el.style.setProperty('--tilt-x', s.cx.toFixed(3) + 'deg');
    el.style.setProperty('--tilt-y', s.cy.toFixed(3) + 'deg');
  }, []);

  const step = useCallback((ts) => {
    const s = state.current;
    if (!s.last) s.last = ts;
    const dt = Math.min((ts - s.last) / 1000, 0.05);
    s.last = ts;
    const k = 1 - Math.exp(-dt / 0.13);
    s.cx += (s.tx - s.cx) * k;
    s.cy += (s.ty - s.cy) * k;
    apply();
    if (Math.abs(s.tx - s.cx) > 0.01 || Math.abs(s.ty - s.cy) > 0.01) {
      s.raf = requestAnimationFrame(step);
    } else {
      s.running = false;
      s.last = 0;
      s.raf = null;
    }
  }, [apply]);

  const start = useCallback(() => {
    const s = state.current;
    if (s.running) return;
    s.running = true;
    s.last = 0;
    s.raf = requestAnimationFrame(step);
  }, [step]);

  const onMove = useCallback((e) => {
    const el = wrapRef.current;
    if (!el) return;
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / Math.max(r.width, 1) - 0.5;
    const py = (e.clientY - r.top) / Math.max(r.height, 1) - 0.5;
    state.current.tx = -px * maxTilt * 2;
    state.current.ty = py * maxTilt * 2;
    start();
  }, [maxTilt, start]);

  const onLeave = useCallback(() => {
    state.current.tx = 0;
    state.current.ty = 0;
    start();
  }, [start]);

  useEffect(() => () => {
    if (state.current.raf) cancelAnimationFrame(state.current.raf);
  }, []);

  return { wrapRef, onMove, onLeave };
}

function tiltShell(children, { wrapRef, onMove, onLeave }, extraStyle) {
  return React.createElement(
    'div',
    {
      ref: wrapRef,
      onPointerMove: onMove,
      onPointerLeave: onLeave,
      style: {
        perspective: '900px',
        display: 'flex',
        width: '100%',
        height: '100%',
        ['--tilt-x']: '0deg',
        ['--tilt-y']: '0deg'
      }
    },
    React.createElement(
      'div',
      {
        style: Object.assign({
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          transformStyle: 'preserve-3d',
          transform: 'rotateY(var(--tilt-x)) rotateX(var(--tilt-y))',
          willChange: 'transform'
        }, extraStyle || {})
      },
      children
    )
  );
}

function TiltCard({ children, maxTilt = 5 }) {
  const tilt = useTilt(maxTilt);
  return tiltShell(children, tilt);
}

/* ---------- border glow (React Bits BorderGlow, self-contained CSS) ---------- */

const GLOW_CSS = `
.bg-card{--edge-proximity:0;--cursor-angle:45deg;--edge-sensitivity:30;--color-sensitivity:calc(var(--edge-sensitivity) + 20);--border-radius:14px;--glow-padding:40px;--cone-spread:25;position:relative;border-radius:var(--border-radius);isolation:isolate;transform:translate3d(0,0,0.01px);display:grid;border:1px solid rgb(255 255 255 / 12%);background:var(--card-bg,#0E0E13);overflow:visible}
.bg-card::before,.bg-card::after,.bg-card>.bg-edge{content:"";position:absolute;inset:0;border-radius:inherit;transition:opacity .25s ease-out;z-index:-1}
.bg-card:not(:hover):not(.bg-sweep)::before,.bg-card:not(:hover):not(.bg-sweep)::after,.bg-card:not(:hover):not(.bg-sweep)>.bg-edge{opacity:0;transition:opacity .75s ease-in-out}
.bg-card::before{border:1px solid transparent;background:linear-gradient(var(--card-bg,#0E0E13) 0 100%) padding-box,linear-gradient(rgb(255 255 255 / 0%) 0% 100%) border-box,var(--gradient-one) border-box,var(--gradient-two) border-box,var(--gradient-three) border-box,var(--gradient-four) border-box,var(--gradient-five) border-box,var(--gradient-six) border-box,var(--gradient-seven) border-box,var(--gradient-base) border-box;opacity:calc((var(--edge-proximity) - var(--color-sensitivity)) / (100 - var(--color-sensitivity)));mask-image:conic-gradient(from var(--cursor-angle) at center,black calc(var(--cone-spread) * 1%),transparent calc((var(--cone-spread) + 15) * 1%),transparent calc((100 - var(--cone-spread) - 15) * 1%),black calc((100 - var(--cone-spread)) * 1%))}
.bg-card::after{border:1px solid transparent;background:var(--gradient-one) padding-box,var(--gradient-two) padding-box,var(--gradient-three) padding-box,var(--gradient-four) padding-box,var(--gradient-five) padding-box,var(--gradient-six) padding-box,var(--gradient-seven) padding-box,var(--gradient-base) padding-box;mask-image:linear-gradient(to bottom,black,black),radial-gradient(ellipse at 50% 50%,black 40%,transparent 65%),radial-gradient(ellipse at 66% 66%,black 5%,transparent 40%),radial-gradient(ellipse at 33% 33%,black 5%,transparent 40%),radial-gradient(ellipse at 66% 33%,black 5%,transparent 40%),radial-gradient(ellipse at 33% 66%,black 5%,transparent 40%),conic-gradient(from var(--cursor-angle) at center,transparent 5%,black 15%,black 85%,transparent 95%);mask-composite:subtract,add,add,add,add,add;opacity:calc(var(--fill-opacity,0.4) * (var(--edge-proximity) - var(--color-sensitivity)) / (100 - var(--color-sensitivity)));mix-blend-mode:soft-light}
.bg-card>.bg-edge{inset:calc(var(--glow-padding) * -1);pointer-events:none;z-index:1;mask-image:conic-gradient(from var(--cursor-angle) at center,black 2.5%,transparent 10%,transparent 90%,black 97.5%);opacity:calc((var(--edge-proximity) - var(--edge-sensitivity)) / (100 - var(--edge-sensitivity)));mix-blend-mode:plus-lighter}
.bg-card>.bg-edge::before{content:"";position:absolute;inset:var(--glow-padding);border-radius:inherit;box-shadow:inset 0 0 0 1px var(--glow-color),inset 0 0 1px 0 var(--glow-color-60),inset 0 0 3px 0 var(--glow-color-50),inset 0 0 6px 0 var(--glow-color-40),inset 0 0 15px 0 var(--glow-color-30),inset 0 0 25px 2px var(--glow-color-20),inset 0 0 50px 2px var(--glow-color-10),0 0 1px 0 var(--glow-color-60),0 0 3px 0 var(--glow-color-50),0 0 6px 0 var(--glow-color-40),0 0 15px 0 var(--glow-color-30),0 0 25px 2px var(--glow-color-20),0 0 50px 2px var(--glow-color-10)}
.bg-inner{display:flex;flex-direction:column;position:relative;z-index:1;border-radius:inherit}
`;

function injectCss() {
  if (typeof document === 'undefined' || document.getElementById('bg-card-css')) return;
  const tag = document.createElement('style');
  tag.id = 'bg-card-css';
  tag.textContent = GLOW_CSS;
  document.head.appendChild(tag);
}

function parseHSL(str) {
  const m = String(str).match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!m) return { h: 350, s: 80, l: 70 };
  return { h: parseFloat(m[1]), s: parseFloat(m[2]), l: parseFloat(m[3]) };
}

function glowVars(glowColor, intensity) {
  const { h, s, l } = parseHSL(glowColor);
  const base = h + 'deg ' + s + '% ' + l + '%';
  const op = [100, 60, 50, 40, 30, 20, 10];
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10'];
  const out = {};
  op.forEach((o, i) => {
    out['--glow-color' + keys[i]] = 'hsl(' + base + ' / ' + Math.min(o * intensity, 100) + '%)';
  });
  return out;
}

const POS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
const KEYS = ['--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four', '--gradient-five', '--gradient-six', '--gradient-seven'];
const MAP = [0, 1, 2, 0, 1, 2, 1];

function gradientVars(colors) {
  const out = {};
  for (let i = 0; i < 7; i++) {
    const c = colors[Math.min(MAP[i], colors.length - 1)];
    out[KEYS[i]] = 'radial-gradient(at ' + POS[i] + ', ' + c + ' 0px, transparent 50%)';
  }
  out['--gradient-base'] = 'linear-gradient(' + colors[0] + ' 0 100%)';
  return out;
}

function GlowCard({
  children,
  maxTilt = 5,
  edgeSensitivity = 26,
  glowColor = '350 85 66',
  backgroundColor = '#0E0E13',
  borderRadius = 14,
  glowRadius = 40,
  glowIntensity = 1,
  coneSpread = 25,
  fillOpacity = 0.35,
  colors = ['#C8102E', '#FF7D8E', '#F2E9EC']
}) {
  const cardRef = useRef(null);
  const tilt = useTilt(maxTilt);
  useEffect(injectCss, []);

  const onPointerMove = useCallback((e) => {
    const card = cardRef.current;
    if (!card) return;
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const r = card.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const cx = r.width / 2;
    const cy = r.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    let kx = Infinity;
    let ky = Infinity;
    if (dx !== 0) kx = cx / Math.abs(dx);
    if (dy !== 0) ky = cy / Math.abs(dy);
    const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
    let deg = (dx === 0 && dy === 0) ? 0 : Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (deg < 0) deg += 360;
    card.style.setProperty('--edge-proximity', (edge * 100).toFixed(2));
    card.style.setProperty('--cursor-angle', deg.toFixed(2) + 'deg');
    tilt.onMove(e);
  }, [tilt]);

  const style = Object.assign({
    ['--card-bg']: backgroundColor,
    ['--edge-sensitivity']: edgeSensitivity,
    ['--border-radius']: borderRadius + 'px',
    ['--glow-padding']: glowRadius + 'px',
    ['--cone-spread']: coneSpread,
    ['--fill-opacity']: fillOpacity,
    flex: 1
  }, glowVars(glowColor, glowIntensity), gradientVars(colors));

  const touch = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover:none)').matches;
  if (touch) {
    style['--edge-proximity'] = 88;
    style['--cursor-angle'] = '135deg';
  }

  const card = React.createElement(
    'div',
    { ref: cardRef, className: touch ? 'bg-card bg-sweep' : 'bg-card', onPointerMove, style },
    React.createElement('span', { className: 'bg-edge' }),
    React.createElement('div', { className: 'bg-inner' }, children)
  );

  return tiltShell(card, { wrapRef: tilt.wrapRef, onMove: () => {}, onLeave: tilt.onLeave }, { flex: 1 });
}

module.exports = { TiltCard, GlowCard };
