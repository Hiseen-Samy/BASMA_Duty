"""
محاكي شريحة الـ GPS العتادية - BASMA Duty Hardware GPS Simulator
يقوم هذا السكربت بمحاكاة شريحة استقبال GPS حقيقية (مثل u-blox أو MediaTek)،
وتوليد إشارات وبروتوكولات NMEA 0183 القياسية وبثها عبر الشبكة والمنافذ الافتراضية.
"""

import sys
import os
import time
import math
import random
import socket
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Tuple

# ضبط ترميز الطرفية لويندوز
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import location_service

class VirtualGpsChip:
    def __init__(self, host: str = "127.0.0.1", udp_port: int = 10110, tcp_port: int = 2947):
        self.host = host
        self.udp_port = udp_port
        self.tcp_port = tcp_port
        self.running = False
        self.organic_jitter = True  # تذبذب إشارة طبيعي (0.5 - 1.5 متر) لإقناع أنظمة الحضور
        self.altitude = 25.0        # الارتفاع بالأمتار
        self.satellites = 9         # عدد الأقمار الصناعية المتصلة
        self.hdop = 0.85            # معامل دقة القياس (أقل من 1 يعني دقة متناهية)
        
        self.latest_nmea = []
        self.latest_coords = {"lat": 30.54182, "lon": 29.80293}
        
        # خوادم البث
        self.udp_socket = None
        self.tcp_server = None
        self.tcp_clients = []
        self._thread = None

    def _calc_checksum(self, sentence: str) -> str:
        """حساب Checksum القياسي لجمل NMEA"""
        csum = 0
        for char in sentence:
            csum ^= ord(char)
        return f"{csum:02X}"

    def _deg_to_nmea(self, val: float, is_lat: bool) -> Tuple[str, str]:
        """تحويل الدرجات العشرية إلى تنسيق NMEA (DDMM.MMMM أو DDDMM.MMMM)"""
        direction = ""
        if is_lat:
            direction = "N" if val >= 0 else "S"
        else:
            direction = "E" if val >= 0 else "W"
            
        abs_val = abs(val)
        degrees = int(abs_val)
        minutes = (abs_val - degrees) * 60.0
        
        if is_lat:
            formatted = f"{degrees:02d}{minutes:07.4f}"
        else:
            formatted = f"{degrees:03d}{minutes:07.4f}"
            
        return formatted, direction

    def generate_nmea_sentences(self, lat: float, lon: float) -> list:
        """توليد حزمة جمل NMEA 0183 القياسية لشريحة GPS نشطة"""
        now = datetime.utcnow()
        time_str = now.strftime("%H%M%S.00")
        date_str = now.strftime("%d%m%y")
        
        # إضافة تذبذب خفيف طبيعي جداً (jitter) لمحاكاة الغلاف الجوي
        if self.organic_jitter:
            jitter_lat = random.uniform(-0.000015, 0.000015)
            jitter_lon = random.uniform(-0.000015, 0.000015)
            lat += jitter_lat
            lon += jitter_lon
            
        self.latest_coords = {"lat": round(lat, 6), "lon": round(lon, 6)}
        
        lat_nmea, lat_dir = self._deg_to_nmea(lat, True)
        lon_nmea, lon_dir = self._deg_to_nmea(lon, False)
        
        sentences = []
        
        # 1. جملة $GPGGA (Global Positioning System Fix Data)
        gga_raw = f"GPGGA,{time_str},{lat_nmea},{lat_dir},{lon_nmea},{lon_dir},1,{self.satellites:02d},{self.hdop:.1f},{self.altitude:.1f},M,0.0,M,,"
        gga = f"${gga_raw}*{self._calc_checksum(gga_raw)}"
        sentences.append(gga)
        
        # 2. جملة $GPRMC (Recommended Minimum Specific GPS Data)
        rmc_raw = f"GPRMC,{time_str},A,{lat_nmea},{lat_dir},{lon_nmea},{lon_dir},0.02,0.0,{date_str},,,A"
        rmc = f"${rmc_raw}*{self._calc_checksum(rmc_raw)}"
        sentences.append(rmc)
        
        # 3. جملة $GPGSA (DOP and active satellites - 3D Fix)
        gsa_raw = f"GPGSA,A,3,03,14,16,22,26,29,31,32,,,,1.4,{self.hdop:.1f},1.1"
        gsa = f"${gsa_raw}*{self._calc_checksum(gsa_raw)}"
        sentences.append(gsa)
        
        # 4. جملة $GPGLL (Geographic Position - Latitude/Longitude)
        gll_raw = f"GPGLL,{lat_nmea},{lat_dir},{lon_nmea},{lon_dir},{time_str},A,A"
        gll = f"${gll_raw}*{self._calc_checksum(gll_raw)}"
        sentences.append(gll)
        
        self.latest_nmea = sentences
        return sentences

    def start(self):
        """بدء تشغيل محاكي شريحة الـ GPS في الخلفية"""
        if self.running:
            return
            
        self.running = True
        
        # تهيئة UDP socket للبث
        try:
            self.udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.udp_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        except Exception as e:
            print(f"[!] تحذير UDP: {e}")
            
        # تشغيل حلقة البث في Thread مستقل
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        print(f"[+] شريحة الـ GPS الافتراضية نشطة الآن (بث NMEA على UDP المنفذ {self.udp_port})")

    def _run_loop(self):
        """الحلقة التكرارية لتوليد إشارات الأقمار الصناعية كل ثانية (1 Hz)"""
        while self.running:
            try:
                # قراءة أحدث إحداثيات مختارة من ملف location.json
                loc = location_service.get_current_location()
                lat = float(loc.get("lat", 30.54182))
                lon = float(loc.get("lon", 29.80293))
                
                # توليد حزمة NMEA
                sentences = self.generate_nmea_sentences(lat, lon)
                payload = "\r\n".join(sentences) + "\r\n"
                encoded = payload.encode("ascii")
                
                # بث عبر UDP
                if self.udp_socket:
                    try:
                        self.udp_socket.sendto(encoded, (self.host, self.udp_port))
                    except Exception:
                        pass
                        
            except Exception as e:
                pass
                
            time.sleep(1.0)

    def stop(self):
        """إيقاف المحاكي"""
        self.running = False
        if self.udp_socket:
            try:
                self.udp_socket.close()
            except Exception:
                pass

    def get_status(self) -> Dict[str, Any]:
        """الحصول على تقرير حالة شريحة الـ GPS لمحاكاتها في الواجهة"""
        return {
            "status": "active" if self.running else "paused",
            "chip_model": "Virtual u-blox NEO-M8N / GNSS Hardware Simulator",
            "fix_type": "3D GNSS Fix (GPS + GLONASS)",
            "satellites_locked": self.satellites,
            "accuracy_meters": round(self.hdop * 4.5, 1),
            "hdop": self.hdop,
            "altitude": f"{self.altitude} m",
            "current_coordinates": self.latest_coords,
            "organic_jitter_enabled": self.organic_jitter,
            "latest_nmea_sentences": self.latest_nmea,
            "udp_broadcast_port": self.udp_port
        }

