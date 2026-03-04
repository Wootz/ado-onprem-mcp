import * as azdev from 'azure-devops-node-api';
import { z } from 'zod';
import { createSuccessResponse } from '../utils.js';
import { logger } from '../logger.js';

// Build status enum values
const BUILD_STATUS: Record<string, number> = {
  none: 0,
  inProgress: 1,
  completed: 2,
  cancelling: 4,
  postponed: 8,
  notStarted: 32,
  all: 47,
};

// Build result enum values
const BUILD_RESULT: Record<string, number> = {
  none: 0,
  succeeded: 2,
  partiallySucceeded: 4,
  failed: 8,
  canceled: 32,
};

export const TOOL_DEFINITIONS = [
  {
    name: 'mcp_ado_builds_list_definitions',
    description: 'List build definitions (pipelines) for a project',
    inputSchema: z.object({
      project: z.string().optional().describe('Project name or ID (uses ADO_PROJECT env var if not specified)'),
      name: z.string().optional().describe('Filter by definition name (supports wildcards)'),
      top: z.number().optional().describe('Maximum number of definitions to return'),
    }),
  },
  {
    name: 'mcp_ado_builds_list',
    description: 'List builds for a project with optional filters',
    inputSchema: z.object({
      project: z.string().optional().describe('Project name or ID (uses ADO_PROJECT env var if not specified)'),
      definitionId: z.number().optional().describe('Build definition ID filter'),
      statusFilter: z
        .enum(['none', 'inProgress', 'completed', 'cancelling', 'postponed', 'notStarted', 'all'])
        .optional()
        .describe('Build status filter'),
      resultFilter: z
        .enum(['none', 'succeeded', 'partiallySucceeded', 'failed', 'canceled'])
        .optional()
        .describe('Build result filter'),
      branchName: z.string().optional().describe('Branch name filter (e.g., refs/heads/main)'),
      top: z.number().optional().describe('Maximum number of builds to return'),
    }),
  },
  {
    name: 'mcp_ado_builds_get',
    description: 'Get details of a specific build by ID',
    inputSchema: z.object({
      project: z.string().optional().describe('Project name or ID (uses ADO_PROJECT env var if not specified)'),
      buildId: z.number().describe('Build ID'),
    }),
  },
  {
    name: 'mcp_ado_builds_queue',
    description: 'Queue (trigger) a new build for a definition',
    inputSchema: z.object({
      project: z.string().optional().describe('Project name or ID (uses ADO_PROJECT env var if not specified)'),
      definitionId: z.number().describe('Build definition ID'),
      sourceBranch: z
        .string()
        .optional()
        .describe('Source branch (e.g., refs/heads/main). Defaults to definition default branch.'),
      parameters: z
        .string()
        .optional()
        .describe('Build parameters as a JSON string, e.g. {"param1":"value1"}'),
    }),
  },
  {
    name: 'mcp_ado_builds_get_logs',
    description:
      'Get log list for a build, or specific log lines when logId is provided',
    inputSchema: z.object({
      project: z.string().optional().describe('Project name or ID (uses ADO_PROJECT env var if not specified)'),
      buildId: z.number().describe('Build ID'),
      logId: z
        .number()
        .optional()
        .describe('Log ID to retrieve log lines. Omit to list all available logs.'),
    }),
  },
];

export async function handleToolCall(
  name: string,
  args: any,
  connectionProvider: () => Promise<azdev.WebApi>
): Promise<any> {
  const connection = await connectionProvider();
  const buildApi = await connection.getBuildApi();

  switch (name) {
    case 'mcp_ado_builds_list_definitions': {
      logger.info('Executing mcp_ado_builds_list_definitions', args);
      const { project, name: defName, top } = args as {
        project: string;
        name?: string;
        top?: number;
      };
      const definitions = await buildApi.getDefinitions(
        project,
        defName,
        undefined, // repositoryId
        undefined, // repositoryType
        undefined, // queryOrder
        top
      );
      return createSuccessResponse(definitions);
    }

    case 'mcp_ado_builds_list': {
      logger.info('Executing mcp_ado_builds_list', args);
      const { project, definitionId, statusFilter, resultFilter, branchName, top } = args as {
        project: string;
        definitionId?: number;
        statusFilter?: string;
        resultFilter?: string;
        branchName?: string;
        top?: number;
      };
      const definitions = definitionId ? [definitionId] : undefined;
      const status = statusFilter ? BUILD_STATUS[statusFilter] : undefined;
      const result = resultFilter ? BUILD_RESULT[resultFilter] : undefined;
      const builds = await buildApi.getBuilds(
        project,
        definitions,
        undefined, // queues
        undefined, // buildNumber
        undefined, // minTime
        undefined, // maxTime
        undefined, // requestedFor
        undefined, // reasonFilter
        status as any,
        result as any,
        undefined, // tagFilters
        undefined, // properties
        top,
        undefined, // continuationToken
        undefined, // maxBuildsPerDefinition
        undefined, // deletedFilter
        undefined, // queryOrder
        branchName
      );
      return createSuccessResponse(builds);
    }

    case 'mcp_ado_builds_get': {
      logger.info('Executing mcp_ado_builds_get', args);
      const { project, buildId } = args as { project: string; buildId: number };
      const build = await buildApi.getBuild(project, buildId);
      return createSuccessResponse(build);
    }

    case 'mcp_ado_builds_queue': {
      logger.info('Executing mcp_ado_builds_queue', args);
      const { project, definitionId, sourceBranch, parameters } = args as {
        project: string;
        definitionId: number;
        sourceBranch?: string;
        parameters?: string;
      };
      const build: any = {
        definition: { id: definitionId },
        sourceBranch,
        parameters,
      };
      const queued = await buildApi.queueBuild(build, project);
      return createSuccessResponse(queued);
    }

    case 'mcp_ado_builds_get_logs': {
      logger.info('Executing mcp_ado_builds_get_logs', args);
      const { project, buildId, logId } = args as {
        project: string;
        buildId: number;
        logId?: number;
      };
      if (logId !== undefined) {
        const logLines = await buildApi.getBuildLogLines(project, buildId, logId);
        return createSuccessResponse({ logId, lines: logLines });
      }
      const logs = await buildApi.getBuildLogs(project, buildId);
      return createSuccessResponse(logs);
    }

    default:
      return null;
  }
}
