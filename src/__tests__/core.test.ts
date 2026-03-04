jest.mock('../logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { handleToolCall } from '../tools/core.js';

const mockGetProjects = jest.fn();
const mockCoreApi = { getProjects: mockGetProjects };
const mockConnection = { getCoreApi: jest.fn().mockResolvedValue(mockCoreApi) } as any;
const connectionProvider = jest.fn().mockResolvedValue(mockConnection);

describe('core handleToolCall', () => {
  beforeEach(() => {
    mockGetProjects.mockReset();
  });

  test('mcp_ado_core_list_projects - 回傳專案清單', async () => {
    mockGetProjects.mockResolvedValue([
      { id: '1', name: 'ProjectA', description: 'Desc', url: 'http://url', state: 1, visibility: 0, lastUpdateTime: new Date() },
    ]);

    const result = await handleToolCall('mcp_ado_core_list_projects', {}, connectionProvider);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(1);
    expect(data.projects[0].name).toBe('ProjectA');
  });

  test('mcp_ado_core_list_projects - 傳遞 stateFilter / top / skip', async () => {
    mockGetProjects.mockResolvedValue([]);

    await handleToolCall('mcp_ado_core_list_projects', { stateFilter: 'wellFormed', top: 5, skip: 2 }, connectionProvider);
    expect(mockGetProjects).toHaveBeenCalledWith('wellFormed', 5, 2);
  });

  test('未知工具名稱回傳 null', async () => {
    const result = await handleToolCall('mcp_ado_unknown', {}, connectionProvider);
    expect(result).toBeNull();
  });
});
