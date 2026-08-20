import { createSuccessResponse, createErrorResponse, trimIdentities, createWorkItemResponse } from '../utils.js';

describe('createSuccessResponse', () => {
  test('回傳含 JSON 字串的 content 陣列', () => {
    const result = createSuccessResponse({ id: 1, name: 'Test' });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual({ id: 1, name: 'Test' });
  });

  test('沒有 isError 欄位', () => {
    const result = createSuccessResponse({});
    expect((result as any).isError).toBeUndefined();
  });

  test('可接受陣列資料', () => {
    const result = createSuccessResponse([1, 2, 3]);
    expect(JSON.parse(result.content[0].text)).toEqual([1, 2, 3]);
  });
});

describe('createErrorResponse', () => {
  test('接受 Error 物件，回傳 isError:true', () => {
    const result = createErrorResponse(new Error('something went wrong'));
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe('something went wrong');
    expect(parsed.isError).toBe(true);
  });

  test('接受字串訊息', () => {
    const result = createErrorResponse('bad input');
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe('bad input');
  });

  test('接受未知型別（數字）', () => {
    const result = createErrorResponse(42);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe('42');
  });
});


describe('trimIdentities（issue #5）', () => {
  const identity = {
    displayName: '陳小明',
    uniqueName: 'ming@company.com',
    id: 'abc-123',
    imageUrl: 'https://tfs/_api/_common/identityImage?id=abc-123',
    descriptor: 'win.abc',
    _links: { avatar: { href: 'https://tfs/avatar' } },
  };

  test('identity 物件只保留 displayName 與 uniqueName', () => {
    expect(trimIdentities(identity)).toEqual({
      displayName: '陳小明',
      uniqueName: 'ming@company.com',
    });
  });

  test('巢狀於 fields 內的 identity 也會被裁剪', () => {
    const workItem = {
      id: 6320,
      rev: 3,
      fields: {
        'System.Title': '標題',
        'System.CreatedBy': identity,
        'System.ChangedBy': identity,
      },
    };
    const result = trimIdentities(workItem) as any;
    expect(result.id).toBe(6320);
    expect(result.fields['System.Title']).toBe('標題');
    expect(result.fields['System.CreatedBy']).toEqual({
      displayName: '陳小明',
      uniqueName: 'ming@company.com',
    });
  });

  test('陣列內的 identity 會被裁剪', () => {
    const result = trimIdentities([{ fields: { 'System.CreatedBy': identity } }]) as any;
    expect(result[0].fields['System.CreatedBy'].imageUrl).toBeUndefined();
  });

  test('不會誤裁只有 id 與 displayName 的一般物件', () => {
    const notIdentity = { id: 5, displayName: '一般物件', other: true };
    expect(trimIdentities(notIdentity)).toEqual(notIdentity);
  });

  test('保留 null 與純量', () => {
    expect(trimIdentities({ a: null, b: 1, c: 'x' })).toEqual({ a: null, b: 1, c: 'x' });
  });

  test('明顯縮短回應長度', () => {
    const before = JSON.stringify({ fields: { 'System.CreatedBy': identity } }).length;
    const after = JSON.stringify(trimIdentities({ fields: { 'System.CreatedBy': identity } })).length;
    expect(after).toBeLessThan(before / 2);
  });
});

describe('createWorkItemResponse', () => {
  const withIdentity = { fields: { 'System.CreatedBy': { displayName: 'A', uniqueName: 'a@b.c', imageUrl: 'x' } } };

  test('預設裁剪 identity', () => {
    const parsed = JSON.parse(createWorkItemResponse(withIdentity).content[0].text);
    expect(parsed.fields['System.CreatedBy'].imageUrl).toBeUndefined();
  });

  test('raw:true 保留完整內容', () => {
    const parsed = JSON.parse(createWorkItemResponse(withIdentity, true).content[0].text);
    expect(parsed.fields['System.CreatedBy'].imageUrl).toBe('x');
  });
});
