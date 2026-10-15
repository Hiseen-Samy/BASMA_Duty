"""
خدمة إدارة وتحديد الموقع الجغرافي - BASMA Duty Location Service
يوفر هذا الملف واجهة برمجية بايثون لقراءة وتحديث الموقع الجغرافي المحدد من خلال واجهة الخريطة.
"""

import json
import os
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
LOCATION_FILE = BASE_DIR / "location.json"
PRESETS_FILE = BASE_DIR / "presets.json"
ENV_FILE = BASE_DIR / ".env"

DEFAULT_LOCATION = {
    "lat": 30.54182,
    "lon": 29.80293,
    "zoom": 8,
    "radius": 150,
    "name": "الموقع الافتراضي",
    "address": "طريق مصر الإسكندرية الصحراوي، مصر",
    "display_name": "طريق مصر الإسكندرية الصحراوي، مصر",
    "updated_at": datetime.now().isoformat()
}

DEFAULT_PRESETS = [
    {
        "id": "cairo_hq",
        "name": "المقر الرئيسي (القاهرة)",
        "lat": 30.0444,
        "lon": 31.2357,
        "zoom": 15,
        "radius": 100,
        "address": "وسط البلد، القاهرة، مصر"
    },
    {
        "id": "alex_branch",
        "name": "فرع الإسكندرية",
        "lat": 31.2001,
        "lon": 29.9187,
        "zoom": 15,
        "radius": 120,
        "address": "سيدي جابر، الإسكندرية، مصر"
    },
    {
        "id": "smart_village",
        "name": "القرية الذكية (الجيزة)",
        "lat": 30.0736,
        "lon": 31.0184,
        "zoom": 15,
        "radius": 200,
        "address": "القرية الذكية، طريق مصر إسكندرية الصحراوي، الجيزة"
    },
    {
        "id": "new_cairo",
        "name": "التجمع الخامس (القاهرة الجديدة)",
        "lat": 30.0074,
        "lon": 31.4342,
        "zoom": 15,
        "radius": 150,
        "address": "شارع التسعين، التجمع الخامس، القاهرة"
    }
]


def get_current_location() -> Dict[str, Any]:
    """قراءة الموقع الحالي المحفوظ من ملف location.json"""
    if not LOCATION_FILE.exists():
        save_current_location(DEFAULT_LOCATION)
        return DEFAULT_LOCATION.copy()
    
    try:
        with open(LOCATION_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data
    except Exception as e:
        print(f"[Warning] Error reading location file: {e}. Falling back to default.")
        return DEFAULT_LOCATION.copy()


def save_current_location(data: Dict[str, Any]) -> Dict[str, Any]:
    """حفظ وتحديث الموقع الحالي في ملف location.json وملف .env"""
    payload = {
        "lat": float(data.get("lat", DEFAULT_LOCATION["lat"])),
        "lon": float(data.get("lon", DEFAULT_LOCATION["lon"])),
        "zoom": int(data.get("zoom", DEFAULT_LOCATION["zoom"])),
        "radius": int(data.get("radius", DEFAULT_LOCATION["radius"])),
        "name": data.get("name", "موقعي المحدد"),
        "address": data.get("address", ""),
        "display_name": data.get("display_name", data.get("address", "")),
        "updated_at": datetime.now().isoformat()
    }
    
    # حفظ في ملف JSON
    with open(LOCATION_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        
    # حفظ في ملف .env لسهولة استخدامه في سكربتات أخرى
    try:
        env_content = (
            f"# BASMA Duty Location Config - Generated on {payload['updated_at']}\n"
            f"DUTY_LATITUDE={payload['lat']}\n"
            f"DUTY_LONGITUDE={payload['lon']}\n"
            f"DUTY_RADIUS_METERS={payload['radius']}\n"
            f"DUTY_ZOOM={payload['zoom']}\n"
            f"DUTY_LOCATION_NAME=\"{payload['name']}\"\n"
            f"DUTY_LOCATION_ADDRESS=\"{payload['address']}\"\n"
        )
        with open(ENV_FILE, "w", encoding="utf-8") as f:
            f.write(env_content)
    except Exception as e:
        print(f"[Warning] Could not update .env: {e}")
        
    return payload


def get_presets() -> list:
    """قراءة قائمة المواقع المحفوظة / المفضلة"""
    if not PRESETS_FILE.exists():
        save_presets(DEFAULT_PRESETS)
        return DEFAULT_PRESETS.copy()
        
    try:
        with open(PRESETS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return DEFAULT_PRESETS.copy()


def save_presets(presets: list) -> None:
    """حفظ قائمة المواقع المفضلة"""
    with open(PRESETS_FILE, "w", encoding="utf-8") as f:
        json.dump(presets, f, ensure_ascii=False, indent=2)


def add_preset(preset: Dict[str, Any]) -> list:
    """إضافة موقع مفضل جديد"""
    presets = get_presets()
    if not preset.get("id"):
        preset["id"] = f"preset_{int(datetime.now().timestamp())}"
    presets.append(preset)
    save_presets(presets)
    return presets


def delete_preset(preset_id: str) -> list:
    """حذف موقع مفضل"""
    presets = [p for p in get_presets() if p.get("id") != preset_id]
    save_presets(presets)
    return presets


def generate_gpx_content(lat: float, lon: float, name: str = "My Location") -> str:
    """توليد ملف GPX للموقع لاستخدامه في برامج المحاكاة GPS Mocking"""
    time_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BASMA Duty Location Picker" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="{lat}" lon="{lon}">
    <time>{time_iso}</time>
    <name>{name}</name>
    <desc>BASMA Duty Location</desc>
  </wpt>
</gpx>
"""
