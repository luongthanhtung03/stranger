# Stranger

Video call 5 phút với một sinh viên ngẫu nhiên. Beta: không tài khoản, chỉ cần tên.

## Cấu trúc

```
apps/web        Next.js (Vercel)      – giao diện, WebRTC P2P
apps/server     Node + Socket.IO      – ghép cặp, phòng, báo cáo, TURN credentials
packages/shared – kiểu sự kiện socket, bộ câu hỏi icebreaker
```

## Chạy local

```bash
npm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local
npm run dev            # web :3000 + server :4000
```

Mở hai tab trình duyệt (một tab ẩn danh để có deviceId khác) → nhập tên → Bắt đầu.

Test server: `cd apps/server && npm run dev` rồi `npx tsx test/signaling.test.mjs` (mặc định trỏ tới :4010, đặt `URL=http://localhost:4000` nếu cần).

## Cho bạn bè vào thử (tunnel)

Điện thoại chỉ cho mở camera qua HTTPS, nên không dùng được IP LAN trực tiếp. Lệnh này mở 2 Cloudflare quick tunnel (miễn phí, không cần tài khoản) rồi tự chạy web + server:

```bash
npm run tunnel
# nếu cổng 3000/4000 đang bận:
WEB_PORT=3200 SERVER_PORT=4200 npm run tunnel
```

Gửi link `https://….trycloudflare.com` in ra màn hình cho bạn bè. Giữ cửa sổ mở; `Ctrl+C` để tắt (env files tự trả về localhost). Link đổi mỗi lần chạy. Cần `cloudflared.exe` trong thư mục `.tools/` (tải từ https://github.com/cloudflare/cloudflared/releases).

Nếu ai đó ở 4G bị kẹt "Đang kết nối…", điền `CF_TURN_KEY_ID` / `CF_TURN_KEY_TOKEN` trong `apps/server/.env` (Cloudflare Realtime TURN, miễn phí).

## Đăng nhập Google (ẩn trong bản beta)

Đã code xong nhưng **tắt mặc định**: bản beta không hiện nút, không tải script của Google. Khi bật, chỉ email sinh viên `.edu.vn` được vào, và lệnh cấm/bạn bè gắn với tài khoản thay vì thiết bị.

1. Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web). Thêm domain web vào *Authorized JavaScript origins* (vd. `http://localhost:3000`).
2. `apps/server/.env`: `AUTH_ENABLED=true`, `GOOGLE_CLIENT_ID=…`, `SESSION_SECRET=` (32+ ký tự ngẫu nhiên).
3. `apps/web/.env.local`: `NEXT_PUBLIC_AUTH_ENABLED=true`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID=…` (cùng client id).

Test: chạy server với các biến trên ở `PORT=4011`, rồi `SESSION_SECRET=… npx tsx test/auth.test.mjs`.

## Deploy (miễn phí)

| Phần | Nơi | Ghi chú |
|---|---|---|
| `apps/server` | Render (Free web service) | Build: `npm install`; Start: `npm start -w apps/server`; env `PORT`, `CORS_ORIGINS=https://<web>.vercel.app`, `CF_TURN_KEY_ID`, `CF_TURN_KEY_TOKEN`. Thêm UptimeRobot ping `/healthz` mỗi 5 phút để không bị ngủ. |
| `apps/web` | Vercel (Hobby) | Root directory `apps/web`; env `NEXT_PUBLIC_SERVER_URL=https://<server>.onrender.com`. |
| TURN | Cloudflare Realtime | Dashboard → Realtime → TURN → tạo key. 1.000 GB/tháng miễn phí. |

## Chất lượng video

P2P WebRTC (không SFU), xin 1280×720@30, ưu tiên codec VP9, giới hạn 2.5 Mbps, giữ độ phân giải khi mạng yếu. Nút 🍃 "Tiết kiệm data" hạ xuống 640×360 / 500 kbps.
