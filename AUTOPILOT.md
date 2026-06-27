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
   - Một bước nhỏ hướng tới mục **"Sáng Kiến Dài Hạn"** ở cuối file — đây là
     các mảng lớn (visual identity tower, làm súng khác playstyle thật, môi
     trường, VFX chiêu quái, model quái ổn định, player-flow) cần chia thành
     nhiều task nhỏ rải qua nhiều session. Trộn xen kẽ vào danh sách ưu tiên
     này như mọi nguồn khác — **không** dồn hết vào 1 task to, không ưu tiên
     hơn hay thấp hơn các mục trên, chỉ là một nguồn task ngang hàng

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
   - **Thêm special mechanic mới cho 1 vũ khí** (ví dụ: shotgun knockback,
     sniper scope-zoom giảm spread khi giữ chuột, AR damage ramp-up khi bắn
     liên tục...) là được phép — đây là cách hợp lệ để làm các súng khác tiền
     thật sự khác playstyle, không chỉ khác số. Nhưng **trước khi viết code**,
     phải mở `claude.md`, viết một đoạn note ngắn dưới mục Weapon Profiles
     (hoặc tạo mục mới `### Weapon Special Mechanics` nếu chưa có) mô tả: tên
     mechanic, súng nào, trigger condition, effect, lý do thiết kế (vì sao
     hợp lý với cost/role của súng đó so với súng khác). Note này phải tồn
     tại trong claude.md **trước** dòng code đầu tiên của mechanic được viết
     — coi như "design doc 3 dòng" làm bằng chứng quyết định có chủ đích, để
     session sau (hoặc tôi) đọc lại hiểu được vì sao mechanic này tồn tại.
     Mechanic mới vẫn phải nằm trong field/flag pattern hiện có (giống style
     `bulletPenetrating`, `armorPiercing`...) trên Player/Bullet/Weapon —
     không tạo class hệ thống vũ khí mới song song.

4. **Build bắt buộc:** chạy `npm run build` (hoặc `tsc --noEmit` nếu build quá
   chậm để lặp nhanh, nhưng phải chạy `npm run build` đầy đủ trước khi commit).
   - Nếu lỗi → sửa ngay, không chuyển task khác cho đến khi build sạch.
   - Không bao giờ commit code không build được.

5. **Tự kiểm tra logic** bằng cách đọc lại đoạn code vừa sửa và lần theo luồng
   dữ liệu thủ công (vì không có test tự động) — đặc biệt với thay đổi số liệu
   cân bằng (damage, HP, cost), kiểm tra đơn vị và scale có hợp lý với các giá
   trị tương đương khác trong cùng bảng/pool không.

5b. **Tự kiểm tra hình ảnh (BẮT BUỘC cho mọi task chạm vào rendering/visual/
    animation — tower, zombie, garrison, effects, HUD canvas)**: chỉ đọc code
    là không đủ để biết hình vẽ ra có ổn hay kỳ lạ. Phải tự *nhìn thấy* kết quả:
    - Viết một script Node/TS nhỏ, độc lập, dùng `node-canvas` (hoặc tương đương
      đã có sẵn trong devDependencies; nếu chưa có, cài tạm `npm install canvas
      --no-save` trong scratch dir, không thêm vào `package.json` chính thức
      của repo) để gọi đúng hàm vẽ vừa sửa (`SKELETON_FACTORIES[...]`,
      `drawZombieComposite`, hàm vẽ tower mới, v.v.) với vài giá trị tham số
      tiêu biểu (tier khác nhau, vài frame animation khác nhau, vài góc quay).
    - Render ra file `.png` tạm trong thư mục làm việc (không commit file ảnh
      này vào git — chỉ dùng để tự xem).
    - Dùng tool `view` để **tự nhìn ảnh đó** và đánh giá thành thật: bố cục có
      cân đối không, có bộ phận nào chồng lấn/lệch kỳ lạ không, màu có tuân
      theo `theme.ts` không, hình có "đọc" được là loại tower/zombie gì không
      (silhouette rõ ràng), animation frame-to-frame có giật/nhảy bất thường
      không (so 2–3 frame liên tiếp).
    - Nếu nhìn kỳ lạ hoặc không đạt: **sửa lại và render lại**, lặp tới khi ổn
      — đừng commit ở lần vẽ đầu tiên chỉ vì code chạy không lỗi.
    - Nhân lúc này, kiểm tra và khắc phục luôn các lỗi animation liên quan đang
      thấy được qua ảnh (frame bị đứng yên sai chỗ, scale/rotation áp dụng sai
      thứ tự, limb bị "trôi" khỏi anchor point...) — không chỉ riêng phần mới
      thêm, vì các state cũ đứng cạnh state mới dễ lộ ra sự thiếu nhất quán.
    - Dọn các file `.png`/script tạm này trước khi commit — chúng là công cụ
      tự-review, không phải deliverable.

