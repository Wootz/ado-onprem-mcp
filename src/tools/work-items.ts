import * as azdev from 'azure-devops-node-api';
import { createSuccessResponse } from '../utils.js';
import { logger } from '../logger.js';
import type * as WorkItemTrackingInterfaces from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js';

// JSON Patch operation types
enum Operation {
  Add = 0,
  Remove = 1,
  Replace = 2,
  Move = 3,
  Copy = 4,
  Test = 5,
}

interface JsonPatchOperation {
  op: Operation;
  path: string;
  value?: any;
  from?: string;
}

export const TOOL_DEFINITIONS = [
  {
    name: 'mcp_ado_work_items_get',
    description: 'Get work item by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Work item ID' },
        expand: {
          type: 'string',
          enum: ['None', 'Relations', 'Fields', 'Links', 'All'],
          description: 'Expansion level for work item',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'mcp_ado_work_items_create',
    description: 'Create a new work item',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name or ID' },
        type: { type: 'string', description: 'Work item type (e.g., Bug, Task, User Story)' },
        title: { type: 'string', description: 'Work item title' },
        description: { type: 'string', description: 'Work item description' },
        assignedTo: { type: 'string', description: 'Assigned to (email or display name)' },
        areaPath: { type: 'string', description: 'Area path' },
        iterationPath: { type: 'string', description: 'Iteration path' },
        fields: {
          type: 'object',
          description: 'Additional fields as key-value pairs',
        },
      },
      required: ['project', 'type', 'title'],
    },
  },
  {
    name: 'mcp_ado_work_items_update',
    description: 'Update an existing work item',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Work item ID' },
        fields: {
          type: 'object',
          description: 'Fields to update as key-value pairs',
        },
      },
      required: ['id', 'fields'],
    },
  },
  {
    name: 'mcp_ado_work_items_delete',
    description: 'Delete a work item',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Work item ID' },
        destroy: {
          type: 'boolean',
          description: 'Permanently destroy the work item (default: false)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'mcp_ado_work_items_query_by_wiql',
    description: 'Query work items using WIQL (Work Item Query Language)',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name or ID' },
        query: { type: 'string', description: 'WIQL query string' },
        top: { type: 'number', description: 'Maximum number of results' },
      },
      required: ['project', 'query'],
    },
  },
  {
    name: 'mcp_ado_work_items_add_comment',
    description: 'Add a comment to a work item',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name or ID' },
        workItemId: { type: 'number', description: 'Work item ID' },
        text: { type: 'string', description: 'Comment text' },
      },
      required: ['project', 'workItemId', 'text'],
    },
  },
  {
    name: 'mcp_ado_work_items_get_comments',
    description: 'Get comments for a work item',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name or ID' },
        workItemId: { type: 'number', description: 'Work item ID' },
        top: { type: 'number', description: 'Maximum number of comments' },
      },
      required: ['project', 'workItemId'],
    },
  },
  {
    name: 'mcp_ado_work_items_add_link',
    description: 'Add a link between work items',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Source work item ID' },
        targetId: { type: 'number', description: 'Target work item ID' },
        linkType: {
          type: 'string',
          description: 'Link type (e.g., Related, Parent, Child)',
        },
        comment: { type: 'string', description: 'Link comment' },
      },
      required: ['id', 'targetId', 'linkType'],
    },
  },
  {
    name: 'mcp_ado_work_items_get_updates',
    description: 'Get revision history for a work item',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Work item ID' },
        top: { type: 'number', description: 'Maximum number of updates' },
      },
      required: ['id'],
    },
  },
  {
    name: 'mcp_ado_work_items_batch_get',
    description: 'Get multiple work items by IDs',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of work item IDs',
        },
        expand: {
          type: 'string',
          enum: ['None', 'Relations', 'Fields', 'Links', 'All'],
          description: 'Expansion level',
        },
      },
      required: ['ids'],
    },
  },
];

