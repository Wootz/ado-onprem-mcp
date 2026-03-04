import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock logger to suppress output during tests
jest.mock('../logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// Mock handler for the tool under test
const mockWorkItemsHandler = jest.fn();

// Mock all tool modules - use a single testable tool in work-items
jest.mock('../tools/work-items.js', () => ({
  TOOL_DEFINITIONS: [
    {
      name: 'mcp_ado_work_items_create',
      description: 'Create a work item',
      inputSchema: {},
    },
  ],
  handleToolCall: (...args: any[]) => mockWorkItemsHandler(...args),
}));

jest.mock('../tools/core.js', () => ({
  TOOL_DEFINITIONS: [],
  handleToolCall: jest.fn().mockResolvedValue(null),
}));

jest.mock('../tools/repositories.js', () => ({
  TOOL_DEFINITIONS: [],
  handleToolCall: jest.fn().mockResolvedValue(null),
}));

jest.mock('../tools/builds.js', () => ({
  TOOL_DEFINITIONS: [],
  handleToolCall: jest.fn().mockResolvedValue(null),
}));

jest.mock('../tools/work.js', () => ({
  TOOL_DEFINITIONS: [],
  handleToolCall: jest.fn().mockResolvedValue(null),
}));

import { configureAllTools } from '../tools.js';

const SUCCESS_RESPONSE = { content: [{ type: 'text', text: '{}' }] };

describe('configureAllTools - ADO_PROJECT 專案限制', () => {
  let registeredHandlers: Map<string, (args: any) => Promise<any>>;
  let mockServer: Pick<McpServer, 'registerTool'>;
  const mockConnectionProvider = jest.fn();

  beforeEach(() => {
    registeredHandlers = new Map();
    mockServer = {
      registerTool: jest.fn().mockImplementation((_name: string, _schema: any, handler: any) => {
        registeredHandlers.set(_name, handler);
      }),
    } as any;
    mockWorkItemsHandler.mockReset();
  });

  describe('未設定 ADO_PROJECT', () => {
    beforeEach(async () => {
      await configureAllTools(mockServer as McpServer, mockConnectionProvider);
    });

    test('呼叫時不帶 project，不應注入，args 原封不動傳入', async () => {
      mockWorkItemsHandler.mockResolvedValue(SUCCESS_RESPONSE);
      const handler = registeredHandlers.get('mcp_ado_work_items_create')!;
      await handler({ type: 'Bug', title: 'Test' });
      expect(mockWorkItemsHandler).toHaveBeenCalledWith(
        'mcp_ado_work_items_create',
        { type: 'Bug', title: 'Test' },
        mockConnectionProvider
      );
    });

    test('呼叫時帶 project，應正常傳入', async () => {
      mockWorkItemsHandler.mockResolvedValue(SUCCESS_RESPONSE);
      const handler = registeredHandlers.get('mcp_ado_work_items_create')!;
      await handler({ project: 'OtherProject', type: 'Bug', title: 'Test' });
      expect(mockWorkItemsHandler).toHaveBeenCalledWith(
        'mcp_ado_work_items_create',
        { project: 'OtherProject', type: 'Bug', title: 'Test' },
        mockConnectionProvider
      );
    });
  });

  describe('已設定 ADO_PROJECT=MyProject', () => {
    beforeEach(async () => {
      await configureAllTools(mockServer as McpServer, mockConnectionProvider, 'MyProject');
    });

    test('呼叫時不帶 project，應自動注入 MyProject', async () => {
      mockWorkItemsHandler.mockResolvedValue(SUCCESS_RESPONSE);
      const handler = registeredHandlers.get('mcp_ado_work_items_create')!;
      await handler({ type: 'Bug', title: 'Test' });
      expect(mockWorkItemsHandler).toHaveBeenCalledWith(
        'mcp_ado_work_items_create',
        { project: 'MyProject', type: 'Bug', title: 'Test' },
        mockConnectionProvider
      );
    });

    test('呼叫時帶 project，應回傳錯誤且不呼叫 handler', async () => {
      const handler = registeredHandlers.get('mcp_ado_work_items_create')!;
      const result = await handler({ project: 'OtherProject', type: 'Bug', title: 'Test' });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('MyProject');
      expect(mockWorkItemsHandler).not.toHaveBeenCalled();
    });

    test('呼叫時帶 project 與 ADO_PROJECT 相同，也應回傳錯誤', async () => {
      const handler = registeredHandlers.get('mcp_ado_work_items_create')!;
      const result = await handler({ project: 'MyProject', type: 'Bug', title: 'Test' });
      expect(result.isError).toBe(true);
      expect(mockWorkItemsHandler).not.toHaveBeenCalled();
    });
  });
});