6. **Cập nhật `claude.md`** ngay trong cùng task nếu thay đổi ảnh hưởng đến:
   bảng số liệu (Tower Profiles, Weapon Profiles, skill tables), cấu trúc field
   mới trên entity, pattern mới, hoặc field/hàm bị xóa. Đây không phải bước
   tùy chọn — nếu claude.md lệch so với code, task coi như **chưa xong**.

7. **Commit theo đúng quy ước version + category của repo này:**

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

8. **Quay lại bước 1** với task tiếp theo. Không tự dừng, không tóm tắt giữa
   chừng, không hỏi "bạn có muốn tôi tiếp tục không" — cứ tiếp tục cho đến khi
   hết ý tưởng hợp lý để cải thiện hoặc gặp lỗi không tự sửa được.

## Sáng Kiến Dài Hạn

Đây là các mảng cải thiện lớn, không làm xong trong 1 task — mỗi lần chạy chỉ
nên cắn một miếng nhỏ, cụ thể, build/commit/push được ngay, rồi để session sau
tiếp tục. Đừng cố làm "cho xong cả mảng" trong 1 lần — task to vi phạm bước 1
("1 task duy nhất, nhỏ, cụ thể") và rất dễ tạo commit khó review, khó revert.

### A. Visual identity cho tower ✅ HOÀN THÀNH (v2.2–v2.7)
Tất cả 7 tower types đã có custom silhouette riêng biệt:
- fireTower: octagonal base + barrel nozzle + glowing ember tip
- electricTower: tesla coil column + discharge prongs + pulsing ball
- machineGunTower: hexagonal turret + ammo drum + muzzle flash
- freezeTower: circular cryo dish + 4–6 ice spines + glowing core
- poisonTower: oval acid tank + angled nozzle + animated drip dots
- repairTower: rounded workshop pad + wrench cross + beacon dots
- barricade: vẫn giữ square (phù hợp — là vật cản vật lý, không cần identity phức tạp)

Bước tiếp theo nếu muốn tiếp tục mảng này: animation cho tower (xoay nòng MG theo
target, muzzle flash khi bắn thực sự, freeze tower glow khi pulse...). Đây là task
riêng, không urgent so với các mảng khác chưa bắt đầu.

### B. Làm vũ khí khác nhau về playstyle, không chỉ về số
Mục tiêu: người chơi chọn súng vì **cách chơi** khác (range vs khác, AoE vs
single-target, rủi ro-lợi ích khác), không chỉ vì số dmg/firerate nhân lên.
- Trước khi sửa số: tự hỏi súng A và B (cùng tier giá) khác nhau ở hành vi
  nào khi cầm, không phải chỉ ở DPS trên giấy.
- Cách hợp lệ để tạo khác biệt: (1) tune số trong field hiện có (damage,
  spread, reload, magazine — không cần note claude.md trước); (2) thêm
  special mechanic mới riêng cho súng đó (**phải note claude.md trước khi
  code**, xem bước 3). Ví dụ hướng đi hợp lý: shotgun đánh gần mạnh nhưng có
  knockback ngắn; sniper có "charge" giữ chuột để giảm spread/tăng dmg nhưng
  bất động; SMG có mobility bonus khi đang bắn; grenade launcher có self-damage
  zone nhỏ nếu bắn quá gần. Đây chỉ là ví dụ — tự đánh giá phù hợp.
