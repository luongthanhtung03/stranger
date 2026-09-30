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

Test server: `cd apps/server && npm run dev` rồi `node test/signaling.test.mjs` (mặc định trỏ tới :4010, đặt `URL=http://localhost:4000` nếu cần).

## Deploy (miễn phí)

| Phần | Nơi | Ghi chú |
|---|---|---|
| `apps/server` | Render (Free web service) | Build: `npm install`; Start: `npm start -w apps/server`; env `PORT`, `CORS_ORIGINS=https://<web>.vercel.app`, `CF_TURN_KEY_ID`, `CF_TURN_KEY_TOKEN`. Thêm UptimeRobot ping `/healthz` mỗi 5 phút để không bị ngủ. |
| `apps/web` | Vercel (Hobby) | Root directory `apps/web`; env `NEXT_PUBLIC_SERVER_URL=https://<server>.onrender.com`. |
| TURN | Cloudflare Realtime | Dashboard → Realtime → TURN → tạo key. 1.000 GB/tháng miễn phí. |

## Chất lượng video

P2P WebRTC (không SFU), xin 1280×720@30, ưu tiên codec VP9, giới hạn 2.5 Mbps, giữ độ phân giải khi mạng yếu. Nút 🍃 "Tiết kiệm data" hạ xuống 640×360 / 500 kbps.
