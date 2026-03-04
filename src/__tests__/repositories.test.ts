jest.mock('../logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { handleToolCall } from '../tools/repositories.js';

const mockGitApi = {
  getPullRequests: jest.fn(),
  getPullRequest: jest.fn(),
  createPullRequest: jest.fn(),
  updatePullRequest: jest.fn(),
  getThreads: jest.fn(),
  createThread: jest.fn(),
  getRepositories: jest.fn(),
  getRefs: jest.fn(),
  getItem: jest.fn(),
  getCommits: jest.fn(),
};

const mockConnection = { getGitApi: jest.fn().mockResolvedValue(mockGitApi) } as any;
const connectionProvider = jest.fn().mockResolvedValue(mockConnection);

beforeEach(() => {
  Object.values(mockGitApi).forEach((fn) => (fn as jest.Mock).mockReset());
});

describe('repositories handleToolCall', () => {
  test('mcp_ado_repos_list_pull_requests - 回傳 PR 清單', async () => {
    mockGitApi.getPullRequests.mockResolvedValue([{ pullRequestId: 1 }]);
    const result = await handleToolCall('mcp_ado_repos_list_pull_requests', {
      repositoryId: 'repo1',
      project: 'MyProject',
      status: 'active',
      top: 5,
    }, connectionProvider);
    expect(mockGitApi.getPullRequests).toHaveBeenCalledWith('repo1', expect.objectContaining({ status: 'active' }), 'MyProject', undefined, undefined, 5);
    expect(JSON.parse(result.content[0].text)).toHaveLength(1);
  });

  test('mcp_ado_repos_get_pull_request - 回傳 PR 詳情', async () => {
    mockGitApi.getPullRequest.mockResolvedValue({ pullRequestId: 42 });
    const result = await handleToolCall('mcp_ado_repos_get_pull_request', {
      pullRequestId: 42,
      repositoryId: 'repo1',
      project: 'MyProject',
    }, connectionProvider);
    expect(mockGitApi.getPullRequest).toHaveBeenCalledWith('repo1', 42, 'MyProject');
    expect(JSON.parse(result.content[0].text)).toMatchObject({ pullRequestId: 42 });
  });

  test('mcp_ado_repos_create_pull_request - 帶上 sourceRefName/targetRefName', async () => {
    mockGitApi.createPullRequest.mockResolvedValue({ pullRequestId: 99 });
    await handleToolCall('mcp_ado_repos_create_pull_request', {
      repositoryId: 'repo1',
      project: 'MyProject',
      sourceBranch: 'feature/x',
      targetBranch: 'main',
      title: 'New Feature',
    }, connectionProvider);
    const prArg = mockGitApi.createPullRequest.mock.calls[0][0];
    expect(prArg.sourceRefName).toBe('refs/heads/feature/x');
    expect(prArg.targetRefName).toBe('refs/heads/main');
    expect(prArg.title).toBe('New Feature');
  });

  test('mcp_ado_repos_update_pull_request - 更新狀態與標題', async () => {
    mockGitApi.updatePullRequest.mockResolvedValue({ pullRequestId: 10 });
    await handleToolCall('mcp_ado_repos_update_pull_request', {
      pullRequestId: 10,
      repositoryId: 'repo1',
      project: 'MyProject',
      status: 'completed',
      title: 'Updated',
    }, connectionProvider);
    const prArg = mockGitApi.updatePullRequest.mock.calls[0][0];
    expect(prArg.status).toBe('completed');
    expect(prArg.title).toBe('Updated');
  });

  test('mcp_ado_repos_get_pr_threads - 回傳討論串', async () => {
    mockGitApi.getThreads.mockResolvedValue([{ id: 1 }]);
    const result = await handleToolCall('mcp_ado_repos_get_pr_threads', {
      pullRequestId: 5,
      repositoryId: 'repo1',
      project: 'MyProject',
    }, connectionProvider);
    expect(mockGitApi.getThreads).toHaveBeenCalledWith('repo1', 5, 'MyProject');
    expect(JSON.parse(result.content[0].text)).toHaveLength(1);
  });

  test('mcp_ado_repos_create_pr_thread - 建立新討論串', async () => {
    mockGitApi.createThread.mockResolvedValue({ id: 20 });
    await handleToolCall('mcp_ado_repos_create_pr_thread', {
      pullRequestId: 5,
      repositoryId: 'repo1',
      project: 'MyProject',
      content: 'LGTM',
    }, connectionProvider);
    const threadArg = mockGitApi.createThread.mock.calls[0][0];
    expect(threadArg.comments[0].content).toBe('LGTM');
  });

  test('mcp_ado_repos_list_repositories - 回傳 repo 清單', async () => {
    mockGitApi.getRepositories.mockResolvedValue([{ id: 'r1', name: 'MainRepo' }]);
    const result = await handleToolCall('mcp_ado_repos_list_repositories', {
      project: 'MyProject',
    }, connectionProvider);
    expect(mockGitApi.getRepositories).toHaveBeenCalledWith('MyProject');
    expect(JSON.parse(result.content[0].text)).toHaveLength(1);
  });

  test('mcp_ado_repos_list_branches - 無 filter 使用 heads/', async () => {
    mockGitApi.getRefs.mockResolvedValue([{ name: 'refs/heads/main' }]);
    await handleToolCall('mcp_ado_repos_list_branches', {
      repositoryId: 'repo1',
      project: 'MyProject',
    }, connectionProvider);
    expect(mockGitApi.getRefs).toHaveBeenCalledWith('repo1', 'MyProject', 'heads/');
  });

  test('mcp_ado_repos_list_branches - 有 filter 使用 heads/{filter}', async () => {
    mockGitApi.getRefs.mockResolvedValue([]);
    await handleToolCall('mcp_ado_repos_list_branches', {
      repositoryId: 'repo1',
      project: 'MyProject',
      filter: 'feature',
    }, connectionProvider);
    expect(mockGitApi.getRefs).toHaveBeenCalledWith('repo1', 'MyProject', 'heads/feature');
  });

  test('mcp_ado_repos_get_item - 取得檔案內容', async () => {
    mockGitApi.getItem.mockResolvedValue({ content: 'hello world' });
    const result = await handleToolCall('mcp_ado_repos_get_item', {
      repositoryId: 'repo1',
      path: '/src/app.ts',
      project: 'MyProject',
    }, connectionProvider);
    expect(JSON.parse(result.content[0].text).content).toBe('hello world');
  });

  test('mcp_ado_repos_get_item - 有 branch 時傳 versionDescriptor', async () => {
    mockGitApi.getItem.mockResolvedValue({});
    await handleToolCall('mcp_ado_repos_get_item', {
      repositoryId: 'repo1',
      path: '/src/app.ts',
      project: 'MyProject',
      branch: 'develop',
    }, connectionProvider);
    const versionDesc = mockGitApi.getItem.mock.calls[0][8];
    expect(versionDesc).toMatchObject({ version: 'develop' });
  });

  test('mcp_ado_repos_get_commits - 回傳 commit 清單', async () => {
    mockGitApi.getCommits.mockResolvedValue([{ commitId: 'abc' }]);
    const result = await handleToolCall('mcp_ado_repos_get_commits', {
      repositoryId: 'repo1',
      project: 'MyProject',
      top: 10,
    }, connectionProvider);
    expect(mockGitApi.getCommits).toHaveBeenCalledWith('repo1', expect.any(Object), 'MyProject', undefined, 10);
    expect(JSON.parse(result.content[0].text)).toHaveLength(1);
  });

  test('未知工具名稱回傳 null', async () => {
    const result = await handleToolCall('mcp_ado_unknown', {}, connectionProvider);
    expect(result).toBeNull();
  });
});
