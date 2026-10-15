document.addEventListener('DOMContentLoaded', () => {
  const chkEnable = document.getElementById('chkEnable');
  const toggleText = document.getElementById('toggleText');
  const latInput = document.getElementById('latInput');
  const lonInput = document.getElementById('lonInput');
  const btnSave = document.getElementById('btnSave');
  const statusBox = document.getElementById('statusBox');

  // استرجاع الإعدادات المحفوظة
  chrome.storage.local.get(['enabled', 'lat', 'lon'], (res) => {
    chkEnable.checked = res.enabled !== false;
    toggleText.textContent = chkEnable.checked ? 'مفعل' : 'معطل';
    latInput.value = res.lat || '31.217653';
    lonInput.value = res.lon || '29.945706';
  });

  chkEnable.addEventListener('change', () => {
    toggleText.textContent = chkEnable.checked ? 'مفعل' : 'معطل';
    saveSettings();
  });

  // أزرار المقرات السريعة
  document.getElementById('presetAlex')?.addEventListener('click', () => {
    latInput.value = '31.217653';
    lonInput.value = '29.945706';
    saveSettings();
  });

  document.getElementById('presetCairo')?.addEventListener('click', () => {
    latInput.value = '30.044420';
    lonInput.value = '31.235712';
    saveSettings();
  });

  document.getElementById('presetNatrun')?.addEventListener('click', () => {
    latInput.value = '30.541820';
    lonInput.value = '29.802930';
    saveSettings();
  });

  btnSave.addEventListener('click', saveSettings);

  function saveSettings() {
    const lat = parseFloat(latInput.value);
    const lon = parseFloat(lonInput.value);
    const enabled = chkEnable.checked;

    if (isNaN(lat) || isNaN(lon)) return;

    chrome.storage.local.set({ enabled, lat, lon, accuracy: 5.0 }, () => {
      statusBox.style.display = 'block';
      setTimeout(() => {
        statusBox.style.display = 'none';
      }, 2500);
    });
  }
});
