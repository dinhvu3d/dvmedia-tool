import sys
import os
import json
import subprocess
import re

# Set UTF-8 for Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

def send_json(msg_type, data):
    print(json.dumps({"type": msg_type, **data}, ensure_ascii=False))
    sys.stdout.flush()

def timestamp_to_seconds(timestamp):
    timestamp = timestamp.replace(',', '.')
    hrs, mins, secs = timestamp.split(':')
    return float(hrs) * 3600 + float(mins) * 60 + float(secs)

def parse_srt(srt_path):
    segments = []
    try:
        with open(srt_path, 'r', encoding='utf-8') as f: content = f.read()
    except:
        with open(srt_path, 'r', encoding='utf-8-sig') as f: content = f.read()
            
    pattern = re.compile(r'(\d+)\n(\d{2}:\d{2}:\d{2}[,.]\d{3}) --> (\d{2}:\d{2}:\d{2}[,.]\d{3})\n((?:(?!\n\n).)*)', re.DOTALL)
    matches = pattern.findall(content)
    for match in matches:
        idx, start_str, end_str, text = match
        start = timestamp_to_seconds(start_str)
        end = timestamp_to_seconds(end_str)
        text = text.replace('\n', ' ').strip()
        segments.append({"id": idx, "start": start, "end": end, "text": text, "duration": end - start})
    return segments

def main():
    if len(sys.argv) < 5:
        send_json("error", {"message": "Missing args"})
        return

    # Args: script.py [video] [audio] [srt] [temp_dir] [ffmpeg_path]
    video_path = sys.argv[1]
    audio_path = sys.argv[2]
    srt_path = sys.argv[3]
    temp_dir = sys.argv[4]
    ffmpeg_path = sys.argv[5]

    if not os.path.exists(temp_dir): os.makedirs(temp_dir)

    try:
        # 1. PARSE SRT
        send_json("progress", {"step": "Reading SRT...", "percent": 10})
        audio_segments = parse_srt(srt_path)
        
        if not audio_segments:
            send_json("error", {"message": "No subtitles found in SRT file."})
            return

        # 2. CUT AUDIO
        audio_folder = os.path.join(temp_dir, "audio_segments")
        if not os.path.exists(audio_folder): os.makedirs(audio_folder)
        
        total_segs = len(audio_segments)
        final_audio_list = []
        
        for i, seg in enumerate(audio_segments):
            send_json("progress", {"step": f"Cutting Audio {i+1}/{total_segs}", "percent": 10 + int((i/total_segs)*80)})
            out_name = f"audio_{i:03d}.wav"
            out_path = os.path.join(audio_folder, out_name)
            
            cmd = [
                ffmpeg_path, '-y', '-i', audio_path,
                '-ss', str(seg['start']), '-to', str(seg['end']),
                '-c', 'pcm_s16le', out_path
            ]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            if os.path.exists(out_path):
                seg['file_path'] = out_path
                final_audio_list.append(seg)
        
        # 3. NO VIDEO SCENE DETECTION (TIMELINE MODE)
        # Trả về danh sách rỗng cho video_scenes vì ta không dùng nữa
        send_json("done", {
            "audio_segments": final_audio_list,
            "video_scenes": [], 
            "message": f"Prepared {len(final_audio_list)} audio segments from SRT."
        })

    except Exception as e:
        send_json("error", {"message": str(e)})

if __name__ == "__main__":
    main()