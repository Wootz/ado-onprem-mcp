# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a simplified MCP (Model Context Protocol) server for **Azure DevOps Server 2022 (on-premises)** deployments. It provides 15 essential tools across 3 core domains for managing work items and pull requests.

**Key Features**:
- Collection-based URL patterns (`https://{server}/{collection}`)
- PAT-only authentication (no Azure CLI/OAuth)
- Minimal dependencies and straightforward architecture
- 10 source files, ~500 lines of code

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
│   ├── core.ts          # Projects (1 tool)
│   ├── work-items.ts    # Work items (10 tools)
│   └── repositories.ts  # Pull requests (4 tools)
├── utils.ts             # Response helpers
├── logger.ts            # Winston logging
└── version.ts           # Version info
```

### Data Flow

1. **index.ts** - Loads env vars, creates connection
2. **auth.ts** - Creates `azdev.WebApi` with PAT
3. **server.ts** - Creates `McpServer`, registers tools
4. **tools.ts** - Aggregates and registers all 15 tools
5. **tools/*.ts** - Individual tool handlers

### Tool Domains

- **core** (1 tool): Project management
- **work-items** (10 tools): CRUD, queries, comments, links
- **repositories** (4 tools): Pull requests and code review

**Total: 15 tools**

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

## TypeScript Configuration

- **Module system**: ES Modules (Node16, `.js` imports required)
- **Target**: ES2022
- **Strict mode**: Enabled
- **Output**: `dist/` directory

## Environment Variables

**Required**:
- `ADO_SERVER_URL`: Full URL with collection (e.g., `https://tfs.company.com/DefaultCollection`)
- `ADO_PAT_TOKEN`: Personal Access Token

**Optional**:
- `NODE_TLS_REJECT_UNAUTHORIZED=0`: For self-signed certs (dev only)
- `LOG_LEVEL`: Logging level (`error`, `warn`, `info`, `debug`; default: `info`)

## Removed Features

This server has been simplified by removing:

**Domains**:
- `pipelines`: Build/pipeline operations
- `test-plans`: Test management
- `work`: Iterations, capacity, boards
- `wiki`: Wiki operations
- `search`: Search functionality

**MCP Features**:
- Resources (previously `ado://{serverUrl}/projects`)
- Prompts (previously `create-work-item`, `pr-summary`)

**Code**:
- `src/shared/types.ts`: Removed, types inlined
- Domain filtering: All 3 domains always loaded
- Unused tool files deleted

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
