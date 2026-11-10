import { ServiceConfig } from '../config/apiConfig';
import {
  ApiResponse,
  HelmChartBuildData,
  HelmChartPublishingResults,
  InstallModuleCommand,
} from '../types/actionTypes';

/**
 * Resolve a complete endpoint URL from either an absolute or relative endpoint.
 */
function resolveEndpointUrl(baseUrl: string, endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  try {
    const parsedBase = new URL(baseUrl);
    return new URL(endpoint, parsedBase.origin).toString();
  } catch {
    return endpoint;
  }
}

/**
 * Read the response body exactly once and normalize HTTP + business-level errors.
 * A 2xx response is not considered successful unless the API explicitly returns
 * isSuccessful: true.
 */
async function parseApiResponse<T>(res: Response): Promise<ApiResponse<T>> {
  const rawBody = await res.text();
  let body: any = null;
  let parseError: string | null = null;

  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      parseError = 'پاسخ سرویس JSON معتبر نیست.';
    }
  } else {
    parseError = 'سرویس پاسخ خالی برگرداند.';
  }

  const responseObject =
    body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const subStatuses = Array.isArray(responseObject.subStatuses)
    ? responseObject.subStatuses
    : undefined;
  const subStatusMessages = (subStatuses || [])
    .map((item: any) => item?.message)
    .filter((message: unknown): message is string =>
      typeof message === 'string' && message.trim().length > 0
    );

  const fallbackMessage = !res.ok
    ? `خطای HTTP ${res.status}${res.statusText ? ` (${res.statusText})` : ''}`
    : parseError || 'سرویس عملیات را با موفقیت تأیید نکرد.';

  const message =
    (typeof responseObject.message === 'string' && responseObject.message.trim()) ||
    subStatusMessages.join(' | ') ||
    fallbackMessage;

  return {
    ...responseObject,
    data: responseObject.data ?? null,
    statusCode:
      typeof responseObject.statusCode === 'number'
        ? responseObject.statusCode
        : res.status,
    httpStatus: res.status,
    message,
    subStatuses,
    rawResponse: parseError ? rawBody : responseObject.rawResponse,
    isSuccessful: res.ok && responseObject.isSuccessful === true,
  } as ApiResponse<T>;
}

/**
 * Shared POST helper. Network errors are deliberately allowed to propagate;
 * they must never be converted into a fabricated successful response.
 */
async function postJson<T>(
  url: string,
  headers: Record<string, string>,
  payload: unknown
): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseApiResponse<T>(res);
}

const PROJECT_RESOURCE_BRANCH_ID = '00000000-0000-0000-0000-000000000000';

function createHeaders(
  config: ServiceConfig,
  extra: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };

  if (config.token?.trim()) {
    const token = config.token.trim();
    headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  return headers;
}

/**
 * 1) Build HelmChart.
 */
export async function executeBuildHelmChart(
  command: InstallModuleCommand,
  config: ServiceConfig
): Promise<ApiResponse<HelmChartBuildData>> {
  const targetUrl = resolveEndpointUrl(config.serviceUrl, config.helmChartEndpoint);
  const headers = createHeaders(config, {
    'resource-type': 'PROJECT',
    'resource-ref-id': command.projectGuid,
    'branch-id': PROJECT_RESOURCE_BRANCH_ID,
  });

  return postJson<HelmChartBuildData>(targetUrl, headers, {
    branchGuid: command.branchGuid,
    projectGuid: command.projectGuid,
    productGuid: command.productGuid,
  });
}

/**
 * 2) Retry publishing the package to the Helm registry.
 */
export async function executeRetryPublishPackage(
  params: HelmChartPublishingResults,
  config: ServiceConfig
): Promise<ApiResponse<string>> {
  const targetUrl = resolveEndpointUrl(config.serviceUrl, config.publishPackageEndpoint);
  const headers = createHeaders(config, {
    'resource-type': 'PROJECT',
    'resource-ref-id': params.projectGuid,
    'branch-id': PROJECT_RESOURCE_BRANCH_ID,
  });

  const payload: HelmChartPublishingResults = {
    version: params.version || '0.0.0',
    packageGuid_SC: params.packageGuid_SC,
    packageName: params.packageName,
    solutionName: params.solutionName,
    product: params.product,
  };

  return postJson<string>(targetUrl, headers, payload);
}

/**
 * 3) Create ModuleProduct using AddModuleProduct/{PackageGuid}.
 */
export async function executeAddModuleProduct(
  packageGuid: string,
  command: InstallModuleCommand,
  config: ServiceConfig
): Promise<ApiResponse<string>> {
  const baseEndpoint = resolveEndpointUrl(config.serviceUrl, config.addModuleProductEndpoint);
  let targetUrl: string;

  if (baseEndpoint.includes('{PackageGuid}')) {
    targetUrl = baseEndpoint.replace('{PackageGuid}', packageGuid);
  } else if (baseEndpoint.endsWith('/')) {
    targetUrl = `${baseEndpoint}${packageGuid}`;
  } else {
    targetUrl = `${baseEndpoint}/${packageGuid}`;
  }

  const headers = createHeaders(config, {
    'resource-type': 'PROJECT',
    'resource-ref-id': command.projectGuid,
    'branch-id': command.branchGuid,
  });

  return postJson<string>(targetUrl, headers, {
    branchGuid: command.branchGuid,
    projectGuid: command.projectGuid,
    productGuid: command.productGuid,
  });
}

/**
 * Detect the special case where the package was built but is not yet available
 * in the Helm registry. Exception objects are included in the text scan.
 */
export function checkIsRegistryNotFoundError(response: ApiResponse<any>): boolean {
  if (!response) return false;
  const exceptionText =
    typeof response.exception === 'string'
      ? response.exception
      : response.exception
      ? JSON.stringify(response.exception)
      : '';

  const messagesToCheck = [
    response.message || '',
    ...(response.subStatuses?.map((item) => item.message || '') || []),
    exceptionText,
  ];

  const fullText = messagesToCheck.join(' ').toLowerCase();
  return (
    fullText.includes('was not found in the helm registry') ||
    fullText.includes('helm registry') ||
    fullText.includes('not found in the helm')
  );
}
