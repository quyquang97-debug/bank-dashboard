import axios from "axios";

const url = "https://finance.vietstock.vn/company/tradinginfo";

const headers = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
    Connection: "keep-alive",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Cookie: process.env.VIETSTOCK_COOKIE as string,
    Origin: "https://finance.vietstock.vn",
    Referer: "https://finance.vietstock.vn/MBB-ngan-hang-tmcp-quan-doi.htm",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "sec-ch-ua": '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
};

const data = new URLSearchParams({
    code: "MBB",
    s: "0",
    t: "",
    __RequestVerificationToken: process.env.VIETSTOCK_TOKEN as string,
});

export async function GetTradeInfo(stockCode: string): Promise<number> {
    data.set("code", stockCode);
    const rs = await axios.post(url, data, { headers, timeout: 10_000 });
    return rs.data.LastPrice;
}
