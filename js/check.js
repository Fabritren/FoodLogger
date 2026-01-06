if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/FoodLogger/js/sw.js')
    .then(reg => {
      console.log('SW registered with scope:', reg.scope);
    })
    .catch(err => {
      console.error('SW registration failed:', err);
    });
}

let updateInterval = null; // store interval ID
const intervalTime = 5000; // 5s between retries
let retryCount = 0;
const maxRetries = 5;

async function updatePwaFooterStatus() {
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
    `Service Worker: ${swControlled ? 'OK' : 'NOT Controlling'}`,
    `App scope: ${correctScope ? 'OK' : 'WRONG PATH'}`,
    '',
    healthy
      ? '✅ App installed correctly'
      : '⚠️ App is NOT fully installed. Data may be cleared by iOS.'
  ];

  el.innerHTML = lines.join('<br>');
  el.style.color = healthy ? '#0a3622' : '#8a6d3b';

  return swControlled; // return SW status for retry logic
}

function startSafeRetry() {
  if (updateInterval) return; // already running

  retryCount = 0;
  updateInterval = setInterval(async () => {
    retryCount++;

    const swControlled = await updatePwaFooterStatus();

    // Stop interval if SW is controlling or max retries reached
    if (swControlled || retryCount >= maxRetries) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  }, intervalTime);
}

// Run after page load
window.addEventListener('load', () => {
  startSafeRetry();
});

// Optional: run on app resume
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    startSafeRetry();
  }
});
