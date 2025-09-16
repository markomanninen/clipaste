/**
 * Environment detection utilities
 *
 * Centralized logic for detecting headless/CI environments across the application
 */

/**
 * Detect if we're running in a headless/CI environment where clipboard may not work
 * @returns {boolean} true if headless/CI environment, false otherwise
 */
function isHeadlessEnvironment () {
  // Check for various CI/headless indicators
  if (process.platform === 'win32') {
    return !!(
      process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.HEADLESS ||
      process.env.XVFB_RUN ||
      process.argv.includes('--headless')
    )
  }

  // On macOS, DISPLAY is not typically set, so don't check it
  if (process.platform === 'darwin') {
    return !!(
      process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.HEADLESS ||
      process.env.XVFB_RUN ||
      process.argv.includes('--headless')
    )
  }

  // On Linux and other Unix-like systems, DISPLAY is a good indicator
  // but also check for xvfb which sets DISPLAY but doesn't have real clipboard
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.HEADLESS ||
    !process.env.DISPLAY ||
    process.env.XVFB_RUN ||
    process.argv.includes('--headless') ||
    // Detect xvfb virtual display (usually :99 or similar high numbers)
    (process.env.DISPLAY && /^:\d{2,}/.test(process.env.DISPLAY))
  )
}

module.exports = {
  isHeadlessEnvironment
}
