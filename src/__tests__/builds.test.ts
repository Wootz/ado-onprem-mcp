jest.mock('../logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { handleToolCall } from '../tools/builds.js';

const mockBuildApi = {
  getDefinitions: jest.fn(),
  getBuilds: jest.fn(),
  getBuild: jest.fn(),
  queueBuild: jest.fn(),
  getBuildLogLines: jest.fn(),
  getBuildLogs: jest.fn(),
};

const mockConnection = { getBuildApi: jest.fn().mockResolvedValue(mockBuildApi) } as any;
const connectionProvider = jest.fn().mockResolvedValue(mockConnection);

beforeEach(() => {
  Object.values(mockBuildApi).forEach((fn) => (fn as jest.Mock).mockReset());
});

describe('builds handleToolCall', () => {
  test('mcp_ado_builds_list_definitions - 回傳定義清單', async () => {
    mockBuildApi.getDefinitions.mockResolvedValue([{ id: 1, name: 'CI' }]);
    const result = await handleToolCall('mcp_ado_builds_list_definitions', {
      project: 'MyProject',
    }, connectionProvider);
    expect(mockBuildApi.getDefinitions).toHaveBeenCalledWith('MyProject', undefined, undefined, undefined, undefined, undefined);
    expect(JSON.parse(result.content[0].text)).toHaveLength(1);
  });

  test('mcp_ado_builds_list_definitions - 傳遞 name / top', async () => {
    mockBuildApi.getDefinitions.mockResolvedValue([]);
    await handleToolCall('mcp_ado_builds_list_definitions', {
      project: 'MyProject',
      name: 'CI*',
      top: 10,
    }, connectionProvider);
    expect(mockBuildApi.getDefinitions).toHaveBeenCalledWith('MyProject', 'CI*', undefined, undefined, undefined, 10);
  });

  test('mcp_ado_builds_list - 回傳 build 清單', async () => {
    mockBuildApi.getBuilds.mockResolvedValue([{ id: 100 }]);
    const result = await handleToolCall('mcp_ado_builds_list', {
      project: 'MyProject',
      statusFilter: 'completed',
      resultFilter: 'succeeded',
      top: 5,
    }, connectionProvider);
    expect(JSON.parse(result.content[0].text)).toHaveLength(1);
    // Verify status/result numeric values passed (completed=2, succeeded=2)
    const callArgs = mockBuildApi.getBuilds.mock.calls[0];
    expect(callArgs[8]).toBe(2); // status completed
    expect(callArgs[9]).toBe(2); // result succeeded
  });

  test('mcp_ado_builds_get - 回傳 build 詳情', async () => {
    mockBuildApi.getBuild.mockResolvedValue({ id: 42, status: 2 });
    const result = await handleToolCall('mcp_ado_builds_get', {
      project: 'MyProject',
      buildId: 42,
    }, connectionProvider);
    expect(mockBuildApi.getBuild).toHaveBeenCalledWith('MyProject', 42);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ id: 42 });
  });

  test('mcp_ado_builds_queue - 觸發 build', async () => {
    mockBuildApi.queueBuild.mockResolvedValue({ id: 200 });
    const result = await handleToolCall('mcp_ado_builds_queue', {
      project: 'MyProject',
      definitionId: 5,
      sourceBranch: 'refs/heads/main',
    }, connectionProvider);
    const buildArg = mockBuildApi.queueBuild.mock.calls[0][0];
    expect(buildArg.definition.id).toBe(5);
    expect(buildArg.sourceBranch).toBe('refs/heads/main');
    expect(JSON.parse(result.content[0].text)).toMatchObject({ id: 200 });
  });

  test('mcp_ado_builds_get_logs - 無 logId 時回傳 log 清單', async () => {
    mockBuildApi.getBuildLogs.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const result = await handleToolCall('mcp_ado_builds_get_logs', {
      project: 'MyProject',
      buildId: 100,
    }, connectionProvider);
    expect(mockBuildApi.getBuildLogs).toHaveBeenCalledWith('MyProject', 100);
    expect(mockBuildApi.getBuildLogLines).not.toHaveBeenCalled();
    expect(JSON.parse(result.content[0].text)).toHaveLength(2);
  });

  test('mcp_ado_builds_get_logs - 有 logId 時回傳 log 內容', async () => {
    mockBuildApi.getBuildLogLines.mockResolvedValue(['line1', 'line2']);
    const result = await handleToolCall('mcp_ado_builds_get_logs', {
      project: 'MyProject',
      buildId: 100,
      logId: 3,
    }, connectionProvider);
    expect(mockBuildApi.getBuildLogLines).toHaveBeenCalledWith('MyProject', 100, 3);
    const data = JSON.parse(result.content[0].text);
    expect(data.logId).toBe(3);
    expect(data.lines).toEqual(['line1', 'line2']);
  });

  test('未知工具名稱回傳 null', async () => {
    const result = await handleToolCall('mcp_ado_unknown', {}, connectionProvider);
    expect(result).toBeNull();
  });
});
