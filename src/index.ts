#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { createConnection, getTokenFromEnv } from './auth.js';
import { createServer, startServer } from './server.js';
import { logger } from './logger.js';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('log-level', {
      describe: 'Logging level',
      type: 'string',
      choices: ['error', 'warn', 'info', 'debug'],
      default: 'info',
    })
    .help()
    .alias('help', 'h')
    .version()
    .alias('version', 'v')
    .example(
      '$0',
      'Start the MCP server (requires ADO_SERVER_URL env var)'
    )
    .parse();

  // Set log level
  logger.level = argv['log-level'];

  // Get server URL from environment
  const serverUrl = process.env.ADO_SERVER_URL;
  if (!serverUrl) {
    logger.error('ADO_SERVER_URL environment variable is required');
    console.error('Error: ADO_SERVER_URL environment variable is required');
    console.error('Example: export ADO_SERVER_URL="https://tfs.company.com/DefaultCollection"');
    process.exit(1);
  }

  logger.info('Starting Azure DevOps On-Premises MCP Server', {
    serverUrl,
  });

  try {
    const token = getTokenFromEnv();
    const connection = await createConnection(serverUrl, token);
    const server = await createServer({ connection });
    await startServer(server);
  } catch (error) {
    logger.error('Failed to start server', { error });
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Unhandled error', { error });
  console.error('Fatal error:', error);
  process.exit(1);
});
