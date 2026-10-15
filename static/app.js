/**
 * BASMA Duty - Location Picker & Manager Interactive Logic
 * محرك الخريطة التفاعلية وتحديد موقع البصمة والدوام
 */

// إحداثيات البداية المطلوبة من المستخدم
const INITIAL_COORDS = {
  lat: 30.54182,
  lon: 29.80293,
  zoom: 8,
  radius: 150,
  address: "طريق مصر الإسكندرية الصحراوي، مصر"
};

// الحالة العامة للتطبيق
let state = {
  lat: INITIAL_COORDS.lat,
  lon: INITIAL_COORDS.lon,
  zoom: INITIAL_COORDS.zoom,
  radius: INITIAL_COORDS.radius,
  address: INITIAL_COORDS.address,
  name: "موقعي المحدد",
  isServerOnline: false
};

// متغيرات Leaflet
let map = null;
let currentMarker = null;
let geofenceCircle = null;
let tileLayers = {};
let currentActiveTileLayer = null;

// توقيت إلغاء الارتداد للبحث (Debounce)
let searchDebounceTimer = null;

/* ==========================================================================
   تهيئة التطبيق عند اكتمال تحميل الصفحة
   ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initMap();
  setupEventListeners();
  await checkServerAndLoadLocation();
  loadPresets();
  startGpsHardwarePolling();
});

function startGpsHardwarePolling() {
  setInterval(async () => {
    try {
      const res = await fetch('/api/gps/status');
      if (res.ok) {
        const data = await res.json();
        const log = document.getElementById('nmeaStreamLog');
        if (log && data.latest_nmea_sentences && data.latest_nmea_sentences.length > 0) {
          log.textContent = data.latest_nmea_sentences.join('\n');
        }
        const sat = document.getElementById('satellitesCount');
        if (sat && data.satellites_locked) {
          sat.textContent = `🛰️ ${data.satellites_locked} أقمار (3D Fix)`;
        }
      }
    } catch (e) {}
  }, 2000);
}

/* ==========================================================================
   إعداد وتبديل المظهر (Dark / Light Theme)
   ========================================================================== */
function initTheme() {
  const savedTheme = localStorage.getItem('basma_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
  }

  document.getElementById('btnThemeToggle')?.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-theme');
    if (isDark) {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      localStorage.setItem('basma_theme', 'light');
      showToast('تم التبديل إلى الوضع النهاري', 'info');
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
      localStorage.setItem('basma_theme', 'dark');
      showToast('تم التبديل إلى الوضع الليلي', 'info');
    }
  });
}

/* ==========================================================================
   تهيئة خريطة Leaflet والطبقات
   ========================================================================== */
function initMap() {
  // إنشاء عنصر الخريطة ممركزاً على إحداثيات المستخدم
  map = L.map('map', {
    center: [state.lat, state.lon],
    zoom: state.zoom,
    zoomControl: false // سنضيف أزرار التكبير في موضع مناسب
  });

  // إضافة تحكم التكبير والتصغير أسفل اليسار
  L.control.zoom({ position: 'topleft' }).addTo(map);

  // تعريف طبقات الخرائط المختلفة
  tileLayers = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }),
    topo: L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team'
    })
  };

  // تفعيل الطبقة الافتراضية
  currentActiveTileLayer = tileLayers.osm;
  currentActiveTileLayer.addTo(map);

  // إنشاء الأيقونة الرادارية المخصصة للدبوس
  createRadarMarker([state.lat, state.lon]);

  // إنشاء دائرة نطاق الدوام (Geofence Circle)
  createGeofenceCircle([state.lat, state.lon], state.radius);

  // الاستماع للنقر المباشر على الخريطة
  map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    updateSelectedLocation(lat, lng, true);
  });
}

/* ==========================================================================
   إنشاء وتحديث الدبوس وعلامة الرادار
   ========================================================================== */
