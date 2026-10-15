"""
خادم الويب والواجهة البرمجية لتحديد ومزامنة الموقع - BASMA Duty Location Server
"""

import sys
import os
import json
import httpx
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

import location_service
import gps_simulator

# بدء محاكي شريحة الـ GPS العتادية تلقائياً مع السيرفر
try:
    gps_simulator.simulator_instance.start()
except Exception as e:
    print(f"[!] Warning: GPS simulator startup: {e}")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(
    title="BASMA Duty - Location Picker & Manager",
    description="واجهة تفاعلية متطورة لاختيار وتثبيت الموقع الجغرافي باستخدام OpenStreetMap",
    version="1.0.0"
)

# تمكين CORS لمرونة الربط مع أي سكربت خارجي
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# كاش داخلي لتقليل الطلبات على سيرفرات OpenStreetMap Nominatim
_cache_geocode: Dict[str, Any] = {}
_cache_search: Dict[str, Any] = {}

class LocationPayload(BaseModel):
    lat: float = Field(..., description="خط العرض Latitude")
    lon: float = Field(..., description="خط الطول Longitude")
    zoom: Optional[int] = Field(8, description="مستوى التكبير Zoom")
    radius: Optional[int] = Field(150, description="نصف قطر النطاق بالأمتار Geofence Radius")
    name: Optional[str] = Field("موقعي المحدد", description="اسم الموقع")
    address: Optional[str] = Field("", description="العنوان المقروء")
    display_name: Optional[str] = Field("", description="الاسم المعروض")

class PresetPayload(BaseModel):
    name: str
    lat: float
    lon: float
    zoom: Optional[int] = 15
    radius: Optional[int] = 150
    address: Optional[str] = ""

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return HTMLResponse("<h1>جاري تحميل واجهة الخريطة...</h1>")

@app.get("/test", response_class=HTMLResponse)
async def serve_test_page():
    test_file = STATIC_DIR / "test.html"
    if test_file.exists():
        return FileResponse(test_file)
    return HTMLResponse("<h1>صفحة الفحص غير متوفرة</h1>")

@app.get("/api/status")
async def get_status():
    """التحقق من حالة السيرفر والموقع الحالي"""
    current = location_service.get_current_location()
    return {
        "status": "online",
        "app": "BASMA Duty Location Manager",
        "version": "1.0.0",
        "current_location": current
    }

@app.get("/api/location")
async def get_location():
    """الحصول على الموقع الجغرافي المحدد حالياً"""
    return location_service.get_current_location()

@app.post("/api/location")
async def update_location(payload: LocationPayload):
    """تحديث وحفظ الموقع الجغرافي المحدد"""
    saved = location_service.save_current_location(payload.model_dump())
    return {
        "success": True,
        "message": "تم حفظ وتثبيت الموقع بنجاح كـ موقعك الحالي",
        "location": saved
    }

@app.get("/api/gps/status")
async def get_gps_chip_status():
    """الحصول على تقرير حالة شريحة الـ GPS الافتراضية والأقمار الصناعية"""
    return gps_simulator.simulator_instance.get_status()

@app.get("/api/gps/nmea")
async def get_gps_nmea_stream():
    """الحصول على بث جمل بروتوكول NMEA 0183 الحية من الشريحة الافتراضية"""
    status = gps_simulator.simulator_instance.get_status()
    raw = "\n".join(status.get("latest_nmea_sentences", []))
    return PlainTextResponse(raw)

@app.get("/api/presets")
async def get_presets():
    """الحصول على قائمة الأماكن المحفوظة / المفضلة"""
    return location_service.get_presets()

@app.post("/api/presets")
async def create_preset(preset: PresetPayload):
    """إضافة موقع مفضل جديد"""
    updated = location_service.add_preset(preset.model_dump())
    return {"success": True, "presets": updated}

@app.delete("/api/presets/{preset_id}")
async def remove_preset(preset_id: str):
    """حذف موقع مفضل"""
    updated = location_service.delete_preset(preset_id)
    return {"success": True, "presets": updated}

@app.get("/api/reverse-geocode")
async def reverse_geocode(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    lang: str = Query("ar", description="Language code")
):
    """استرجاع العنوان المقروء من الإحداثيات عبر OpenStreetMap مع التخزين المؤقت"""
    cache_key = f"{round(lat, 5)}_{round(lon, 5)}_{lang}"
    if cache_key in _cache_geocode:
        return _cache_geocode[cache_key]

    url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}&accept-language={lang}"
    headers = {"User-Agent": "BasmaDutyLocationPicker/1.0 (contact: admin@local.test)"}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                _cache_geocode[cache_key] = data
                return data
            else:
                return {"display_name": f"الإحداثيات: {lat:.5f}, {lon:.5f}"}
    except Exception as e:
        return {
            "display_name": f"خط العرض: {lat:.5f} | خط الطول: {lon:.5f}",
            "error": str(e)
        }

@app.get("/api/search")
async def search_places(
    q: str = Query(..., description="Search query"),
    lang: str = Query("ar", description="Language code")
):
    """البحث السريع عن الأماكن والمدن عبر OpenStreetMap"""
    q_trimmed = q.strip()
    if not q_trimmed:
        return []

    cache_key = f"{q_trimmed.lower()}_{lang}"
    if cache_key in _cache_search:
        return _cache_search[cache_key]

    url = f"https://nominatim.openstreetmap.org/search?format=jsonv2&q={httpx.URL(q_trimmed)}&limit=7&accept-language={lang}"
    headers = {"User-Agent": "BasmaDutyLocationPicker/1.0 (contact: admin@local.test)"}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                results = resp.json()
                _cache_search[cache_key] = results
                return results
            return []
    except Exception as e:
        return []

@app.get("/api/export/gpx")
async def export_gpx():
    """تحميل ملف GPX لموقعك الحالي لاستخدامه في برامج المحاكاة"""
    loc = location_service.get_current_location()
    content = location_service.generate_gpx_content(
        loc["lat"], loc["lon"], loc.get("name", "BASMA Duty Location")
    )
    return Response(
        content=content,
        media_type="application/gpx+xml",
        headers={"Content-Disposition": "attachment; filename=duty_location.gpx"}
    )

@app.get("/api/export/env")
async def export_env():
    """تحميل ملف المتغيرات .env"""
    loc = location_service.get_current_location()
    content = (
        f"DUTY_LATITUDE={loc['lat']}\n"
        f"DUTY_LONGITUDE={loc['lon']}\n"
        f"DUTY_RADIUS_METERS={loc['radius']}\n"
        f"DUTY_LOCATION_NAME=\"{loc.get('name', 'My Location')}\"\n"
    )
    return Response(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=.env"}
    )

# ربط المجلد الثابت للملفات static
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
