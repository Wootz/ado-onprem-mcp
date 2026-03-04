import { createSuccessResponse, createErrorResponse } from '../utils.js';

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