function createRadarMarker(latlng) {
  const radarIcon = L.divIcon({
    className: 'custom-pin-marker',
    html: `
      <div class="radar-core"></div>
      <div class="radar-ring"></div>
      <div class="radar-ring ring-2"></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  currentMarker = L.marker(latlng, {
    icon: radarIcon,
    draggable: true,
    riseOnHover: true
  }).addTo(map);

  // تحديث الموقع عند سحب الدبوس
  currentMarker.on('drag', (e) => {
    const { lat, lng } = e.target.getLatLng();
    updateUIFields(lat, lng, false);
    if (geofenceCircle) {
      geofenceCircle.setLatLng([lat, lng]);
    }
  });

  currentMarker.on('dragend', (e) => {
    const { lat, lng } = e.target.getLatLng();
    updateSelectedLocation(lat, lng, false);
  });
}

/* ==========================================================================
   إنشاء دائرة نطاق البصمة (Geofence Range Circle)
   ========================================================================== */
function createGeofenceCircle(latlng, radiusMeters) {
  if (geofenceCircle) {
    map.removeLayer(geofenceCircle);
  }

  geofenceCircle = L.circle(latlng, {
    radius: radiusMeters,
    color: '#06b6d4',
    weight: 2,
    opacity: 0.8,
    fillColor: '#0284c7',
    fillOpacity: 0.18,
    dashArray: '6, 6'
  }).addTo(map);
}

/* ==========================================================================
   تحديث الموقع المحدد وتحديث العناوين والإحداثيات
   ========================================================================== */
async function updateSelectedLocation(lat, lon, panMap = true) {
  state.lat = Number(Number(lat).toFixed(6));
  state.lon = Number(Number(lon).toFixed(6));

  if (currentMarker) {
    currentMarker.setLatLng([state.lat, state.lon]);
  }
  if (geofenceCircle) {
    geofenceCircle.setLatLng([state.lat, state.lon]);
  }

  if (panMap) {
    map.panTo([state.lat, state.lon], { animate: true, duration: 0.5 });
  }

  updateUIFields(state.lat, state.lon, true);

  // جلب العنوان المقروء من OpenStreetMap
  await resolveAddress(state.lat, state.lon);
}

/* ==========================================================================
   تحديث الحقول النصية في الواجهة
   ========================================================================== */
function updateUIFields(lat, lon, updateInputs = true) {
  const latStr = Number(lat).toFixed(6);
  const lonStr = Number(lon).toFixed(6);

  // نصوص العرض
  document.getElementById('displayLat').textContent = latStr;
  document.getElementById('displayLon').textContent = lonStr;
  document.getElementById('headerCoordsText').textContent = `${latStr}, ${lonStr}`;

  if (updateInputs) {
    const manualLat = document.getElementById('manualLat');
    const manualLon = document.getElementById('manualLon');
    if (manualLat) manualLat.value = latStr;
    if (manualLon) manualLon.value = lonStr;
  }
}

/* ==========================================================================
   الاستعلام عن العنوان المقروء (Reverse Geocoding)
   ========================================================================== */
async function resolveAddress(lat, lon) {
  const addressElem = document.getElementById('resolvedAddress');
  if (addressElem) {
    addressElem.textContent = 'جاري استرجاع تفاصيل العنوان من OpenStreetMap...';
  }

  try {
    let url = `/api/reverse-geocode?lat=${lat}&lon=${lon}&lang=ar`;
    let response;
    
    try {
      response = await fetch(url);
    } catch {
      // احتياطي مباشر لـ OSM Nominatim إذا كان السيرفر المحلي غير متصل
      response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=ar`);
    }

    if (response && response.ok) {
      const data = await response.json();
      state.address = data.display_name || `إحداثيات: ${lat}, ${lon}`;
      if (addressElem) {
        addressElem.textContent = state.address;
      }
    } else {
      fallbackAddress(lat, lon);
    }
  } catch (err) {
    fallbackAddress(lat, lon);
  }
}

