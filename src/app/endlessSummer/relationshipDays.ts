export function relationshipDays(startDate: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  const [year, month, day] = startDate.split('-').map(Number);
  const start = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (!Number.isFinite(start) || start > today) return 0;
  return Math.floor((today - start) / 86_400_000) + 1;
}