export async function handleToolCall(
  name: string,
  args: any,
  connectionProvider: () => Promise<azdev.WebApi>
): Promise<any> {
  const connection = await connectionProvider();
  const witApi = await connection.getWorkItemTrackingApi();

  switch (name) {
    case 'mcp_ado_work_items_get': {
      logger.info('Executing mcp_ado_work_items_get', args);
      const { id, expand } = args as { id: number; expand?: string };

      const expandEnum = expand as WorkItemTrackingInterfaces.WorkItemExpand | undefined;
      const workItem = await witApi.getWorkItem(id, undefined, undefined, expandEnum);

      return createSuccessResponse(workItem);
    }

    case 'mcp_ado_work_items_create': {
      logger.info('Executing mcp_ado_work_items_create', args);
      const { project, type, title, description, assignedTo, areaPath, iterationPath, fields } =
        args as {
          project: string;
          type: string;
          title: string;
          description?: string;
          assignedTo?: string;
          areaPath?: string;
          iterationPath?: string;
          fields?: Record<string, unknown>;
        };

      const document: JsonPatchOperation[] = [
        {
          op: Operation.Add,
          path: '/fields/System.Title',
          value: title,
        },
      ];

      if (description) {
        document.push({
          op: Operation.Add,
          path: '/fields/System.Description',
          value: description,
        });
      }

      if (assignedTo) {
        document.push({
          op: Operation.Add,
          path: '/fields/System.AssignedTo',
          value: assignedTo,
        });
      }

      if (areaPath) {
        document.push({
          op: Operation.Add,
          path: '/fields/System.AreaPath',
          value: areaPath,
        });
      }

      if (iterationPath) {
        document.push({
          op: Operation.Add,
          path: '/fields/System.IterationPath',
          value: iterationPath,
        });
      }

      if (fields) {
        Object.entries(fields).forEach(([key, value]) => {
          document.push({
            op: Operation.Add,
            path: `/fields/${key}`,
            value,
          });
        });
      }

      const workItem = await witApi.createWorkItem(
        undefined,
        document,
        project,
        type
      );

      return createSuccessResponse(workItem);
    }

    case 'mcp_ado_work_items_update': {
      logger.info('Executing mcp_ado_work_items_update', args);
      const { id, fields } = args as {
        id: number;
        fields: Record<string, unknown>;
      };

      const document: JsonPatchOperation[] = [];

      Object.entries(fields).forEach(([key, value]) => {
        document.push({
          op: Operation.Add,
          path: `/fields/${key}`,
          value,
        });
      });

      const workItem = await witApi.updateWorkItem(undefined, document, id);

      return createSuccessResponse(workItem);
    }

    case 'mcp_ado_work_items_delete': {
      logger.info('Executing mcp_ado_work_items_delete', args);
      const { id, destroy } = args as { id: number; destroy?: boolean };

      const result = await witApi.deleteWorkItem(id, undefined, destroy);

      return createSuccessResponse({
        deleted: true,
        id,
        result,
      });
    }

    case 'mcp_ado_work_items_query_by_wiql': {
      logger.info('Executing mcp_ado_work_items_query_by_wiql', args);
      const { project, query, top } = args as {
        project: string;
        query: string;
        top?: number;
      };

      const wiql: WorkItemTrackingInterfaces.Wiql = {
        query,
      };

      const teamContext = { project, team: undefined };
      const result = await witApi.queryByWiql(wiql, teamContext, undefined, top);

      // Get full work items if IDs are returned
      if (result.workItems && result.workItems.length > 0) {
        const ids = result.workItems.map((wi) => wi.id!);
        const workItems = await witApi.getWorkItems(ids);

        return createSuccessResponse({
          query: result,
          workItems,
        });
      }

      return createSuccessResponse(result);
    }

    case 'mcp_ado_work_items_add_comment': {
      logger.info('Executing mcp_ado_work_items_add_comment', args);
      const { project, workItemId, text } = args as {
        project: string;
        workItemId: number;
        text: string;
      };

      const comment = await witApi.addComment(
        { text },
        project,
        workItemId
      );

      return createSuccessResponse(comment);
    }

    case 'mcp_ado_work_items_get_comments': {
      logger.info('Executing mcp_ado_work_items_get_comments', args);
      const { project, workItemId, top } = args as {
        project: string;
        workItemId: number;
        top?: number;
      };

      const comments = await witApi.getComments(project, workItemId, top);

      return createSuccessResponse(comments);
    }

    case 'mcp_ado_work_items_add_link': {
      logger.info('Executing mcp_ado_work_items_add_link', args);
      const { id, targetId, linkType, comment } = args as {
        id: number;
        targetId: number;
        linkType: string;
        comment?: string;
      };

      const document: JsonPatchOperation[] = [
        {
          op: Operation.Add,
          path: '/relations/-',
          value: {
            rel: linkType,
            url: targetId,
            attributes: comment ? { comment } : undefined,
          },
        },
      ];

      const workItem = await witApi.updateWorkItem(undefined, document, id);

      return createSuccessResponse(workItem);
    }

    case 'mcp_ado_work_items_get_updates': {
      logger.info('Executing mcp_ado_work_items_get_updates', args);
      const { id, top } = args as { id: number; top?: number };

      const updates = await witApi.getUpdates(id, top);

      return createSuccessResponse(updates);
    }

    case 'mcp_ado_work_items_batch_get': {
      logger.info('Executing mcp_ado_work_items_batch_get', args);
      const { ids, expand } = args as { ids: number[]; expand?: string };

      const expandEnum = expand as WorkItemTrackingInterfaces.WorkItemExpand | undefined;
      const workItems = await witApi.getWorkItems(ids, undefined, undefined, expandEnum);

      return createSuccessResponse(workItems);
    }

    default:
      return null; // Not handled by this module
  }
}
