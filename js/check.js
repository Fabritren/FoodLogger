async function updatePwaFooterStatusOnce() {
  const el = document.getElementById('pwaStatusLine');
  if (!el) return;

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const correctScope = location.pathname.startsWith('/FoodLogger/');

  const healthy = standalone && swControlled && correctScope;

  const lines = [
    `PWA status:`,
    `Standalone: ${standalone ? 'YES' : 'NO'}`,
    `App scope: ${correctScope ? 'OK' : 'WRONG PATH'}`,
    '',
    healthy
      ? '✅ App installed correctly'
      : '⚠️ App is NOT fully installed. Data may be cleared by iOS.'
  ];

  el.innerHTML = lines.join('<br>');
  el.style.color = healthy ? '#0a3622' : '#8a6d3b';
}

// Run after page load
window.addEventListener('load', () => {
  updatePwaFooterStatusOnce();
});
