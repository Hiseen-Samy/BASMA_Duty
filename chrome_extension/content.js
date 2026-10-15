/**
 * content.js - يعمل في سياق الإضافة
 * يقرأ الإحداثيات من chrome.storage.local ويرسلها فوراً إلى override.js في سياق الصفحة
 */

chrome.storage.local.get(['enabled', 'lat', 'lon', 'accuracy'], (data) => {
  if (data.enabled === false) return;

  const lat = typeof data.lat !== 'undefined' ? data.lat : 31.217653;
  const lon = typeof data.lon !== 'undefined' ? data.lon : 29.945706;
  const accuracy = typeof data.accuracy !== 'undefined' ? data.accuracy : 5.0;

  window.postMessage({
    type: 'BASMA_SET_COORDS',
    lat: lat,
    lon: lon,
    accuracy: accuracy
  }, '*');
});

// الاستماع لأي تحديث جديد
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    chrome.storage.local.get(['lat', 'lon', 'accuracy'], (data) => {
      window.postMessage({
        type: 'BASMA_SET_COORDS',
        lat: data.lat || 31.217653,
        lon: data.lon || 29.945706,
        accuracy: data.accuracy || 5.0
      }, '*');
    });
  }
});
