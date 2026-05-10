export interface WindowResult {
    year: number;
    quarter: number;
    lastDay: number;
    isLastDay: boolean;
}

export function detectWindow(date?: Date): WindowResult | null {
    const today = date ?? new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const currentYear = today.getFullYear();

    let year: number;
    let quarter: number;
    let lastDay: number;

    if (month === 3 && day >= 15 && day <= 31) {
        year = currentYear - 1;
        quarter = 0;
        lastDay = 31;
    } else if (month === 1 && day >= 15 && day <= 31) {
        year = currentYear - 1;
        quarter = 4;
        lastDay = 31;
    } else if (month === 4 && day >= 15 && day <= 30) {
        year = currentYear;
        quarter = 1;
        lastDay = 30;
    } else if (month === 7 && day >= 15 && day <= 31) {
        year = currentYear;
        quarter = 2;
        lastDay = 31;
    } else if (month === 10 && day >= 15 && day <= 31) {
        year = currentYear;
        quarter = 3;
        lastDay = 31;
    } else {
        return null;
    }

    return { year, quarter, lastDay, isLastDay: day === lastDay };
}
