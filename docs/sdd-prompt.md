Phase 1: Tạo Spec Pack (đặc tả có thể triển khai)]

Input:
- Specification sources (ticket description, requirements definition, basic design, existing specification, meeting notes, v.v.)
  * Nếu nguồn gốc ban đầu là file MS Office, giả định rằng phần text extract đã được đặt dưới description.md

Tasks:
1) Nếu chưa có, hãy tạo docs/changes/improve-decision-history/
2) Trước hết tạo “list of specification sources (Source of Truth)”:
   - docs/changes/improve-decision-history/sources.md
   - Ghi lại tài liệu nào là authoritative, chỗ nào có mâu thuẫn
3) Tạo main Spec Pack:
   - docs/changes/improve-decision-history/spec-pack.md
   - Các section bắt buộc: background/purpose, scope (làm gì / không làm gì), terminology, As-Is/To-Be, detailed specification, non-functional requirements, AC (Acceptance Criteria), Examples, Open Issues, risks
4) AC luôn phải được viết thành các câu có thể kiểm thử được, có đánh số (AC-1, AC-2, ...)
5) Tối thiểu, phần Examples phải có:
   - Normal cases (ít nhất 2)
   - Abnormal cases (ít nhất 2)
   - Boundary values (ít nhất 2)
6) Những gì chưa ngã ngũ thì không được triển khai; hãy tách thành Open Issues và viết rõ thành câu hỏi

Yêu cầu bổ sung:
- Ở cuối Spec Pack, hãy tạo một “traceability table”:
  - Bảng mapping giữa AC ↔ screen/API/DB/log/permissions/test type (UT/IT/E2E/BB)
- Ở giai đoạn này, đừng viết quá nhiều về đề xuất implementation (hãy tập trung vào đặc tả và AC)

Output:
- docs/changes/improve-decision-history/sources.md
- docs/changes/improve-decision-history/spec-pack.md
- Phán định: “Chỉ với Spec Pack này đã có thể bắt đầu implementation chưa?” (Yes/No) và lý do
- Thứ tự ưu tiên các Open Issues mà con người cần quyết định trước khi bắt đầu implementation

========================================================================================================================
[Phase 2: Áp context của ticket (Architecture / Characteristics / Implementation Conventions / Notes + Initial Contents Under the Ticket)]

Mục tiêu:
- Chỉ bổ sung/thay đổi những phần của common base từ Phase 0-B mà ticket này thực sự cần
- Tạo nội dung ban đầu cho các working files dưới docs/changes/improve-decision-history/ để phát triển tiếp ở các phase sau
- Giữ tách biệt giữa “shared” và “ticket-specific”, đồng thời bảo đảm các phase sau không bị lạc

