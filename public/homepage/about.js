const chapters = [...document.querySelectorAll('.about-chapter')];
const stackEnabled = matchMedia('(prefers-reduced-motion: no-preference) and (min-width: 360px) and (min-height: 680px)');
let frame = 0;

function updateStack() {
  frame = 0;
  if (!stackEnabled.matches) return;

  const cards = chapters.map(chapter => chapter.getBoundingClientRect());
  for (let index = 0; index < cards.length - 1; index += 1) {
    const current = cards[index];
    const next = cards[index + 1];
    const overlap = Math.max(0, Math.min(1, (current.bottom - next.top) / current.height));
    chapters[index].style.setProperty('--paper-scale', String(1 - overlap * 0.08));
  }
}

function scheduleStack() {
  if (!frame && stackEnabled.matches) frame = requestAnimationFrame(updateStack);
}

addEventListener('scroll', scheduleStack, {passive: true});
addEventListener('resize', scheduleStack);
stackEnabled.addEventListener('change', scheduleStack);
scheduleStack();
