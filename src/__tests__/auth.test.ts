jest.mock('../logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { getTokenFromEnv } from '../auth.js';

describe('getTokenFromEnv', () => {
  const originalEnv = process.env.ADO_PAT_TOKEN;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ADO_PAT_TOKEN;
    } else {
      process.env.ADO_PAT_TOKEN = originalEnv;
    }
  });

  test('回傳 ADO_PAT_TOKEN 的值', () => {
    process.env.ADO_PAT_TOKEN = 'my-secret-token';
    expect(getTokenFromEnv()).toBe('my-secret-token');
  });

  test('未設定時拋出錯誤', () => {
    delete process.env.ADO_PAT_TOKEN;
    expect(() => getTokenFromEnv()).toThrow('ADO_PAT_TOKEN environment variable is required');
  });
});
