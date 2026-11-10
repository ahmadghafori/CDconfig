/**
 * Types for the Cluster & Service Response and JSON Crack Graph Engine
 */

export interface ProductItem {
  product: string;
  branchMain: string;
  productName: string;
}

export interface ExposureStatus {
  ingressEnabled: boolean;
  httprouteEnabled: boolean;
  routeEnabled: boolean;
}

export interface ExposureConfig {
  ingressClassName?: string;
  gatewayName?: string;
  gatewayNamespace?: string;
  gatewaySectionName?: string;
}

export interface ArgoCDConfig {
  address: string;
  user: string;
  pass?: string;
  token?: string;
  applicationTemplate?: {
    project: string;
    destination: {
      server: string;
    };
    syncpolicy?: {
      automated?: {
        prune: boolean;
        selfHeal: boolean;
      };
      syncOptions?: Array<{ key: string; value: string; valueType: string }>;
    };
  };
}

export interface KubernetesConfig {
  domainZone: string | null;
}

export interface ClusterDetails {
  clusterType: number;
  exposureStatus: ExposureStatus;
  exposure: ExposureConfig;
  clouds?: any[];
  argoCD?: ArgoCDConfig;
  kubernetes?: KubernetesConfig;
}

export interface ClusterGetResult {
  guid: string;
  id: number;
  realmGuid: string;
  clientGuid: string;
  accessKey?: string;
  title: string;
  isActive: boolean;
  releaseChannelsGuid?: string;
  releaseChannelsName?: string;
  integrationConfigGuid?: string | null;
  clusterConfig: ClusterDetails;
  clusterType?: any;
  exposure?: any;
}

export interface ConsulServiceConfig {
  url: string;
  token?: string;
  project?: string;
  [key: string]: any;
}

export interface JaegerServiceConfig {
  ui: string;
  collector?: string;
  [key: string]: any;
}

export interface RegistryConfig {
  name: string;
  url: string;
  username?: string;
  password?: string;
  repositoryType?: number;
  registeryType?: number;
  syncDirection?: any;
  isActive?: boolean;
  description?: string;
  [key: string]: any;
}

export interface ServiceItemConfig {
  guid?: string;
  id?: number;
  title?: string;
  systemTitle?: string;
  createDate?: string;
  configString?: string | null;
  config?: {
    consul?: ConsulServiceConfig | null;
    jaeger?: JaegerServiceConfig | null;
    registery?: RegistryConfig | null;
    [key: string]: any;
  };
  serviceType?: number;
  systemType?: number;
  isactive?: boolean;
  store?: any;
  stateName?: string;
  defaultService?: boolean;
  // Support direct flattened properties as in new format:
  url?: string;
  token?: string;
  project?: string;
  ui?: string;
  collector?: string;
  name?: string;
  username?: string;
  [key: string]: any;
}

export interface ClusterConfigInfo {
  clusterGetResult: ClusterGetResult | null;
  consulConfig: (ConsulServiceConfig & ServiceItemConfig) | null;
  jaegerConfig: (JaegerServiceConfig & ServiceItemConfig) | null;
  coderConfig: any | null;
  register: (RegistryConfig & ServiceItemConfig) | null;
}

export interface ClusterItem {
  isCluster: boolean;
  clusterConfigInfo: ClusterConfigInfo | null;
  project: string | null;
  projectName: string | null;
  isProduct: boolean;
  productlist: ProductItem[] | null;
  [key: string]: any;
}

// Graph Representation Types for JSON Crack style diagram
export type JsonPrimitiveType = 'string' | 'number' | 'boolean' | 'null';
export type JsonValueType = JsonPrimitiveType | 'object' | 'array';

export interface NodeRowField {
  id: string;
  key: string;
  value: any;
  valueType: JsonValueType;
  childNodeId?: string;
  isExpandable: boolean;
  isExpanded: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'object' | 'array' | 'root' | 'cluster';
  rawPath: string;
  depth: number;
  fields: NodeRowField[];
  x: number;
  y: number;
  width: number;
  height: number;
  isCollapsed: boolean;
  childNodeIds: string[];
  parentId?: string;
  itemCount?: number;
  isClusterNode?: boolean;
  isActionNode?: boolean;
  actionMetadata?: {
    productId: string;
    productName: string;
    branchGuid: string;
    projectGuid: string;
    packageGuid?: string | null;
  };
  metadata?: {
    isCluster?: boolean;
    projectName?: string | null;
    title?: string;
    productCount?: number;
    realmGuid?: string;
    realmChildCount?: number;
  };
}

export interface GraphEdge {
  id: string;
  sourceNodeId: string;
  sourceRowId: string;
  targetNodeId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  label?: string;
}

export type ViewMode = 'graph' | 'tree' | 'topology' | 'json';
