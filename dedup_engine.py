import sys
import os
import json
import subprocess
import time
import shutil  # Thư viện để di chuyển file

# --- CẤU HÌNH ---
# Tên thư mục chứa file trùng lặp
TRASH_FOLDER_NAME = "Delete duplicate"

# Ép buộc Encoding UTF-8 cho Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

def send_json(msg_type, data):
    print(json.dumps({"type": msg_type, **data}, ensure_ascii=False))
    sys.stdout.flush()

try:
    from PIL import Image
    import imagehash
except ImportError as e:
    send_json("error", {"message": f"Missing Library: {e}. Please install: pip install pillow imagehash"})
    sys.exit(1)

# ==========================================
# 1. CORE LOGIC (FFMPEG PIPE)
# ==========================================
def process_video_ffmpeg(file_path, ffmpeg_path='ffmpeg'):
    try:
        TARGET_FPS = 8 
        SIZE = 64
        
        command = [
            ffmpeg_path,
            '-i', file_path,
            '-vf', f'fps={TARGET_FPS},scale={SIZE}:{SIZE}',
            '-f', 'image2pipe',
            '-pix_fmt', 'gray',
            '-vcodec', 'rawvideo',
            '-'
        ]
        
        pipe = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=10**8)
        
        hashes = []
        frame_size = SIZE * SIZE 
        
        while True:
            raw_image = pipe.stdout.read(frame_size)
            if len(raw_image) != frame_size:
                break
            
            image = Image.frombytes('L', (SIZE, SIZE), raw_image)
            h = imagehash.dhash(image, hash_size=8)
            hashes.append(h)
            
        pipe.terminate()
        
        if not hashes: return None
        
        return {
            "path": file_path,
            "filename": os.path.basename(file_path),
            "duration": len(hashes) / TARGET_FPS, 
            "hashes": hashes
        }

    except Exception:
        return None

