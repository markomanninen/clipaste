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
      process.env.HEADLESS ||
      process.env.XVFB_RUN ||
      process.argv.includes('--headless')
    )
  }

  // On macOS, DISPLAY is not typically set, so don't check it
  if (process.platform === 'darwin') {
    return !!(
      process.env.CI ||
      process.env.HEADLESS ||
      process.env.XVFB_RUN ||
      process.argv.includes('--headless')
    )
  }

  // On Linux and other Unix-like systems, DISPLAY is a good indicator
  return !!(
    process.env.CI ||
    process.env.HEADLESS ||
    !process.env.DISPLAY ||
    process.env.XVFB_RUN ||
    process.argv.includes('--headless')
  )
}

module.exports = {
  isHeadlessEnvironment
}
