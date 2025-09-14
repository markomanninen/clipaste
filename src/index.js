#!/usr/bin/env node

const CLI = require('./cli');

async function main() {
  try {
    const cli = new CLI();
    await cli.run();
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = main;