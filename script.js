// ====================================================================
//  Portfolio — interactive layer
//  - Velocity-stretching blob cursor (squishes along movement vector)
//  - Cursor-reactive background blobs (parallax)
//  - Scroll progress bar
//  - Scroll-triggered reveal animations (IntersectionObserver)
//  - Stat counter animation
//  - Subtle parallax on hero title
// ====================================================================

(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  // ----- CUSTOM CURSOR: velocity-stretch blob -----------------------
  const blob = document.getElementById('cursorBlob');

  // Target position (raw mouse) + eased position (what we actually render)
  let tx = window.innerWidth / 2, ty = window.innerHeight / 2;
  let cx = tx, cy = ty;
  let lastX = tx, lastY = ty;

  // Current stretch + angle (eased each frame so it feels elastic)
  let curSx = 1, curSy = 1, curRot = 0;

  window.addEventListener('mousemove', (e) => {
    tx = e.clientX;
    ty = e.clientY;
  }, { passive: true });

  window.addEventListener('mousedown', () => blob?.classList.add('click'));
  window.addEventListener('mouseup',   () => blob?.classList.remove('click'));

  // Hover targets — blob expands into a ring outline
  document.querySelectorAll('[data-hover]').forEach((el) => {
    el.addEventListener('mouseenter', () => blob?.classList.add('hover'));
    el.addEventListener('mouseleave', () => blob?.classList.remove('hover'));
  });

  // ----- CURSOR-REACTIVE BACKGROUND BLOBS ---------------------------
  const b1 = document.getElementById('blob1');
  const b2 = document.getElementById('blob2');
  const b3 = document.getElementById('blob3');
  const bgBlobs = [
    { el: b1, factor: 60,  x: 0, y: 0 },
    { el: b2, factor: -80, x: 0, y: 0 },
    { el: b3, factor: 120, x: 0, y: 0 },
  ];

  const heroLines = document.querySelectorAll('.hero-title .line > span');

  // ----- RAF LOOP ---------------------------------------------------
  function tick() {
    if (!isCoarse && !prefersReducedMotion) {
      // Eased cursor position (tiny lag → elastic)
      cx += (tx - cx) * 0.35;
      cy += (ty - cy) * 0.35;

      // Per-frame velocity
      const vx = cx - lastX;
      const vy = cy - lastY;
      lastX = cx;
      lastY = cy;

      const speed = Math.min(Math.sqrt(vx * vx + vy * vy), 80);
      const angle = Math.atan2(vy, vx) * (180 / Math.PI);

      // Stretch along motion, squeeze perpendicular — capped for comfort
      const stretch = 1 + speed / 120;         // up to ~1.66
      const squeeze = Math.max(1 - speed / 200, 0.55);

      // Ease toward target stretch so it doesn't jitter
      curSx += (stretch - curSx) * 0.25;
      curSy += (squeeze - curSy) * 0.25;

      // For angle, only update when there's meaningful motion — else keep last angle
      if (speed > 0.6) {
        // Shortest-path angle lerp (to avoid 179° ↔ -179° flips)
        let d = ((angle - curRot) % 360 + 540) % 360 - 180;
        curRot += d * 0.25;
      }

      if (blob) {
        blob.style.setProperty('--x',   cx + 'px');
        blob.style.setProperty('--y',   cy + 'px');
        blob.style.setProperty('--sx',  curSx.toFixed(3));
        blob.style.setProperty('--sy',  curSy.toFixed(3));
        blob.style.setProperty('--rot', curRot.toFixed(2) + 'deg');
      }

      // Parallax background blobs
      const nx = (tx / window.innerWidth)  - 0.5;
      const ny = (ty / window.innerHeight) - 0.5;
      bgBlobs.forEach((b) => {
        if (!b.el) return;
        const targetX = nx * b.factor;
        const targetY = ny * b.factor;
        b.x += (targetX - b.x) * 0.05;
        b.y += (targetY - b.y) * 0.05;
        b.el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
      });

      // Hero title micro-parallax
      heroLines.forEach((span, i) => {
        const depth = (i + 1) * 4;
        span.style.transform = `translate3d(${-nx * depth}px, ${-ny * depth * 0.4}px, 0)`;
      });
    }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ----- SCROLL PROGRESS --------------------------------------------
  const progress = document.getElementById('scrollProgress');
  function updateProgress() {
    const h = document.documentElement;
    const pct = (h.scrollTop || document.body.scrollTop) /
                ((h.scrollHeight - h.clientHeight) || 1);
    if (progress) progress.style.width = `${Math.max(0, Math.min(1, pct)) * 100}%`;
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  // ----- REVEAL ON SCROLL -------------------------------------------
  const revealTargets = document.querySelectorAll('.reveal, .reveal-line');

  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const delay = (entry.target.dataset.delay || 0) * 1;
          setTimeout(() => entry.target.classList.add('in'), delay);
          io.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -60px 0px',
    });

    revealTargets.forEach((el) => {
      const siblings = el.parentElement?.querySelectorAll(':scope > .reveal-line');
      if (siblings && siblings.length > 1) {
        const index = Array.from(siblings).indexOf(el);
        if (index >= 0) el.dataset.delay = index * 180;
      }
      io.observe(el);
    });
  } else {
    revealTargets.forEach((el) => el.classList.add('in'));
  }

  // ----- STAT COUNTER -----------------------------------------------
  const counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    const counterObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          counterObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach((c) => counterObs.observe(c));
  }

  function animateCount(el) {
    const target = parseInt(el.dataset.count, 10);
    const duration = 1400;
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.floor(eased * target);
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }

  // ----- SMOOTH ANCHOR BLUR -----------------------------------------
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', () => { setTimeout(() => a.blur(), 0); });
  });

  // ----- PROJECT CARD: cursor-tracked gradient spotlight ------------
  if (!isCoarse && !prefersReducedMotion) {
    document.querySelectorAll('.project').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top)  / rect.height;
        const bg = card.querySelector('.project-hover-bg');
        if (bg) {
          bg.style.background =
            `radial-gradient(600px circle at ${x * 100}% ${y * 100}%, rgba(192,42,31,0.18), rgba(224,122,31,0.10) 40%, transparent 70%)`;
        }
      });
      card.addEventListener('mouseleave', () => {
        const bg = card.querySelector('.project-hover-bg');
        if (bg) bg.style.background = '';
      });
    });
  }
})();
