import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import { createErrorResponse } from './utils.js';
import { logger } from './logger.js';
import { TOOL_DEFINITIONS as CORE_TOOLS, handleToolCall as handleCoreToolCall } from './tools/core.js';
import { TOOL_DEFINITIONS as WORK_ITEMS_TOOLS, handleToolCall as handleWorkItemsToolCall } from './tools/work-items.js';
import { TOOL_DEFINITIONS as REPOSITORIES_TOOLS, handleToolCall as handleRepositoriesToolCall } from './tools/repositories.js';
import { TOOL_DEFINITIONS as BUILDS_TOOLS, handleToolCall as handleBuildsToolCall } from './tools/builds.js';
import { TOOL_DEFINITIONS as WORK_TOOLS, handleToolCall as handleWorkToolCall } from './tools/work.js';

const ALL_TOOLS = [...CORE_TOOLS, ...WORK_ITEMS_TOOLS, ...REPOSITORIES_TOOLS, ...BUILDS_TOOLS, ...WORK_TOOLS];
const TOOL_HANDLERS = [handleCoreToolCall, handleWorkItemsToolCall, handleRepositoriesToolCall, handleBuildsToolCall, handleWorkToolCall];

export async function configureAllTools(
  server: McpServer,
  connectionProvider: () => Promise<azdev.WebApi>,
  defaultProject?: string
) {
  logger.info('Configuring tools', { count: ALL_TOOLS.length, defaultProject });

  for (const toolDef of ALL_TOOLS) {
    server.registerTool(
      toolDef.name,
      { description: toolDef.description, inputSchema: toolDef.inputSchema },
      async (args: any) => {
        try {
          if (defaultProject && args.project) {
            return createErrorResponse(new Error(`ADO_PROJECT 已設定為 "${defaultProject}"，不允許再指定其他專案`));
          }
          const enrichedArgs = defaultProject
            ? { ...args, project: defaultProject }
            : args;
          for (const handler of TOOL_HANDLERS) {
            const result = await handler(toolDef.name, enrichedArgs, connectionProvider);
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
