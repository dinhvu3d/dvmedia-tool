import os
import sys
import subprocess
import json
import threading
import time
import socket

# --- AUTO INSTALL DEPENDENCIES ---
def ensure_library(package_name, import_name=None):
    if not import_name: import_name = package_name
    try:
        __import__(import_name)
    except ImportError:
        try:
            # Gửi log JSON nếu chạy từ Electron, hoặc print thường nếu chạy CMD
            msg = f"Đang tự động cài đặt thư viện thiếu: {package_name}..."
            if len(sys.argv) > 1: print(json.dumps({"type": "log", "message": msg}), flush=True)
            else: print(msg)
            
            subprocess.check_call([sys.executable, "-m", "pip", "install", package_name])
        except Exception as e:
            err_msg = f"Lỗi cài đặt {package_name}: {e}"
            if len(sys.argv) > 1: print(json.dumps({"type": "log", "message": err_msg}), flush=True)
            else: print(err_msg)

ensure_library("requests")
ensure_library("pysrt")
ensure_library("pydub")
ensure_library("customtkinter")
import re

import requests
import pysrt
from pydub import AudioSegment
import customtkinter as ctk
from tkinter import filedialog, messagebox

# --- CẤU HÌNH MẶC ĐỊNH ---
CONFIG_FILE = "dvmaker_config.json"
DEFAULT_CONFIG = {
    "api_url": "http://127.0.0.1:9880",  # Cổng mặc định của GPT-SoVITS
    "gpt_sovits_py_path": "",
    "ref_audio_path": "",
    "ref_text": "",
    "ref_lang": "vi",
    "target_lang": "vi",
    "input_path": "",
    "output_folder": "",
    "dataset_path": "",
    "model_name": "new_model",
    "batch_size": 4,
    "epochs": 8
}

class ConfigManager:
    @staticmethod
    def load_config():
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    return {**DEFAULT_CONFIG, **json.load(f)}
            except:
                return DEFAULT_CONFIG
        return DEFAULT_CONFIG

    @staticmethod
    def save_config(config_data):
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, indent=4, ensure_ascii=False)
        except Exception as e:
            print(f"Lỗi lưu config: {e}")

# --- HELPERS ---
def apply_pitch_shift(file_path, pitch_octaves, electron_log_func):
    """
    Applies a pitch shift to an audio file using pydub.
    Note: This method will also affect the duration of the audio.
    A pitch_octaves value of 0.5 means shifting up by 6 semitones.
    A pitch_octaves value of -0.5 means shifting down by 6 semitones.
    """
    if not pitch_octaves or pitch_octaves == 0.0:
        return
    try:
        electron_log_func(f"Applying pitch shift of {pitch_octaves} octaves...")
        sound = AudioSegment.from_file(file_path)
        
        new_sample_rate = int(sound.frame_rate * (2.0 ** pitch_octaves))
        
        pitched_sound = sound._spawn(sound.raw_data, overrides={'frame_rate': new_sample_rate})
        
        output_format = file_path.split('.')[-1]
        pitched_sound.export(file_path, format=output_format)
        electron_log_func("Pitch shift applied.")
    except Exception as e:
        electron_log_func(f"WARN: Could not apply pitch shift: {e}")

