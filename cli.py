"""
CLI Interactive Tool untuk SCELE Notif (DDP1)
Bisa digunakan langsung dari terminal untuk cek mata kuliah, nilai, dan deadline!
Usage: python cli.py
"""
import asyncio
import getpass
import sys
from services import moodle, storage


async def menu_login():
    print("\n--- LOGIN SCELE (SSO UI) ---")
    username = input("Username SSO: ").strip()
    password = getpass.getpass("Password SSO: ").strip()

    if not username or not password:
        print("❌ Username dan password tidak boleh kosong!")
        return None

    print("Sedang menghubungi server SCELE...")
    try:
        token = await moodle.get_token(username, password)
        info = await moodle.get_site_info(token)
        user_id = str(info["userid"])
        user_data = {
            "userId": user_id,
            "username": info["username"],
            "fullname": info["fullname"],
            "siteUrl": info.get("siteurl", "https://scele.cs.ui.ac.id"),
            "token": token,
        }
        await storage.save_user(user_id, user_data)
        print(f"✅ Login berhasil! Selamat datang, {info['fullname']} ({info['username']})")
        return user_data
    except Exception as e:
        print(f"❌ Login gagal: {e}")
        return None


async def menu_courses(user):
    print(f"\n--- DAFTAR MATA KULIAH ({user['fullname']}) ---")
    try:
        courses = await moodle.get_courses(user["token"], user["userId"])
        grades_data = await moodle.get_grades(user["token"], user["userId"])

        grade_map = {}
        if isinstance(grades_data, dict) and grades_data.get("grades"):
            for g in grades_data["grades"]:
                grade_map[g["courseid"]] = g.get("grade") or "-"

        print(f"Total: {len(courses)} mata kuliah ditemukan\n")
        for idx, c in enumerate(courses, start=1):
            if c.get("visible") == 0:
                continue
            grade = grade_map.get(c["id"], "Belum ada nilai")
            progress = c.get("progress")
            prog_str = f"{progress}%" if progress is not None else "-"
            print(f"{idx}. {c.get('fullname')} [{c.get('shortname')}]")
            print(f"   ID: {c.get('id')} | Nilai: {grade} | Progress: {prog_str}")
    except Exception as e:
        print(f"❌ Gagal mengambil data courses: {e}")


async def menu_events(user):
    print(f"\n--- DEADLINE & TUGAS MENDATANG ---")
    try:
        events_data = await moodle.get_upcoming_events(user["token"])
        events = events_data.get("events", [])
        if not events:
            print("🎉 Tidak ada deadline atau tugas mendatang!")
            return

        print(f"Ditemukan {len(events)} event/tugas:\n")
        import time
        now = int(time.time())
        for idx, e in enumerate(events, start=1):
            time_left = e.get("timestart", 0) - now
            hours = time_left // 3600
            days = hours // 24
            time_str = f"{days} hari lagi" if days > 0 else f"{hours} jam lagi" if hours > 0 else "Sudah lewat"
            print(f"{idx}. {e.get('name')}")
            print(f"   Mata Kuliah: {e.get('course', {}).get('fullname', 'SCELE')}")
            print(f"   Sisa Waktu : {time_str}")
            print(f"   Tipe Modul : {e.get('modulename', '-')}")
    except Exception as e:
        print(f"❌ Gagal mengambil data events: {e}")


async def main():
    print("=" * 55)
    print("   🎓 SCELE NOTIF - CLI HELPER (DDP 1 FASILKOM UI)   ")
    print("=" * 55)

    # Cek user tersimpan
    users = await storage.get_all_users()
    active_user = None

    if users:
        first_id = list(users.keys())[0]
        active_user = users[first_id]
        print(f"ℹ️  Sesi tersimpan: {active_user.get('fullname')} ({active_user.get('username')})")

    while True:
        print("\nMenu Pilihan:")
        print("1. Login / Ganti Akun SSO UI")
        print("2. Lihat Daftar Mata Kuliah & Nilai")
        print("3. Lihat Deadline & Upcoming Tasks")
        print("4. Jalankan FastAPI Server (Port 8000)")
        print("5. Keluar")

        choice = input("\nPilih menu (1-5): ").strip()

        if choice == "1":
            new_user = await menu_login()
            if new_user:
                active_user = new_user
        elif choice == "2":
            if not active_user:
                print("⚠️  Silakan login terlebih dahulu (Pilihan 1)")
            else:
                await menu_courses(active_user)
        elif choice == "3":
            if not active_user:
                print("⚠️  Silakan login terlebih dahulu (Pilihan 1)")
            else:
                await menu_events(active_user)
        elif choice == "4":
            print("\n🚀 Menjalankan Uvicorn FastAPI Server di http://localhost:8000 ...")
            print("   Tekan Ctrl+C untuk kembali ke terminal\n")
            import uvicorn
            uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
        elif choice == "5":
            print("\nSampai jumpa! Semangat tugas akhirnya! 👋")
            break
        else:
            print("⚠️  Pilihan tidak valid.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nSelesai.")
        sys.exit(0)
