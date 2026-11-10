import { ServiceConfig } from '../config/apiConfig';
import {
  ApiResponse,
  HelmChartBuildData,
  HelmChartPublishingResults,
  InstallModuleCommand,
} from '../types/actionTypes';

/**
 * ارسال Mutationهای پایپ‌لاین محصول از طریق GraphQL.
 * هدرهای Context پروژه و توکن در تمام درخواست‌ها ارسال می‌شوند.
 */
type CloudProviderGraphqlEnum = 'Abriment' | 'ArvanCloud';

/**
 * تبدیل مقدار عددی enum دات‌نت به نام متنی مورد انتظار GraphQL.
 * GraphQL برای Enum مقدار عددی نمی‌پذیرد.
 */
function normalizeCloudProvider(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;

  const normalized = { ...(input as Record<string, unknown>) };
  const key = Object.keys(normalized).find((name) => name.toLowerCase() === 'cloudprovider');
  if (!key) return input;

  const value = normalized[key];
  const enumNames: Record<number, CloudProviderGraphqlEnum> = {
    0: 'Abriment',
    1: 'ArvanCloud',
  };

  if (typeof value === 'number') {
    const enumName = enumNames[value];
    if (!enumName) {
      throw new Error(`مقدار CloudProvider نامعتبر است: ${value}. مقادیر مجاز: 0 (Abriment)، 1 (ArvanCloud).`);
    }
    normalized[key] = enumName;
  } else if (typeof value === 'string' && /^\\d+$/.test(value)) {
    const enumName = enumNames[Number(value)];
    if (!enumName) {
      throw new Error(`مقدار CloudProvider نامعتبر است: ${value}. مقادیر مجاز: 0 (Abriment)، 1 (ArvanCloud).`);
    }
    normalized[key] = enumName;
  }

  return normalized;
}

async function postGraphqlMutation<T>(
  config: ServiceConfig,
  operationName: string,
  query: string,
  input: unknown,
  context?: { projectGuid?: string; branchGuid?: string }
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'resource-type': 'PROJECT',
  };

  if (operationName === 'GenerateHemlChart' || operationName === 'AddProductHelmChart' || operationName === 'AddModuleProduct') {
    // شناسه‌ها باید از Context فعلی پروژه و شاخه main بیایند.
    // در صورت ناقص بودن Context، درخواست ناقص به بک‌اند ارسال نشود.
    const headerContext = context || (input as { projectGuid?: string; branchGuid?: string });
    const projectGuid = headerContext.projectGuid?.trim();
    const branchGuid = headerContext.branchGuid?.trim();

    if (!projectGuid || !branchGuid) {
      throw new Error('ارسال عملیات ممکن نیست: شناسه پروژه یا شاخه اصلی (main) موجود نیست.');
    }

    headers['resource-ref-id'] = projectGuid;
    headers['branch-id'] = branchGuid;
  }

  if (config.token?.trim()) {
    const token = config.token.trim();
    headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  const endpoint = config.productActionsGraphqlEndpoint?.trim() || 'https://studio-gateway-gen3.depna.ir/kcsrv/graphql';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    cache: 'no-store',
    body: JSON.stringify({
      query,
      variables: { input: normalizeCloudProvider(input) },
      operationName,
    }),
  });

  const rawBody = await response.text();
  let envelope: any;
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return {
      data: null as T,
      statusCode: response.status,
      httpStatus: response.status,
      message: rawBody.trim() ? 'پاسخ GraphQL معتبر نیست.' : 'سرویس GraphQL پاسخ خالی برگرداند.',
      rawResponse: rawBody,
      isSuccessful: false,
    };
  }

  if (Array.isArray(envelope?.errors) && envelope.errors.length > 0) {
    const message = envelope.errors.map((error: any) => error?.message).filter(Boolean).join(' | ');
    return {
      data: null as T,
      statusCode: response.status,
      httpStatus: response.status,
      message: message || 'خطای GraphQL رخ داد.',
      exception: envelope.errors,
      rawResponse: rawBody,
      isSuccessful: false,
    };
  }

  const result = envelope?.data?.[operationName];
  if (!response.ok || !result || typeof result !== 'object') {
    return {
      data: null as T,
      statusCode: response.status,
      httpStatus: response.status,
      message: result?.message || `خطای HTTP ${response.status}`,
      rawResponse: rawBody,
      isSuccessful: false,
    };
  }

  const responseData = result.data ?? null;
  if (operationName === 'GenerateHemlChart' && responseData?.version && typeof responseData.version === 'object') {
    const versionParts = [
      responseData.version.major,
      responseData.version.minor,
      responseData.version.build,
      responseData.version.revision,
    ];
    while (versionParts.length > 2 && (versionParts[versionParts.length - 1] === -1 || versionParts[versionParts.length - 1] == null)) {
      versionParts.pop();
    }
    responseData.version = versionParts.join('.');
  }

  const subStatuses = Array.isArray(result.subStatuses) ? result.subStatuses : undefined;
  const subMessages = (subStatuses || [])
    .map((item: any) => item?.message)
    .filter((message: unknown): message is string => typeof message === 'string' && message.trim().length > 0);

  const isSuccessful =
    result.isSuccessful === true ||
    (result.isSuccessful == null &&
      typeof result.statusCode === 'number' &&
      result.statusCode >= 200 &&
      result.statusCode < 300 &&
      result.data !== null &&
      result.data !== undefined);

  return {
    ...result,
    data: responseData,
    statusCode: typeof result.statusCode === 'number' ? result.statusCode : response.status,
    httpStatus: response.status,
    message: result.message || subMessages.join(' | ') || (isSuccessful ? 'عملیات با موفقیت انجام شد.' : 'سرور موفقیت عملیات را تأیید نکرد.'),
    subStatuses,
    isSuccessful,
  } as ApiResponse<T>;
}

