import "dotenv/config";
import { postData } from "./GetReportDataDetailValue.js";

const listNorm = [53, 4305, 4375, 4377, 54, 55];
const BIEN_DO_MOS = 0.6;

export async function calMos(StockCode: string) {
    const result: any = await postData(StockCode);
    const knowleadgeData = result.data.filter((tmp: { ReportNormId: number }) =>
        listNorm.includes(tmp.ReportNormId)
    );
    const loiTruocThue = knowleadgeData.filter((tmp: { ReportNormId: number }) => tmp.ReportNormId === 4377)[0];
    const loiTruocThueNow = loiTruocThue.Value6;
    const loiTruocThuePast = loiTruocThue.Value1;
    const loiTruocThueGrow = Math.round(100 * ((loiTruocThueNow / loiTruocThuePast) ** (1 / 6) - 1));

    const eps = knowleadgeData.filter((tmp: { ReportNormId: number }) => tmp.ReportNormId === 53)[0];
    const epsNow = eps.Value6;
    const epsPast = eps.Value1;
    const epsGrow = Math.round(100 * ((epsNow / epsPast) ** (1 / 6) - 1));

    const bvps = knowleadgeData.filter((tmp: { ReportNormId: number }) => tmp.ReportNormId === 54)[0];
    const bvpsNow = bvps.Value6;
    const bvpsPast = bvps.Value1;
    const bvpsGrow = Math.round(100 * ((bvpsNow / bvpsPast) ** (1 / 8) - 1));

    const pe = knowleadgeData.filter((tmp: { ReportNormId: number }) => tmp.ReportNormId === 55)[0];
    const peAvg = (pe.Value1 + pe.Value2 + pe.Value3 + pe.Value4 + pe.Value5 + pe.Value6 ) / 6;

    const allGrow: number = (loiTruocThueGrow * 2 + epsGrow + bvpsGrow) / 4;
    const peFuture: number = (allGrow * 2 + peAvg) / 3;
    const mos: number = Math.round((epsNow * (1 + allGrow / 100) * peFuture) / 1.15) * BIEN_DO_MOS;

    return mos;
}
