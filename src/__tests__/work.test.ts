jest.mock('../logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { handleToolCall } from '../tools/work.js';

const mockWorkApi = {
  getTeamIterations: jest.fn(),
  getIterationWorkItems: jest.fn(),
  getBacklogs: jest.fn(),
};

const mockConnection = { getWorkApi: jest.fn().mockResolvedValue(mockWorkApi) } as any;
const connectionProvider = jest.fn().mockResolvedValue(mockConnection);

beforeEach(() => {
  Object.values(mockWorkApi).forEach((fn) => (fn as jest.Mock).mockReset());
});

describe('work handleToolCall', () => {
  test('mcp_ado_work_list_iterations - 回傳 sprint 清單', async () => {
    mockWorkApi.getTeamIterations.mockResolvedValue([{ id: 'iter-1', name: 'Sprint 1' }]);
    const result = await handleToolCall('mcp_ado_work_list_iterations', {
      project: 'MyProject',
    }, connectionProvider);
    expect(mockWorkApi.getTeamIterations).toHaveBeenCalledWith({ project: 'MyProject', team: undefined }, undefined);
    expect(JSON.parse(result.content[0].text)).toHaveLength(1);
  });

  test('mcp_ado_work_list_iterations - 傳遞 team / timeframe', async () => {
    mockWorkApi.getTeamIterations.mockResolvedValue([]);
    await handleToolCall('mcp_ado_work_list_iterations', {
      project: 'MyProject',
      team: 'TeamA',
      timeframe: 'current',
    }, connectionProvider);
    expect(mockWorkApi.getTeamIterations).toHaveBeenCalledWith({ project: 'MyProject', team: 'TeamA' }, 'current');
  });

  test('mcp_ado_work_get_iteration_work_items - 回傳 sprint 工作項目', async () => {
    mockWorkApi.getIterationWorkItems.mockResolvedValue({ workItemRelations: [{ target: { id: 1 } }] });
    const result = await handleToolCall('mcp_ado_work_get_iteration_work_items', {
      project: 'MyProject',
      iterationId: 'iter-guid-123',
    }, connectionProvider);
    expect(mockWorkApi.getIterationWorkItems).toHaveBeenCalledWith(
      { project: 'MyProject', team: undefined },
      'iter-guid-123'
    );
    expect(JSON.parse(result.content[0].text)).toMatchObject({ workItemRelations: expect.any(Array) });
  });

  test('mcp_ado_work_list_backlogs - 回傳 backlog 層級', async () => {
    mockWorkApi.getBacklogs.mockResolvedValue([{ id: 'Microsoft.EpicCategory', name: 'Epics' }]);
    const result = await handleToolCall('mcp_ado_work_list_backlogs', {
      project: 'MyProject',
    }, connectionProvider);
    expect(mockWorkApi.getBacklogs).toHaveBeenCalledWith({ project: 'MyProject', team: undefined });
    expect(JSON.parse(result.content[0].text)).toHaveLength(1);
  });

  test('未知工具名稱回傳 null', async () => {
    const result = await handleToolCall('mcp_ado_unknown', {}, connectionProvider);
    expect(result).toBeNull();
  });
});
