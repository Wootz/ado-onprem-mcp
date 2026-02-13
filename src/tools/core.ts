import * as azdev from 'azure-devops-node-api';
import { z } from 'zod';
import { createSuccessResponse } from '../utils.js';
import { logger } from '../logger.js';

export const TOOL_DEFINITIONS = [
  {
    name: 'mcp_ado_core_list_projects',
    description: 'List all projects in the Azure DevOps collection',
    inputSchema: z.object({
      stateFilter: z.enum(['all', 'wellFormed', 'deleting', 'new', 'unchanged']).optional().describe('Filter projects by state (default: all)'),
      top: z.number().optional().describe('Maximum number of projects to return'),
      skip: z.number().optional().describe('Number of projects to skip'),
    }),
  },
];

export async function handleToolCall(
  name: string,
  args: any,
  connectionProvider: () => Promise<azdev.WebApi>
): Promise<any> {
  const connection = await connectionProvider();

  switch (name) {
    case 'mcp_ado_core_list_projects': {
      logger.info('Executing mcp_ado_core_list_projects', args);
      const coreApi = await connection.getCoreApi();
      const { stateFilter, top, skip } = args as {
        stateFilter?: string;
        top?: number;
        skip?: number;
      };

      const projects = await coreApi.getProjects(stateFilter as any, top, skip);

      return createSuccessResponse({
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          url: p.url,
          state: p.state,
          visibility: p.visibility,
          lastUpdateTime: p.lastUpdateTime,
        })),
        count: projects.length,
      });
    }

    default:
      return null; // Not handled by this module
  }
}
