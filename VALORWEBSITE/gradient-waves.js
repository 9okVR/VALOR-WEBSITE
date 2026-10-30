(function () {
  const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime, uSpeed, uAmp, uScale, uSwell, uTurb, uFog, uZoom, uBright, uGrain, uTilt;
uniform vec3  uHorizon, uWave, uCrest, uBase;
uniform vec2  uMouse;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  p.x += uMouse.x * 0.05;
  p.x *= uTilt;

  float horizonY = 0.16 + uMouse.y * 0.02;
  float t = uTime * uSpeed;
  vec3 col = uBase;

  float d = horizonY - p.y;
  if (d > 0.0){
    float z = 1.0 / (d * 6.0 / uZoom + 0.05);
    float x = p.x * z;

    vec2 q = vec2(x * uScale * 0.85, z * uScale * 1.5 - t * 2.2);
    float warp = fbm(q * 0.4 + vec2(t * 0.3, 0.0));
    float h = fbm(q + warp * uTurb);
    h += 0.18 * sin(q.y * 0.8 + warp * 2.4) * uSwell;
    h = clamp((h - 0.34) * 2.0, 0.0, 1.0);
    h = pow(h, 1.4) * uAmp;

    float crest = smoothstep(0.62, 0.98, h);
    float band = smoothstep(0.0, 0.05, d) * smoothstep(0.78, 0.10, d);
    float fog = mix(1.0, exp(-z * 0.05), clamp(uFog, 0.0, 1.0));
    float e = h * band * fog;

    col += uHorizon * e * 0.28 + uWave * pow(e, 2.1) * 0.17 + uCrest * crest * band * fog * 0.07;
  }

  // light sitting on the horizon line
  float glow = exp(-abs(p.y - horizonY) * 15.0);
  col += uHorizon * glow * 0.13;

  col *= uBright;

  if (uGrain > 0.0){
    float g = hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5;
    col += g * uGrain;
  }

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

  function hex(v, fb) {
    const s = (v || fb).replace('#', '');
    const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
    const i = parseInt(n, 16);
    return [((i >> 16) & 255) / 255, ((i >> 8) & 255) / 255, (i & 255) / 255];
  }

  class GradientWaves extends HTMLElement {
    connectedCallback() {
      if (this._init) return;
      this._init = true;
      this.style.display = 'block';
      this.style.position = 'absolute';
      this.style.inset = '0';
      this.style.width = '100%';
      this.style.height = '100%';
      this.style.overflow = 'hidden';
      this.style.pointerEvents = 'none';

      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'display:block;width:100%;height:100%';
      this.appendChild(canvas);
      this.canvas = canvas;

      const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
      if (!gl) return;
      this.gl = gl;

      const mk = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, mk(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      gl.useProgram(prog);
      this.prog = prog;

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      this.u = {};
      ['uRes', 'uTime', 'uSpeed', 'uAmp', 'uScale', 'uSwell', 'uTurb', 'uFog', 'uZoom', 'uBright', 'uGrain', 'uTilt', 'uHorizon', 'uWave', 'uCrest', 'uBase', 'uMouse']
        .forEach((n) => { this.u[n] = gl.getUniformLocation(prog, n); });

      this.mouse = [0, 0];
      this.mTarget = [0, 0];
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.t0 = performance.now();

      this._onMove = (e) => {
        const r = this.getBoundingClientRect();
        this.mTarget[0] = ((e.clientX - r.left) / r.width - 0.5) * 2;
        this.mTarget[1] = ((e.clientY - r.top) / r.height - 0.5) * 2;
      };
      if (this.dataset.mouse !== 'off') window.addEventListener('pointermove', this._onMove, { passive: true });

      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(this);

      this.resize();
      this.loop();
    }

    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
      window.removeEventListener('pointermove', this._onMove);
    }

    resize() {
      const gl = this.gl;
      if (!gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = Math.max(1, Math.round(this.clientWidth * dpr));
      const h = Math.max(1, Math.round(this.clientHeight * dpr));
      if (this.canvas.width === w && this.canvas.height === h) return;
      this.canvas.width = w;
      this.canvas.height = h;
      gl.viewport(0, 0, w, h);
    }

    num(name, fb) {
      const v = parseFloat(this.dataset[name]);
      return isNaN(v) ? fb : v;
    }

    loop = () => {
      this._raf = requestAnimationFrame(this.loop);
      const gl = this.gl;
      if (!gl) return;

      const p = this.num('parallax', 0.5);
      this.mouse[0] += (this.mTarget[0] * p - this.mouse[0]) * 0.05;
      this.mouse[1] += (this.mTarget[1] * p - this.mouse[1]) * 0.05;

      const t = this.reduced ? 12 : (performance.now() - this.t0) / 1000;
      const u = this.u;
      gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(u.uTime, t);
      gl.uniform1f(u.uSpeed, this.num('speed', 0.12));
      gl.uniform1f(u.uAmp, this.num('amplitude', 1.0));
      gl.uniform1f(u.uScale, this.num('scale', 0.62));
      gl.uniform1f(u.uSwell, this.num('swell', 0.5));
      gl.uniform1f(u.uTurb, this.num('turbulence', 0.9));
      gl.uniform1f(u.uFog, this.num('fog', 0.85));
      gl.uniform1f(u.uZoom, this.num('zoom', 1));
      gl.uniform1f(u.uBright, this.num('brightness', 1));
      gl.uniform1f(u.uGrain, this.num('grain', 0.045));
      gl.uniform1f(u.uTilt, this.num('tilt', 1));
      gl.uniform2f(u.uMouse, this.mouse[0], this.mouse[1]);
      gl.uniform3fv(u.uHorizon, hex(this.dataset.horizon, '#5227FF'));
      gl.uniform3fv(u.uWave, hex(this.dataset.wave, '#A78BFA'));
      gl.uniform3fv(u.uCrest, hex(this.dataset.crest, '#FFFFFF'));
      gl.uniform3fv(u.uBase, hex(this.dataset.base, '#08080B'));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
  }

  if (!customElements.get('gradient-waves')) customElements.define('gradient-waves', GradientWaves);
})();
