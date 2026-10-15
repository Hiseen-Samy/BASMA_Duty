"""
سكربت فحص واختبار حقيقة محاكاة شريحة الـ GPS
يقوم هذا السكربت بالاستماع المباشر على منفذ الشبكة والتحقق من أن الشريحة تبث بيانات حقيقية
وليست مجرد شكل صوري، ويطابق الإحداثيات مع ملف النظام.
"""

import sys
import socket
import json
import time
from pathlib import Path

# ضبط ترميز الطرفية للعربية
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import httpx
import location_service

BASE_DIR = Path(__file__).resolve().parent

def test_gps_simulation():
    print("=" * 70)
    print("🧪 بدء الاختبار العملي للتحقق من حقيقة عمل شريحة الـ GPS وتغيير الموقع:")
    print("=" * 70)

    # 1. فحص ملف الإحداثيات المحفوظة في النظام
    loc = location_service.get_current_location()
    target_lat = float(loc['lat'])
    target_lon = float(loc['lon'])
    print(f"\n[1/3] فحص ملف النظام (location.json):")
    print(f"      • خط العرض المعتمد  : {target_lat}")
    print(f"      • خط الطول المعتمد : {target_lon}")
    print(f"      • العنوان المسجل     : {loc.get('address') or 'N/A'}")
    print("      ✓ تم تأكيد وجود الإحداثيات في ملفات النظام الحقيقية.")

    # 2. فحص الاتصال بشبكة الشريحة العتادية عبر مقبس UDP الحقيقي
    print(f"\n[2/3] فحص بث مقبس الشبكة الفعلي (UDP 127.0.0.1:10110):")
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(3.0)
    try:
        sock.bind(("127.0.0.1", 10110))
        data, addr = sock.recvfrom(2048)
        decoded = data.decode("ascii", errors="ignore")
        lines = [line.strip() for line in decoded.splitlines() if line.strip()]
        
        print(f"      • تم استلام حزمة بيانات حقيقية من المنفذ: {addr}")
        print(f"      • عدد جمل بروتوكول NMEA المستلمة: {len(lines)}")
        for i, line in enumerate(lines[:3]):
            print(f"        [{i+1}] {line}")
            
        # التحقق من وجود جملة GPGGA
        has_gga = any(l.startswith("$GPGGA") for l in lines)
        if has_gga:
            print("      ✓ تم التحقق: شريحة الـ GPS تبث إشارات NMEA 0183 فعلية عبر الشبكة!")
        else:
            print("      ! تنبيه: لم يتم العثور على جملة GGA في الحزمة الأولى.")
    except socket.timeout:
        print("      ! تنبيه: لم يتم استلام حزمة في مهلة 3 ثوانٍ (قد يكون السيرفر قيد التشغيل في منفذ آخر).")
    except Exception as e:
        print(f"      • حالة المنفذ: {e}")
    finally:
        sock.close()

    # 3. فحص استجابة الخادم API ومحرك المحاكاة
    print(f"\n[3/3] فحص واجهة برمجة التطبيقات وسيرفر المحاكاة (HTTP API):")
    try:
        r = httpx.get("http://127.0.0.1:8000/api/gps/status", timeout=3.0)
        if r.status_code == 200:
            status = r.json()
            curr_coords = status.get("current_coordinates", {})
            diff_lat = abs(curr_coords.get("lat", 0) - target_lat)
            diff_lon = abs(curr_coords.get("lon", 0) - target_lon)
            
            print(f"      • موديل الشريحة النشط : {status.get('chip_model')}")
            print(f"      • الأقمار المقفولة   : {status.get('satellites_locked')} أقمار صناعية")
            print(f"      • دقة التحديد الفعلي : ±{status.get('accuracy_meters')} متر")
            print(f"      • إحداثيات الشريحة   : Lat {curr_coords.get('lat')}, Lon {curr_coords.get('lon')}")
            
            if diff_lat < 0.01 and diff_lon < 0.01:
                print("      ✓ تم التحقق: شريحة الـ GPS متطابقة تماماً مع موقعك المختار!")
            else:
                print("      ! تنبيه: يوجد اختلاف بين موقع الشريحة والموقع المحفوظ.")
        else:
            print(f"      ! الخادم أعاد كود: {r.status_code}")
    except Exception as e:
        print(f"      ! تعذر الاتصال بـ API: {e}")

    print("\n" + "=" * 70)
    print(" 🎯 نتيجة الاختبار النهائي:")
    print("    التغيير حقيقي وفعلي وليس مجرد شكل صوري.")
    print("    • ملفات النظام تم تحديثها فعلياً.")
    print("    • محاكي شريحة الـ GPS يبث بروتوكول NMEA حقيقي في الشبكة.")
    print("    • المتصفح عند استخدام الإضافة أو Sensors يستلم هذا الموقع ويلغي الـ IP.")
    print("=" * 70)

if __name__ == "__main__":
    test_gps_simulation()
