import * as azdev from 'azure-devops-node-api';
import { z } from 'zod';
import { createSuccessResponse, createWorkItemResponse } from '../utils.js';
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

const PARENT_REL = 'System.LinkTypes.Hierarchy-Reverse';

/**
 * 友善連結名稱對照表。ADO 只接受完整的 System.LinkTypes.* 名稱，
 * 但工具描述向來承諾 Parent / Child / Related 可用，這裡補上轉換。
 */
const REL_ALIASES: Record<string, string> = {
  Parent: PARENT_REL,
  Child: 'System.LinkTypes.Hierarchy-Forward',
  Related: 'System.LinkTypes.Related',
  Duplicate: 'System.LinkTypes.Duplicate-Forward',
  DuplicateOf: 'System.LinkTypes.Duplicate-Reverse',
  Successor: 'System.LinkTypes.Dependency-Forward',
  Predecessor: 'System.LinkTypes.Dependency-Reverse',
};

/**
 * ADO 的階層是關聯不是欄位。System.Parent 為唯讀計算欄位，
 * 用 /fields/ patch 寫入會被伺服器「接受並忽略」，靜默失敗。
 */
const READONLY_RELATION_FIELDS = new Set(['System.Parent']);

function resolveRelType(linkType: string): string {
  const rel = REL_ALIASES[linkType] ?? linkType;
  if (!rel.startsWith('System.LinkTypes.') && !rel.startsWith('Microsoft.VSTS.')) {
    throw new Error(
      `未知的連結型別 "${linkType}"。可用的友善名稱：${Object.keys(REL_ALIASES).join(', ')}，` +
        `或直接提供完整名稱（例如 System.LinkTypes.Hierarchy-Reverse）。`
    );
  }
  return rel;
}

/**
 * 組出 work item 的完整 URL。ADO 建立連結時要求完整位址，裸 ID 會被拒絕。
 */
function workItemUrl(connection: azdev.WebApi, project: string | undefined, id: number): string {
  const base = connection.serverUrl.replace(/\/+$/, '');
  const scope = project ? `${base}/${encodeURIComponent(project)}` : base;
  return `${scope}/_apis/wit/workItems/${id}`;
}

/**
 * 攔截 fields 內的唯讀關聯欄位，避免靜默丟棄。
 */
function assertNoReadonlyRelationFields(fields: Record<string, unknown> | undefined) {
  if (!fields) return;
  for (const key of Object.keys(fields)) {
    if (READONLY_RELATION_FIELDS.has(key)) {
      throw new Error(
        `"${key}" 是唯讀計算欄位，放在 fields 內會被 ADO 靜默忽略、父子關係不會建立。` +
          `請改用 parentId 參數，或以 add_link 建立連結。`
      );
    }
  }
}

/**
 * ADO API 不接受同時指定 fields 與 expand，會直接回錯。先擋下並給明確訊息。
 */
function assertFieldsExpandExclusive(fields: string[] | undefined, expand: string | undefined) {
  if (fields?.length && expand && expand !== 'None') {
    throw new Error('fields 與 expand 不可同時使用，請擇一（需要 relations 時改用 expand）。');
  }
}

function buildParentRelationPatch(
  connection: azdev.WebApi,
  project: string | undefined,
  parentId: number
): JsonPatchOperation {
  return {
    op: Operation.Add,
    path: '/relations/-',
    value: {
      rel: PARENT_REL,
      url: workItemUrl(connection, project, parentId),
    },
  };
}

/**
 * WIQL 的 project 篩選取決於查詢本身是否含 System.TeamProject 條件，
 * teamContext 不足以強制篩選。未帶條件時自動注入，避免拿到跨專案資料。
 */
