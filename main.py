"""
BASMA Duty - مشغل التطبيق الرئيسي
يقوم هذا السكربت بتشغيل الخادم المحلي وفتح واجهة تحديد الموقع التفاعلية تلقائياً.
"""

import os
import sys
import time
import argparse
import threading
import webbrowser
from pathlib import Path

# ضبط ترميز الطرفية للعربية
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import uvicorn
import location_service

BASE_DIR = Path(__file__).resolve().parent

BANNER = """
======================================================================
   📍 نظام تحديد موقع البصمة والدوام - BASMA Duty Location Picker
======================================================================
 [✔] الخريطة المعتمدة : OpenStreetMap (الموقع الافتراضي: 30.54182, 29.80293)
 [✔] الخادم المحلي     : http://127.0.0.1:{port}
 [✔] ملف حفظ الموقع   : {loc_file}
 [✔] ملف المتغيرات     : {env_file}
----------------------------------------------------------------------
 اضغط Ctrl + C في أي وقت لإيقاف السيرفر.
======================================================================
"""

def run_uvicorn_server(host: str, port: int):
    """تشغيل خادم Uvicorn"""
    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        log_level="warning",
        access_log=False
    )

def open_desktop_window(url: str, title: str):
    """محاولة فتح نافذة برمجية مستقلة عبر pywebview"""
    try:
        import webview
        print("[+] جاري فتح الواجهة في نافذة سطح مكتب مستقلة...")
        window = webview.create_window(
            title=title,
            url=url,
            width=1280,
            height=850,
            min_size=(900, 600)
        )
        webview.start()
        return True
    except Exception as e:
        print(f"[!] تنبيه: تعذر فتح نافذة pywebview ({e}). سيتم الفتح في المتصفح الافتراضي.")
        return False

def main():
    parser = argparse.ArgumentParser(description="BASMA Duty - Location Manager")
    parser.add_argument("--port", type=int, default=8000, help="رقم المنفذ (الافتراضي 8000)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="عنوان المضيف")
    parser.add_argument("--browser", action="store_true", help="الفتح المباشر في المتصفح بدلاً من نافذة التطبيق")
    parser.add_argument("--no-open", action="store_true", help="عدم فتح الواجهة تلقائياً")
    args = parser.parse_args()

    # التأكد من تهيئة البيانات الافتراضية
    initial_location = location_service.get_current_location()

    print(BANNER.format(
        port=args.port,
        loc_file=location_service.LOCATION_FILE.name,
        env_file=location_service.ENV_FILE.name
    ))

    # بدء خادم FastAPI في Thread منفصل
    server_thread = threading.Thread(
        target=run_uvicorn_server,
        args=(args.host, args.port),
        daemon=True
    )
    server_thread.start()

    # انتظار قصير حتى يصبح السيرفر جاهزاً
    time.sleep(1.0)

    app_url = f"http://{args.host}:{args.port}"
    window_title = "نظام تحديد موقع البصمة والدوام | BASMA Duty"

    if not args.no_open:
        opened_in_desktop = False
        if not args.browser:
            opened_in_desktop = open_desktop_window(app_url, window_title)

        if not opened_in_desktop:
            print(f"[+] فتح الواجهة في المتصفح: {app_url}")
            webbrowser.open(app_url)

    # إبقاء التطبيق قيد التشغيل
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] تم إيقاف السيرفر بنجاح. في أمان الله!")

if __name__ == "__main__":
    main()
