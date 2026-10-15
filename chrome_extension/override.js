/**
 * محاكي GPS لمتصفح كروم - سياق الصفحة الحقيقي (MAIN World)
 * يعمل عند document_start قبل تحميل أي سطر في Google Maps أو صفحة البصمة
 */

(function() {
  let targetLat = 31.217653;
  let targetLon = 29.945706;
  let targetAcc = 5.0;

  // استرجاع الإحداثيات السريعة من الجلسة إن وجدت
  try {
    const cached = sessionStorage.getItem('basma_cached_gps');
    if (cached) {
      const p = JSON.parse(cached);
      if (p.lat && p.lon) {
        targetLat = Number(p.lat);
        targetLon = Number(p.lon);
      }
    }
  } catch(e) {}

  // الاستماع لتحديث الإحداثيات من content.js
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'BASMA_SET_COORDS') {
      targetLat = Number(event.data.lat);
      targetLon = Number(event.data.lon);
      if (event.data.accuracy) targetAcc = Number(event.data.accuracy);
      try {
        sessionStorage.setItem('basma_cached_gps', JSON.stringify({ lat: targetLat, lon: targetLon }));
      } catch(e) {}
    }
  });

  function getMockPosition() {
    // تذبذب إشارة طبيعي جداً (0.5 متر) لإقناع خوارزميات جوجل ماب والبصمة بدقة الإشارة
    const jitter = (Math.random() - 0.5) * 0.000012;
    return {
      coords: {
        latitude: Number((targetLat + jitter).toFixed(6)),
        longitude: Number((targetLon + jitter).toFixed(6)),
        altitude: 18.0,
        accuracy: targetAcc, // دقة 5 أمتار (High Accuracy)
        altitudeAccuracy: 2.0,
        heading: null,
        speed: 0.0
      },
      timestamp: Date.now()
    };
  }

  // استبدال كائن Geolocation بالكامل
  const mockGeo = {
    getCurrentPosition: function(success, error, options) {
      if (typeof success === 'function') {
        setTimeout(function() {
          success(getMockPosition());
        }, 20);
      }
    },
    watchPosition: function(success, error, options) {
      if (typeof success === 'function') {
        setTimeout(function() {
          success(getMockPosition());
        }, 20);
        return setInterval(function() {
          success(getMockPosition());
        }, 8000);
      }
      return 1;
    },
    clearWatch: function(id) {
      clearInterval(id);
    }
  };

  try {
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeo,
      configurable: true,
      writable: true
    });
  } catch(e) {
    navigator.geolocation = mockGeo;
  }

  // تجاوز permissions.query لتجاوز أي فحص أمني
  if (navigator.permissions && navigator.permissions.query) {
    const origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function(params) {
      if (params && params.name === 'geolocation') {
        return Promise.resolve({
          state: 'granted',
          name: 'geolocation',
          onchange: null
        });
      }
      return origQuery(params);
    };
  }

  console.log("%c[BASMA GPS]%c 🛰️ تم تفعيل المحاكي بنجاح في Google Maps وجميع المواقع!", "background:#0284c7;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px;", "color:#10b981;font-weight:bold;");
})();
