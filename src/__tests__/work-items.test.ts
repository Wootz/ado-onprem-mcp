jest.mock('../logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { handleToolCall } from '../tools/work-items.js';

const mockWitApi = {
  getWorkItem: jest.fn(),
  createWorkItem: jest.fn(),
  updateWorkItem: jest.fn(),
  deleteWorkItem: jest.fn(),
  queryByWiql: jest.fn(),
  getWorkItems: jest.fn(),
  addComment: jest.fn(),
  getComments: jest.fn(),
  getUpdates: jest.fn(),
};

const mockConnection = { getWorkItemTrackingApi: jest.fn().mockResolvedValue(mockWitApi) } as any;
const connectionProvider = jest.fn().mockResolvedValue(mockConnection);

beforeEach(() => {
  Object.values(mockWitApi).forEach((fn) => (fn as jest.Mock).mockReset());
});

describe('work-items handleToolCall', () => {
  test('mcp_ado_work_items_get - 回傳工作項目', async () => {
    mockWitApi.getWorkItem.mockResolvedValue({ id: 42, fields: {} });
    const result = await handleToolCall('mcp_ado_work_items_get', { id: 42 }, connectionProvider);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ id: 42 });
    expect(mockWitApi.getWorkItem).toHaveBeenCalledWith(42, undefined, undefined, undefined);
  });

  test('mcp_ado_work_items_create - 建立工作項目並傳遞所有欄位', async () => {
    mockWitApi.createWorkItem.mockResolvedValue({ id: 1 });
    await handleToolCall('mcp_ado_work_items_create', {
      project: 'MyProject',
      type: 'Bug',
      title: 'Test Bug',
      description: 'Desc',
      assignedTo: 'user@test.com',
      areaPath: 'MyProject\\Area',
      iterationPath: 'MyProject\\Sprint1',
      fields: { 'Microsoft.VSTS.Common.Priority': 1 },
    }, connectionProvider);

    const patchDoc = mockWitApi.createWorkItem.mock.calls[0][1];
    const paths = patchDoc.map((op: any) => op.path);
    expect(paths).toContain('/fields/System.Title');
    expect(paths).toContain('/fields/System.Description');
    expect(paths).toContain('/fields/System.AssignedTo');
    expect(paths).toContain('/fields/System.AreaPath');
    expect(paths).toContain('/fields/System.IterationPath');
    expect(paths).toContain('/fields/Microsoft.VSTS.Common.Priority');
  });

  test('mcp_ado_work_items_update - 更新欄位', async () => {
    mockWitApi.updateWorkItem.mockResolvedValue({ id: 10 });
    await handleToolCall('mcp_ado_work_items_update', {
      id: 10,
      fields: { 'System.State': 'Done' },
    }, connectionProvider);
    const patchDoc = mockWitApi.updateWorkItem.mock.calls[0][1];
    expect(patchDoc[0].path).toBe('/fields/System.State');
    expect(patchDoc[0].value).toBe('Done');
  });

  test('mcp_ado_work_items_delete - 回傳刪除結果', async () => {
    mockWitApi.deleteWorkItem.mockResolvedValue({});
    const result = await handleToolCall('mcp_ado_work_items_delete', { id: 5 }, connectionProvider);
    const data = JSON.parse(result.content[0].text);
    expect(data.deleted).toBe(true);
    expect(data.id).toBe(5);
  });

  test('mcp_ado_work_items_query_by_wiql - 無結果時直接回傳', async () => {
    mockWitApi.queryByWiql.mockResolvedValue({ workItems: [] });
    const result = await handleToolCall('mcp_ado_work_items_query_by_wiql', {
      project: 'MyProject',
      query: 'SELECT [Id] FROM WorkItems',
    }, connectionProvider);
    expect(result.content).toBeDefined();
    expect(mockWitApi.getWorkItems).not.toHaveBeenCalled();
  });

  test('mcp_ado_work_items_query_by_wiql - 有結果時取得完整工作項目', async () => {
    mockWitApi.queryByWiql.mockResolvedValue({ workItems: [{ id: 1 }, { id: 2 }] });
    mockWitApi.getWorkItems.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    await handleToolCall('mcp_ado_work_items_query_by_wiql', {
      project: 'MyProject',
      query: 'SELECT [Id] FROM WorkItems',
    }, connectionProvider);
    expect(mockWitApi.getWorkItems).toHaveBeenCalledWith([1, 2]);
  });

  test('mcp_ado_work_items_add_comment - 新增留言', async () => {
    mockWitApi.addComment.mockResolvedValue({ id: 99, text: 'hello' });
    const result = await handleToolCall('mcp_ado_work_items_add_comment', {
      project: 'MyProject',
      workItemId: 7,
      text: 'hello',
    }, connectionProvider);
    expect(mockWitApi.addComment).toHaveBeenCalledWith({ text: 'hello' }, 'MyProject', 7);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ id: 99 });
  });

  test('mcp_ado_work_items_get_comments - 取得留言', async () => {
    mockWitApi.getComments.mockResolvedValue({ comments: [] });
    await handleToolCall('mcp_ado_work_items_get_comments', {
      project: 'MyProject',
      workItemId: 7,
      top: 10,
    }, connectionProvider);
    expect(mockWitApi.getComments).toHaveBeenCalledWith('MyProject', 7, 10);
  });

  test('mcp_ado_work_items_add_link - 新增連結', async () => {
    mockWitApi.updateWorkItem.mockResolvedValue({ id: 10 });
    await handleToolCall('mcp_ado_work_items_add_link', {
      id: 10,
      targetId: 20,
      linkType: 'Related',
    }, connectionProvider);
    const patchDoc = mockWitApi.updateWorkItem.mock.calls[0][1];
    expect(patchDoc[0].path).toBe('/relations/-');
    expect(patchDoc[0].value.rel).toBe('Related');
  });

  test('mcp_ado_work_items_get_updates - 取得修訂歷史', async () => {
    mockWitApi.getUpdates.mockResolvedValue([{ revision: 1 }]);
    const result = await handleToolCall('mcp_ado_work_items_get_updates', { id: 5, top: 3 }, connectionProvider);
    expect(mockWitApi.getUpdates).toHaveBeenCalledWith(5, 3);
    expect(JSON.parse(result.content[0].text)).toHaveLength(1);
  });

  test('mcp_ado_work_items_batch_get - 批次取得工作項目', async () => {
    mockWitApi.getWorkItems.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const result = await handleToolCall('mcp_ado_work_items_batch_get', { ids: [1, 2] }, connectionProvider);
    expect(mockWitApi.getWorkItems).toHaveBeenCalledWith([1, 2], undefined, undefined, undefined);
    expect(JSON.parse(result.content[0].text)).toHaveLength(2);
  });

  test('未知工具名稱回傳 null', async () => {
    const result = await handleToolCall('mcp_ado_unknown', {}, connectionProvider);
    expect(result).toBeNull();
  });
});