# ==========================================
# 2. HELPER FUNCTIONS
# ==========================================
def calculate_similarity(video1, video2):
    hashes1 = video1['hashes']
    hashes2 = video2['hashes']
    
    len1, len2 = len(hashes1), len(hashes2)
    if len1 == 0 or len2 == 0: return 0
    
    # Nếu độ dài chênh lệch quá lớn (> 50%) thì coi như không trùng (để an toàn)
    # Tùy nhu cầu: Nếu bạn muốn tìm clip con 2s trong clip 30s thì bỏ dòng này đi
    # Nhưng ở đây giữ lại để tối ưu tốc độ cho các clip tương đồng
    # if abs(len1 - len2) / max(len1, len2) > 0.5: return 0
    
    min_len = min(len1, len2)
    if min_len < 10:
        step = 1
    else:
        step = max(1, min_len // 100) # Lấy mẫu 100 điểm ảnh
    
    matches = 0
    comparisons = 0
    limit = min_len
    
    # So sánh hash
    for i in range(0, limit, step):
        diff = hashes1[i] - hashes2[i]
        if diff < 12: # Tăng nhẹ ngưỡng chấp nhận sai số (10 -> 12)
            matches += 1
        comparisons += 1
        
    if comparisons == 0: return 0
    return (matches / comparisons) * 100

def move_to_trash(file_info, trash_path):
    """Di chuyển file vào thư mục rác, đổi tên nếu trùng"""
    try:
        filename = file_info['filename']
        src = file_info['path']
        dst = os.path.join(trash_path, filename)
        
        # Nếu file đích đã tồn tại, đổi tên file nguồn thêm timestamp
        if os.path.exists(dst):
            name, ext = os.path.splitext(filename)
            new_name = f"{name}_{int(time.time())}{ext}"
            dst = os.path.join(trash_path, new_name)
            
        shutil.move(src, dst)
        return True, os.path.basename(dst)
    except Exception as e:
        return False, str(e)

# ==========================================
# 3. MAIN EXECUTION
# ==========================================
def main():
    if len(sys.argv) < 2:
        send_json("error", {"message": "Missing arguments"})
        return

    folder_path = sys.argv[1]
    ffmpeg_exec = sys.argv[2] if len(sys.argv) > 2 else 'ffmpeg'
    
    # --- TẠO THƯ MỤC RÁC ---
    trash_path = os.path.join(folder_path, TRASH_FOLDER_NAME)
    if not os.path.exists(trash_path):
        try:
            os.makedirs(trash_path)
        except Exception as e:
            send_json("error", {"message": f"Cannot create folder '{TRASH_FOLDER_NAME}': {e}"})
            return

    valid_exts = {'.mp4', '.mov', '.mkv', '.avi', '.flv', '.wmv', '.webm'}
    files = []
    try:
        for f in os.listdir(folder_path):
            full_path = os.path.join(folder_path, f)
            # Bỏ qua thư mục rác để không quét lại file đã xóa
            if os.path.isfile(full_path) and f != TRASH_FOLDER_NAME:
                if os.path.splitext(f)[1].lower() in valid_exts:
                    files.append(full_path)
    except Exception as e:
        send_json("error", {"message": str(e)})
        return

    total = len(files)
    if total < 2:
        send_json("done", {"message": "Not enough videos to compare."})
        return

    processed_videos = []
    
    # --- PHASE 1: SCANNING ---
    for i, file_path in enumerate(files):
        send_json("progress", {
            "phase": "Scanning",
            "current": i + 1,
            "total": total,
            "msg": f"Analysing: {os.path.basename(file_path)}"
        })
        
        data = process_video_ffmpeg(file_path, ffmpeg_exec)
        if data:
            processed_videos.append(data)
            
        time.sleep(0.01)

    # --- PHASE 2: COMPARING & MOVING ---
    # Sắp xếp danh sách video theo thời lượng giảm dần (Dài trước - Ngắn sau)
    # Điều này giúp ưu tiên giữ file gốc (dài) và loại bỏ file cắt (ngắn)
    processed_videos.sort(key=lambda x: x['duration'], reverse=True)
    
    total_videos = len(processed_videos)
    moved_files = set() # Danh sách các file đã bị di chuyển
    moved_count = 0
    
    for i in range(total_videos):
        vid_a = processed_videos[i]
        
        # Nếu Vid A đã bị chuyển đi trước đó, bỏ qua
        if vid_a['path'] in moved_files:
            continue
            
        for j in range(i + 1, total_videos):
            vid_b = processed_videos[j]
            
            # Nếu Vid B đã bị chuyển đi, bỏ qua
            if vid_b['path'] in moved_files:
                continue

            # Gửi progress (giảm tần suất gửi để đỡ lag)
            if j % 10 == 0:
                send_json("progress", {
                    "phase": "Comparing",
                    "current": i + 1,
                    "total": total_videos,
                    "msg": f"Checking {vid_a['filename']}..."
                })

            score = calculate_similarity(vid_a, vid_b)
            
            # Nếu trùng khớp (Score > 90%)
            if score >= 90:
                # Logic xác định file nào cần xóa (file ngắn hơn hoặc file sau)
                if vid_a['duration'] < vid_b['duration']:
                    victim = vid_a
                    keeper = vid_b
                else:
                    victim = vid_b
                    keeper = vid_a
                
                # Thực hiện di chuyển
                success, msg = move_to_trash(victim, trash_path)
                
                if success:
                    moved_files.add(victim['path'])
                    moved_count += 1
                    
                    send_json("match", {
                        "file_a": keeper['filename'], # File giữ lại
                        "file_b": msg,                # File đã chuyển đi
                        "score": round(score, 2)
                    })
                    
                    # Log riêng việc đã xóa để UI hiển thị màu đỏ
                    # Định dạng log này app.jsx sẽ bắt được nhờ check "[DELETED]" hoặc "[MOVED]"
                    print(f"[DELETED] Moved {victim['filename']} to {TRASH_FOLDER_NAME}") 
                    sys.stdout.flush()
                
                # Nếu vid_a là nạn nhân, dừng vòng lặp j ngay lập tức (vì A không còn ở đó để so sánh nữa)
                if victim == vid_a:
                    break

    send_json("done", {"message": f"Completed. Moved {moved_count} duplicates to '{TRASH_FOLDER_NAME}'."})

if __name__ == "__main__":
    main()