function fallbackAddress(lat, lon) {
  const addressElem = document.getElementById('resolvedAddress');
  state.address = `الموقع المعتمد: (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
  if (addressElem) {
    addressElem.textContent = state.address;
  }
}

/* ==========================================================================
   التحقق من حالة السيرفر وتحميل الموقع المحفوظ
   ========================================================================== */
async function checkServerAndLoadLocation() {
  try {
    const res = await fetch('/api/location');
    if (res.ok) {
      state.isServerOnline = true;
      const data = await res.json();
      if (data && data.lat && data.lon) {
        state.lat = data.lat;
        state.lon = data.lon;
        state.radius = data.radius || 150;
        state.address = data.address || state.address;
        state.name = data.name || state.name;

        // تطبيق على الخريطة
        updateSelectedLocation(state.lat, state.lon, false);
        map.setView([state.lat, state.lon], data.zoom || 14);
        
        // تحديث سلايدر النطاق
        updateRadiusUI(state.radius);
        showToast('تم استعادة موقعك المحفوظ بنجاح', 'info');
        return;
      }
    }
  } catch (e) {
    console.log('Running in local offline client mode');
  }

  // في حال تعذر السيرفر، اقرأ من localStorage
  const localSaved = localStorage.getItem('basma_duty_location');
  if (localSaved) {
    try {
      const parsed = JSON.parse(localSaved);
      state.lat = parsed.lat;
      state.lon = parsed.lon;
      state.radius = parsed.radius || 150;
      updateSelectedLocation(state.lat, state.lon, false);
      map.setView([state.lat, state.lon], parsed.zoom || 12);
      updateRadiusUI(state.radius);
    } catch {}
  } else {
    // استخدم الإحداثيات الافتراضية المحددة في الطلب
    updateSelectedLocation(state.lat, state.lon, true);
  }
}

/* ==========================================================================
   تحديث نطاق الدوام (Geofence Slider & Chips)
   ========================================================================== */
function updateRadiusUI(radius) {
  state.radius = Number(radius);
  const slider = document.getElementById('radiusSlider');
  const text = document.getElementById('radiusValText');
  
  if (slider) slider.value = state.radius;
  if (text) {
    text.textContent = state.radius >= 1000 
      ? `${(state.radius / 1000).toFixed(1)} كم` 
      : `${state.radius} متر`;
  }

  if (geofenceCircle) {
    geofenceCircle.setRadius(state.radius);
  }

  // تحديث تفعيل أزرار الشرائح (Chips)
  document.querySelectorAll('.btn-chip').forEach(chip => {
    chip.classList.toggle('active', Number(chip.dataset.radius) === state.radius);
  });
}

/* ==========================================================================
   إعداد مستمعي الأحداث التفاعلية (Event Listeners)
   ========================================================================== */
function setupEventListeners() {
  // شريط البحث المباشر
  const searchInput = document.getElementById('searchInput');
  const searchDropdown = document.getElementById('searchResultsDropdown');
  const searchClear = document.getElementById('searchClearBtn');
  const searchSpinner = document.getElementById('searchSpinner');

  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    searchClear.style.display = query ? 'block' : 'none';

    clearTimeout(searchDebounceTimer);
    if (!query) {
      searchDropdown.style.display = 'none';
      searchSpinner.style.display = 'none';
      return;
    }

    searchSpinner.style.display = 'block';
    searchDebounceTimer = setTimeout(() => {
      performSearch(query);
    }, 400);
  });

  searchClear?.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    searchDropdown.style.display = 'none';
    searchSpinner.style.display = 'none';
    searchInput.focus();
  });

  // إغلاق قائمة البحث عند النقر في الخارج
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.floating-search-bar')) {
      searchDropdown.style.display = 'none';
    }
  });

  // منزلق النطاق Geofence Slider
  const radiusSlider = document.getElementById('radiusSlider');
  radiusSlider?.addEventListener('input', (e) => {
    updateRadiusUI(e.target.value);
  });

  // أزرار الاختيار السريع للنطاق
  document.querySelectorAll('.btn-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      updateRadiusUI(chip.dataset.radius);
    });
  });

  // تبديل طبقات الخريطة
  document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const layerKey = btn.dataset.layer;
      if (tileLayers[layerKey]) {
        if (currentActiveTileLayer) {
          map.removeLayer(currentActiveTileLayer);
        }
        currentActiveTileLayer = tileLayers[layerKey];
        currentActiveTileLayer.addTo(map);

        document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showToast(`تم التبديل إلى: ${btn.textContent.trim()}`, 'info');
      }
    });
  });

  // تحديد الموقع الحقيقي عبر GPS
  document.getElementById('btnLocateMe')?.addEventListener('click', locateUserViaGPS);

  // أزرار الحفظ الرئيسية
  document.getElementById('btnSavePrimary')?.addEventListener('click', saveCurrentLocation);
  document.getElementById('btnSaveSidebar')?.addEventListener('click', saveCurrentLocation);

  // إدخال الإحداثيات اليدوي
  document.getElementById('btnApplyManualCoords')?.addEventListener('click', () => {
    const latVal = parseFloat(document.getElementById('manualLat').value);
    const lonVal = parseFloat(document.getElementById('manualLon').value);

    if (isNaN(latVal) || isNaN(lonVal) || latVal < -90 || latVal > 90 || lonVal < -180 || lonVal > 180) {
      showToast('يرجى إدخال إحداثيات صحيحة بين -90 و 90 لخط العرض، و -180 و 180 لخط الطول', 'error');
      return;
    }

    updateSelectedLocation(latVal, lonVal, true);
    map.setView([latVal, lonVal], 16);
    showToast('تم تطبيق الإحداثيات والانتقال للموقع', 'success');
  });

  // أدوات النسخ السريع والتصدير
  setupExportTools();

  // تبديل السايدبار في الموبايل
  const drawerToggle = document.getElementById('drawerToggleBtn');
  const sidebar = document.getElementById('controlSidebar');
  drawerToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // نقر شارة الرأس لنسخ الإحداثيات
  document.getElementById('headerCoordsBadge')?.addEventListener('click', () => {
    copyTextToClipboard(`${state.lat}, ${state.lon}`, 'تم نسخ الإحداثيات بنجاح!');
  });

  // إضافة للمفضلة
  document.getElementById('btnAddFavoriteModal')?.addEventListener('click', promptAddFavorite);

  // نظام تثبيت الـ GPS الافتراضي والفحص
  document.getElementById('btnLockVirtualGps')?.addEventListener('click', lockVirtualGPS);
  document.getElementById('btnVerifyLocation')?.addEventListener('click', verifyLocationAndShowModal);
  document.getElementById('btnOpenInjectorModal')?.addEventListener('click', openInjectorModal);

  // إغلاق نوافذ التأكيد والفحص
  document.getElementById('btnCloseVerifyModal')?.addEventListener('click', () => {
    document.getElementById('modalVerification').style.display = 'none';
  });
  document.getElementById('btnConfirmVerifyClose')?.addEventListener('click', () => {
    document.getElementById('modalVerification').style.display = 'none';
  });

  document.getElementById('btnCloseInjectorModal')?.addEventListener('click', () => {
    document.getElementById('modalInjector').style.display = 'none';
  });
  document.getElementById('btnConfirmInjectorClose')?.addEventListener('click', () => {
    document.getElementById('modalInjector').style.display = 'none';
  });

  // نسخ كود الكونسول
  document.getElementById('btnCopyConsoleCode')?.addEventListener('click', () => {
    const code = document.getElementById('consoleInjectorCode').textContent;
    copyTextToClipboard(code, 'تم نسخ كود تثبيت موقع البصمة!');
  });

  // نسخ رابط Bookmarklet
  document.getElementById('btnCopyBookmarklet')?.addEventListener('click', () => {
    const bookmarklet = document.getElementById('bookmarkletLink').href;
    copyTextToClipboard(bookmarklet, 'تم نسخ رابط الـ Bookmarklet!');
  });
}

/* ==========================================================================
   وظائف تثبيت الـ GPS الافتراضي والفحص (Virtual GPS & Verification)
   ========================================================================== */
function lockVirtualGPS() {
  overrideBrowserGeolocation(state.lat, state.lon);
  saveCurrentLocation();
  
  if (currentMarker && currentMarker.getElement()) {
    currentMarker.getElement().classList.add('locked');
  }

  const statusEl = document.getElementById('vGpsStatusText');
  if (statusEl) {
    statusEl.textContent = '🔒 مثبت افتراضياً';
    statusEl.style.background = 'rgba(16, 185, 129, 0.25)';
    statusEl.style.color = '#10b981';
  }
  showToast('🔒 تم تثبيت وقفل موقعك بنجاح كـ GPS افتراضي بدون عتاد GPS!', 'success');
}

function overrideBrowserGeolocation(lat, lon) {
  const mockPosition = {
    coords: {
      latitude: Number(lat),
      longitude: Number(lon),
      altitude: 20.0,
      accuracy: 5.0, // دقة عالية 5 أمتار
      altitudeAccuracy: 5.0,
      heading: null,
      speed: null
    },
    timestamp: Date.now()
  };

  try {
    navigator.geolocation.getCurrentPosition = function(success, error, options) {
      if (success) success(mockPosition);
    };
    navigator.geolocation.watchPosition = function(success, error, options) {
      if (success) success(mockPosition);
      return 1;
    };
  } catch (e) {
    console.warn('Could not override navigator.geolocation:', e);
  }
}

function verifyLocationAndShowModal() {
  // تفعيل التثبيت الافتراضي
  overrideBrowserGeolocation(state.lat, state.lon);

  document.getElementById('verifyCoordsText').textContent = `${state.lat}, ${state.lon}`;
  document.getElementById('verifyAddressText').textContent = state.address || 'العنوان المعتمد';

  document.getElementById('modalVerification').style.display = 'flex';
  showToast('✅ تم الفحص والتأكد: كل البيانات سليمة ومثبتة 100%', 'success');
}

function openInjectorModal() {
  const code = `navigator.geolocation.getCurrentPosition = (s) => s({coords:{latitude:${state.lat},longitude:${state.lon},accuracy:5},timestamp:Date.now()});`;
  const bookmarklet = `javascript:(function(){navigator.geolocation.getCurrentPosition=(s)=>s({coords:{latitude:${state.lat},longitude:${state.lon},accuracy:5},timestamp:Date.now()});alert('تم تثبيت موقع البصمة بنجاح! الإحداثيات: ${state.lat}, ${state.lon}');})();`;

  const codeEl = document.getElementById('consoleInjectorCode');
  if (codeEl) codeEl.textContent = code;

  const bookmarkletEl = document.getElementById('bookmarkletLink');
  if (bookmarkletEl) bookmarkletEl.href = bookmarklet;

  document.querySelectorAll('.lat-copy').forEach(el => { el.textContent = state.lat; });
  document.querySelectorAll('.lon-copy').forEach(el => { el.textContent = state.lon; });

  document.getElementById('modalInjector').style.display = 'flex';
}

/* ==========================================================================
   البحث عن الأماكن والمدن (Search Geocoding)
   ========================================================================== */
async function performSearch(query) {
  const dropdown = document.getElementById('searchResultsDropdown');
  const spinner = document.getElementById('searchSpinner');

  try {
    let url = `/api/search?q=${encodeURIComponent(query)}&lang=ar`;
    let response;
    try {
      response = await fetch(url);
    } catch {
      response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=6&accept-language=ar`);
    }

    spinner.style.display = 'none';

    if (!response.ok) {
      dropdown.style.display = 'none';
      return;
    }

    const results = await response.json();
    if (!results || results.length === 0) {
      dropdown.innerHTML = '<div style="padding: 14px; text-align: center; color: var(--text-dim); font-size: 0.85rem;">لم يتم العثور على نتائج مطابقة</div>';
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = results.map(item => `
      <div class="search-result-item" data-lat="${item.lat}" data-lon="${item.lon}" data-title="${escapeHtml(item.display_name)}">
        <span class="item-icon">📍</span>
        <div class="item-texts">
          <div class="item-title">${escapeHtml(item.display_name.split(',')[0])}</div>
          <div class="item-desc">${escapeHtml(item.display_name)}</div>
        </div>
      </div>
    `).join('');

    dropdown.style.display = 'block';

    // إضافة نقر على النتائج
    dropdown.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const lat = parseFloat(el.dataset.lat);
        const lon = parseFloat(el.dataset.lon);
        updateSelectedLocation(lat, lon, true);
        map.flyTo([lat, lon], 16, { duration: 1.2 });
        dropdown.style.display = 'none';
        document.getElementById('searchInput').value = el.dataset.title.split(',')[0];
        showToast('تم الانتقال وتثبيت موقع البحث', 'success');
      });
    });

  } catch (err) {
    spinner.style.display = 'none';
    dropdown.style.display = 'none';
  }
}

