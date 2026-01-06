if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/FoodLogger/js/sw.js')
    .then(reg => {
      console.log('SW registered with scope:', reg.scope);
    })
    .catch(err => {
      console.error('SW registration failed:', err);
    });
}

async function updatePwaFooterStatusOnce() {
  const el = document.getElementById('pwaStatusLine');
  if (!el) return;

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const swControlled =
    'serviceWorker' in navigator &&
    !!navigator.serviceWorker.controller;

  const correctScope = location.pathname.startsWith('/FoodLogger/');

  const healthy = standalone && swControlled && correctScope;

  const lines = [
    `PWA status:`,
    `Standalone: ${standalone ? 'YES' : 'NO'}`,
    `Service Worker: ${swControlled ? 'OK' : 'NOT CONTROLLING'}`,
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
