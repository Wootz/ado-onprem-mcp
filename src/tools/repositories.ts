import * as azdev from 'azure-devops-node-api';
import { createSuccessResponse } from '../utils.js';
import { logger } from '../logger.js';

export const TOOL_DEFINITIONS = [
  {
    name: 'mcp_ado_repos_list_pull_requests',
    description: 'List pull requests in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repositoryId: { type: 'string', description: 'Repository ID or name' },
        project: { type: 'string', description: 'Project name or ID' },
        status: {
          type: 'string',
          enum: ['active', 'abandoned', 'completed', 'all'],
          description: 'PR status filter',
        },
        creatorId: { type: 'string', description: 'Creator user ID' },
        reviewerId: { type: 'string', description: 'Reviewer user ID' },
        top: { type: 'number', description: 'Maximum number of PRs' },
      },
      required: ['repositoryId', 'project'],
    },
  },
  {
    name: 'mcp_ado_repos_get_pull_request',
    description: 'Get pull request details',
    inputSchema: {
      type: 'object',
      properties: {
        pullRequestId: { type: 'number', description: 'Pull request ID' },
        repositoryId: { type: 'string', description: 'Repository ID or name' },
        project: { type: 'string', description: 'Project name or ID' },
      },
      required: ['pullRequestId', 'repositoryId', 'project'],
    },
  },
  {
    name: 'mcp_ado_repos_create_pull_request',
    description: 'Create a new pull request',
    inputSchema: {
      type: 'object',
      properties: {
        repositoryId: { type: 'string', description: 'Repository ID or name' },
        project: { type: 'string', description: 'Project name or ID' },
        sourceBranch: { type: 'string', description: 'Source branch name' },
        targetBranch: { type: 'string', description: 'Target branch name' },
        title: { type: 'string', description: 'PR title' },
        description: { type: 'string', description: 'PR description' },
        reviewers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of reviewer IDs',
        },
      },
      required: ['repositoryId', 'project', 'sourceBranch', 'targetBranch', 'title'],
    },
  },
  {
    name: 'mcp_ado_repos_update_pull_request',
    description: 'Update a pull request',
    inputSchema: {
      type: 'object',
      properties: {
        pullRequestId: { type: 'number', description: 'Pull request ID' },
        repositoryId: { type: 'string', description: 'Repository ID or name' },
        project: { type: 'string', description: 'Project name or ID' },
        status: {
          type: 'string',
          enum: ['active', 'abandoned', 'completed'],
          description: 'PR status',
        },
        title: { type: 'string', description: 'PR title' },
        description: { type: 'string', description: 'PR description' },
      },
      required: ['pullRequestId', 'repositoryId', 'project'],
    },
  },
  {
    name: 'mcp_ado_repos_get_pr_threads',
    description: 'Get review threads for a pull request',
    inputSchema: {
      type: 'object',
      properties: {
        pullRequestId: { type: 'number', description: 'Pull request ID' },
        repositoryId: { type: 'string', description: 'Repository ID or name' },
        project: { type: 'string', description: 'Project name or ID' },
      },
      required: ['pullRequestId', 'repositoryId', 'project'],
    },
  },
  {
    name: 'mcp_ado_repos_create_pr_thread',
    description: 'Create a review thread on a pull request',
    inputSchema: {
      type: 'object',
      properties: {
        pullRequestId: { type: 'number', description: 'Pull request ID' },
        repositoryId: { type: 'string', description: 'Repository ID or name' },
        project: { type: 'string', description: 'Project name or ID' },
        content: { type: 'string', description: 'Comment content' },
        status: {
          type: 'string',
          enum: ['active', 'fixed', 'wontFix', 'closed', 'byDesign', 'pending'],
          description: 'Thread status',
        },
      },
      required: ['pullRequestId', 'repositoryId', 'project', 'content'],
    },
  },
];

export async function handleToolCall(
  name: string,
  args: any,
  connectionProvider: () => Promise<azdev.WebApi>
): Promise<any> {
  const connection = await connectionProvider();
  const gitApi = await connection.getGitApi();

  switch (name) {
    case 'mcp_ado_repos_list_pull_requests': {
      logger.info('Executing mcp_ado_repos_list_pull_requests', args);
      const { repositoryId, project, status, creatorId, reviewerId, top } = args as {
        repositoryId: string;
        project: string;
        status?: string;
        creatorId?: string;
        reviewerId?: string;
        top?: number;
      };
      const searchCriteria: any = {
        status,
        creatorId,
        reviewerId,
      };
      const prs = await gitApi.getPullRequests(repositoryId, searchCriteria, project, undefined, undefined, top);
      return createSuccessResponse(prs);
    }

    case 'mcp_ado_repos_get_pull_request': {
      logger.info('Executing mcp_ado_repos_get_pull_request', args);
      const { pullRequestId, repositoryId, project } = args as {
        pullRequestId: number;
        repositoryId: string;
        project: string;
      };
      const pr = await gitApi.getPullRequest(repositoryId, pullRequestId, project);
      return createSuccessResponse(pr);
    }

    case 'mcp_ado_repos_create_pull_request': {
      logger.info('Executing mcp_ado_repos_create_pull_request', args);
      const { repositoryId, project, sourceBranch, targetBranch, title, description, reviewers } = args as {
        repositoryId: string;
        project: string;
        sourceBranch: string;
        targetBranch: string;
        title: string;
        description?: string;
        reviewers?: string[];
      };

      const gitPullRequest = {
        sourceRefName: `refs/heads/${sourceBranch}`,
        targetRefName: `refs/heads/${targetBranch}`,
        title,
        description,
        reviewers: reviewers?.map((id) => ({ id })),
      };

      const pr = await gitApi.createPullRequest(gitPullRequest, repositoryId, project);
      return createSuccessResponse(pr);
    }

    case 'mcp_ado_repos_update_pull_request': {
      logger.info('Executing mcp_ado_repos_update_pull_request', args);
      const { pullRequestId, repositoryId, project, status, title, description } = args as {
        pullRequestId: number;
        repositoryId: string;
        project: string;
        status?: string;
        title?: string;
        description?: string;
      };

      const gitPullRequest: any = {};
      if (status) gitPullRequest.status = status;
      if (title) gitPullRequest.title = title;
      if (description) gitPullRequest.description = description;

      const pr = await gitApi.updatePullRequest(gitPullRequest, repositoryId, pullRequestId, project);
      return createSuccessResponse(pr);
    }

    case 'mcp_ado_repos_get_pr_threads': {
      logger.info('Executing mcp_ado_repos_get_pr_threads', args);
      const { pullRequestId, repositoryId, project } = args as {
        pullRequestId: number;
        repositoryId: string;
        project: string;
      };
      const threads = await gitApi.getThreads(repositoryId, pullRequestId, project);
      return createSuccessResponse(threads);
    }

    case 'mcp_ado_repos_create_pr_thread': {
      logger.info('Executing mcp_ado_repos_create_pr_thread', args);
      const { pullRequestId, repositoryId, project, content, status } = args as {
        pullRequestId: number;
        repositoryId: string;
        project: string;
        content: string;
        status?: string;
      };

      const thread: any = {
        comments: [{ content }],
        status: status || 1, // 1 = active
      };

      const createdThread = await gitApi.createThread(thread, repositoryId, pullRequestId, project);
      return createSuccessResponse(createdThread);
    }

    default:
      return null;
  }
}