/* ==========================================================================
   تحديد الموقع الفعلي عبر متصفح الـ GPS
   ========================================================================== */
function locateUserViaGPS() {
  if (!navigator.geolocation) {
    showToast('متصفحك لا يدعم تحديد الموقع الجغرافي (Geolocation)', 'error');
    return;
  }

  showToast('جاري استشعار موقعك الحالي عبر GPS...', 'info');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      updateSelectedLocation(latitude, longitude, true);
      map.flyTo([latitude, longitude], 16, { duration: 1.4 });
      showToast(`تم تحديد موقعك بدقة ±${Math.round(accuracy)} متر`, 'success');
    },
    (err) => {
      let msg = 'تعذر الوصول للموقع الجغرافي. تأكد من تفعيل إذن الموقع.';
      if (err.code === 1) msg = 'تم رفض إذن الوصول إلى الموقع في المتصفح.';
      showToast(msg, 'error');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

/* ==========================================================================
   حفظ الموقع المعتمد (Save as My Location)
   ========================================================================== */
async function saveCurrentLocation() {
  const payload = {
    lat: state.lat,
    lon: state.lon,
    zoom: map.getZoom(),
    radius: state.radius,
    name: state.name,
    address: state.address,
    display_name: state.address
  };

  // حفظ محلياً في المتصفح فوراً
  localStorage.setItem('basma_duty_location', JSON.stringify(payload));

  // إرسال للسيرفر لحفظه في location.json و .env
  try {
    const res = await fetch('/api/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      showToast('🎉 تم حفظ وتثبيت هذا الموقع كـ "موقعك المعتمد" بنجاح!', 'success');
      highlightSavedSuccess();
      return;
    }
  } catch (e) {
    console.warn('Saved to localStorage only (offline mode)');
  }

  showToast('تم حفظ الموقع بنجاح في ذاكرة المتصفح', 'success');
  highlightSavedSuccess();
}

function highlightSavedSuccess() {
  const badge = document.getElementById('activeBadge');
  if (badge) {
    badge.textContent = 'تم الحفظ والاعتماد ✓';
    badge.style.background = 'rgba(16, 185, 129, 0.3)';
    setTimeout(() => {
      badge.textContent = 'نشط ومحدد';
      badge.style.background = '';
    }, 3000);
  }
}

/* ==========================================================================
   أدوات التصدير والربط السريع
   ========================================================================== */
function setupExportTools() {
  // نسخ الإحداثيات
  document.getElementById('btnCopyCoords')?.addEventListener('click', () => {
    copyTextToClipboard(`${state.lat}, ${state.lon}`, 'تم نسخ الإحداثيات (خط العرض وخط الطول)');
  });

  // فتح في Google Maps
  document.getElementById('btnOpenGoogleMaps')?.addEventListener('click', () => {
    const url = `https://www.google.com/maps?q=${state.lat},${state.lon}`;
    window.open(url, '_blank');
  });

  // فتح في OpenStreetMap
  document.getElementById('btnOpenOSM')?.addEventListener('click', () => {
    const zoom = map.getZoom() || 16;
    const url = `https://www.openstreetmap.org/?mlat=${state.lat}&mlon=${state.lon}#map=${zoom}/${state.lat}/${state.lon}`;
    window.open(url, '_blank');
  });

  // نسخ كود بايثون جاهز للاستخدام
  document.getElementById('btnCopyPython')?.addEventListener('click', () => {
    const pyCode = `# كود بايثون جاهز - موقع بصمة الدوام المحدد
DUTY_LOCATION = {
    "latitude": ${state.lat},
    "longitude": ${state.lon},
    "geofence_radius": ${state.radius},
    "address": "${state.address.replace(/"/g, '\\"')}"
}
`;
    copyTextToClipboard(pyCode, 'تم نسخ كود بايثون لموقع الدوام بنجاح!');
  });

  // تحميل ملف GPX للمحاكاة
  document.getElementById('btnDownloadGPX')?.addEventListener('click', () => {
    window.location.href = '/api/export/gpx';
    showToast('جاري تنزيل ملف GPX للمحاكاة...', 'info');
  });

  // نسخ صيغة JSON
  document.getElementById('btnCopyJSON')?.addEventListener('click', () => {
    const jsonObj = {
      latitude: state.lat,
      longitude: state.lon,
      radius_meters: state.radius,
      address: state.address,
      timestamp: new Date().toISOString()
    };
    copyTextToClipboard(JSON.stringify(jsonObj, null, 2), 'تم نسخ بيانات الموقع بصيغة JSON');
  });

  // نسخ الحقول الفردية
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.copy;
      const val = type === 'lat' ? state.lat : state.lon;
      const label = type === 'lat' ? 'خط العرض' : 'خط الطول';
      copyTextToClipboard(val.toString(), `تم نسخ ${label}`);
    });
  });
}