Inputs (dự kiến truyền bằng @):
- docs/changes/improve-decision-history/sources.md
- docs/changes/improve-decision-history/spec-pack.md
- Representative code (ví dụ tốt / vùng cần cẩn trọng)
- docs/architecture/*, docs/standards/*, .claude/rules/* (common base)

Tasks:
1) Đọc spec-pack.md cùng code hiện có, rồi rút ra các perspective quan trọng cho ticket này
   - Architecture (layers, dependencies, responsibilities, key flows)
   - Characteristics (consistency, permissions, logs, audit, performance, operations)
   - Implementation conventions (naming, exceptions, testing style)
   - Notes (known pitfalls, compatibility, workarounds)
2) Chỉ bổ sung/thay đổi những phần common base cần thiết
   - docs/architecture/* (nếu cần)
   - docs/standards/* (nếu cần)
   - .claude/rules/* (nếu cần)
3) Tạo/cập nhật các file sau dưới docs/changes/improve-decision-history/
   - impl-plan.md (bản đầu)
   - review-checklist.md (bản đầu)
   - self-review.md (template)
   - test-plan.md (template)
   - test-results.md (template)
   - blackbox-testcases.md (template)
   - test-data.md (template)
   - report.md (template)
4) Ở giai đoạn này, ưu tiên chuẩn bị **initial contents / drafts**, không phải “hoàn tất” chúng
5) Nếu cần, hãy ghi ngắn lý do thay đổi vào tài liệu liên quan hoặc vào report.md

Output (bắt buộc):
- Danh sách common-base files đã được cập nhật
- Danh sách files được tạo/cập nhật dưới docs/changes/improve-decision-history/
- Danh sách bullet về các hạng mục (gaps / cautions) cần đào sâu ở các Phases 3–8 tiếp theo

========================================================================================================================

[Phase 3: impl-plan (Implementation Plan + Impact Analysis)]

Input:
@docs/changes/improve-decision-history/spec-pack.md
@docs/architecture/overview.md
@docs/standards/
@.claude/rules/

Tasks:
1) Xây implementation policy dựa trên AC trong spec-pack.md (nếu có nhiều phương án thì so sánh)
2) Thực hiện impact analysis:
   - Liệt kê các files/modules/API/DB/settings/logs/permissions có thể bị ảnh hưởng
   - Trước hết liệt kê “existing code cần đọc”, rồi mới đọc (không đọc bừa)
3) Tạo/cập nhật docs/changes/improve-decision-history/impl-plan.md (nếu đã có bản đầu ở Phase 2 thì nuôi lớn nó)
   - Bắt buộc: policy, changes, impact analysis, implementation steps (chia thành đơn vị nhỏ), risks, rollback, verification procedure
4) Ở cuối impl-plan.md, tạo “AC mapping table” (mỗi AC được đáp ứng ở đâu)

Ràng buộc quan trọng:
- Không được làm những gì không có trong đặc tả (spec-pack). Nếu cần, phải trả lại thành Open Issue.
- Implementation steps phải tuân theo nguyên tắc “1 step = nhỏ tới mức có thể review được”.

Output:
- docs/changes/improve-decision-history/impl-plan.md
- Checklist các điều cần xác nhận trước khi implementation bắt đầu (bao gồm cả những thông tin còn thiếu)

========================================================================================================================

[Phase 4: Review Perspectives (checklist) + self-review template]

Input:
@docs/changes/improve-decision-history/spec-pack.md
@docs/changes/improve-decision-history/impl-plan.md
@docs/standards/
@.claude/rules/

Tasks:
1) Tạo/cập nhật docs/changes/improve-decision-history/review-checklist.md (nếu đã có bản đầu từ Phase 2 thì nuôi lớn nó)
   - Cấu trúc: specification/AC, design/dependencies, security, performance, compatibility, logs/audit, error handling, testing, operations
   - Gắn “severity (Blocker/Major/Minor)” cho từng item
   - Thêm bảng mapping tới AC (mỗi check xác nhận AC nào)
2) Tạo/cập nhật docs/changes/improve-decision-history/self-review.md (nếu đã có template từ Phase 2 thì nuôi lớn nó)
   - Giả định Claude sẽ tự điền sau implementation, nên các hạng mục kiểm tra phải là checkbox
   - Tạo các section để ghi command đã chạy (lint/test) và kết quả
   - Tạo các section để ghi known risks / not handled yet / remaining issues

Output:
- review-checklist.md
- self-review.md

Trước hết hãy trình bày Plan (chưa được sửa gì).

========================================================================================================================

[Phase 5: Implementation + Claude Self-Check]

Input:
@docs/changes/improve-decision-history/spec-pack.md
@docs/changes/improve-decision-history/impl-plan.md

@.claude/rules/
@docs/standards/

Tasks:
1) Thực hiện implementation đúng theo impl-plan.md (không được tự ý nở scope)
2) Giữ thay đổi nhỏ:
   - Mỗi step đều phải báo ngắn “đã thay đổi gì”, “ảnh hưởng gì”, “check tiếp theo là gì”
3) Nếu có thể, hãy chạy lint/test (sau khi kiểm tra standard commands của dự án)
4) Nếu phát hiện spec-pack.md và implementation bị lệch nhau:
   - Không được tự sửa đặc tả; hãy đề xuất cái nào cần được xem là authoritative rồi dừng lại
   - Nếu cần, hãy trình bày đề xuất sửa spec-pack.md và chờ approval

Ràng buộc quan trọng:
- Cấm destructive commands, và không để secrets lộ trong logs/commits
- Cấm large refactors (chỉ thực hiện minimum change đủ để thỏa AC này)
- Khi kết thúc implementation, hãy tóm tắt “diff overview”, “AC achievement status”, và “remaining issues”

========================================================================================================================

[Phase 6: Test Plan → Test Implementation → Recording Results]

Input:
@docs/changes/improve-decision-history/spec-pack.md
@docs/changes/improve-decision-history/impl-plan.md
@docs/changes/improve-decision-history/review-checklist.md
(Ngoài ra tham chiếu implementation diffs nếu cần)

Tasks:
1) Tạo/cập nhật docs/changes/improve-decision-history/test-plan.md (nếu đã có template từ Phase 2 thì nuôi lớn nó)
   - Ghi rõ với từng AC thì “test type nào sẽ bảo đảm nó”
   - Chắc chắn phải bao gồm FE UT / BE UT / API IT
   - Tuân theo testing conventions hiện có (naming / placement / mocking policy), lấy .claude/rules và docs/standards làm chuẩn
2) Implement các tests:
   - FE UT: tập trung vào “các ranh giới UI dễ vỡ”, như form validation, state transitions, exception display
   - BE UT: use case / domain boundary values, exceptions, permissions
   - API IT: endpoints có cả authentication / DB
3) Nếu có thể, hãy chạy tests và tạo/cập nhật docs/changes/improve-decision-history/test-results.md với kết quả
   - Commands đã chạy
   - Success / failure
   - Nguyên nhân và cách xử lý khi fail
4) Tự kiểm tra “có thiếu test perspectives nào không” dựa trên review checklist

Ràng buộc:
- Tests không phải là “chép lại implementation”; phải viết để bảo vệ AC và các boundary

Trước hết hãy trình bày Plan (chưa được sửa gì).