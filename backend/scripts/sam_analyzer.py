import sys
import json
import cv2
import numpy as np

def analyze_image(image_path):
    # Log gửi qua stderr sẽ KHÔNG ảnh hưởng đến kết quả JSON cuối cùng
    sys.stderr.write(f"[Python] Bắt đầu phân tích file: {image_path}\n")
    
    # 1. Đọc ảnh
    image = cv2.imread(image_path)
    if image is None:
        sys.stderr.write("Không thể đọc ảnh.\n")
        sys.exit(1)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 2. Xử lý hình ảnh để tìm các khối (giả định các hình chữ nhật trong bản vẽ là bàn)
    _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    tables = []
    seats = []
    
    table_id_counter = 1
    seat_id_counter = 1

    # 3. Chuyển đổi Contour thành tọa độ SVG
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        
        # Lọc các vật thể quá nhỏ hoặc quá lớn
        if w > 50 and h > 20: 
            # Snap to grid 10px
            snap_x = round(x / 10) * 10
            snap_y = round(y / 10) * 10
            snap_w = round(w / 10) * 10
            snap_h = round(h / 10) * 10
            
            tables.append({
                "id": f"table_AI_{table_id_counter}",
                "x": snap_x,
                "y": snap_y,
                "width": snap_w,
                "height": snap_h
            })
            table_id_counter += 1
            
            # Gợi ý đặt ghế tự động dựa trên kích thước bàn (Mỗi bàn 2 ghế)
            seats.append({"id": f"S_AI_{seat_id_counter}", "x": snap_x + 20, "y": snap_y + snap_h + 30, "align": "top"})
            seat_id_counter += 1
            seats.append({"id": f"S_AI_{seat_id_counter}", "x": snap_x + snap_w - 20, "y": snap_y + snap_h + 30, "align": "top"})
            seat_id_counter += 1

    generated_layout = {
        "tables": tables,
        "seats": seats
    }

    sys.stderr.write(f"[Python] Phân tích hoàn tất. Tím thấy {len(tables)} bàn.\n")

    # In ra định dạng chuẩn JSON để Node.js bắt và đọc
    print(json.dumps(generated_layout))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write("Lỗi: Cần truyền đường dẫn file ảnh.\n")
        sys.exit(1)
        
    target_image = sys.argv[1]
    analyze_image(target_image)