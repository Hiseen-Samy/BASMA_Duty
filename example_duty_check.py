"""
مثال على كيفية استخدام الموقع المحدد في سكربت دوام / بصمة (Duty Check-in Bot)
يمكن لأي سكربت بايثون قراءة الموقع المعتمد بسهولة من خلال هذا النموذج.
"""

import sys
import location_service

# ضبط ترميز الطرفية لويندوز لدعم الرموز التعبيرية واللغة العربية
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def check_duty_location():
    # قراءة الموقع المعتمد حالياً
    loc = location_service.get_current_location()

    print("=" * 60)
    print("📍 بيانات موقع البصمة والدوام المعتمد:")
    print("=" * 60)
    print(f"• خط العرض (Latitude)    : {loc['lat']}")
    print(f"• خط الطول (Longitude)   : {loc['lon']}")
    print(f"• نطاق السماح (Radius)   : {loc['radius']} متر")
    print(f"• العنوان المقروء         : {loc['address']}")
    print(f"• آخر تحديث              : {loc['updated_at']}")
    print("=" * 60)

    # مثال لإرسال الإحداثيات إلى API أو محاكاة GPS
    print("\n💡 يمكنك استخدام هذه الإحداثيات مباشرة في دوال تسجيل الحضور أو المحاكاة:")
    print(f"payload = {{'lat': {loc['lat']}, 'lng': {loc['lon']}}}")

if __name__ == "__main__":
    check_duty_location()