# --- LOGIC XỬ LÝ (VOICEVOX) ---
class VoicevoxLogic:
    def __init__(self, api_url="http://127.0.0.1:50021"):
        self.api_url = api_url

    def check_connection(self):
        """Kiểm tra xem VOICEVOX Engine có đang bật không"""
        try:
            response = requests.get(f"{self.api_url}/version", timeout=2)
            return response.status_code == 200
        except:
            return False

    def tts_request(self, text, speaker_id):
        """Gửi lệnh đọc tới VOICEVOX Engine."""
        try:
            # 1. Tạo audio query
            query_payload = {"text": text, "speaker": speaker_id}
            query_response = requests.post(f"{self.api_url}/audio_query", params=query_payload, timeout=10)
            if query_response.status_code != 200:
                raise Exception(f"Lỗi audio_query (Code {query_response.status_code}): {query_response.text}")
            
            audio_query = query_response.json()

            # 2. Tổng hợp âm thanh (Retry mechanism)
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    synth_response = requests.post(f"{self.api_url}/synthesis", params={"speaker": speaker_id}, json=audio_query, timeout=60)
                    if synth_response.status_code != 200:
                        raise Exception(f"Lỗi synthesis (Code {synth_response.status_code}): {synth_response.text}")
                    return synth_response.content
                except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
                    if attempt < max_retries - 1:
                        time.sleep(2)
                        continue
                    else:
                        raise e
                except Exception as e:
                    raise e
        except Exception as e:
            raise e

    def process_srt(self, srt_path, output_path, speaker_id, format="wav", progress_callback=None):
        subs = pysrt.open(srt_path)
        combined_audio = AudioSegment.silent(duration=0)
        
        if len(subs) > 0:
            last_end_time = subs[-1].end.ordinal
            combined_audio = AudioSegment.silent(duration=last_end_time + 2000)

        for i, sub in enumerate(subs):
            text = sub.text.replace("\n", " ").strip()
            if not text:
                continue
                
            if progress_callback:
                progress_callback(f"Đang xử lý dòng {i+1}/{len(subs)}: {text[:30]}...", percent=round(((i+1)/len(subs))*100))

            try:
                audio_data = self.tts_request(text, speaker_id)
                
                temp_file = f"temp_voicevox_{i}.wav"
                with open(temp_file, "wb") as f:
                    f.write(audio_data)
                
                segment = AudioSegment.from_wav(temp_file)
                os.remove(temp_file)
                
                start_time = sub.start.ordinal
                combined_audio = combined_audio.overlay(segment, position=start_time)
                
            except Exception as e:
                error_msg = f"Lỗi dòng {i+1}: {e}"
                if progress_callback:
                    progress_callback(error_msg)
                else:
                    print(error_msg)
        
        if format == "mp3":
            combined_audio.export(output_path, format="mp3", bitrate="192k")
        else:
            combined_audio.export(output_path, format="wav")

    def process_txt(self, txt_path, output_path, speaker_id, format="wav", progress_callback=None):
        with open(txt_path, 'r', encoding='utf-8') as f:
            text = f.read()

        # Tách câu dựa trên dấu câu tiếng Nhật: 。 (dấu chấm), ！ (cảm thán), ？ (hỏi), và ký tự xuống dòng \n
        # (?<=...) là lookbehind assertion để giữ lại dấu câu
        sentences = [s.strip() for s in re.split(r'(?<=[。！？\n])', text) if s.strip()]
        
        combined_audio = AudioSegment.empty()
        total = len(sentences)

        for i, sentence in enumerate(sentences):
            if progress_callback:
                progress_callback(f"Đang xử lý câu {i+1}/{total}: {sentence[:30]}...", percent=round(((i+1)/total)*100))

            try:
                audio_data = self.tts_request(sentence, speaker_id)
                
                # Rate limiting to prevent timeout/overload
                time.sleep(0.2)

                temp_file = f"temp_voicevox_txt_{i}.wav"
                with open(temp_file, "wb") as f:
                    f.write(audio_data)
                
                segment = AudioSegment.from_wav(temp_file)
                os.remove(temp_file)
                
                combined_audio += segment
                
            except Exception as e:
                print(f"Lỗi câu {i+1}: {e}")
        
        if format == "mp3":
            combined_audio.export(output_path, format="mp3", bitrate="192k")
        else:
            combined_audio.export(output_path, format="wav")

# --- LOGIC XỬ LÝ (KẾT NỐI GPT-SOVITS) ---
class DVMakerLogic:
    def __init__(self, api_url):
        self.api_url = api_url

    def check_connection(self):
        """Kiểm tra xem GPT-SoVITS có đang bật không"""
        try:
            # Thử kết nối tới trang chủ của API
            response = requests.get(self.api_url, timeout=2)
            return True
        except:
            return False

    def tts_request(self, text, ref_audio, ref_text, ref_lang, target_lang, speed=1.0):
        """
        Gửi lệnh đọc tới GPT-SoVITS.
        Gửi kèm nhiều tên biến khác nhau để tương thích cả v1 và v2.
        """
        payload = {
            "text": text,                   # Nội dung cần đọc
            "text_lang": target_lang,       # Ngôn ngữ cần đọc (v2)
            "text_language": target_lang,   # Ngôn ngữ cần đọc (v1/other)
            
            "ref_audio_path": ref_audio,    # Đường dẫn file mẫu (v2)
            "refer_wav_path": ref_audio,    # Đường dẫn file mẫu (v1/api.py gốc)
            
            "prompt_text": ref_text,        # Nội dung file mẫu
            "prompt_lang": ref_lang,        # Ngôn ngữ file mẫu (v2)
            "prompt_language": ref_lang,    # Ngôn ngữ file mẫu (v1)
            
            "media_type": "wav",            # Định dạng trả về
            "speed": speed                  # Tham số tốc độ
        }
        
        # Endpoint thường là /tts hoặc / (tùy phiên bản)
        # Ta thử /tts trước, nếu lỗi 404 thì thử /
        url = f"{self.api_url}/tts"
        
        try:
            response = requests.post(url, json=payload, timeout=60)
            
            # Nếu API trả về 404 (Not Found), thử endpoint gốc
            if response.status_code == 404:
                url = f"{self.api_url}/"
                response = requests.post(url, json=payload, timeout=60)

            if response.status_code == 200:
                return response.content
            else:
                raise Exception(f"Lỗi từ GPT-SoVITS (Code {response.status_code}): {response.text}")
        except Exception as e:
            raise e

    def process_srt(self, srt_path, output_path, ref_audio, ref_text, ref_lang, target_lang, speed=1.0, format="wav", progress_callback=None):
        subs = pysrt.open(srt_path)
        combined_audio = AudioSegment.silent(duration=0)
        
        if len(subs) > 0:
            # Tạo file rỗng dài bằng tổng thời gian file sub + 2 giây
            last_end_time = subs[-1].end.ordinal
            combined_audio = AudioSegment.silent(duration=last_end_time + 2000)

        for i, sub in enumerate(subs):
            text = sub.text.replace("\n", " ").strip()
            if not text:
                continue
                
            if progress_callback:
                progress_callback(f"Đang xử lý dòng {i+1}/{len(subs)}: {text[:30]}...")

            try:
                # Gọi API lấy giọng đọc
                audio_data = self.tts_request(text, ref_audio, ref_text, ref_lang, target_lang, speed=speed)
                
                # Lưu tạm
                temp_file = f"temp_{i}.wav"
                with open(temp_file, "wb") as f:
                    f.write(audio_data)
                
                # Đọc file tạm và chèn vào đúng vị trí timecode
                segment = AudioSegment.from_wav(temp_file)
                os.remove(temp_file)
                
                start_time = sub.start.ordinal
                combined_audio = combined_audio.overlay(segment, position=start_time)
                
            except Exception as e:
                if progress_callback:
                    progress_callback(f"Lỗi dòng {i+1}: {e}")
                print(f"Error line {i}: {e}")
        
        # Xuất file cuối cùng
        if format == "mp3":
            combined_audio.export(output_path, format="mp3", bitrate="192k")
        else:
            combined_audio.export(output_path, format="wav")

