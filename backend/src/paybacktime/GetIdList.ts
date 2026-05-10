import axios from "axios";
import qs from "qs";

const url = "https://finance.vietstock.vn/data/BCTT_GetListReportData";

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

const postData = {
    StockCode: "TCB",
    UnitedId: -1,
    AuditedStatusId: -1,
    Unit: 1000000000,
    IsNamDuongLich: false,
    PeriodType: "NAM",
    SortTimeType: "Time_ASC",
    __RequestVerificationToken: process.env.VIETSTOCK_TOKEN as string,
};

export const getId = async (StockCode: string) => {
    postData.StockCode = StockCode;
    try {
        const response = await axios.post(url, qs.stringify(postData), { headers, timeout: 10_000 });
        return response.data;
    } catch (error: any) {
        console.error("❌ Error:", error.response?.data || error.message);
        return null;
    }
};
