import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { banksRouter } from "./routes/banks.js";
import { rankingRouter } from "./routes/ranking.js";
import { periodsRouter } from "./routes/periods.js";

dotenv.config();

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use("/api/banks", banksRouter);
app.use("/api/ranking", rankingRouter);
app.use("/api/periods", periodsRouter);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`Backend running on :${PORT}`));
