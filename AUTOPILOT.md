# AUTOPILOT MODE — Zombie Apolycase

Bạn đang chạy ở chế độ **tự động dài hạn, không có người giám sát trực tiếp**.
Tôi sẽ không trả lời câu hỏi trong lúc bạn chạy — vì vậy **không bao giờ dừng lại
để hỏi tôi**. Nếu gặp điều mơ hồ, tự đưa ra quyết định hợp lý nhất, ghi lại lý do
trong commit message, và tiếp tục.

## Nguồn sự thật

`claude.md` ở gốc repo là tài liệu tham chiếu duy nhất về kiến trúc, pattern,
và quy ước của codebase. **Đọc lại file này trước khi bắt đầu mỗi task mới**
(không chỉ một lần ở đầu session) — vì bạn sẽ tự cập nhật nó liên tục và nó
có thể đã thay đổi so với lúc bạn đọc lần trước.

## Vòng lặp làm việc (lặp lại vô hạn cho đến khi hết task hoặc bị dừng)

Với MỖI task, thực hiện đúng các bước theo thứ tự sau, không bỏ bước:

1. **Chọn 1 task duy nhất, nhỏ, cụ thể.** Không gộp nhiều thay đổi không liên
   quan vào một lần sửa. Lấy task từ một trong các nguồn sau, theo thứ tự ưu tiên:
   - Bug hoặc vi phạm pattern đã ghi trong "Các Pattern Quan Trọng" của claude.md
     mà bạn phát hiện khi đọc code
   - Mất cân bằng gameplay rõ ràng (ví dụ: 1 skill quá mạnh/yếu so với rarity
     của nó, 1 tower vô dụng, scaling wave làm game không thể chơi được)
   - Thiếu sót trong cây skill (node base skill tree chưa có hiệu ứng rõ ràng,
     hoặc node không cân bằng so với cost crystal)
   - Cải thiện UI/UX nhỏ (đã có pattern trong HUD.ts/BreakPanel.ts) — không tự
     ý đổi sang framework hay đổi kiến trúc DOM/innerHTML hiện có
   - Polish hiệu ứng hình ảnh/âm thanh theo đúng pattern EffectsManager/AudioManager
     đã có, không tạo hệ thống effect mới song song
   - Dọn dẹp code: loại bỏ field/hàm "legacy" đã ghi chú trong claude.md
     (ví dụ `titanSplashPending`, `BASE_SKILL_POOL` cũ) **chỉ khi** đã xác nhận
     không còn nơi nào dùng

2. **Trước khi sửa code**, lướt qua các file liên quan trực tiếp đến task để
   xác nhận pattern hiện tại (đừng chỉ tin claude.md mù quáng — nó có thể lệch
   so với code thực tế nếu lần cập nhật trước bị sót).

3. **Sửa code**, tuân thủ nghiêm các quy ước đã ghi trong "Các Pattern Quan Trọng"
   (1–18) của claude.md. Đặc biệt:
   - Không bypass `game.resources.spend()`, `game.placeTower()`, `game.onZombieDead()`
   - Không tạo lại hệ thống effect/animation song song với cái đã có
   - Giữ nguyên kiến trúc: không thêm framework, không đổi sang React/Vue
   - Theme màu lấy từ `T` trong `theme.ts`, không hard-code hex mới trừ khi
     thêm vào `theme.ts` trước

4. **Build bắt buộc:** chạy `npm run build` (hoặc `tsc --noEmit` nếu build quá
   chậm để lặp nhanh, nhưng phải chạy `npm run build` đầy đủ trước khi commit).
   - Nếu lỗi → sửa ngay, không chuyển task khác cho đến khi build sạch.
   - Không bao giờ commit code không build được.

5. **Tự kiểm tra logic** bằng cách đọc lại đoạn code vừa sửa và lần theo luồng
   dữ liệu thủ công (vì không có test tự động) — đặc biệt với thay đổi số liệu
   cân bằng (damage, HP, cost), kiểm tra đơn vị và scale có hợp lý với các giá
   trị tương đương khác trong cùng bảng/pool không.

6. **Cập nhật `claude.md`** ngay trong cùng task nếu thay đổi ảnh hưởng đến:
   bảng số liệu (Tower Profiles, Weapon Profiles, skill tables), cấu trúc field
   mới trên entity, pattern mới, hoặc field/hàm bị xóa. Đây không phải bước
   tùy chọn — nếu claude.md lệch so với code, task coi như **chưa xong**.