export function injectProjectFilter(query: string, project: string | undefined): string {
  if (!project) return query;
  if (/\[?System\.TeamProject\]?/i.test(query)) return query;

  const clause = `[System.TeamProject] = '${project.replace(/'/g, "''")}'`;
  const whereMatch = query.match(/\bWHERE\b/i);

  if (whereMatch) {
    const idx = whereMatch.index!;
    const head = query.slice(0, idx + whereMatch[0].length);
    const tail = query.slice(idx + whereMatch[0].length);
    return `${head} ${clause} AND (${tail.trim()})`;
  }

  // 沒有 WHERE：插在 ORDER BY / ASOF 之前，否則接在最後
  const tailMatch = query.match(/\b(ORDER\s+BY|ASOF)\b/i);
  if (tailMatch) {
    const idx = tailMatch.index!;
    return `${query.slice(0, idx).trimEnd()} WHERE ${clause} ${query.slice(idx)}`;
  }

  return `${query.trimEnd()} WHERE ${clause}`;
}

export const TOOL_DEFINITIONS = [
  {
    name: 'mcp_ado_work_items_get',
    description: 'Get work item by ID',
    inputSchema: z.object({
      id: z.number().describe('Work item ID'),
      expand: z.enum(['None', 'Relations', 'Fields', 'Links', 'All']).optional().describe('Expansion level for work item'),
      fields: z.array(z.string()).optional().describe('Only return these fields (e.g., System.Id, System.Title). Cannot be combined with expand.'),
      raw: z.boolean().optional().describe('Return full identity objects instead of the trimmed displayName/uniqueName (default: false)'),
    }),
  },
  {
    name: 'mcp_ado_work_items_create',
    description: 'Create a new work item',
    inputSchema: z.object({
      project: z.string().optional().describe('Project name or ID (uses ADO_PROJECT env var if not specified)'),
      type: z.string().describe('Work item type (e.g., Bug, Task, User Story)'),
      title: z.string().describe('Work item title'),
      description: z.string().optional().describe('Work item description'),
      assignedTo: z.string().optional().describe('Assigned to (email or display name)'),
      areaPath: z.string().optional().describe('Area path'),
      iterationPath: z.string().optional().describe('Iteration path'),
      parentId: z.number().optional().describe('Parent work item ID. Creates the hierarchy link; do NOT put System.Parent in fields.'),
      fields: z.record(z.string(), z.unknown()).optional().describe('Additional fields as key-value pairs. System.Parent is rejected here - use parentId.'),
      raw: z.boolean().optional().describe('Return full identity objects instead of the trimmed displayName/uniqueName (default: false)'),
    }),
  },
  {
    name: 'mcp_ado_work_items_update',
    description: 'Update an existing work item',
    inputSchema: z.object({
      id: z.number().describe('Work item ID'),
      fields: z.record(z.string(), z.unknown()).optional().describe('Fields to update as key-value pairs. System.Parent is rejected here - use parentId.'),
      parentId: z.number().optional().describe('Parent work item ID. Adds the hierarchy link; do NOT put System.Parent in fields.'),
      project: z.string().optional().describe('Project name or ID, used to build the parent link URL (uses ADO_PROJECT env var if not specified)'),
      raw: z.boolean().optional().describe('Return full identity objects instead of the trimmed displayName/uniqueName (default: false)'),
    }),
  },
  {
    name: 'mcp_ado_work_items_delete',
    description: 'Delete a work item',
    inputSchema: z.object({
      id: z.number().describe('Work item ID'),
      destroy: z.boolean().optional().describe('Permanently destroy the work item (default: false)'),
    }),
  },
  {
    name: 'mcp_ado_work_items_query_by_wiql',
    description:
      'Query work items using WIQL (Work Item Query Language). When a project is configured and the query has no ' +
      '[System.TeamProject] clause, one is injected automatically so results stay within that project.',
    inputSchema: z.object({
      project: z.string().optional().describe('Project name or ID (uses ADO_PROJECT env var if not specified)'),
      query: z.string().describe('WIQL query string'),
      top: z.number().optional().describe('Maximum number of results'),
      expand: z.enum(['None', 'Relations', 'Fields', 'Links', 'All']).optional().describe('Expansion level for the fetched work items (default: Relations, so System.Parent is visible). Cannot be combined with fields.'),
      fields: z.array(z.string()).optional().describe('Only return these fields (e.g., System.Id, System.Title, System.Parent). Cannot be combined with expand.'),
      raw: z.boolean().optional().describe('Return full identity objects instead of the trimmed displayName/uniqueName (default: false)'),
    }),
  },
  {
    name: 'mcp_ado_work_items_add_comment',
    description: 'Add a comment to a work item',
    inputSchema: z.object({
      project: z.string().optional().describe('Project name or ID (uses ADO_PROJECT env var if not specified)'),
      workItemId: z.number().describe('Work item ID'),
      text: z.string().describe('Comment text'),
    }),
  },
  {
    name: 'mcp_ado_work_items_get_comments',
    description: 'Get comments for a work item',
    inputSchema: z.object({
      project: z.string().optional().describe('Project name or ID (uses ADO_PROJECT env var if not specified)'),
      workItemId: z.number().describe('Work item ID'),
      top: z.number().optional().describe('Maximum number of comments'),
    }),
  },
  {
    name: 'mcp_ado_work_items_add_link',
    description: 'Add a link between work items',
    inputSchema: z.object({
      id: z.number().describe('Source work item ID'),
      targetId: z.number().describe('Target work item ID'),
      linkType: z.string().describe('Link type: friendly name (Parent, Child, Related, Duplicate, DuplicateOf, Successor, Predecessor) or a full name such as System.LinkTypes.Related'),
      comment: z.string().optional().describe('Link comment'),
      project: z.string().optional().describe('Project name or ID, used to build the target URL (uses ADO_PROJECT env var if not specified)'),
      raw: z.boolean().optional().describe('Return full identity objects instead of the trimmed displayName/uniqueName (default: false)'),
    }),
  },
  {
    name: 'mcp_ado_work_items_get_updates',
    description: 'Get revision history for a work item',
    inputSchema: z.object({
      id: z.number().describe('Work item ID'),
      top: z.number().optional().describe('Maximum number of updates'),
    }),
  },
  {
    name: 'mcp_ado_work_items_batch_get',
    description: 'Get multiple work items by IDs',
    inputSchema: z.object({
      ids: z.array(z.number()).describe('Array of work item IDs'),
      expand: z.enum(['None', 'Relations', 'Fields', 'Links', 'All']).optional().describe('Expansion level. Cannot be combined with fields.'),
      fields: z.array(z.string()).optional().describe('Only return these fields (e.g., System.Id, System.Title, System.Parent). Cannot be combined with expand.'),
      raw: z.boolean().optional().describe('Return full identity objects instead of the trimmed displayName/uniqueName (default: false)'),
    }),
  },
  {
    name: 'mcp_ado_work_items_batch_create',
    description:
      'Create multiple work items in one call, including parent/child links within the same batch. ' +
      'Use a negative tempId to reference an item created in the same batch as a parent.',
    inputSchema: z.object({
      project: z.string().optional().describe('Project name or ID (uses ADO_PROJECT env var if not specified)'),
      items: z
        .array(
          z.object({
            tempId: z.number().optional().describe('Temporary negative ID so later items can reference this one as parentId'),
            type: z.string().describe('Work item type (e.g., Bug, Task, User Story)'),
            title: z.string().describe('Work item title'),
            description: z.string().optional().describe('Work item description'),
            assignedTo: z.string().optional().describe('Assigned to (email or display name)'),
            areaPath: z.string().optional().describe('Area path'),
            iterationPath: z.string().optional().describe('Iteration path'),
            parentId: z.number().optional().describe('Parent work item ID: a real ID, or a negative tempId from this same batch'),
            fields: z.record(z.string(), z.unknown()).optional().describe('Additional fields as key-value pairs'),
          })
        )
        .describe('Work items to create, in order. Parents must appear before children that reference them.'),
      raw: z.boolean().optional().describe('Return full identity objects instead of the trimmed displayName/uniqueName (default: false)'),
    }),
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
      const { id, expand, fields, raw } = args as {
        id: number;
        expand?: string;
        fields?: string[];
        raw?: boolean;
      };

      assertFieldsExpandExclusive(fields, expand);

      const expandEnum = expand as WorkItemTrackingInterfaces.WorkItemExpand | undefined;
      const workItem = await witApi.getWorkItem(id, fields, undefined, expandEnum);

      return createWorkItemResponse(workItem, raw);
    }

    case 'mcp_ado_work_items_create': {
      logger.info('Executing mcp_ado_work_items_create', args);
      const { project, type, title, description, assignedTo, areaPath, iterationPath, parentId, fields, raw } =
        args as {
          project: string;
          type: string;
          title: string;
          description?: string;
          assignedTo?: string;
          areaPath?: string;
          iterationPath?: string;
          parentId?: number;
          fields?: Record<string, unknown>;
          raw?: boolean;
        };

      assertNoReadonlyRelationFields(fields);

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

      if (parentId != null) {
        document.push(buildParentRelationPatch(connection, project, parentId));
      }

      const workItem = await witApi.createWorkItem(
        undefined,
        document,
        project,
        type
      );

      return createWorkItemResponse(workItem, raw);
    }

    case 'mcp_ado_work_items_update': {
      logger.info('Executing mcp_ado_work_items_update', args);
      const { id, fields, parentId, project, raw } = args as {
        id: number;
        fields?: Record<string, unknown>;
        parentId?: number;
        project?: string;
        raw?: boolean;
      };

      assertNoReadonlyRelationFields(fields);

      const document: JsonPatchOperation[] = [];

      Object.entries(fields ?? {}).forEach(([key, value]) => {
        document.push({
          op: Operation.Add,
          path: `/fields/${key}`,
          value,
        });
      });

      if (parentId != null) {
        document.push(buildParentRelationPatch(connection, project, parentId));
      }

      if (document.length === 0) {
        throw new Error('未提供任何要更新的內容，請指定 fields 或 parentId。');
      }

      const workItem = await witApi.updateWorkItem(undefined, document, id);

      return createWorkItemResponse(workItem, raw);
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
      const { project, query, top, expand, fields, raw } = args as {
        project: string;
        query: string;
        top?: number;
        expand?: string;
        fields?: string[];
        raw?: boolean;
      };

      assertFieldsExpandExclusive(fields, expand);

      const scopedQuery = injectProjectFilter(query, project);
      if (scopedQuery !== query) {
        logger.info('Injected project filter into WIQL', { project });
      }

      const wiql: WorkItemTrackingInterfaces.Wiql = {
        query: scopedQuery,
      };

      const teamContext = { project, team: undefined };
      const result = await witApi.queryByWiql(wiql, teamContext, undefined, top);

      // Get full work items if IDs are returned
      if (result.workItems && result.workItems.length > 0) {
        const ids = result.workItems.map((wi) => wi.id!);

        // 未指定 fields 時預設帶 Relations，否則查詢結果看不到 System.Parent，
        // 階層無從驗證。
        const expandEnum = fields
          ? undefined
          : ((expand ?? 'Relations') as unknown as WorkItemTrackingInterfaces.WorkItemExpand);

        const workItems = await witApi.getWorkItems(ids, fields, undefined, expandEnum);

        return createWorkItemResponse(
          {
            query: { ...result, query: scopedQuery },
            workItems,
          },
          raw
        );
      }

      return createWorkItemResponse({ ...result, query: scopedQuery }, raw);
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
      const { id, targetId, linkType, comment, project, raw } = args as {
        id: number;
        targetId: number;
        linkType: string;
        comment?: string;
        project?: string;
        raw?: boolean;
      };

      const document: JsonPatchOperation[] = [
        {
          op: Operation.Add,
          path: '/relations/-',
          value: {
            rel: resolveRelType(linkType),
            url: workItemUrl(connection, project, targetId),
            attributes: comment ? { comment } : undefined,
          },
        },
      ];

      const workItem = await witApi.updateWorkItem(undefined, document, id);

      return createWorkItemResponse(workItem, raw);
    }

    case 'mcp_ado_work_items_get_updates': {
      logger.info('Executing mcp_ado_work_items_get_updates', args);
      const { id, top } = args as { id: number; top?: number };

      const updates = await witApi.getUpdates(id, top);

      return createSuccessResponse(updates);
    }

    case 'mcp_ado_work_items_batch_get': {
      logger.info('Executing mcp_ado_work_items_batch_get', args);
      const { ids, expand, fields, raw } = args as {
        ids: number[];
        expand?: string;
        fields?: string[];
        raw?: boolean;
      };

      assertFieldsExpandExclusive(fields, expand);

      const expandEnum = expand as WorkItemTrackingInterfaces.WorkItemExpand | undefined;
      const workItems = await witApi.getWorkItems(ids, fields, undefined, expandEnum);

      return createWorkItemResponse(workItems, raw);
    }

    case 'mcp_ado_work_items_batch_create': {
      logger.info('Executing mcp_ado_work_items_batch_create', { count: args?.items?.length });
      const { project, items, raw } = args as {
        project?: string;
        items: Array<{
          tempId?: number;
          type: string;
          title: string;
          description?: string;
          assignedTo?: string;
          areaPath?: string;
          iterationPath?: string;
          parentId?: number;
          fields?: Record<string, unknown>;
        }>;
        raw?: boolean;
      };

      if (!items?.length) {
        throw new Error('items 不可為空。');
      }

      if (!project) {
        throw new Error('必須指定 project，或設定 ADO_PROJECT 環境變數。');
      }

      // tempId -> 實際建立後的 work item ID
      const tempIdMap = new Map<number, number>();
      const created: any[] = [];

      for (const [index, item] of items.entries()) {
        assertNoReadonlyRelationFields(item.fields);

        if (item.tempId != null && item.tempId >= 0) {
          throw new Error(`items[${index}].tempId 必須是負數，收到 ${item.tempId}。`);
        }

        let resolvedParentId = item.parentId;
        if (resolvedParentId != null && resolvedParentId < 0) {
          const mapped = tempIdMap.get(resolvedParentId);
          if (mapped == null) {
            throw new Error(
              `items[${index}] 的 parentId ${resolvedParentId} 找不到對應項目。` +
                `同批次的父項必須排在子項之前，且其 tempId 需相符。`
            );
          }
          resolvedParentId = mapped;
        }

        const document: JsonPatchOperation[] = [
          { op: Operation.Add, path: '/fields/System.Title', value: item.title },
        ];

        if (item.description) {
          document.push({ op: Operation.Add, path: '/fields/System.Description', value: item.description });
        }
        if (item.assignedTo) {
          document.push({ op: Operation.Add, path: '/fields/System.AssignedTo', value: item.assignedTo });
        }
        if (item.areaPath) {
          document.push({ op: Operation.Add, path: '/fields/System.AreaPath', value: item.areaPath });
        }
        if (item.iterationPath) {
          document.push({ op: Operation.Add, path: '/fields/System.IterationPath', value: item.iterationPath });
        }
        if (item.fields) {
          Object.entries(item.fields).forEach(([key, value]) => {
            document.push({ op: Operation.Add, path: `/fields/${key}`, value });
          });
        }
        if (resolvedParentId != null) {
          document.push(buildParentRelationPatch(connection, project, resolvedParentId));
        }

        try {
          const workItem = await witApi.createWorkItem(undefined, document, project, item.type);
          if (item.tempId != null && workItem?.id != null) {
            tempIdMap.set(item.tempId, workItem.id);
          }
          created.push(workItem);
        } catch (error) {
          // 中途失敗：回報已建立的項目，讓呼叫端知道實際狀態而非全有全無。
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(
            `items[${index}]（${item.title}）建立失敗：${message}。` +
              `此批次已成功建立 ${created.length} 筆，ID：${created.map((w) => w?.id).join(', ') || '無'}。`
          );
        }
      }

      return createWorkItemResponse(
        {
          created: created.length,
          tempIdMap: Object.fromEntries(tempIdMap),
          workItems: created,
        },
        raw
      );
    }

    default:
      return null; // Not handled by this module
  }
}
