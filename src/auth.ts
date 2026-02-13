import * as azdev from 'azure-devops-node-api';
import { logger } from './logger.js';

/**
 * Creates a connection to Azure DevOps Server using PAT authentication
 * @param serverUrl Full URL including collection (e.g., https://tfs.company.com/DefaultCollection)
 * @param token Personal Access Token
 */
export async function createConnection(
  serverUrl: string,
  token: string
): Promise<azdev.WebApi> {
  logger.info('Creating Azure DevOps connection', {
    serverUrl
  });

  const authHandler = azdev.getPersonalAccessTokenHandler(token);
  const connection = new azdev.WebApi(serverUrl, authHandler);

  // Verify connection by getting core API
  try {
    const coreApi = await connection.getCoreApi();
    const projects = await coreApi.getProjects(undefined, 1);
    logger.info('Connection verified successfully', {
      projectCount: projects?.length || 0
    });
  } catch (error) {
    logger.error('Failed to verify connection', { error });
    throw new Error(`Failed to connect to Azure DevOps Server: ${error instanceof Error ? error.message : String(error)}`);
  }

  return connection;
}

/**
 * Gets PAT token from environment variable
 */
export function getTokenFromEnv(): string {
  const token = process.env.ADO_PAT_TOKEN;
  if (!token) {
    throw new Error('ADO_PAT_TOKEN environment variable is required');
  }
  return token;
}
