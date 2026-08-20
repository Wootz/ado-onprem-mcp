jest.mock('../logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { handleToolCall, injectProjectFilter } from '../tools/work-items.js';

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

const mockConnection = {
  serverUrl: 'https://tfs.example.com/DefaultCollection',
  getWorkItemTrackingApi: jest.fn().mockResolvedValue(mockWitApi),
} as any;
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
    expect(mockWitApi.getWorkItems).toHaveBeenCalledWith([1, 2], undefined, undefined, 'Relations');
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
    expect(patchDoc[0].value.rel).toBe('System.LinkTypes.Related');
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

describe('父子階層（issue #1）', () => {
  test('create 帶 parentId - 產生 relation patch 且 url 為完整位址', async () => {
    mockWitApi.createWorkItem.mockResolvedValue({ id: 6320 });
    await handleToolCall('mcp_ado_work_items_create', {
      project: 'MyProject',
      type: 'Task',
      title: '子項',
      parentId: 5787,
    }, connectionProvider);

    const patchDoc = mockWitApi.createWorkItem.mock.calls[0][1];
    const relOp = patchDoc.find((op: any) => op.path === '/relations/-');
    expect(relOp).toBeDefined();
    expect(relOp.value.rel).toBe('System.LinkTypes.Hierarchy-Reverse');
    expect(relOp.value.url).toBe(
      'https://tfs.example.com/DefaultCollection/MyProject/_apis/wit/workItems/5787'
    );
  });

  test('update 帶 parentId - 產生 relation patch', async () => {
    mockWitApi.updateWorkItem.mockResolvedValue({ id: 10 });
    await handleToolCall('mcp_ado_work_items_update', {
      id: 10,
      project: 'MyProject',
      parentId: 99,
    }, connectionProvider);

    const patchDoc = mockWitApi.updateWorkItem.mock.calls[0][1];
    expect(patchDoc[0].path).toBe('/relations/-');
    expect(patchDoc[0].value.rel).toBe('System.LinkTypes.Hierarchy-Reverse');
  });

  test('create 在 fields 放 System.Parent - 應明確報錯而非靜默丟棄', async () => {
    await expect(
      handleToolCall('mcp_ado_work_items_create', {
        project: 'MyProject',
        type: 'Task',
        title: 'x',
        fields: { 'System.Parent': 5787 },
      }, connectionProvider)
    ).rejects.toThrow(/System\.Parent.*唯讀|唯讀.*System\.Parent/s);
    expect(mockWitApi.createWorkItem).not.toHaveBeenCalled();
  });

  test('update 在 fields 放 System.Parent - 應明確報錯', async () => {
    await expect(
      handleToolCall('mcp_ado_work_items_update', {
        id: 1,
        fields: { 'System.Parent': 5787 },
      }, connectionProvider)
    ).rejects.toThrow(/parentId/);
    expect(mockWitApi.updateWorkItem).not.toHaveBeenCalled();
  });

  test('update 未給 fields 與 parentId - 應報錯而非送出空 patch', async () => {
    await expect(
      handleToolCall('mcp_ado_work_items_update', { id: 1 }, connectionProvider)
    ).rejects.toThrow(/未提供任何要更新的內容/);
    expect(mockWitApi.updateWorkItem).not.toHaveBeenCalled();
  });
});

describe('add_link（issue #2）', () => {
  test('url 為完整位址而非裸 ID', async () => {
    mockWitApi.updateWorkItem.mockResolvedValue({ id: 10 });
    await handleToolCall('mcp_ado_work_items_add_link', {
      id: 10,
      targetId: 20,
      linkType: 'Parent',
      project: 'MyProject',
    }, connectionProvider);

    const value = mockWitApi.updateWorkItem.mock.calls[0][1][0].value;
    expect(value.rel).toBe('System.LinkTypes.Hierarchy-Reverse');
    expect(value.url).toBe(
      'https://tfs.example.com/DefaultCollection/MyProject/_apis/wit/workItems/20'
    );
  });

  test('完整連結名稱可直接傳入', async () => {
    mockWitApi.updateWorkItem.mockResolvedValue({ id: 10 });
    await handleToolCall('mcp_ado_work_items_add_link', {
      id: 10,
      targetId: 20,
      linkType: 'System.LinkTypes.Dependency-Forward',
      project: 'MyProject',
    }, connectionProvider);
    expect(mockWitApi.updateWorkItem.mock.calls[0][1][0].value.rel).toBe(
      'System.LinkTypes.Dependency-Forward'
    );
  });

  test('未知連結型別應擋下並列出可用值', async () => {
    await expect(
      handleToolCall('mcp_ado_work_items_add_link', {
        id: 10,
        targetId: 20,
        linkType: 'NotARealType',
        project: 'MyProject',
      }, connectionProvider)
    ).rejects.toThrow(/未知的連結型別.*Parent/s);
    expect(mockWitApi.updateWorkItem).not.toHaveBeenCalled();
  });
});

describe('WIQL expand 與 project 篩選（issue #3、#4）', () => {
  beforeEach(() => {
    mockWitApi.queryByWiql.mockResolvedValue({ workItems: [{ id: 1 }] });
    mockWitApi.getWorkItems.mockResolvedValue([{ id: 1 }]);
  });

  test('未帶 System.TeamProject 時自動注入條件', async () => {
    await handleToolCall('mcp_ado_work_items_query_by_wiql', {
      project: 'MyProject',
      query: 'SELECT [System.Id] FROM WorkItems',
    }, connectionProvider);

    const sent = mockWitApi.queryByWiql.mock.calls[0][0].query;
    expect(sent).toContain("[System.TeamProject] = 'MyProject'");
  });

  test('已帶 System.TeamProject 時不重複注入', async () => {
    const query = "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = 'Other'";
    await handleToolCall('mcp_ado_work_items_query_by_wiql', {
      project: 'MyProject',
      query,
    }, connectionProvider);
    expect(mockWitApi.queryByWiql.mock.calls[0][0].query).toBe(query);
  });

  test('注入條件時保留既有 WHERE 並以括號包住原條件', async () => {
    await handleToolCall('mcp_ado_work_items_query_by_wiql', {
      project: 'MyProject',
      query: "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'",
    }, connectionProvider);

    const sent = mockWitApi.queryByWiql.mock.calls[0][0].query;
    expect(sent).toBe(
      "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = 'MyProject' AND ([System.State] = 'Active')"
    );
  });

  test('注入條件時插在 ORDER BY 之前', async () => {
    await handleToolCall('mcp_ado_work_items_query_by_wiql', {
      project: 'MyProject',
      query: 'SELECT [System.Id] FROM WorkItems ORDER BY [System.Id]',
    }, connectionProvider);

    const sent = mockWitApi.queryByWiql.mock.calls[0][0].query;
    expect(sent).toBe(
      "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = 'MyProject' ORDER BY [System.Id]"
    );
  });

  test('指定 fields 時改以 fields 取回且不帶 expand', async () => {
    await handleToolCall('mcp_ado_work_items_query_by_wiql', {
      project: 'MyProject',
      query: 'SELECT [System.Id] FROM WorkItems',
      fields: ['System.Id', 'System.Parent'],
    }, connectionProvider);

    expect(mockWitApi.getWorkItems).toHaveBeenCalledWith(
      [1],
      ['System.Id', 'System.Parent'],
      undefined,
      undefined
    );
  });

  test('fields 與 expand 併用應報錯', async () => {
    await expect(
      handleToolCall('mcp_ado_work_items_query_by_wiql', {
        project: 'MyProject',
        query: 'SELECT [System.Id] FROM WorkItems',
        fields: ['System.Id'],
        expand: 'Relations',
      }, connectionProvider)
    ).rejects.toThrow(/不可同時使用/);
  });
});

describe('batch_create（issue #7）', () => {
  test('同批次內以負數 tempId 建立父子關係', async () => {
    mockWitApi.createWorkItem
      .mockResolvedValueOnce({ id: 100 })
      .mockResolvedValueOnce({ id: 101 });

    const result = await handleToolCall('mcp_ado_work_items_batch_create', {
      project: 'MyProject',
      items: [
        { tempId: -1, type: 'Feature', title: '父項' },
        { type: 'Task', title: '子項', parentId: -1 },
      ],
    }, connectionProvider);

    expect(mockWitApi.createWorkItem).toHaveBeenCalledTimes(2);

    // 第二筆應指向第一筆真實 ID 100
    const childDoc = mockWitApi.createWorkItem.mock.calls[1][1];
    const relOp = childDoc.find((op: any) => op.path === '/relations/-');
    expect(relOp.value.url).toBe(
      'https://tfs.example.com/DefaultCollection/MyProject/_apis/wit/workItems/100'
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.created).toBe(2);
    expect(data.tempIdMap['-1']).toBe(100);
  });

  test('真實 parentId（正數）直接使用', async () => {
    mockWitApi.createWorkItem.mockResolvedValue({ id: 200 });
    await handleToolCall('mcp_ado_work_items_batch_create', {
      project: 'MyProject',
      items: [{ type: 'Task', title: '子項', parentId: 5787 }],
    }, connectionProvider);

    const relOp = mockWitApi.createWorkItem.mock.calls[0][1].find(
      (op: any) => op.path === '/relations/-'
    );
    expect(relOp.value.url).toContain('/workItems/5787');
  });

  test('參照不存在的 tempId 應報錯', async () => {
    await expect(
      handleToolCall('mcp_ado_work_items_batch_create', {
        project: 'MyProject',
        items: [{ type: 'Task', title: '孤兒', parentId: -99 }],
      }, connectionProvider)
    ).rejects.toThrow(/找不到對應項目/);
  });

  test('中途失敗時回報已建立的項目', async () => {
    mockWitApi.createWorkItem
      .mockResolvedValueOnce({ id: 100 })
      .mockRejectedValueOnce(new Error('欄位驗證失敗'));

    await expect(
      handleToolCall('mcp_ado_work_items_batch_create', {
        project: 'MyProject',
        items: [
          { type: 'Feature', title: '成功' },
          { type: 'Task', title: '失敗' },
        ],
      }, connectionProvider)
    ).rejects.toThrow(/已成功建立 1 筆.*100/s);
  });

  test('items 為空應報錯', async () => {
    await expect(
      handleToolCall('mcp_ado_work_items_batch_create', {
        project: 'MyProject',
        items: [],
      }, connectionProvider)
    ).rejects.toThrow(/不可為空/);
  });
});

describe('injectProjectFilter', () => {
  const P = 'MyProject';
  const CLAUSE = "[System.TeamProject] = 'MyProject'";

  it('WHERE 與 ORDER BY 並存時，ORDER BY 不可被包進條件括號', () => {
    const out = injectProjectFilter(
      'SELECT [System.Id] FROM WorkItems WHERE [System.Id] >= 10 ORDER BY [System.Id]', P);
    expect(out).toBe(
      `SELECT [System.Id] FROM WorkItems WHERE ${CLAUSE} AND ([System.Id] >= 10) ORDER BY [System.Id]`);
    expect(out).not.toMatch(/\(.*ORDER\s+BY.*\)/i);
  });

  it('WHERE 與 ASOF 並存時，ASOF 不可被包進條件括號', () => {
    const out = injectProjectFilter(
      "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New' ASOF '2026-01-01'", P);
    expect(out).toBe(
      `SELECT [System.Id] FROM WorkItems WHERE ${CLAUSE} AND ([System.State] = 'New') ASOF '2026-01-01'`);
  });

  it('僅有 WHERE 時包住原條件', () => {
    expect(injectProjectFilter('SELECT [System.Id] FROM WorkItems WHERE [System.Id] >= 10', P))
      .toBe(`SELECT [System.Id] FROM WorkItems WHERE ${CLAUSE} AND ([System.Id] >= 10)`);
  });

  it('無 WHERE 但有 ORDER BY 時插在其前', () => {
    expect(injectProjectFilter('SELECT [System.Id] FROM WorkItems ORDER BY [System.Id]', P))
      .toBe(`SELECT [System.Id] FROM WorkItems WHERE ${CLAUSE} ORDER BY [System.Id]`);
  });

  it('無 WHERE 也無尾句時接在最後', () => {
    expect(injectProjectFilter('SELECT [System.Id] FROM WorkItems', P))
      .toBe(`SELECT [System.Id] FROM WorkItems WHERE ${CLAUSE}`);
  });

  it('已含 System.TeamProject 時不重複注入', () => {
    const q = "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = 'Other' ORDER BY [System.Id]";
    expect(injectProjectFilter(q, P)).toBe(q);
  });

  it('未設定 project 時原樣返回', () => {
    const q = 'SELECT [System.Id] FROM WorkItems WHERE [System.Id] >= 10 ORDER BY [System.Id]';
    expect(injectProjectFilter(q, undefined)).toBe(q);
  });

  it('小寫關鍵字同樣正確處理', () => {
    expect(injectProjectFilter(
      'select [System.Id] from WorkItems where [System.Id]>1 order by [System.Id] desc', P))
      .toBe(`select [System.Id] from WorkItems where ${CLAUSE} AND ([System.Id]>1) order by [System.Id] desc`);
  });

  it('專案名稱含單引號時正確跳脫', () => {
    expect(injectProjectFilter('SELECT [System.Id] FROM WorkItems', "It's"))
      .toBe("SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = 'It''s'");
  });
});
