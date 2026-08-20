# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Project Overview

This is a simplified MCP (Model Context Protocol) server for **Azure DevOps Server 2022 (on-premises)** deployments. It provides 30 tools across 5 domains for managing work items, pull requests, builds and iterations.

**Key Features**:
- Collection-based URL patterns (`https://{server}/{collection}`)
- PAT-only authentication (no Azure CLI/OAuth)
- Minimal dependencies and straightforward architecture

## Build and Test Commands

```bash
# Build the project
pnpm run build

# Watch mode for development
pnpm run watch

# Run tests
pnpm test

# Run linter
pnpm run lint

# Start the MCP server (requires ADO_SERVER_URL and ADO_PAT_TOKEN env vars)
node dist/index.js
```

## Architecture

### Project Structure

```
src/
├── index.ts             # CLI entry point
├── auth.ts              # PAT authentication
├── server.ts            # MCP server setup
├── tools.ts             # Tool registration
├── tools/
│   ├── core.ts          # Projects
│   ├── work-items.ts    # Work items (incl. hierarchy + batch create)
│   ├── repositories.ts  # Pull requests
│   ├── builds.ts        # Builds
│   └── work.ts          # Iterations / backlogs
├── utils.ts             # Response helpers
├── logger.ts            # Winston logging
└── version.ts           # Version info
```

### Data Flow