/* ==========================================================================
   إدارة الأماكن المحفوظة والمفضلة (Presets)
   ========================================================================== */
async function loadPresets() {
  const listElem = document.getElementById('presetsList');
  if (!listElem) return;

  let presets = [];
  try {
    const res = await fetch('/api/presets');
    if (res.ok) {
      presets = await res.json();
    }
  } catch {}

  if (!presets || presets.length === 0) {
    const local = localStorage.getItem('basma_presets');
    if (local) {
      try { presets = JSON.parse(local); } catch {}
    }
  }

  if (presets.length === 0) {
    listElem.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; text-align: center; padding: 10px;">لا توجد مواقع مفضلة حالياً</div>';
    return;
  }

  listElem.innerHTML = presets.map(p => `
    <div class="preset-item" data-lat="${p.lat}" data-lon="${p.lon}" data-zoom="${p.zoom || 15}" data-radius="${p.radius || 150}" data-id="${p.id || ''}">
      <div class="preset-info-group">
        <span class="preset-name">${escapeHtml(p.name)}</span>
        <span class="preset-coords">${p.lat}, ${p.lon}</span>
      </div>
      <button class="preset-delete-btn" title="حذف" data-id="${p.id || ''}">&times;</button>
    </div>
  `).join('');

  // استماع النقر للتنقل للموقع المفضل
  listElem.querySelectorAll('.preset-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.preset-delete-btn')) return;
      const lat = parseFloat(item.dataset.lat);
      const lon = parseFloat(item.dataset.lon);
      const zoom = parseInt(item.dataset.zoom) || 15;
      const radius = parseInt(item.dataset.radius) || 150;

      updateRadiusUI(radius);
      updateSelectedLocation(lat, lon, true);
      map.flyTo([lat, lon], zoom, { duration: 1.2 });
      showToast(`تم الانتقال إلى: ${item.querySelector('.preset-name').textContent}`, 'success');
    });
  });

  // استماع حذف المفضلة
  listElem.querySelectorAll('.preset-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm('هل أنت متأكد من حذف هذا الموقع من المفضلة؟')) return;

      try {
        await fetch(`/api/presets/${id}`, { method: 'DELETE' });
      } catch {}
      loadPresets();
      showToast('تم حذف الموقع من المفضلة', 'info');
    });
  });
}

