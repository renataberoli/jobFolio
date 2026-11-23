type SummaryEntry = { status: string; createdAt: string; easyApply?: boolean; manuallyApplied?: boolean };

export function getApplicationSummary(entries: SummaryEntry[], now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  let applicationsToday = 0;
  let applicationsThisWeek = 0;
  let interviews = 0;
  let rejected = 0;
  const todayMethods = { easyApply: 0, manuallyApplied: 0 };
  const weekMethods = { easyApply: 0, manuallyApplied: 0 };
  const interviewMethods = { easyApply: 0, manuallyApplied: 0 };
  const rejectedMethods = { easyApply: 0, manuallyApplied: 0 };
  for (const entry of entries) {
    if (entry.status === "Rejected") {
      rejected++;
      if (entry.easyApply) rejectedMethods.easyApply++;
      if (entry.manuallyApplied) rejectedMethods.manuallyApplied++;
    }
    if (entry.status === "Interview") {
      interviews++;
      if (entry.easyApply) interviewMethods.easyApply++;
      if (entry.manuallyApplied) interviewMethods.manuallyApplied++;
    }
    const createdAt = new Date(entry.createdAt);
    if (entry.status === "Applied" && createdAt >= today && createdAt < tomorrow) {
      applicationsToday++;
      if (entry.easyApply) todayMethods.easyApply++;
      if (entry.manuallyApplied) todayMethods.manuallyApplied++;
    }
    if (createdAt >= weekStart && createdAt < weekEnd) {
      applicationsThisWeek++;
      if (entry.easyApply) weekMethods.easyApply++;
      if (entry.manuallyApplied) weekMethods.manuallyApplied++;
    }
  }
  return { applicationsToday, applicationsThisWeek, todayMethods, weekMethods, interviews, interviewMethods, rejected, rejectedMethods };
}
