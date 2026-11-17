# TÌNH TÍNH TING TING — Interactive Invitation (V1)

## L10 visual integration

L10 keeps the V3 live canvas and interaction timeline, with a shared
indigo-ribbon environment across boot, stage and invitation. The boot phase is
readiness-gated, has a 1.5 second minimum fresh-visit dwell and a 350 ms fade;
it does not delay the timer that begins after `PLAY`.

TikTok and Google Maps links are nullable. Before using either in Admin, run
`SUPABASE_L10_MIGRATION.sql` manually in the project's Supabase SQL editor and
verify the query at its end. Do not run it automatically against production.
For a source rollback map, read `L10_ROLLBACK.md`.

Trang web lời mời tương tác chính thức cho sự kiện **TÌNH TÍNH TING TING**.
Dự án được xây dựng hoàn toàn độc lập, siêu nhẹ, tương thích tối đa với thiết bị di động (iOS Safari, Android Chrome, in-app browsers của Zalo/Facebook/Messenger/Instagram).

---

## 🌟 Tính năng Nổi bật

1. **Hiển thị & Tương tác Kẹo dẻo 2.5D (Smooth Gummy & Living Characters)**:
   - 5 nhân vật hoạt hình sống động bơi lội và trôi tự do trong không gian:
     - **Pink Dome**: Khối mochi hồng bóng bẩy, mắt tròn liếc nhìn theo ngón tay và nhấp nháy.
     - **Yellow Star**: Ngôi sao vàng phồng mọng với nụ cười nhắm mắt tinh nghịch.
     - **Mint Bean**: Hạt đậu ngọc lam nháy mắt lém lỉnh.
     - **Lilac Flower**: Đóa hoa mây tím ngọt ngào.
     - **Golden Coin**: Đồng xu vàng thương hiệu tương tác chạm nảy.
   - Hiệu ứng biến dạng mềm (soft-body squish & stretch), va chạm đàn hồi và bảo toàn thể tích.
2. **Typography Kẹo Dẻo Cá nhân hóa Động (Dynamic Gummy Typography)**:
   - Tự động sinh chữ cái kẹo dẻo 2.5D phồng mọng cho bất kỳ tên khách mời nào (`Linh`, `Minh Anh`, `Phuong`, `Nguyen Phuong Anh`...).
   - Tự động căn dòng, đo khoảng cách ký tự (kerning) và tự động thu phóng/ngắt dòng khi tên dài, bảo đảm không bao giờ bị tràn biên màn hình.
   - Từng chữ cái là một vật thể độc lập: bồng bềnh, có thể chạm, kéo, vẩy tay tự do.
3. **Cơ chế Hút Nam Châm & Pháo hoa Kẹo Ngọt (Magnetic Snap & Reveal)**:
   - Sau khoảng ~8–10 giây người dùng nghịch chạm, toàn bộ các chữ cái sẽ được kích hoạt lực hút lò xo bay về ghép thành câu chào: **`Hi, [Tên Khách]!`**.
   - Độ văng vượt đích (overshoot) rồi nhún êm ái, bùng nổ chùm pháo hoa confetti, ngôi sao và kẹo ngọt rực rỡ.
   - Nút lớn màu vàng kẹo dẻo **"MỞ LỜI MỜI"** xuất hiện ngay dưới tên, chờ người dùng chủ động mở thiệp.
4. **Modal Thiệp Mời Bo Tròn Duyên Dáng (Invitation Modal)**:
   - Thiết kế theo phong cách thiệp kem viền thạch hồng (chuẩn concept Screen 3).
   - Hiển thị logo chính thức, lời nhắn riêng của từng khách, mô tả sự kiện, ngày giờ, địa điểm và các nút mạng xã hội (Facebook, Instagram, Website) nếu được cấu hình.
   - Nút **"Xem lời mời"** có sẵn từ giây đầu tiên ở đáy màn hình giúp khách xem nhanh thông tin bất kỳ lúc nào mà không bị ép buộc phải chơi.
5. **Hệ thống Quản lý Khách & Sự kiện Độc lập (Admin Manager tại `/admin`)**:
   - Thêm/sửa/xóa khách mời, kiểm tra tính hợp lệ của tên ASCII.
   - Tự động tạo link mời riêng cho từng khách (`/?guest=demo-linh`).
   - Cập nhật ngày giờ, địa chỉ, link mạng xã hội của sự kiện.
   - Xuất/nhập file JSON (`event.json`, `guests.json`) để đồng bộ với mã nguồn.

---

## 🚀 Khởi chạy Cục bộ (Local Development)

```bash
# Cài đặt thư viện
npm install

# Khởi chạy dev server (mở cả mạng LAN cho điện thoại)
npm run dev

# Biên dịch sản phẩm (Production Build)
npm run build
```

- **Trang thiệp mời chính**: `http://localhost:5173/`
  - Thử link khách Linh: `http://localhost:5173/?guest=demo-linh`
  - Thử link khách Minh Anh: `http://localhost:5173/?guest=demo-minh-anh`
  - Thử link khách tên dài: `http://localhost:5173/?guest=demo-nguyen-phuong-anh`
- **Trang quản lý thiệp mời (Admin)**: `http://localhost:5173/admin/`
- **Thử nghiệm 3D Three.js độc lập**: `http://localhost:5173/experiments/gummy-3d/`

---

## 📦 Hướng dẫn Deploy Lên Web Tĩnh (Vercel / Netlify / Cloudflare / GitHub Pages)

Dự án là Single Page Application tĩnh thuần túy (HTML/CSS/TS), có thể deploy miễn phí lên bất kỳ nền tảng nào:

### 1. Vercel
1. Kết nối kho Git hoặc chạy lệnh `vercel` qua CLI.
2. Thiết lập:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 2. Netlify
1. Thêm site mới từ Git.
2. Build command: `npm run build`
3. Publish directory: `dist`

### 3. Quy trình Cập nhật Danh sách Khách Mời trên Trang Live
1. Mở trang quản lý `/admin` trên máy tính của bạn.
2. Thêm khách mới, chỉnh sửa lời nhắn hoặc ngày giờ sự kiện.
3. Bấm nút **"⬇ Xuất JSON"** để tải về 2 file `event.json` và `guests.json`.
4. Copy đè 2 file này vào thư mục `config/` (hoặc `public/config/`) trong repo.
5. Commit & Push lên GitHub. Vercel/Netlify sẽ tự động build lại trang web trong vòng 30 giây!
