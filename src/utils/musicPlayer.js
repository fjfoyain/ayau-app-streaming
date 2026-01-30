/**
 * Format time in seconds to MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
export function formatTime(seconds) {
  if (isNaN(seconds) || seconds === Infinity) {
    return '0:00'
  }

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}

/**
 * Format duration to readable format
 * @param {number} duration - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatDuration(duration) {
  const minute = Math.floor(duration / 60)
  const secondLeft = duration - minute * 60
  return `${minute}:${secondLeft < 10 ? `0${secondLeft}` : secondLeft}`
}