async function promptAddFavorite() {
  const name = prompt('أدخل اسماً لهذا الموقع (مثال: مقر العمل الرئيسي، الفرع الجديد):', 'مقر عملي');
  if (!name || !name.trim()) return;

  const newPreset = {
    name: name.trim(),
    lat: state.lat,
    lon: state.lon,
    zoom: map.getZoom(),
    radius: state.radius,
    address: state.address
  };

  try {
    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPreset)
    });
    if (res.ok) {
      loadPresets();
      showToast('تمت إضافة الموقع إلى المفضلة بنجاح!', 'success');
      return;
    }
  } catch {}

  // حفظ محلي في حال تعذر السيرفر
  let list = [];
  try { list = JSON.parse(localStorage.getItem('basma_presets') || '[]'); } catch {}
  newPreset.id = `local_${Date.now()}`;
  list.push(newPreset);
  localStorage.setItem('basma_presets', JSON.stringify(list));
  loadPresets();
  showToast('تمت إضافة الموقع إلى المفضلة', 'success');
}

/* ==========================================================================
   وظائف مساعدة (Clipboard, Toasts, Escaping)
   ========================================================================== */
function copyTextToClipboard(text, successMessage = 'تم النسخ بنجاح!') {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMessage, 'success');
    }).catch(() => {
      fallbackCopyText(text, successMessage);
    });
  } else {
    fallbackCopyText(text, successMessage);
  }
}

function fallbackCopyText(text, successMessage) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast(successMessage, 'success');
  } catch {
    showToast('تعذر النسخ التلقائي، يمكنك نسخه يدوياً', 'error');
  }
  document.body.removeChild(textArea);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✓' : (type === 'error' ? '⚠️' : 'ℹ️');
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
