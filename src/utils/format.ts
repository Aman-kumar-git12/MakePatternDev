/** "45m" / "2h 5m" */
export const formatMinutes = (minutes: number | undefined | null) => {
  const m = Math.max(0, Math.round(minutes || 0));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};