const GENERATE_HELM_CHART_MUTATION = `mutation GenerateHemlChart($input: InstallModuleCommandInput!) {
  GenerateHemlChart(input: $input) {
    statusCode message requestId isSuccessful
    data { version { major minor build revision } packageGuid_SC packageName solutionName product }
    subStatuses { subject subStatusCode message subActionType }
  }
}`;

const ADD_PRODUCT_HELM_CHART_MUTATION = `mutation AddProductHelmChart($input: HelmChartPublishingResultsInput!) {
  AddProductHelmChart(input: $input) {
    statusCode message requestId isSuccessful data
    subStatuses { subject subStatusCode message subActionType }
  }
}`;

const ADD_MODULE_PRODUCT_MUTATION = `mutation AddModuleProduct($input: InstallModuleProductCommandInput!) {
  AddModuleProduct(input: $input) {
    statusCode message requestId isSuccessful data
    subStatuses { subject subStatusCode message subActionType }
  }
}`;

/**
 * تبدیل نسخه متنی به ساختار System.Version مورد انتظار GraphQL.
 */
function toGraphqlVersion(version: string): { major: number; minor: number; build: number; revision: number } {
  const parts = version.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length < 2 || parts.length > 4 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`فرمت Version معتبر نیست: ${version}`);
  }
  return {
    major: parts[0],
    minor: parts[1],
    build: parts.length > 2 ? parts[2] : -1,
    revision: parts.length > 3 ? parts[3] : -1,
  };
}

/**
 * 1) ساخت HelmChart از طریق GraphQL.
 */
export async function executeBuildHelmChart(
  command: InstallModuleCommand,
  config: ServiceConfig
): Promise<ApiResponse<HelmChartBuildData>> {
  return postGraphqlMutation<HelmChartBuildData>(
    config,
    'GenerateHemlChart',
    GENERATE_HELM_CHART_MUTATION,
    command
  );
}

/**
 * 2) ثبت Package در Helm Registry از طریق GraphQL.
 */
export async function executeRetryPublishPackage(
  params: HelmChartPublishingResults,
  config: ServiceConfig
): Promise<ApiResponse<string>> {
  const { projectGuid: _projectGuid, branchGuid: _branchGuid, ...input } = params;
  const graphqlInput = { ...input, version: toGraphqlVersion(params.version) };
  return postGraphqlMutation<string>(
    config,
    'AddProductHelmChart',
    ADD_PRODUCT_HELM_CHART_MUTATION,
    graphqlInput,
    { projectGuid: params.projectGuid, branchGuid: params.branchGuid }
  );
}

/**
 * 3) ساخت ModuleProduct از طریق GraphQL؛ PackageGuid داخل input ارسال می‌شود، نه URL.
 */
export async function executeAddModuleProduct(
  packageGuid: string,
  command: InstallModuleCommand,
  config: ServiceConfig
): Promise<ApiResponse<string>> {
  const input = { ...command, packageGuid };
  return postGraphqlMutation<string>(
    config,
    'AddModuleProduct',
    ADD_MODULE_PRODUCT_MUTATION,
    input
  );
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
