import axios from "axios";
import qs from "qs";
import { getId } from "./GetIdList.js";

const url = "https://finance.vietstock.vn/data/GetReportDataDetailValue_BCTT_ByReportDataIds";

const headers = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
    Connection: "keep-alive",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Origin: "https://finance.vietstock.vn",
    Referer: "https://finance.vietstock.vn/tcb/tai-chinh.htm?tab=BCTT",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "sec-ch-ua": '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    Cookie: process.env.VIETSTOCK_COOKIE as string,
};

const START_YEAR = 2019;
const CURRENT_YEAR = 2025;

export const postData = async (StockCode: string) => {
    const result = await getId(StockCode);
    const idList: number[] = result.data
        .filter((tmp: { YearPeriod: number }) => tmp.YearPeriod >= START_YEAR)
        .map((x: { ReportDataID: any }) => x.ReportDataID);

    const data = qs.stringify({
        StockCode: StockCode,
        Unit: 1000000000,
        __RequestVerificationToken: process.env.VIETSTOCK_TOKEN as string,
        ...Object.fromEntries(
            Array.from({ length: CURRENT_YEAR - START_YEAR })
                .map((_, i) => {
                    const base = `listReportDataIds[${i}]`;
                    return [
                        [`${base}[Index]`, i],
                        [`${base}[ReportDataId]`, idList[i]],
                        [`${base}[IsShowData]`, true],
                        [`${base}[RowNumber]`, 18 + i],
                        [`${base}[YearPeriod]`, START_YEAR + i],
                        [`${base}[TotalCount]`, 24],
                        [`${base}[SortTimeType]`, "Time_ASC"],
                    ];
                })
                .flat()
        ),
    });

    try {
        const response = await axios.post(url, data, { headers, timeout: 10_000 });
        return response.data;
    } catch (error: any) {
        console.error("❌ Error:", error.response?.data || error.message);
        return null;
    }
};
