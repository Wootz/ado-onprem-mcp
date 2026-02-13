import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as azdev from 'azure-devops-node-api';
import { logger } from './logger.js';
import { VERSION, SERVER_NAME } from './version.js';
import { configureAllTools } from './tools.js';

export interface ServerOptions {
  connection: azdev.WebApi;
}

export async function createServer(options: ServerOptions): Promise<McpServer> {
  const { connection } = options;

  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  await configureAllTools(server, async () => connection);

  return server;
}

/**
 * Starts the MCP server
 */
export async function startServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Azure DevOps On-Premises MCP Server started', {
    version: VERSION,
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down server');
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down server');
    await server.close();
    process.exit(0);
  });
}
