/** Вычисление оставшегося времени по абсолютному сроку: не накапливает ошибку интервала. */
function remainingSeconds(deadlineMs, nowMs = Date.now()) {
  if (!Number.isFinite(deadlineMs)) return 0;
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}
function formatSeconds(seconds) {
  const v = Math.max(0, Math.floor(seconds) || 0);
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}
function durationFromParts(minutes, seconds) {
  const m = Number(minutes), s = Number(seconds);
  if (!Number.isInteger(m) || !Number.isInteger(s) || m < 0 || m > 99 || s < 0 || s > 59 || (m === 0 && s === 0)) return null;
  return m * 60 + s;
}
module.exports = { remainingSeconds, formatSeconds, durationFromParts };
