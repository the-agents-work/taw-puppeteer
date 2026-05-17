# taw-puppeteer

Prototype phim rối 2D theo hướng rẻ, ổn định và dễ tự động hóa:

- 1 background cố định.
- Nhân vật được sinh từ JSON spec thành SVG layer.
- Timeline JavaScript đổi caption, miệng, mày, mắt, tay và trạng thái nói/nghe.
- Có chế độ "múa bóng".
- Có nút xuất SVG cho nhân vật đang active.
- Chưa dùng audio/TTS ở bản đầu, để giữ demo gọn.

## Chạy local

```bash
npm run dev
```

Mở:

```text
http://localhost:5173
```

Hoặc mở trực tiếp `index.html` trong browser.

## Kiểm tra

```bash
npm run check
```

## Cách hoạt động

`script.js` có 3 khối chính:

- `characterPresets`: config màu, tên, phụ kiện của nhân vật.
- `createPuppetSvg()`: sinh SVG nhân vật từ config.
- `timeline`: lời thoại và thời điểm animation.

Miệng dùng viseme path đơn giản:

```js
const mouthPaths = {
  rest: "...",
  a: "...",
  o: "...",
  e: "...",
  m: "...",
};
```

Sau này có thể thay `mouthOrder` bằng dữ liệu lip-sync thật từ audio/TTS.

## Vì sao dùng SVG thay vì PNG cho nhân vật?

PNG đẹp khi làm concept, nhưng SVG tốt hơn cho pipeline auto:

- đổi miệng/mắt/mày bằng code;
- xuất từng nhân vật thành asset riêng;
- scale không vỡ;
- dễ nối vào timeline, TTS, ffmpeg, Remotion hoặc canvas renderer.

Hướng hợp lý là dùng AI để tạo concept art/character sheet, rồi chuyển thành layer SVG/PNG sạch cho engine điều khiển.

## Roadmap

- Thêm TTS.
- Tạo lip-sync từ audio hoặc transcript.
- Export MP4 bằng Remotion hoặc frame sequence + ffmpeg.
- Tạo editor nhỏ để thêm nhân vật/cảnh/timeline không cần sửa code.
- Cho phép import PNG/SVG layer thật từ tool thiết kế.