# --- LOGIC XỬ LÝ (FISH SPEECH) ---
class FishSpeechLogic:
    def __init__(self, api_url="http://127.0.0.1:8080"):
        self.api_url = api_url

    def start_fish_server(self, python_path, root_dir):
        """
        Hàm khởi động Server Fish Speech (Dùng cho Tkinter hoặc tham khảo logic).
        Lưu ý: Electron App sẽ dùng logic riêng trong main.js để quản lý process tốt hơn.
        """
        cmd = [
            python_path, "-m", "tools.api_server",
            "--listen", "127.0.0.1:8080",
            "--device", "cuda",
            "--llama-checkpoint-path", os.path.join(root_dir, "checkpoints/fish-speech-1.5"),
            "--decoder-checkpoint-path", os.path.join(root_dir, "checkpoints/fish-speech-1.5/firefly-gan-vq-fsq-8x1024-21hz-generator.pth")
        ]
        return subprocess.Popen(cmd, cwd=root_dir)

    def fish_speech_tts(self, text, ref_audio_path, ref_text, output_path):
        ensure_library("msgpack")
        import msgpack

        url = f"{self.api_url}/v1/tts"
        
        with open(ref_audio_path, "rb") as f:
            ref_audio_content = f.read()

        # Payload chuẩn cho Fish Speech 1.5 API
        data = { "text": text, "references": [{ "audio": ref_audio_content, "text": ref_text }], "reference_id": None, "normalize": True, "format": "wav", "mp3_bitrate": 64, "opus_bitrate": -1000 }
        
        headers = {"Content-Type": "application/msgpack"}
        packed_data = msgpack.packb(data)
        
        response = requests.post(url, data=packed_data, headers=headers, stream=True)
        
        if response.status_code == 200:
            with open(output_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
        else:
            raise Exception(f"Fish Speech API Error ({response.status_code}): {response.text}")

    def process_srt(self, srt_path, output_path, ref_audio_path, ref_text, format="wav", progress_callback=None):
        subs = pysrt.open(srt_path)
        combined_audio = AudioSegment.silent(duration=0)
        
        if len(subs) > 0:
            last_end_time = subs[-1].end.ordinal
            combined_audio = AudioSegment.silent(duration=last_end_time + 2000)

        for i, sub in enumerate(subs):
            text = sub.text.replace("\n", " ").strip()
            if not text:
                continue
                
            if progress_callback:
                progress_callback(f"Đang xử lý dòng {i+1}/{len(subs)}: {text[:30]}...", percent=round(((i+1)/len(subs))*100))

            try:
                temp_output_file = f"temp_fspeech_{i}.wav"
                self.fish_speech_tts(text, ref_audio_path, ref_text, temp_output_file)
                
                segment = AudioSegment.from_wav(temp_output_file)
                os.remove(temp_output_file)
                
                start_time = sub.start.ordinal
                combined_audio = combined_audio.overlay(segment, position=start_time)
                
            except Exception as e:
                error_msg = f"Lỗi dòng {i+1}: {e}"
                if progress_callback:
                    progress_callback(error_msg)
                else:
                    print(error_msg)
        
        if format == "mp3":
            combined_audio.export(output_path, format="mp3", bitrate="192k")
        else:
            combined_audio.export(output_path, format="wav")

# --- GIAO DIỆN NGƯỜI DÙNG (FRONTEND) ---
class DVMakerApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Cấu hình cửa sổ
        self.title("DVMaker - GPT-SoVITS Controller")
        self.geometry("950x650")
        ctk.set_appearance_mode("Dark")
        
        # Load Config
        self.config = ConfigManager.load_config()
        self.logic = DVMakerLogic(self.config["api_url"])

        # Layout chính
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # HEADER: Trạng thái kết nối
        self.header_frame = ctk.CTkFrame(self, height=40, fg_color="transparent")
        self.header_frame.grid(row=0, column=0, sticky="ew", padx=20, pady=(10,0))
        
        self.lbl_status = ctk.CTkLabel(self.header_frame, text="Trạng thái GPT-SoVITS: Chưa kiểm tra", text_color="gray")
        self.lbl_status.pack(side="left")
        
        ctk.CTkButton(self.header_frame, text="Kiểm tra kết nối", command=self.check_api_status, width=120, height=25).pack(side="right")

        # MENU TAB (Ở giữa)
        self.tab_view = ctk.CTkTabview(self, width=500, height=50)
        self.tab_view.grid(row=1, column=0, pady=10, sticky="nsew", padx=20)
        
        self.tab_tts = self.tab_view.add("TTS (Đọc văn bản)")
        self.tab_train = self.tab_view.add("Model Train (Huấn luyện)")

        self.setup_tts_tab()
        self.setup_train_tab()

        # Sự kiện đóng
        self.protocol("WM_DELETE_WINDOW", self.on_close)
        
        # Tự động kiểm tra kết nối khi mở
        self.after(1000, self.check_api_status)

    def check_api_status(self):
        url = self.entry_api.get()
        self.logic.api_url = url
        if self.logic.check_connection():
            self.lbl_status.configure(text=f"GPT-SoVITS: ĐÃ KẾT NỐI ({url})", text_color="#00FF00") # Xanh lá
        else:
            self.lbl_status.configure(text=f"GPT-SoVITS: KHÔNG KẾT NỐI ĐƯỢC ({url})", text_color="#FF0000") # Đỏ

    def setup_tts_tab(self):
        self.tab_tts.grid_columnconfigure(0, weight=1, uniform="tts_group")
        self.tab_tts.grid_columnconfigure(1, weight=1, uniform="tts_group")
        
        # --- CỘT TRÁI: CẤU HÌNH ĐẦU VÀO ---
        frame_left = ctk.CTkFrame(self.tab_tts, fg_color="transparent")
        frame_left.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")

        ctk.CTkLabel(frame_left, text="0. Khởi động Server (api_v2.py):", font=("Arial", 14, "bold")).pack(anchor="w", pady=(0,5))
        
        bat_frame = ctk.CTkFrame(frame_left, fg_color="transparent")
        bat_frame.pack(fill="x", pady=(0, 5))
        
        self.entry_script = ctk.CTkEntry(bat_frame, placeholder_text="Chọn file api_v2.py")
        self.entry_script.insert(0, self.config.get("gpt_sovits_py_path", ""))
        self.entry_script.pack(side="left", fill="x", expand=True, padx=(0, 5))
        
        ctk.CTkButton(bat_frame, text="...", width=30, command=self.browse_script).pack(side="right")
        
        ctk.CTkButton(frame_left, text="KHỞI ĐỘNG SERVER", command=self.run_server_thread, fg_color="green").pack(fill="x", pady=(0, 15))

        ctk.CTkLabel(frame_left, text="1. Cấu hình GPT-SoVITS API:", font=("Arial", 14, "bold")).pack(anchor="w", pady=(0,5))
        self.entry_api = ctk.CTkEntry(frame_left, placeholder_text="Ví dụ: http://127.0.0.1:9880")
        self.entry_api.insert(0, self.config["api_url"])
        self.entry_api.pack(fill="x", pady=(0, 15))

        ctk.CTkLabel(frame_left, text="2. File Giọng Mẫu (Reference Audio):", font=("Arial", 14, "bold")).pack(anchor="w", pady=(0,5))
        
        ctk.CTkLabel(frame_left, text="Đường dẫn file WAV (3-10s):").pack(anchor="w")
        self.entry_ref_audio = ctk.CTkEntry(frame_left)
        self.entry_ref_audio.insert(0, self.config["ref_audio_path"])
        self.entry_ref_audio.pack(fill="x", pady=(0, 5))
        ctk.CTkButton(frame_left, text="Chọn File Mẫu", command=self.browse_ref_audio).pack(anchor="e", pady=(0, 10))

        ctk.CTkLabel(frame_left, text="Nội dung của file mẫu (Prompt Text):").pack(anchor="w")
        self.entry_ref_text = ctk.CTkEntry(frame_left)
        self.entry_ref_text.insert(0, self.config["ref_text"])
        self.entry_ref_text.pack(fill="x", pady=(0, 10))

        ctk.CTkLabel(frame_left, text="Ngôn ngữ mẫu / Ngôn ngữ cần đọc:").pack(anchor="w")
        lang_frame = ctk.CTkFrame(frame_left, fg_color="transparent")
        lang_frame.pack(fill="x")
        self.combo_ref_lang = ctk.CTkComboBox(lang_frame, values=["vi", "en", "zh", "ja"], width=100)
        self.combo_ref_lang.set(self.config["ref_lang"])
        self.combo_ref_lang.pack(side="left", padx=(0, 10))
        
        self.combo_target_lang = ctk.CTkComboBox(lang_frame, values=["vi", "en", "zh", "ja"], width=100)
        self.combo_target_lang.set(self.config["target_lang"])
        self.combo_target_lang.pack(side="left")

        # --- CỘT PHẢI: NỘI DUNG & XUẤT ---
        frame_right = ctk.CTkFrame(self.tab_tts, fg_color="transparent")
        frame_right.grid(row=0, column=1, padx=10, pady=10, sticky="nsew")

        ctk.CTkLabel(frame_right, text="3. Nội dung cần đọc (Input):", font=("Arial", 14, "bold")).pack(anchor="w", pady=(0,5))
        self.entry_input_path = ctk.CTkEntry(frame_right, placeholder_text="Chọn file .txt hoặc .srt")
        self.entry_input_path.insert(0, self.config["input_path"])
        self.entry_input_path.pack(fill="x", pady=(0, 5))
        ctk.CTkButton(frame_right, text="Chọn File Nội Dung", command=self.browse_input).pack(anchor="e", pady=(0, 15))

        ctk.CTkLabel(frame_right, text="4. Nơi lưu kết quả (Output):", font=("Arial", 14, "bold")).pack(anchor="w", pady=(0,5))
        self.entry_output = ctk.CTkEntry(frame_right)
        self.entry_output.insert(0, self.config["output_folder"])
        self.entry_output.pack(fill="x", pady=(0, 5))
        ctk.CTkButton(frame_right, text="Chọn Thư Mục Lưu", command=self.browse_output).pack(anchor="e", pady=(0, 15))

        ctk.CTkLabel(frame_right, text="Định dạng:").pack(anchor="w")
        self.combo_format = ctk.CTkComboBox(frame_right, values=["wav", "mp3"])
        self.combo_format.set("wav")
        self.combo_format.pack(fill="x", pady=(0, 10))

        # LOG
        self.textbox_log = ctk.CTkTextbox(frame_right, height=120)
        self.textbox_log.pack(fill="both", expand=True, pady=(0, 10))

        # NÚT CHẠY
        self.btn_run = ctk.CTkButton(frame_right, text="BẮT ĐẦU ĐỌC (TTS)", command=self.run_tts_thread, fg_color="#1f6aa5", height=50, font=("Arial", 16, "bold"))
        self.btn_run.pack(fill="x")

    def setup_train_tab(self):
        self.tab_train.grid_columnconfigure(0, weight=1, uniform="train_group")
        self.tab_train.grid_columnconfigure(1, weight=1, uniform="train_group")
        
        # --- CỘT TRÁI ---
        frame_left = ctk.CTkFrame(self.tab_train, fg_color="transparent")
        frame_left.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")

        # KHỞI ĐỘNG WEBUI
        ctk.CTkLabel(frame_left, text="1. Giao diện Đào Tạo (WebUI):", font=("Arial", 14, "bold")).pack(anchor="w", pady=(0,5))
        
        webui_frame = ctk.CTkFrame(frame_left, fg_color="transparent")
        webui_frame.pack(fill="x", pady=(0, 15))
        
        ctk.CTkLabel(webui_frame, text="Để train model, cách tốt nhất là dùng WebUI gốc.\nTool sẽ tự tìm và mở nó giúp bạn.", text_color="gray", justify="left").pack(anchor="w")
        
        ctk.CTkButton(webui_frame, text="MỞ WEBUI ĐÀO TẠO", command=self.run_webui_thread, fg_color="#d35400", height=40).pack(fill="x", pady=(10, 0))
        
        ctk.CTkLabel(frame_left, text="2. Thông tin ghi nhớ:", font=("Arial", 14, "bold")).pack(anchor="w", pady=(10,5))
        
        ctk.CTkLabel(frame_left, text="Đường dẫn Dataset (Copy vào WebUI):").pack(anchor="w")
        self.entry_dataset = ctk.CTkEntry(frame_left)
        self.entry_dataset.insert(0, self.config["dataset_path"])
        self.entry_dataset.pack(fill="x", pady=(0, 10))
        ctk.CTkButton(frame_left, text="Chọn Folder", command=self.browse_dataset, width=100).pack(anchor="e", pady=(0, 20))

        ctk.CTkLabel(frame_left, text="Tên Model:").pack(anchor="w")
        self.entry_model_name = ctk.CTkEntry(frame_left)
        self.entry_model_name.insert(0, self.config["model_name"])
        self.entry_model_name.pack(fill="x")

        # --- CỘT PHẢI ---
        frame_right = ctk.CTkFrame(self.tab_train, fg_color="transparent")
        frame_right.grid(row=0, column=1, padx=10, pady=10, sticky="nsew")

        ctk.CTkLabel(frame_right, text="3. Hướng dẫn nhanh (Cheat Sheet):", font=("Arial", 14, "bold")).pack(anchor="w", pady=(0,5))

        self.textbox_guide = ctk.CTkTextbox(frame_right, height=300)
        self.textbox_guide.pack(fill="both", expand=True)
        
        guide_text = """BƯỚC 1: XỬ LÝ DỮ LIỆU (Tab 1-GPT-SoVITS-TTS trên WebUI)
1. Điền "Tên Model" và "Đường dẫn Dataset" (lấy từ cột bên trái).
2. Mục 1a: Bấm "Bật xử lý văn bản" -> Đợi xong.
3. Mục 1b: Bấm "Cắt giọng nói" -> Đợi xong.
4. Mục 1c: Bấm "Bật nhận dạng giọng nói" -> Đợi xong.

BƯỚC 2: TRAIN SOVITS (Tab 1-GPT-SoVITS-TTS)
1. Chuyển sang thẻ "1B-Tinh chỉnh SoVITS".
2. Giữ nguyên thông số hoặc chỉnh Epochs lên 8-12.
3. Bấm "Bắt đầu huấn luyện".

BƯỚC 3: TRAIN GPT (Tab 1-GPT-SoVITS-TTS)
1. Chuyển sang thẻ "1C-Tinh chỉnh GPT".
2. Bấm "Bắt đầu huấn luyện".

Sau khi xong, quay lại Tool này, vào Tab TTS và bấm "Làm mới" (nếu có) hoặc nhập tên model mới để dùng."""
        self.textbox_guide.insert("0.0", guide_text)

    # --- CÁC HÀM SỰ KIỆN ---
    def run_webui_thread(self):
        threading.Thread(target=self.run_webui_process, daemon=True).start()

    def is_port_in_use(self, port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('127.0.0.1', port)) == 0

    def run_webui_process(self):
        script_path = self.entry_script.get()
        if not os.path.exists(script_path):
            messagebox.showerror("Lỗi", "Vui lòng chọn file api_v2.py ở Tab TTS trước để xác định thư mục gốc!")
            return
        
        working_dir = os.path.dirname(script_path)
        
        # Tìm python
        python_exe = "python"
        possible_runtime = os.path.join(working_dir, "runtime", "python.exe")
        if os.path.exists(possible_runtime):
            python_exe = possible_runtime
            
        # Tìm file webui (ưu tiên webui.py)
        webui_script = os.path.join(working_dir, "webui.py")
        if not os.path.exists(webui_script):
            # Thử tìm file khác nếu webui.py không có
            webui_script = os.path.join(working_dir, "GPT_SoVITS", "webui.py")
            
        if os.path.exists(webui_script):
            # Tìm cổng trống bắt đầu từ 9874
            port = 9874
            while self.is_port_in_use(port):
                port += 1
                if port > 9900: break # Giới hạn tìm kiếm
            
            # Thiết lập biến môi trường để đổi cổng cho Gradio
            env = os.environ.copy()
            env["GRADIO_SERVER_PORT"] = str(port)
            
            subprocess.Popen([python_exe, webui_script], cwd=working_dir, env=env, creationflags=0x08000000)
            messagebox.showinfo("Thành công", f"Đang mở WebUI Đào Tạo trên cổng {port}...\nCửa sổ trình duyệt sẽ sớm hiện lên.")
        else:
            messagebox.showerror("Lỗi", f"Không tìm thấy file webui.py tại: {working_dir}")

    def browse_script(self):
        file_path = filedialog.askopenfilename(filetypes=[("Python File", "*.py")])
        if file_path:
            self.entry_script.delete(0, "end")
            self.entry_script.insert(0, file_path)

    def run_server_thread(self):
        threading.Thread(target=self.run_server_process, daemon=True).start()

    def run_server_process(self):
        script_path = self.entry_script.get()
        if not os.path.exists(script_path):
            messagebox.showerror("Lỗi", "File api_v2.py không tồn tại!")
            return
        
        try:
            working_dir = os.path.dirname(script_path)
            
            # Tự động tìm python trong thư mục runtime (nếu dùng bản portable)
            python_exe = "python"
            possible_runtime = os.path.join(working_dir, "runtime", "python.exe")
            if os.path.exists(possible_runtime):
                python_exe = possible_runtime
            
            # Chạy lệnh: python api_v2.py
            # Sử dụng 0x08000000 (CREATE_NO_WINDOW) để chạy ngầm không hiện cửa sổ
            subprocess.Popen([python_exe, script_path], cwd=working_dir, creationflags=0x08000000)
            
            self.log(f">>> Đã khởi động: {python_exe} {os.path.basename(script_path)}")
            messagebox.showinfo("Thông báo", "Đã khởi động Server (api_v2.py).\nVui lòng đợi 10-30 giây để server sẵn sàng rồi bấm 'Kiểm tra kết nối'.")
        except Exception as e:
            self.log(f"Lỗi khởi động: {e}")
            messagebox.showerror("Lỗi", str(e))

    def browse_input(self):
        file_path = filedialog.askopenfilename(filetypes=[("Text/Subtitle", "*.txt *.srt")])
        if file_path:
            self.entry_input_path.delete(0, "end")
            self.entry_input_path.insert(0, file_path)

    def browse_ref_audio(self):
        file_path = filedialog.askopenfilename(filetypes=[("Audio", "*.wav *.mp3")])
        if file_path:
            self.entry_ref_audio.delete(0, "end")
            self.entry_ref_audio.insert(0, file_path)

    def browse_output(self):
        folder = filedialog.askdirectory()
        if folder:
            self.entry_output.delete(0, "end")
            self.entry_output.insert(0, folder)
            
    def browse_dataset(self):
        folder = filedialog.askdirectory()
        if folder:
            self.entry_dataset.delete(0, "end")
            self.entry_dataset.insert(0, folder)

    def log(self, message):
        self.textbox_log.insert("end", message + "\n")
        self.textbox_log.see("end")

    def run_tts_thread(self):
        threading.Thread(target=self.process_tts, daemon=True).start()

    def process_tts(self):
        api_url = self.entry_api.get()
        input_path = self.entry_input_path.get()
        output_folder = self.entry_output.get()
        ref_audio = self.entry_ref_audio.get()
        ref_text = self.entry_ref_text.get()
        ref_lang = self.combo_ref_lang.get()
        target_lang = self.combo_target_lang.get()
        out_format = self.combo_format.get()

        if not all([input_path, output_folder, ref_audio]):
            messagebox.showwarning("Thiếu thông tin", "Vui lòng chọn đủ: File Input, File Mẫu, và Thư mục Output.")
            return

        self.btn_run.configure(state="disabled", text="Đang xử lý...")
        self.logic.api_url = api_url
        self.log(">>> Bắt đầu gửi lệnh tới GPT-SoVITS...")

        try:
            # Kiểm tra kết nối trước
            if not self.logic.check_connection():
                raise Exception(f"Không thể kết nối tới {api_url}. Hãy chắc chắn bạn đã bật GPT-SoVITS ở chế độ API.")

            filename = os.path.basename(input_path)
            name_only = os.path.splitext(filename)[0]
            output_file = os.path.join(output_folder, f"{name_only}_output.{out_format}")

            if input_path.lower().endswith(".srt"):
                self.log("Phát hiện file SRT. Đang xử lý từng dòng theo timecode...")
                self.logic.process_srt(
                    input_path, output_file, ref_audio, ref_text, ref_lang, target_lang, 
                    format=out_format, progress_callback=self.log
                )
            else:
                self.log("Phát hiện file TXT. Đang đọc nội dung...")
                with open(input_path, "r", encoding="utf-8") as f:
                    text = f.read()
                
                audio_data = self.logic.tts_request(text, ref_audio, ref_text, ref_lang, target_lang)
                
                with open(output_file, "wb") as f:
                    f.write(audio_data)
                
                if out_format == "mp3":
                    sound = AudioSegment.from_wav(output_file)
                    sound.export(output_file, format="mp3", bitrate="192k")

            self.log(f"✅ HOÀN TẤT! File lưu tại: {output_file}")
            messagebox.showinfo("Thành công", f"Đã xong!\nFile: {output_file}")

        except Exception as e:
            self.log(f"❌ LỖI: {str(e)}")
            messagebox.showerror("Lỗi", str(e))
        finally:
            self.btn_run.configure(state="normal", text="BẮT ĐẦU ĐỌC (TTS)")

    def run_train_thread(self):
        threading.Thread(target=self.process_train, daemon=True).start()

    def process_train(self):
        self.log(">>> Gửi lệnh Train...")
        # Lưu ý: GPT-SoVITS gốc không có API train chuẩn. Đây là mô phỏng hoặc dành cho bản custom.
        try:
            payload = {
                "dataset_path": self.entry_dataset.get(),
                "model_name": self.entry_model_name.get()
            }
            # requests.post(f"{self.entry_api.get()}/train", json=payload)
            time.sleep(1)
            self.log("⚠️ Cảnh báo: GPT-SoVITS gốc chưa hỗ trợ Train qua API.")
            self.log("Vui lòng mở tab '1-GPT-SoVITS-TTS' trong thư mục gốc và chạy 'go-webui.bat' để train.")
            messagebox.showinfo("Thông báo", "Đã gửi lệnh (Mô phỏng). Vui lòng kiểm tra Console của GPT-SoVITS nếu bạn đang dùng bản Custom có hỗ trợ API Train.")
        except Exception as e:
            self.log(f"Lỗi: {e}")

    def on_close(self):
        config_data = {
            "gpt_sovits_py_path": self.entry_script.get(),
            "api_url": self.entry_api.get(),
            "ref_audio_path": self.entry_ref_audio.get(),
            "ref_text": self.entry_ref_text.get(),
            "ref_lang": self.combo_ref_lang.get(),
            "target_lang": self.combo_target_lang.get(),
            "input_path": self.entry_input_path.get(),
            "output_folder": self.entry_output.get(),
            "dataset_path": self.entry_dataset.get(),
            "model_name": self.entry_model_name.get()
        }
        ConfigManager.save_config(config_data)
        self.destroy()

if __name__ == "__main__":
    import sys
    from pathlib import Path

    if len(sys.argv) > 1:
        try:
            params = json.loads(sys.argv[1])
            task = params.get('task', 'gpt-sovits') # Default to old task

            def electron_log(msg, percent=None):
                log_data = {"type": "log", "message": msg}
                print(json.dumps(log_data, ensure_ascii=False), flush=True)
                if percent is not None:
                    progress_data = {"type": "progress", "percent": percent}
                    print(json.dumps(progress_data), flush=True)

            input_path = Path(params['inputPath'])
            output_folder = Path(params['outputFolder'])
            out_format = params['format']
            
            if not output_folder.exists():
                output_folder.mkdir(parents=True, exist_ok=True)

            custom_name = params.get('outputFilename', '').strip()
            if custom_name:
                # Ensure the extension is correct
                if not custom_name.lower().endswith(f".{out_format}"):
                    custom_name = f"{custom_name}.{out_format}"
                output_file = output_folder / custom_name
            else:
                output_file = output_folder / f"{input_path.stem}_tts.{out_format}"

            # --- JP VOICE (VOICEVOX) TASK ---
            if task == 'jp-voice':
                logic = VoicevoxLogic()
                speaker_id = params['speakerId'] # Frontend will send speakerId
                
                electron_log(f"Bắt đầu xử lý JP VOICE: {input_path.name}")

                if input_path.suffix.lower() == ".srt":
                    logic.process_srt(
                        str(input_path), str(output_file), speaker_id,
                        format=out_format, progress_callback=electron_log
                    )
                else: # TXT file
                    logic.process_txt(
                        str(input_path), str(output_file), speaker_id,
                        format=out_format, progress_callback=electron_log
                    )

            # --- FISH SPEECH TASK ---
            elif task == 'fish-speech':
                logic = FishSpeechLogic(params.get('apiUrl', 'http://127.0.0.1:8080'))
                electron_log(f"Bắt đầu xử lý Fish Speech cho file: {input_path.name}")

                if input_path.suffix.lower() == ".srt":
                    logic.process_srt(
                        str(input_path), str(output_file), 
                        params['refAudio'], params['refText'],
                        format=out_format, progress_callback=electron_log
                    )
                else: # TXT file
                    with open(input_path, "r", encoding="utf-8") as f:
                        text = f.read()
                    
                    electron_log("Đang đọc file văn bản và gửi yêu cầu API...")
                    logic.fish_speech_tts(
                        text, 
                        params['refAudio'], 
                        params['refText'], 
                        str(output_file)
                    )
                    if out_format == "mp3":
                        electron_log("Đang chuyển đổi sang MP3...")
                        sound = AudioSegment.from_wav(str(output_file))
                        sound.export(str(output_file), format="mp3")

            # --- GPT-SOVITS TASK ---
            else: # Default task
                logic = DVMakerLogic(params['apiUrl'])
                speed = params.get('speed', 1.0)
                pitch = params.get('pitch', 0.0)

                electron_log(f"Bắt đầu xử lý GPT-SoVITS: {input_path.name} (Speed: {speed}, Pitch: {pitch})")

                if input_path.suffix.lower() == ".srt":
                    subs = pysrt.open(str(input_path))
                    total = len(subs)

                    def progress_wrapper(msg):
                        try:
                            current = int(msg.split('/')[0].split(' ')[-1])
                            p = round((current / total) * 100)
                            electron_log(msg, percent=p)
                        except:
                            electron_log(msg)

                    logic.process_srt(
                        str(input_path), str(output_file), 
                        params['refAudio'], params['refText'], 
                        params['refLang'], params['targetLang'], speed=speed,
                        format=out_format, progress_callback=progress_wrapper
                    )
                else:
                    electron_log("Đang đọc file văn bản và gửi yêu cầu API...")
                    with open(input_path, "r", encoding="utf-8") as f:
                        text = f.read()
                    
                    audio_data = logic.tts_request(
                        text, params['refAudio'], params['refText'], 
                        params['refLang'], params['targetLang'], speed=speed
                    )
                    
                    with open(output_file, "wb") as f:
                        f.write(audio_data)
                    
                    if out_format == "mp3":
                        electron_log("Đang chuyển đổi sang MP3...")
                        sound = AudioSegment.from_wav(str(output_file))
                        sound.export(str(output_file), format="mp3")
            
            # Áp dụng Pitch Shift (nếu có) cho GSpeech và JPVoice
            if task in ['gpt-sovits', 'jp-voice'] and params.get('pitch', 0.0) != 0.0:
                apply_pitch_shift(str(output_file), params.get('pitch', 0.0), electron_log)

            # Gửi tin nhắn DONE
            print(json.dumps({"type": "done", "message": f"Thành công! File: {output_file.absolute()}"}), flush=True)
            
        except Exception as e:
            print(json.dumps({"type": "log", "message": f"LỖI ENGINE: {str(e)}"}), flush=True)
            sys.exit(1)
    else:
        app = DVMakerApp()
        app.mainloop()