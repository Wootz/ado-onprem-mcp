import * as azdev from 'azure-devops-node-api';
import { z } from 'zod';
import { createSuccessResponse } from '../utils.js';
import { logger } from '../logger.js';

export const TOOL_DEFINITIONS = [
  {
    name: 'mcp_ado_work_list_iterations',
    description: 'List iterations (sprints) for a team',
    inputSchema: z.object({
      project: z.string().optional().describe('Project name or ID (uses ADO_PROJECT env var if not specified)'),
      team: z.string().optional().describe('Team name (defaults to project default team)'),
      timeframe: z
        .enum(['past', 'current', 'future'])
        .optional()
        .describe('Filter by timeframe relative to today'),
    }),
  },
  {
    name: 'mcp_ado_work_get_iteration_work_items',
    description: 'Get work items assigned to a specific iteration (sprint)',
    inputSchema: z.object({
      project: z.string().optional().describe('Project name or ID (uses ADO_PROJECT env var if not specified)'),
      team: z.string().optional().describe('Team name (defaults to project default team)'),
      iterationId: z.string().describe('Iteration ID (GUID) from mcp_ado_work_list_iterations'),
    }),
  },
  {
    name: 'mcp_ado_work_list_backlogs',
    description: 'List backlog levels configured for a team (e.g., Epics, Features, Stories)',
    inputSchema: z.object({
      project: z.string().optional().describe('Project name or ID (uses ADO_PROJECT env var if not specified)'),
      team: z.string().optional().describe('Team name (defaults to project default team)'),
    }),
  },
];

export async function handleToolCall(
  name: string,
  args: any,
  connectionProvider: () => Promise<azdev.WebApi>
): Promise<any> {
  const connection = await connectionProvider();
  const workApi = await connection.getWorkApi();

  switch (name) {
    case 'mcp_ado_work_list_iterations': {
      logger.info('Executing mcp_ado_work_list_iterations', args);
      const { project, team, timeframe } = args as {
        project: string;
        team?: string;
        timeframe?: string;
      };
      const teamContext = { project, team };
      const iterations = await workApi.getTeamIterations(teamContext, timeframe);
      return createSuccessResponse(iterations);
    }

    case 'mcp_ado_work_get_iteration_work_items': {
      logger.info('Executing mcp_ado_work_get_iteration_work_items', args);
      const { project, team, iterationId } = args as {
        project: string;
        team?: string;
        iterationId: string;
      };
      const teamContext = { project, team };
      const items = await workApi.getIterationWorkItems(teamContext, iterationId);
      return createSuccessResponse(items);
    }

    case 'mcp_ado_work_list_backlogs': {
      logger.info('Executing mcp_ado_work_list_backlogs', args);
      const { project, team } = args as {
        project: string;
        team?: string;
      };
      const teamContext = { project, team };
      const backlogs = await workApi.getBacklogs(teamContext);
      return createSuccessResponse(backlogs);
    }

    default:
      return null;
  }
}