- Mỗi task = 1 thay đổi cho 1 súng. Sau khi sửa, tự kiểm tra bằng cách đọc
  lại toàn bảng Weapon Profiles trong claude.md để chắc súng đó không bỗng
  vượt trội/vô dụng so với phần còn lại của bảng (xem bước 5 — kiểm tra logic
  cân bằng vẫn áp dụng đầy đủ ở đây, không chỉ riêng số liệu).

### C. Hiệu ứng môi trường
Polish/thêm hiệu ứng tăng "sự sống" cho thế giới game — theo đúng pattern
`EffectsManager` đã có, không tạo hệ thống effect song song. Ví dụ hướng đi:
ambient particle theo theme map (bụi, tàn lửa xa base), phản hồi hình ảnh khi
territory expand, weather/lighting nhẹ theo wave progression. Mỗi task = 1
hiệu ứng nhỏ, qua bước 5b nếu có phần vẽ mới.

### D. VFX chiêu/đòn đánh quái vật tốt hơn
Mở rộng trên hệ thống `spawnZombieSlash()` / `SlashEffect` đã có (pattern 18)
— không viết hệ thống slash song song. Mỗi archetype có thể cần pattern riêng
biệt hơn nữa (ví dụ spitter cần visual rõ hơn cho acid spit tầm xa, boss cần
telegraph rõ hơn cho wind-up dài). Mỗi task = 1 archetype hoặc 1 loại đòn.
Qua bước 5b bắt buộc.

### E. Model quái vật ổn định hơn
"Ổn định" ở đây nghĩa là: limb không bị "trôi"/lệch anchor khi animation
chuyển frame hoặc khi windup/hit-recoil scale áp dụng cùng lúc, silhouette
nhất quán giữa các tier của cùng archetype (tier cao không nên trông "vô lý"
khác hẳn tier thấp, nên là phiên bản "tăng cường" rõ ràng của cùng bộ khung).
Đây là task review + fix, không phải thêm tính năng — tự dựng ảnh debug theo
bước 5b, so sánh nhiều tier/frame cạnh nhau, tìm điểm bất thường rồi sửa
trong `SKELETON_FACTORIES` hoặc `zombieAnimationData.ts`.

### F. Audit luồng chơi từ góc nhìn người chơi
Định kỳ (ví dụ mỗi vài task khác), dành 1 task để **đọc code như người chơi
trải nghiệm**, không phải như reviewer kỹ thuật: lần theo 1 vòng break →
playing → break tiếp theo trong đầu (hoặc nếu có cách chạy dev server headless
để quan sát log/state, dùng nó), tìm điểm gây khó chịu — quá nhiều click để
làm 1 việc quen tay, modal che mất thông tin cần thấy lúc gameplay, feedback
hình ảnh/âm thanh thiếu khi 1 hành động quan trọng xảy ra (ví dụ nhận dame,
hết đạn, base bị tấn công mà người chơi đang ở xa), hoặc 1 quyết định (mua gì,
build gì) mà không đủ thông tin hiển thị để quyết định tốt. Mỗi lần audit chỉ
ghi nhận **1 điểm khó chịu cụ thể nhất** và sửa nó như 1 task bình thường qua
toàn bộ vòng lặp (không liệt kê hàng loạt rồi làm hết 1 lần).

## Giới hạn cứng — không bao giờ làm

- Không refactor kiến trúc lớn (đổi rendering pipeline, đổi state management,
  thêm framework) trong autopilot — việc đó cần thảo luận với tôi trực tiếp.
  (Vẽ thêm hàm vẽ chi tiết hơn cho tower trong `renderTowers()`, hoặc thêm
  field mechanic mới trên `WeaponSlot`/`Bullet` theo mục Sáng Kiến Dài Hạn
  bên trên, **không** tính là refactor kiến trúc — đó là mở rộng tăng dần
  trong khuôn pattern hiện có, vẫn được phép.)
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
- Không thêm special mechanic mới cho súng mà không ghi note thiết kế vào
  `claude.md` trước (xem bước 3) — mục Sáng Kiến Dài Hạn cho phép thêm
  mechanic, nhưng không phải ngoại lệ cho bước note-trước-khi-code này.

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