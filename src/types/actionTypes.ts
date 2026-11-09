/**
 * انواع داده‌ها و دستورات مربوط به پایپ‌لاین محصول (HelmChart & ModuleProduct)
 */

export interface InstallModuleCommand {
  branchGuid: string;
  projectGuid: string;
  productGuid: string;
  moduleType?: number[] | null;
}

export interface HelmChartPublishingResults {
  version: string;
  packageGuid_SC: string;
  packageName?: string;
  solutionName?: string;
  product?: string;
}

export interface SubStatusItem {
  subject?: string | null;
  subStatusCode: number;
  message?: string | null;
  exception?: any;
  subActionType?: number;
}

export type ProductActionOperation = 'helm' | 'publish' | 'module';

export interface OperationFailure {
  operation: ProductActionOperation;
  message: string;
  statusCode?: number;
  httpStatus?: number;
  requestId?: string | null;
  exception?: any;
  subStatuses?: SubStatusItem[];
  rawResponse?: string;
}

export interface ApiResponse<T = any> {
  data: T;
  statusCode: number;
  httpStatus?: number;
  message?: string;
  mode?: number;
  actionType?: number;
  requestId?: string | null;
  exception?: any;
  subStatuses?: SubStatusItem[];
  resourceGuid?: string | null;
  resourceType?: string | null;
  resourceText?: string | null;
  resourceVersion?: string | null;
  noLog?: boolean;
  rawResponse?: string;
  isSuccessful: boolean;
}

export interface HelmChartBuildData {
  version: string;
  packageGuid_SC: string;
  packageName: string;
  solutionName: string;
  product: string;
}

export type ProductActionStep =
  | 'idle'
  | 'building_helm'
  | 'helm_success'
  | 'helm_warning_registry'
  | 'publishing_package'
  | 'package_published'
  | 'adding_module'
  | 'module_success'
  | 'error';

export interface ProductActionState {
  productId: string;
  productName: string;
  branchGuid: string;
  projectGuid: string;
  step: ProductActionStep;
  helmBuildData?: HelmChartBuildData | null;
  packageGuid?: string | null;
  moduleGuid?: string | null;
  lastMessage?: string | null;
  errorMessage?: string | null;
  requiresPublishRetry?: boolean;
  lastResponse?: any;
  operationErrors?: Partial<Record<ProductActionOperation, OperationFailure>>;
  timestamp?: string;
}