# مثيل عام لشريحة الـ GPS
simulator_instance = VirtualGpsChip()

def run_standalone():
    """تشغيل المحاكي كبرنامج مستقل عبر الطرفية لعرض البيانات حياً"""
    sim = VirtualGpsChip()
    sim.start()
    
    print("=" * 65)
    print(" 🛰️  محاكي شريحة الـ GPS العتادية - BASMA Duty Hardware Simulator")
    print("=" * 65)
    print(f" • نوع الشريحة     : Virtual u-blox NEO-M8N GNSS Chip")
    print(f" • حالة الاتصال     : 3D Fix (متصل بـ {sim.satellites} أقمار صناعية)")
    print(f" • بروتوكول البث    : NMEA 0183 (1 Hz Broadcast)")
    print(f" • منفذ الشبكة     : UDP 127.0.0.1:{sim.udp_port}")
    print("=" * 65)
    print(" اضغط Ctrl + C لإيقاف المحاكي.\n")
    
    try:
        while True:
            status = sim.get_status()
            coords = status["current_coordinates"]
            gga = status["latest_nmea_sentences"][0] if status["latest_nmea_sentences"] else "N/A"
            sys.stdout.write(f"\r[🛰️ بث حي] خط العرض: {coords['lat']} | خط الطول: {coords['lon']} | الدقة: ±{status['accuracy_meters']}م | {gga[:40]}...")
            sys.stdout.flush()
            time.sleep(1)
    except KeyboardInterrupt:
        sim.stop()
        print("\n[*] تم إيقاف المحاكي.")

if __name__ == "__main__":
    run_standalone()
