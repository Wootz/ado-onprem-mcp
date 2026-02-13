import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import { createErrorResponse } from './utils.js';
import { logger } from './logger.js';
import { TOOL_DEFINITIONS as CORE_TOOLS, handleToolCall as handleCoreToolCall } from './tools/core.js';
import { TOOL_DEFINITIONS as WORK_ITEMS_TOOLS, handleToolCall as handleWorkItemsToolCall } from './tools/work-items.js';
import { TOOL_DEFINITIONS as REPOSITORIES_TOOLS, handleToolCall as handleRepositoriesToolCall } from './tools/repositories.js';

const ALL_TOOLS = [...CORE_TOOLS, ...WORK_ITEMS_TOOLS, ...REPOSITORIES_TOOLS];
const TOOL_HANDLERS = [handleCoreToolCall, handleWorkItemsToolCall, handleRepositoriesToolCall];

export async function configureAllTools(
  server: McpServer,
  connectionProvider: () => Promise<azdev.WebApi>
) {
  logger.info('Configuring tools', { count: ALL_TOOLS.length });

  for (const toolDef of ALL_TOOLS) {
    server.registerTool(
      toolDef.name,
      { description: toolDef.description, inputSchema: toolDef.inputSchema },
      async (args: any) => {
        try {
          for (const handler of TOOL_HANDLERS) {
            const result = await handler(toolDef.name, args, connectionProvider);
            if (result !== null) return result;
          }
          throw new Error(`Unknown tool: ${toolDef.name}`);
        } catch (error) {
          logger.error('Tool failed', { name: toolDef.name, error });
          return createErrorResponse(error);
        }
      }
    );
  }

  logger.info('Tools configured');
}
