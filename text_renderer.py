import sys
import json
import os
from PIL import Image, ImageDraw, ImageFont

# Set UTF-8 for Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

def create_overlay(config, output_path):
    try:
        # 1. Config parameters
        W = config.get('width', 1920)
        H = config.get('height', 1080)
        text1 = config.get('text1', '')
        text2 = config.get('text2', '')
        font_path = config.get('fontPath', 'arial.ttf')
        
        # --- SUPERSAMPLING SETUP (Khử răng cưa) ---
        # Vẽ to gấp 3 lần rồi resize xuống để mịn cạnh
        SCALE = 3 
        real_size = config.get('size', 40) * SCALE
        padding = config.get('padding', 10) * SCALE
        
        # Tinh chỉnh khoảng cách giữa 2 dòng cho gần nhau hơn
        internal_line_spacing = padding // 2
        
        # Colors
        text_color = config.get('color', '#FFFFFF')
        stroke_color = config.get('strokeColor', '#000000')
        bg_color = config.get('bgColor', '#FF5733')
        
        enable_stroke = config.get('enableStroke', False)
        enable_bg = config.get('enableBg', False)
        
        # Canvas size (Scaled up)
        img_w, img_h = W * SCALE, H * SCALE
        
        image = Image.new("RGBA", (img_w, img_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        
        # Load Font
        try:
            font = ImageFont.truetype(font_path, real_size)
        except:
            try: font = ImageFont.truetype("arial.ttf", real_size)
            except: font = ImageFont.load_default()

        # Helper: Draw text with stroke
        def draw_text_with_stroke(draw_obj, x, y, text, font, t_color, s_color, do_stroke):
            if do_stroke:
                stroke_width = int(real_size * 0.08) 
                draw_obj.text((x, y), text, font=font, fill=s_color, stroke_width=stroke_width, stroke_fill=s_color)
            draw_obj.text((x, y), text, font=font, fill=t_color)

        lines = []
        if text1: lines.append(text1)
        if text2: lines.append(text2)
        
        if not lines:
            image.save(output_path)
            return

        # ==============================================================================
        # LOGIC TÍNH TOÁN VỊ TRÍ MỚI (Top-Right Anchor + Centered Text + Rounded Box)
        # ==============================================================================

        # 1. Tính toán kích thước chính xác của từng dòng text
        max_text_w = 0
        total_text_h = 0
        line_dims = [] # Lưu (width, height) của từng dòng

        for i, line in enumerate(lines):
            bbox = font.getbbox(line) # left, top, right, bottom
            lw = bbox[2] - bbox[0]
            lh = bbox[3] - bbox[1]
            
            # Điều chỉnh chiều cao dòng một chút để căn giữa theo chiều dọc tốt hơn
            # (do getbbox đôi khi tính sát baseline quá)
            lh_adjusted = int(lh * 1.15) 
            
            line_dims.append((lw, lh_adjusted))
            max_text_w = max(max_text_w, lw)
            total_text_h += lh_adjusted
            if i < len(lines) - 1:
                 total_text_h += internal_line_spacing

        # 2. Xác định tọa độ hộp (Box Coordinates) ghim góc trên phải
        # Margin cố định từ cạnh phải và cạnh trên màn hình
        margin_right_screen = 30 * SCALE
        margin_top_screen = 30 * SCALE

        # Kích thước tổng của hộp (bao gồm padding)
        box_w = max_text_w + (padding * 2)
        box_h = total_text_h + (padding * 2)

        # Tính tọa độ 4 góc hộp dựa trên điểm neo (Anchor) là góc trên phải
        box_x1 = img_w - margin_right_screen # Cạnh phải hộp
        box_y0 = margin_top_screen           # Cạnh trên hộp
        box_x0 = box_x1 - box_w              # Cạnh trái hộp (tự động mở rộng sang trái)
        box_y1 = box_y0 + box_h              # Cạnh dưới hộp (tự động mở rộng xuống dưới)

        # 3. Vẽ hộp nền bo tròn (Rounded Rectangle)
        if enable_bg:
            # Bán kính bo góc (điều chỉnh số 20 nếu muốn bo nhiều/ít hơn)
            corner_radius = 20 * SCALE 
            draw.rounded_rectangle(
                [box_x0, box_y0, box_x1, box_y1], 
                radius=corner_radius, 
                fill=bg_color
            )

        # 4. Vẽ Text (Căn giữa trong hộp)
        offset_y = 10 * SCALE 
        current_y = box_y0 + padding - offset_y # Vị trí Y bắt đầu vẽ dòng đầu tiên

        for i, line in enumerate(lines):
            lw, lh_adjusted = line_dims[i]
            
            # Tính toán vị trí X để căn giữa dòng text hiện tại trong hộp
            # Công thức: Vị trí bắt đầu text block + nửa khoảng trống còn dư
            text_x_centered = box_x0 + padding + (max_text_w - lw) // 2
            
            draw_text_with_stroke(draw, text_x_centered, current_y, line, font, text_color, stroke_color, enable_stroke)
            
            # Cộng thêm chiều cao dòng và khoảng cách cho dòng tiếp theo
            current_y += lh_adjusted + internal_line_spacing

        # ==============================================================================

        # Resize về kích thước gốc với bộ lọc LANCZOS (Chất lượng cao nhất)
        final_image = image.resize((W, H), resample=Image.Resampling.LANCZOS)
        
        final_image.save(output_path)
        print("OK")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) > 2:
        config_str = sys.argv[1]
        out_path = sys.argv[2]
        try:
            cfg = json.loads(config_str)
            create_overlay(cfg, out_path)
        except Exception as e:
            print(f"Error parsing json: {e}")