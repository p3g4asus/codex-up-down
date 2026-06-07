export function getExpectedMonthlyRemainingSales(
  monthlyForecast: number,
  referenceDate: Date = new Date(),
) {
  const year = referenceDate.getFullYear();
  const monthIndex = referenceDate.getMonth();
  const dayOfMonth = referenceDate.getDate();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const remainingDaysIncludingToday = Math.max(0, daysInMonth - dayOfMonth + 1);

  return (monthlyForecast * remainingDaysIncludingToday) / daysInMonth;
}

export function isBelowExpectedMonthlySalesPace(
  stock: number,
  monthlyForecast: number | null,
  referenceDate: Date = new Date(),
) {
  if (monthlyForecast === null) {
    return false;
  }

  const expectedRemaining = getExpectedMonthlyRemainingSales(monthlyForecast, referenceDate);
  return stock < expectedRemaining;
}
