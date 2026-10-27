// Interactive liquid blobs for the homepage hero.
// Each <canvas class="fluid-blob"> gets a ray-marched 3D blob drawn in a WebGL shader: the surface flows
// on its own, a droplet pulls towards the cursor, and clicks send a ripple across it.
//
// Two modes, set with data-blob-mode on the canvas:
//   "under" (default): the blob sits under the hero copy, and the copy (.blob-overlay) drifts and bends with it.
//   "lens": the blob sits over the copy (.blob-lens-copy) and magnifies it like a drop of water. The copy is
//           redrawn into a texture that the shader refracts; the real text stays underneath for screen readers,
//           and the button stays clickable because the canvas ignores the pointer.
//
// Add ?blob=classic to the URL to see the original image-based blob instead.
// If WebGL isn't available, the static blob image underneath stays visible.
(function () {
  if (/[?&]blob=classic\b/.test(location.search)) return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MAX_RIPPLES = 4;
  // The canvas is drawn larger than its layout box (see site.css): 1.6x taller and 2.6x wider,
  // so the blob can stretch, and the droplet travel sideways, without being cut off. SCALE is the vertical factor.
  var SCALE = 1.6;
  // Half the height of the layout box, in blob units (the blob's radius is about 1)
  var VIEW = 1.07;
  // How much the lens version magnifies the copy behind it
  var MAGNIFY = 1.2;

  var vertexSource = "attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }";

  function fragmentSource(lens) {
    return [
      "precision highp float;",
      lens ? "#define LENS" : "",
      "#define SCALE " + SCALE.toFixed(2),
      "#define VIEW " + VIEW.toFixed(2),
      "#define MAGNIFY " + MAGNIFY.toFixed(2),
      "uniform vec2 uRes;",
      "uniform float uTime;",
      "uniform float uEnergy;",
      "uniform vec3 uOffset;",   // where the main body has drifted to
      "uniform vec3 uAttr;",     // droplet that follows the cursor
      "uniform float uAttrR;",
      "uniform vec4 uRipples[" + MAX_RIPPLES + "];", // xyz = impact point, w = start time
      "uniform float uBound;",
      "#ifdef LENS",
      "uniform sampler2D uText;", // the copy behind the blob, drawn at canvas resolution
      "#endif",

      "float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }",
      "float noise(vec3 x) {",
      "  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);",
      "  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),",
      "             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z) * 2.0 - 1.0;",
      "}",
      "float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }",

      "float map(vec3 p) {",
      "  vec3 q = p - uOffset;",
      "  float t = uTime;",
      "  float n = noise(q * 1.15 + vec3(0.0, t * 0.13, t * 0.09)) * 0.6 + noise(q * 2.3 - vec3(t * 0.11, 0.0, t * 0.07)) * 0.25;",
      "  float d = length(q * vec3(1.0, 1.08, 1.0)) - 1.0 - n * (0.16 + 0.08 * uEnergy);",
      "  d += 0.022 * (1.0 + 1.5 * uEnergy) * sin(5.0 * q.x + t * 1.1) * sin(4.0 * q.y - t * 0.8) * sin(3.0 * q.z + t * 0.6);",
      "  for (int i = 0; i < " + MAX_RIPPLES + "; i++) {",
      "    float age = t - uRipples[i].w;",
      "    if (age > 0.0 && age < 3.0) {",
      "      float dist = length(q - uRipples[i].xyz);",
      "      float front = (dist - age * 1.1) * 5.0;",
      "      float ring = exp(-front * front) * exp(-age * 1.3);",
      "      d -= 0.07 * ring;",
      "      d += 0.09 * exp(-dist * dist * 10.0) * exp(-age * 4.0);",
      "    }",
      "  }",
      "  if (uAttrR > 0.001) d = smin(d, length(p - uAttr) - uAttrR, 0.5);",
      "  return d;",
      "}",

      "vec3 calcNormal(vec3 p) {",
      "  const vec2 k = vec2(1.0, -1.0); const float h = 0.0015;",
      "  return normalize(k.xyy * map(p + k.xyy * h) + k.yyx * map(p + k.yyx * h) + k.yxy * map(p + k.yxy * h) + k.xxx * map(p + k.xxx * h));",
      "}",

      // Grey studio: soft overhead light, two softboxes and a darker floor, like the original blob render.
      "float env(vec3 d) {",
      "  float c = mix(0.55, 1.0, smoothstep(-0.6, 0.7, d.y));",
      "  c -= 0.35 * exp(-abs(d.y + 0.08) * 7.0);",
      "  c += 1.3 * smoothstep(0.9, 0.975, dot(d, normalize(vec3(0.55, 0.65, 0.55))));",
      "  c += 0.8 * smoothstep(0.93, 0.985, dot(d, normalize(vec3(-0.7, 0.25, 0.65))));",
      "  c += 0.55 * smoothstep(0.55, 1.0, sin(d.y * 9.0 + d.x * 2.5 + noise(d * 2.0) * 2.0));",
      "  c -= 0.25 * smoothstep(0.6, 1.0, sin(d.x * 7.0 - d.y * 3.0 + noise(d * 2.5) * 2.5));",
      "  c += 0.2 * noise(d * 4.0);",
      "  return c;",
      "}",

      "void main() {",
      "  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * 2.0;",
      "  vec3 ro = vec3(0.0, 0.0, 3.2);",
      "  vec3 rd = normalize(vec3(uv * VIEW / 3.2 * SCALE, -1.0));",
      // Only march inside a bounding sphere around the blob
      "  float b = dot(ro, rd); float c = dot(ro, ro) - uBound * uBound; float hdisc = b * b - c;",
      "  if (hdisc < 0.0) { gl_FragColor = vec4(0.0); return; }",
      "  float t = max(-b - sqrt(hdisc), 0.0); float tEnd = -b + sqrt(hdisc);",
      "  float minD = 1e3; bool hit = false;",
      "  for (int i = 0; i < 72; i++) {",
      "    vec3 p = ro + rd * t; float d = map(p);",
      "    minD = min(minD, d);",
      "    if (d < 0.0015) { hit = true; break; }",
      "    t += d * 0.7;",
      "    if (t > tEnd) break;",
      "  }",
      "  float px = 2.0 * VIEW * SCALE / uRes.y;",
      "  if (!hit) { float a = 1.0 - smoothstep(0.0, px * 1.5, minD); gl_FragColor = vec4(vec3(0.82) * a, a); return; }",
      "  vec3 p = ro + rd * t; vec3 n = calcNormal(p);",
      // Quick, fine ripples on the surface: this is what makes it read as water
      "  vec3 w = p * 6.0 + vec3(0.0, uTime * 0.5, uTime * 0.3);",
      "  n = normalize(n + 0.2 * vec3(noise(w), noise(w + 7.1), noise(w + 3.7)));",
      "  float cosT = clamp(dot(n, -rd), 0.0, 1.0);",
      "  float edge = 1.0 - cosT;",
      "  float fres = 0.03 + 0.97 * pow(edge, 4.0);",
      "  vec3 refl = reflect(rd, n); vec3 refr = refract(rd, n, 0.75);",
      // Caustics: thin bright lines of light that shimmer through the water
      "  vec3 cp = p * 2.6 + refr * 0.8 + vec3(0.0, uTime * 0.35, uTime * 0.2);",
      "  float caust = pow(1.0 - abs(noise(cp)), 10.0) + 0.6 * pow(1.0 - abs(noise(cp * 1.9 + 4.3)), 12.0);",
      "  float spec = 1.3 * pow(max(dot(refl, normalize(vec3(0.5, 0.7, 0.5))), 0.0), 140.0)",
      "             + 0.45 * pow(max(dot(refl, normalize(vec3(-0.6, 0.3, 0.7))), 0.0), 40.0);",
      "  float lip = 0.5 * smoothstep(0.88, 0.98, edge) * (0.5 + 0.5 * noise(p * 6.0));", // bright lip at the very edge

      "#ifdef LENS",
      // Look through the drop at the copy behind it: magnified about the blob's centre, bent more towards the
      // rim, with a slight colour fringe (each channel bends by a different amount, as in real glass)
      "  vec2 asp = vec2(uRes.y / uRes.x, 1.0);",
      "  vec2 suv = gl_FragCoord.xy / uRes;",
      "  vec2 cuv = 0.5 + uOffset.xy / (VIEW * SCALE) * 0.5 * asp;",
      "  vec2 look = cuv + (suv - cuv) / MAGNIFY;",
      "  vec2 bend = -n.xy * asp * (0.02 + 0.1 * edge * edge);",
      "  vec3 behind = vec3(texture2D(uText, look + bend).r, texture2D(uText, look + bend * 1.04).g, texture2D(uText, look + bend * 1.08).b);",
      "  vec3 col3 = behind * mix(1.0, 0.82, smoothstep(0.6, 1.0, edge));",
      "  col3 = mix(col3, vec3(env(refl)), fres * 0.6);",
      "  col3 *= mix(1.0, 0.55, smoothstep(0.8, 0.98, edge));",    // thin darker line at the rim
      "  col3 += 0.3 * caust + spec + lip;",
      "  gl_FragColor = vec4(clamp(col3, 0.0, 1.0), 1.0);",
      "#else",
      // Light bent through the body: soft grey streaks from the studio around it
      "  float through = 0.78 + 0.22 * env(refr);",
      "  float col = mix(through, env(refl), fres);",
      "  col *= mix(1.0, 0.45, smoothstep(0.7, 0.97, edge));",    // thin darker line at the rim
      "  col += lip + 0.5 * caust + spec;",
      "  col = clamp(col, 0.0, 1.0);",
      // Translucent: the centre is mostly see-through, the rim, reflections and highlights are solid
      "  float alpha = clamp(0.22 + 0.7 * smoothstep(0.3, 0.95, edge) + 0.6 * fres + 0.35 * caust + spec, 0.0, 1.0);",
      "  gl_FragColor = vec4(vec3(col) * alpha, alpha);",
      "#endif",
      "}",
    ].join("\n");
  }

  function clamp(v, m) { return Math.max(-m, Math.min(m, v)); }

  function createBlob(canvas) {
    var lens = canvas.getAttribute("data-blob-mode") === "lens";
    var stage = canvas.closest(".c_hero-height") || document;

    var gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) { console.warn("fluid-blob: WebGL not available, showing the static blob"); return; }

    function compile(type, source) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("fluid-blob: " + gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    }
    var vs = compile(gl.VERTEX_SHADER, vertexSource);
    var fs = compile(gl.FRAGMENT_SHADER, fragmentSource(lens));
    if (!vs || !fs) return;
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.warn("fluid-blob: " + gl.getProgramInfoLog(program)); return; }
    gl.useProgram(program);

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var u = {};
    ["uRes", "uTime", "uEnergy", "uOffset", "uAttr", "uAttrR", "uRipples", "uBound", "uText"].forEach(function (name) {
      u[name] = gl.getUniformLocation(program, name);
    });

    // --- Lens mode: the copy behind the blob, redrawn into a texture the shader can bend
    var copy = lens ? stage.querySelector(".blob-lens-copy") : null;
    var textCanvas = null, textCtx = null, texture = null, pageColor = "#fff";
    if (lens) {
      textCanvas = document.createElement("canvas");
      textCtx = textCanvas.getContext("2d");
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.uniform1i(u.uText, 0);
      // The page colour behind the copy (the first ancestor with a solid background)
      for (var el = canvas.parentElement; el; el = el.parentElement) {
        var bg = getComputedStyle(el).backgroundColor;
        if (bg && bg !== "transparent" && !/rgba\(.*,\s*0\)$/.test(bg)) { pageColor = bg; break; }
      }
    }

    function roundRect(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    // Draws the copy exactly where it sits on the page: boxes (the button) first, then every character
    // at its own position, so line breaks, letter spacing and fonts match the real text.
    function drawCopy() {
      if (!copy) return;
      var rect = canvas.getBoundingClientRect();
      var W = canvas.width, H = canvas.height;
      var sx = W / rect.width, sy = H / rect.height;
      textCanvas.width = W;
      textCanvas.height = H;
      var ctx = textCtx;
      ctx.fillStyle = pageColor;
      ctx.fillRect(0, 0, W, H);

      [copy].concat([].slice.call(copy.querySelectorAll("*"))).forEach(function (el) {
        var cs = getComputedStyle(el);
        var hasBg = cs.backgroundColor && !/rgba\(.*,\s*0\)$/.test(cs.backgroundColor) && cs.backgroundColor !== "transparent";
        var border = parseFloat(cs.borderTopWidth) || 0;
        if (!hasBg && !border) return;
        var r = el.getBoundingClientRect();
        var x = (r.left - rect.left) * sx, y = (r.top - rect.top) * sy, w = r.width * sx, h = r.height * sy;
        roundRect(ctx, x, y, w, h, (parseFloat(cs.borderTopLeftRadius) || 0) * sx);
        if (hasBg) { ctx.fillStyle = cs.backgroundColor; ctx.fill(); }
        if (border) { ctx.lineWidth = border * sx; ctx.strokeStyle = cs.borderTopColor; ctx.stroke(); }
      });

      var walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
      var range = document.createRange();
      for (var node = walker.nextNode(); node; node = walker.nextNode()) {
        var cs = getComputedStyle(node.parentElement);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        var size = parseFloat(cs.fontSize) * sx;
        ctx.font = cs.fontStyle + " " + cs.fontWeight + " " + size + "px " + cs.fontFamily;
        ctx.fillStyle = cs.color;
        ctx.textBaseline = "alphabetic";
        var text = node.data;
        for (var i = 0; i < text.length; i++) {
          var ch = text[i];
          if (/\s/.test(ch)) continue;
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          var rr = range.getClientRects()[0];
          if (!rr) continue;
          if (cs.textTransform === "uppercase") ch = ch.toUpperCase();
          var m = ctx.measureText(ch);
          var asc = m.fontBoundingBoxAscent || size * 0.8;
          var desc = m.fontBoundingBoxDescent || size * 0.2;
          var y = (rr.top - rect.top) * sy + (rr.height * sy - (asc + desc)) / 2 + asc;
          ctx.fillText(ch, (rr.left - rect.left) * sx, y);
        }
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
    }
    var copyDirty = true;
    if (lens) {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { copyDirty = true; });
      window.addEventListener("resize", function () { copyDirty = true; });
    }

    // --- Sizing: render below full device resolution, and lower it further if frames are slow
    var quality = 1;
    var pxPerUnit = 0;
    function resize() {
      var rect = canvas.getBoundingClientRect();
      var scale = Math.min(window.devicePixelRatio || 1, 1.5) * quality;
      var w = Math.max(1, Math.round(rect.width * scale));
      var h = Math.max(1, Math.round(rect.height * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        copyDirty = true;
      }
      pxPerUnit = rect.height / 2 / (VIEW * SCALE);
    }

    // --- Pointer: converted to the blob's world space
    var pointer = { x: 0, y: 0, active: false, speed: 0 };
    var lastMove = null;
    function toWorld(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      var halfH = rect.height / 2;
      return {
        x: ((clientX - rect.left - rect.width / 2) / halfH) * VIEW * SCALE,
        y: (-(clientY - rect.top - halfH) / halfH) * VIEW * SCALE,
      };
    }
    window.addEventListener("pointermove", function (e) {
      var w = toWorld(e.clientX, e.clientY);
      var now = performance.now();
      if (lastMove) {
        var dt = Math.max(now - lastMove.t, 1) / 1000;
        pointer.speed = Math.min(Math.hypot(w.x - lastMove.x, w.y - lastMove.y) / dt, 12);
      }
      lastMove = { x: w.x, y: w.y, t: now };
      pointer.x = w.x;
      pointer.y = w.y;
      pointer.active = true;
    }, { passive: true });
    document.addEventListener("pointerleave", function () { pointer.active = false; });

    var ripples = [];
    for (var i = 0; i < MAX_RIPPLES; i++) ripples.push([0, 0, 0, -100]);
    var nextRipple = 0;
    window.addEventListener("pointerdown", function (e) {
      var w = toWorld(e.clientX, e.clientY);
      var dx = w.x - body.p[0], dy = w.y - body.p[1];
      var r = Math.hypot(dx, dy);
      if (r > 1.25) return; // only clicks on (or right next to) the blob
      var s = Math.min(r, 0.98);
      var x = (dx / (r || 1)) * s, y = (dy / (r || 1)) * s;
      ripples[nextRipple] = [x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y)), time];
      nextRipple = (nextRipple + 1) % MAX_RIPPLES;
      energy = Math.min(energy + 0.6, 1.5);
    }, { passive: true });

    // --- Springs give the droplet and body their jelly-like lag
    function spring(s, target, dt, stiffness, damping) {
      for (var k = 0; k < 3; k++) {
        var a = (target[k] - s.p[k]) * stiffness - s.v[k] * damping;
        s.v[k] += a * dt;
        s.p[k] += s.v[k] * dt;
      }
    }
    var drop = { p: [0, 0, 0.3], v: [0, 0, 0] };
    var body = { p: [0, 0, 0], v: [0, 0, 0] };
    var dropR = 0;
    var energy = 0;
    var time = 0;

    // --- Under mode: the hero text and button sit "in" the water: they drift and squash with the blob's
    // springs, and an SVG displacement filter bends them like a lens. They stay real text and a real link.
    var overlay = lens || reduceMotion ? null : stage.querySelector(".blob-overlay");
    var warp = null;
    if (overlay) {
      var svgNS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("width", "0");
      svg.setAttribute("height", "0");
      svg.style.position = "absolute";
      svg.innerHTML =
        '<filter id="blob-warp" x="-15%" y="-25%" width="130%" height="150%" color-interpolation-filters="sRGB">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="noise"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G"/>' +
        "</filter>";
      document.body.appendChild(svg);
      warp = { turbulence: svg.querySelector("feTurbulence"), displace: svg.querySelector("feDisplacementMap") };
      overlay.style.filter = "url(#blob-warp)";
      overlay.style.willChange = "translate, rotate, scale";
    }

    function moveOverlay() {
      // How strongly recent clicks are still rippling
      var kick = 0, wave = 0;
      for (var r = 0; r < MAX_RIPPLES; r++) {
        var age = time - ripples[r][3];
        if (age > 0 && age < 2.5) {
          kick += Math.exp(-age * 2.2);
          wave += Math.sin(age * 16) * Math.exp(-age * 3);
        }
      }
      var lean = dropR / 0.3; // 0..1, how far the droplet is pulled out
      var x = (body.p[0] + drop.p[0] * 0.05 * lean) * pxPerUnit + Math.sin(time * 0.9) * 2;
      var y = -(body.p[1] + drop.p[1] * 0.05 * lean) * pxPerUnit + Math.cos(time * 0.7) * 3 + wave * 5;
      var vx = body.v[0], vy = body.v[1];
      var sx = 1 + Math.max(-0.06, Math.min(0.08, Math.abs(vx) * 0.12 - Math.abs(vy) * 0.06)) + wave * 0.015;
      var sy = 1 + Math.max(-0.06, Math.min(0.08, Math.abs(vy) * 0.12 - Math.abs(vx) * 0.06)) - wave * 0.015;
      overlay.style.translate = x.toFixed(2) + "px " + y.toFixed(2) + "px";
      overlay.style.rotate = (-vx * 5 + Math.sin(time * 0.5) * 0.6).toFixed(3) + "deg";
      overlay.style.scale = sx.toFixed(4) + " " + sy.toFixed(4);
      warp.displace.setAttribute("scale", (1.5 + energy * 10 + Math.min(kick, 1.5) * 16).toFixed(2));
      warp.turbulence.setAttribute("baseFrequency",
        (0.011 + 0.002 * Math.sin(time * 0.6)).toFixed(5) + " " + (0.017 + 0.003 * Math.cos(time * 0.45)).toFixed(5));
    }

    // --- Animation loop, paused when the blob is off screen or the tab is hidden
    var visible = true;
    var running = false;
    var last = 0;
    var frameTimes = [];
    var live = false;

    function frame(now) {
      if (!visible || document.hidden) { running = false; return; }
      var dt = Math.min((now - (last || now)) / 1000, 1 / 30);
      last = now;
      time += dt * (reduceMotion ? 0.3 : 1);

      // Pull the droplet towards the cursor when it's near the blob; it shrinks away as the cursor leaves.
      // The frame is wider than it is tall, so the droplet can follow the cursor further sideways.
      var dist = Math.hypot(pointer.x / 1.6, pointer.y);
      var pull = pointer.active && !reduceMotion ? Math.max(0, Math.min(1, (2.4 - dist) / 1.2)) : 0;
      spring(drop, [clamp(pointer.x, 2.2), clamp(pointer.y, 1.4), 0.35], dt, 55, 9);
      // In lens mode the whole drop follows the cursor further, so it can be slid across the copy
      var follow = lens ? 0.4 : 0.07;
      spring(body, [clamp(pointer.x * follow * pull, 1.1), clamp(pointer.y * follow * pull, 0.5), 0], dt, lens ? 18 : 30, lens ? 6 : 7);
      dropR += (0.3 * pull - dropR) * Math.min(1, dt * 4);

      pointer.speed *= Math.pow(0.02, dt);
      energy += (Math.min(pointer.speed / 6, 1) * pull - energy) * Math.min(1, dt * 2);

      resize();
      if (lens && copyDirty) { copyDirty = false; drawCopy(); }
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, time);
      gl.uniform1f(u.uEnergy, energy);
      gl.uniform3fv(u.uOffset, body.p);
      gl.uniform3fv(u.uAttr, drop.p);
      gl.uniform1f(u.uAttrR, dropR);
      gl.uniform4fv(u.uRipples, [].concat.apply([], ripples));
      gl.uniform1f(u.uBound, Math.max(1.4 + Math.hypot(body.p[0], body.p[1]), Math.hypot(drop.p[0], drop.p[1], drop.p[2]) + dropR + 0.45));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (overlay) moveOverlay();

      if (!live) {
        // The live blob is drawing, so hide the static image underneath
        live = true;
        canvas.classList.add("is-live");
        console.info("fluid-blob: running (" + (lens ? "lens" : "under") + ")");
        stage.querySelectorAll(".water-bubble-img").forEach(function (img) { img.style.display = "none"; });
      }

      // If frames are slow, drop the resolution (a softer blob beats a stuttering one)
      frameTimes.push(dt);
      if (frameTimes.length === 40) {
        var avg = frameTimes.reduce(function (a, b) { return a + b; }, 0) / frameTimes.length;
        if (avg > 1 / 40 && quality > 0.55) quality = Math.max(0.55, quality - 0.15);
        frameTimes = [];
      }

      requestAnimationFrame(frame);
    }
    function start() {
      if (running) return;
      running = true;
      last = 0;
      requestAnimationFrame(frame);
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start();
      }).observe(canvas);
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) start(); });
    start();
  }

  document.querySelectorAll("canvas.fluid-blob").forEach(createBlob);
})();
