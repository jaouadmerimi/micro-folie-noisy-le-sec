(() => {
  const section = document.querySelector('.stats-row');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!section || reducedMotion.matches || !('IntersectionObserver' in window)) return;

  const counters = Array.from(section.querySelectorAll('[data-count-to]'), (element) => ({
    element,
    target: Number(element.dataset.countTo),
    suffix: element.dataset.countSuffix || '',
    finalText: element.textContent,
  }));
  const format = new Intl.NumberFormat('fr-FR');
  let frame;

  function finish() {
    cancelAnimationFrame(frame);
    counters.forEach(({ element, finalText }) => { element.textContent = finalText; });
    reducedMotion.removeEventListener('change', onMotionChange);
  }

  function onMotionChange() {
    if (reducedMotion.matches) finish();
  }

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    if (reducedMotion.matches) return;

    counters.forEach(({ element, suffix, finalText }) => {
      // Keep the final number stable for screen readers throughout the animation.
      const readable = document.createElement('span');
      readable.className = 'stat-readable';
      readable.textContent = finalText;
      element.before(readable);
      element.setAttribute('aria-hidden', 'true');
      element.textContent = '0' + suffix;
    });
    reducedMotion.addEventListener('change', onMotionChange);
    let startedAt;

    function tick(now) {
      if (startedAt === undefined) startedAt = now;
      const progress = Math.min((now - startedAt) / 2000, 1);
      if (progress === 1) { finish(); return; }
      const eased = 1 - Math.pow(1 - progress, 3);
      counters.forEach(({ element, target, suffix }) => {
        element.textContent = format.format(Math.floor(target * eased)) + suffix;
      });
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
  }, { threshold: 0.2 });

  observer.observe(section);
})();