7. **Commit và push, theo đúng quy ước version + category của repo này:**

   **a. Xác định version hiện tại trước khi commit:**
   Chạy `git log -1 --pretty=%s` (hoặc xem vài commit gần nhất) để lấy số
   version `vX.Y` mới nhất đã dùng trong repo. **Không tự bịa version** —
   luôn đọc từ git log thật, vì file này không lưu version cứng.

   **b. Quyết định tăng X hay Y** dựa trên độ lớn thay đổi của task:
   - Tăng `Y` (minor, ví dụ v1.6 → v1.7): hầu hết task — balance nhỏ, fix bug,
     polish UI/UX, polish effect, cleanup, docs.
   - Tăng `X` (major, ví dụ v1.6 → v2.0, reset Y về 0): chỉ khi task thêm một
     hệ thống/tính năng đủ lớn để thay đổi cách chơi rõ rệt (ví dụ: thêm hẳn
     một skill tree mới, một loại tower/zombie mới, một cơ chế game loop mới
     được cho phép theo task hiện tại). Khi không chắc, **ưu tiên tăng Y** —
     tăng X là ngoại lệ, không phải mặc định.
   - Đừng tăng version 2 lần cho cùng 1 task. Mỗi commit = đúng 1 bước version.

   **c. Format message:** `vX.Y [category]: mô tả ngắn, rõ, đúng ngữ pháp`
   Category là một trong: `balance`, `fix`, `feature`, `skill-tree`, `ui`,
   `effects`, `cleanup`, `docs`. Mô tả viết bằng tiếng Anh (theo đúng convention
   cũ của repo), thường, không viết hoa đầu câu kiểu tiêu đề — giống style các
   commit trước đó trong repo (ví dụ: `update UI`, `add gun recoil`).
   Ví dụ:
   `v1.7 [balance]: reduce shotgun_870 damage from 12x8 to 10x8, was overperforming for its cost`
   `v1.8 [fix]: spitter zombie gets stuck when aggro target moves out of range`
   `v1.9 [skill-tree]: add missing visual feedback for garrisonArmored node`
   `v2.0 [feature]: add new tower type, flamethrower turret`
   Mỗi commit chỉ chứa 1 task. Không gộp "misc fixes".

   **d. Push lên `origin main` ngay sau khi commit thành công**, để mỗi task
   hoàn thành đều được đẩy lên ngay, không tích trữ nhiều commit chưa push:
   - Chỉ push sau khi: build sạch (bước 4) ✅ và commit đã tạo thành công ✅.
   - Lệnh: `git push origin main`.
   - **Không bao giờ force-push** (`--force` / `-f`), không push lên branch
     khác ngoài `main`, không tạo branch mới trừ khi task yêu cầu rõ.
   - Nếu push thất bại (ví dụ remote có commit mới hơn / conflict): **dừng lại,
     không tự ý rebase hoặc force-push để "giải quyết"** — đây là tình huống
     cần báo cáo theo mục "Khi nào dừng vòng lặp" bên dưới, vì có thể có người
     khác (hoặc tôi) đã thay đổi remote.

8. **Quay lại bước 1** với task tiếp theo. Không tự dừng, không tóm tắt giữa
   chừng, không hỏi "bạn có muốn tôi tiếp tục không" — cứ tiếp tục cho đến khi
   hết ý tưởng hợp lý để cải thiện hoặc gặp lỗi không tự sửa được.

## Giới hạn cứng — không bao giờ làm

- Không refactor kiến trúc lớn (đổi rendering pipeline, đổi state management,
  thêm framework) trong autopilot — việc đó cần thảo luận với tôi trực tiếp.
- Không xóa hoặc viết lại toàn bộ một hệ thống lớn (ví dụ viết lại hết
  SkillManager) trong 1 task — chỉ sửa tăng dần.
- Không đổi tỉ lệ rarity weight (`60/30/10`) hoặc core game loop
  (`enterBreak`/`exitBreak` timing) trừ khi đó chính là task đang làm và có
  lý do rõ trong commit message.
- Không bao giờ revert commit trước đó để "thử cách khác" mà không ghi rõ lý do.
- Nếu một thay đổi cân bằng trước đó (đọc từ git log) có vẻ sai, **sửa tiếp lên
  trên nó** bằng commit mới, không quietly undo.
- Không force-push, không push lên branch khác ngoài `main`, không bypass
  bước build/commit để push thẳng (xem bước 7d).

## Khi nào dừng vòng lặp

Dừng và báo cáo (không tiếp tục im lặng) nếu:
- Build lỗi liên tục không tự sửa được sau ~3 lần thử trên cùng 1 task
- Phát hiện mâu thuẫn nghiêm trọng giữa claude.md và code mà không rõ cái nào
  đúng (ví dụ field được claude.md nói đã xóa nhưng vẫn được gọi ở nhiều nơi)
- Push lên `origin main` thất bại (remote conflict, auth lỗi, v.v.) — không tự
  rebase/force-push để xử lý
- Hết ý tưởng cải thiện hợp lý (đã rà soát hết các mục trong checklist bước 1)

Khi dừng, để lại 1 commit `vX.Y [autopilot]: pause session — <short reason>`
tóm tắt ngắn các task đã làm trong session và đề xuất hướng tiếp theo, **rồi
push lên `origin main`** (commit message này cũng viết bằng tiếng Anh).

## Bắt đầu

Đọc `claude.md`, chạy `git log` để xác nhận version hiện tại, sau đó liệt kê
ra (trong đầu, không cần in ra cho tôi) 5–10 task ứng viên theo thứ tự ưu tiên
ở bước 1, rồi bắt đầu task đầu tiên ngay.