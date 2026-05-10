# Bank Financial Dashboard

Web dashboard theo dõi sức khỏe tài chính các ngân hàng niêm yết tại Việt Nam (NPL, LLR, LDR, Tăng Trưởng Doanh Thu).

## Yêu cầu

- Node.js ≥ 18
- MySQL ≥ 8.0 (cần RANK() OVER window functions)
- Database `finance` với bảng `bctc_new` đã có dữ liệu

## Cài đặt

### 1. Tạo file `.env`

```bash
cp .env.example .env
```

Mở `.env` và điền thông tin kết nối DB:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=finance
PORT=3001
VITE_API_BASE_URL=http://localhost:3001
```

### 2. Cài dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

## Chạy development

Mở **2 terminal** riêng biệt:

**Terminal 1 — Backend** (port 3001):

```bash
cd backend
npm run dev
```

Kết quả: `Backend running on :3001`

**Terminal 2 — Frontend** (port 5173):

```bash
cd frontend
npm run dev
```

Mở trình duyệt tại `http://localhost:5173`

## Build production

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

## Cấu trúc thư mục

```
bank-dashboard/
├── backend/
│   └── src/
│       ├── db/
│       │   ├── connection.ts   # MySQL pool
│       │   └── queries.ts      # Period detection
│       ├── lib/
│       │   └── detectWindow.ts # Xác định kỳ báo cáo hiện tại
│       ├── routes/
│       │   ├── banks.ts        # GET /api/banks, GET /api/banks/:code/trend
│       │   └── ranking.ts      # GET /api/ranking
│       └── index.ts            # Express entry point
├── frontend/
│   └── src/
│       ├── api/
│       │   └── client.ts       # fetch wrappers
│       └── components/
│           ├── BankList.tsx    # Danh sách ngân hàng
│           ├── TrendChart.tsx  # Biểu đồ xu hướng YoY
│           └── RankingChart.tsx# Biểu đồ xếp hạng
├── database/                   # SQL schemas & triggers
└── docs/                       # Spec, impl-plan, standards
```

## API Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/banks` | Danh sách ngân hàng kỳ mới nhất, sort theo điểm giảm dần |
| GET | `/api/banks/:code/trend` | Chuỗi thời gian năm + quý cho 1 ngân hàng |
| GET | `/api/ranking` | Xếp hạng tất cả ngân hàng trên toàn bộ dữ liệu |

## Lưu ý

- Nếu các ngân hàng BID/LPB/TCB/MBB/STB hiển thị `0.00%` cho các chỉ số — cần chạy backfill để trigger tính lại:
  ```sql
  UPDATE bctc_new SET StockCode=StockCode WHERE StockCode IN ('BID','LPB','TCB','MBB','STB');
  ```
- File `.env` chứa credentials — không commit lên git.
