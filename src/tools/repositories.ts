import * as azdev from 'azure-devops-node-api';
import { z } from 'zod';
import { createSuccessResponse } from '../utils.js';
import { logger } from '../logger.js';

export const TOOL_DEFINITIONS = [
  {
    name: 'mcp_ado_repos_list_pull_requests',
    description: 'List pull requests in a repository',
    inputSchema: z.object({
      repositoryId: z.string().describe('Repository ID or name'),
      project: z.string().describe('Project name or ID'),
      status: z.enum(['active', 'abandoned', 'completed', 'all']).optional().describe('PR status filter'),
      creatorId: z.string().optional().describe('Creator user ID'),
      reviewerId: z.string().optional().describe('Reviewer user ID'),
      top: z.number().optional().describe('Maximum number of PRs'),
    }),
  },
  {
    name: 'mcp_ado_repos_get_pull_request',
    description: 'Get pull request details',
    inputSchema: z.object({
      pullRequestId: z.number().describe('Pull request ID'),
      repositoryId: z.string().describe('Repository ID or name'),
      project: z.string().describe('Project name or ID'),
    }),
  },
  {
    name: 'mcp_ado_repos_create_pull_request',
    description: 'Create a new pull request',
    inputSchema: z.object({
      repositoryId: z.string().describe('Repository ID or name'),
      project: z.string().describe('Project name or ID'),
      sourceBranch: z.string().describe('Source branch name'),
      targetBranch: z.string().describe('Target branch name'),
      title: z.string().describe('PR title'),
      description: z.string().optional().describe('PR description'),
      reviewers: z.array(z.string()).optional().describe('Array of reviewer IDs'),
    }),
  },
  {
    name: 'mcp_ado_repos_update_pull_request',
    description: 'Update a pull request',
    inputSchema: z.object({
      pullRequestId: z.number().describe('Pull request ID'),
      repositoryId: z.string().describe('Repository ID or name'),
      project: z.string().describe('Project name or ID'),
      status: z.enum(['active', 'abandoned', 'completed']).optional().describe('PR status'),
      title: z.string().optional().describe('PR title'),
      description: z.string().optional().describe('PR description'),
    }),
  },
  {
    name: 'mcp_ado_repos_get_pr_threads',
    description: 'Get review threads for a pull request',
    inputSchema: z.object({
      pullRequestId: z.number().describe('Pull request ID'),
      repositoryId: z.string().describe('Repository ID or name'),
      project: z.string().describe('Project name or ID'),
    }),
  },
  {
    name: 'mcp_ado_repos_create_pr_thread',
    description: 'Create a review thread on a pull request',
    inputSchema: z.object({
      pullRequestId: z.number().describe('Pull request ID'),
      repositoryId: z.string().describe('Repository ID or name'),
      project: z.string().describe('Project name or ID'),
      content: z.string().describe('Comment content'),
      status: z.enum(['active', 'fixed', 'wontFix', 'closed', 'byDesign', 'pending']).optional().describe('Thread status'),
    }),
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