1. **index.ts** - Loads env vars, creates connection
2. **auth.ts** - Creates `azdev.WebApi` with PAT
3. **server.ts** - Creates `McpServer`, registers tools
4. **tools.ts** - Aggregates and registers all tools
5. **tools/*.ts** - Individual tool handlers

### Tool Domains

- **core**: Project management
- **work-items**: CRUD, queries, comments, links, hierarchy, batch create
- **repositories**: Pull requests and code review
- **builds**: Build definitions and runs
- **work**: Iterations and backlogs

**Total: 30 tools**

## Key Patterns

### Tool Module Pattern

Each tool module exports two things:

```typescript
// Tool definitions
export const TOOL_DEFINITIONS = [
  {
    name: 'mcp_ado_domain_action',
    description: 'What the tool does',
    inputSchema: { type: 'object', properties: {...}, required: [...] }
  }
];

// Tool handler
export async function handleToolCall(
  name: string,
  args: any,
  connectionProvider: () => Promise<azdev.WebApi>
): Promise<any> {
  const connection = await connectionProvider();
  const api = await connection.getSomeApi();

  switch (name) {
    case 'mcp_ado_domain_action':
      const result = await api.someMethod(args);
      return createSuccessResponse(result);
    default:
      return null; // Not handled
  }
}
```

### Centralized Registration

`src/tools.ts` imports all tools and registers them:

```typescript
import { TOOL_DEFINITIONS as CORE_TOOLS, handleToolCall as handleCoreToolCall } from './tools/core.js';
import { TOOL_DEFINITIONS as WORK_ITEMS_TOOLS, handleToolCall as handleWorkItemsToolCall } from './tools/work-items.js';
import { TOOL_DEFINITIONS as REPOSITORIES_TOOLS, handleToolCall as handleRepositoriesToolCall } from './tools/repositories.js';

const ALL_TOOLS = [...CORE_TOOLS, ...WORK_ITEMS_TOOLS, ...REPOSITORIES_TOOLS];
const TOOL_HANDLERS = [handleCoreToolCall, handleWorkItemsToolCall, handleRepositoriesToolCall];

for (const toolDef of ALL_TOOLS) {
  server.registerTool(
    toolDef.name,
    { description: toolDef.description, inputSchema: toolDef.inputSchema },
    async (args) => {
      for (const handler of TOOL_HANDLERS) {
        const result = await handler(toolDef.name, args, connectionProvider);
        if (result !== null) return result;
      }
      throw new Error(`Unknown tool: ${toolDef.name}`);
    }
  );
}
```

### Response Helpers

`src/utils.ts` provides two functions:

```typescript
export function createSuccessResponse(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message, isError: true }, null, 2) }],
    isError: true,
  };
}
```

### Connection Provider

A simple function that returns the Azure DevOps connection:

```typescript
const connectionProvider = async () => connection;
```

Type signature: `() => Promise<azdev.WebApi>`

### Work Items JSON Patch

Work item updates use JSON Patch operations:

```typescript
enum Operation { Add = 0, Remove = 1, Replace = 2, Move = 3, Copy = 4, Test = 5 }

const document = [
  { op: Operation.Add, path: '/fields/System.Title', value: 'New Title' }
];
```

Field paths use `/fields/System.FieldName` format.

### Work Item Hierarchy

Hierarchy is a **relation**, not a field. `System.Parent` is a read-only computed field —
writing it via `/fields/` is silently accepted and ignored by ADO. Use the `parentId`
parameter instead, which emits a `/relations/-` patch:

```typescript
{
  op: Operation.Add,
  path: '/relations/-',
  value: { rel: 'System.LinkTypes.Hierarchy-Reverse', url: `${serverUrl}/${project}/_apis/wit/workItems/${parentId}` }
}
```

Passing `System.Parent` inside `fields` throws an explicit error.
Relation `url` must always be a full address; a bare ID is rejected by ADO.

### WIQL Project Scoping

`teamContext` alone does not scope a WIQL query. When a project is configured and the
query has no `[System.TeamProject]` clause, `query_by_wiql` injects one automatically so
results stay inside the project. Results are fetched with `expand: 'Relations'` by default
so `System.Parent` is visible.

### Response Trimming

Work item responses pass through `createWorkItemResponse`, which trims ADO identity objects
(`System.CreatedBy` etc.) down to `displayName`/`uniqueName`. Pass `raw: true` for the full
payload, or `fields: [...]` to select specific fields (cannot be combined with `expand`).

## TypeScript Configuration

- **Module system**: ES Modules (Node16, `.js` imports required)
- **Target**: ES2022
- **Strict mode**: Enabled
- **Output**: `dist/` directory

### Two TypeScript versions side by side

| Package | Version | Used by |
|---|---|---|
| `typescript` | 6.0.3 | `ts-jest`, `typescript-eslint` (resolved implicitly) |
| `typescript7` (alias of `typescript@7.0.2`) | 7.0.2 | `pnpm run build` / `watch` |

`build` and `watch` invoke `node node_modules/typescript7/bin/tsc`.
**Do not run a bare `tsc`** — it silently compiles with TS 6 instead.

Test type-checking uses `tsconfig.test.json` (wired in via `jest.config.js`),
which must declare `types: ["jest", "node"]`.

## Environment Variables

**Required**:
- `ADO_SERVER_URL`: Full URL with collection (e.g., `https://tfs.company.com/DefaultCollection`)
- `ADO_PAT_TOKEN`: Personal Access Token

**Optional**:
- `NODE_TLS_REJECT_UNAUTHORIZED=0`: For self-signed certs (dev only)
- `LOG_LEVEL`: Logging level (`error`, `warn`, `info`, `debug`; default: `info`)

## Not Supported

- **MCP Resources and Prompts**: this server exposes tools only.
- **Domains not covered**: test plans, wiki, search.
- Some Azure DevOps cloud-only features are unavailable on-premises.

## Adding New Tools

### Add to Existing Domain

1. Add to `TOOL_DEFINITIONS` in domain file:
   ```typescript
   {
     name: 'mcp_ado_repos_new_action',
     description: 'Does something with PRs',
     inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] }
   }
   ```

2. Add case to `handleToolCall`:
   ```typescript
   case 'mcp_ado_repos_new_action':
     const result = await gitApi.doSomething(args.id);
     return createSuccessResponse(result);
   ```

### Create New Domain

1. Create `src/tools/new-domain.ts` with pattern above
2. Update `src/tools.ts`:
   ```typescript
   import { TOOL_DEFINITIONS as NEW_TOOLS, handleToolCall as handleNewToolCall } from './tools/new-domain.js';

   const ALL_TOOLS = [...CORE_TOOLS, ...WORK_ITEMS_TOOLS, ...REPOSITORIES_TOOLS, ...NEW_TOOLS];
   const TOOL_HANDLERS = [handleCoreToolCall, handleWorkItemsToolCall, handleRepositoriesToolCall, handleNewToolCall];
   ```

## Azure DevOps API

- **Version**: API v7.0 (Azure DevOps Server 2022)
- **Library**: `azure-devops-node-api` v15.x
- **Authentication**: PAT tokens only
- **Note**: Some cloud-only features not available in on-premises

## MCP SDK

- **Version**: `@modelcontextprotocol/sdk` v1.26.0
- **API**: `McpServer` (high-level, recommended)
- **Transport**: Stdio
- **Capabilities**: Tools only (resources and prompts removed)
