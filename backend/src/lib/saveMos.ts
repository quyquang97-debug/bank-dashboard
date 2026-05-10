import { pool } from "../db/connection.js";

export async function saveMos(
  stockCode: string,
  mos: number,
  currentPrice: number
): Promise<void> {
  const sql =
    "INSERT INTO `paybacktime` (`StockCode`, `MOS`, `current_price`, `ti_suat_sinh_loi`) " +
    "VALUES (?, ?, ?, ?) " +
    "ON DUPLICATE KEY UPDATE `MOS` = ?, `current_price` = ?, `ti_suat_sinh_loi` = ?, `updated_at` = CURRENT_TIMESTAMP";

  const tiSuat = mos / currentPrice - 1;
  await pool.execute(sql, [
    stockCode, mos, currentPrice, tiSuat,
    mos, currentPrice, tiSuat,
  ]);
}
