import { GraphEdge, GraphNode, JsonValueType, NodeRowField } from '../types/dataTypes';

export interface LayoutOptions {
  filterEmptyClusters?: boolean;
  searchQuery?: string;
  horizontalSpacing?: number;
  verticalSpacing?: number;
  nodeWidth?: number;
  rowHeight?: number;
  headerHeight?: number;
  maxAutoExpandDepth?: number;
}

const DEFAULT_NODE_WIDTH = 270;
const DEFAULT_ROW_HEIGHT = 26;
const DEFAULT_HEADER_HEIGHT = 36;
const DEFAULT_HORIZ_SPACING = 85;
const DEFAULT_VERT_SPACING = 20;

/**
 * تشخیص نوع داده جیسون
 */
function getValueType(val: any): JsonValueType {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  const type = typeof val;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return type;
  }
  if (type === 'object') return 'object';
  return 'string';
}

/**
 * تبدیل داده به نودهای گرافی با کارایی بسیار بالا و سبک شبیه JSON Crack
 */
export function buildJsonGraph(
  rawData: any,
  collapsedMap: Record<string, boolean> = {},
  options: LayoutOptions = {}
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodeWidth = options.nodeWidth || DEFAULT_NODE_WIDTH;
  const rowHeight = options.rowHeight || DEFAULT_ROW_HEIGHT;
  const headerHeight = options.headerHeight || DEFAULT_HEADER_HEIGHT;
  const horizSpacing = options.horizontalSpacing || DEFAULT_HORIZ_SPACING;
  const vertSpacing = options.verticalSpacing || DEFAULT_VERT_SPACING;
  // به صورت پیش‌فرض عمق خودکار روی ۱ قرار دارد تا عملکرد فوق‌العاده سریع (60fps) باشد
  const defaultAutoDepth = options.maxAutoExpandDepth !== undefined ? options.maxAutoExpandDepth : 1;

  // طبق خواسته صریح کاربر: مواردی که isCluster برابر false هستند نباید نشان داده شوند
  let dataToProcess = rawData;
  if (Array.isArray(rawData)) {
    const clusterItems = rawData.filter((item) => item && item.isCluster === true);
    const realmGroups = new Map<string, any[]>();

    clusterItems.forEach((item, index) => {
      const realmGuid = item?.clusterConfigInfo?.clusterGetResult?.realmGuid || item?.realmGuid;
      // Keep records without a realm identifier separate rather than merging unrelated data.
      const groupKey = typeof realmGuid === 'string' && realmGuid.trim()
        ? realmGuid
        : `__unassigned_realm_${index}`;
      const group = realmGroups.get(groupKey) || [];
      group.push(item);
      realmGroups.set(groupKey, group);
    });

    dataToProcess = Array.from(realmGroups.entries()).map(([realmGuid, children]) => ({
      __isRealmGroup: true,
      realmGuid: realmGuid.startsWith('__unassigned_realm_') ? '' : realmGuid,
      children,
    }));
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let nextNodeId = 1;

  // مرحله ۱: ایجاد ساختار نودها به صورت بازگشتی با بهینه‌سازی بارگذاری
  function createNode(
    data: any,
    label: string,
    rawPath: string,
    depth: number,
    parentId?: string,
    parentProjectGuid?: string
  ): string {
    const currentId = `node_${nextNodeId++}`;
    const isArray = Array.isArray(data);
    const isObject = data !== null && typeof data === 'object' && !isArray;

    // تشخیص وضعیت باز یا بسته بودن:
    // اولویت با مقدار صریح کاربر در collapsedMap بر اساس path یا ID
    let isCollapsed: boolean;
    if (collapsedMap[rawPath] !== undefined) {
      isCollapsed = collapsedMap[rawPath];
    } else if (collapsedMap[currentId] !== undefined) {
      isCollapsed = collapsedMap[currentId];
    } else {
      // قانون پیش‌فرض هوشمند: ریشه و کلاسترها بازند، شاخه‌های خیلی عمیق بسته هستند
      isCollapsed = depth > defaultAutoDepth;
    }

    const fields: NodeRowField[] = [];
    const childNodeIds: string[] = [];

    // متادیتاهای خاص برای کلاسترها و ردیابی ProjectGuid
    const isRealmGroup = isObject && data.__isRealmGroup === true;
    const realmChildCount = isRealmGroup && Array.isArray(data.children) ? data.children.length : undefined;
    const realmGuid = isRealmGroup ? data.realmGuid : undefined;
    const isCluster = data && typeof data === 'object' && (data.isCluster === true || !!data.clusterConfigInfo);
    const projectName = data && typeof data === 'object' ? data.projectName : null;
    const currentProjectGuid = (data && typeof data === 'object' && data.project) ? data.project : parentProjectGuid;
    const title = data?.clusterConfigInfo?.clusterGetResult?.title || projectName || undefined;
    const productCount = Array.isArray(data?.productlist) ? data.productlist.length : undefined;

    // تشخیص اینکه آیا این نود نمایانگر یک محصول (Product) است یا خیر
    const isProductItem =
      isObject &&
      typeof data.product === 'string' &&
      typeof data.branchMain === 'string';

    if (isRealmGroup) {
      // Realm is the parent card itself. Render its cluster records directly as
      // child nodes; do not create an intermediate "children" array card.
      if (Array.isArray(data.children)) {
        data.children.forEach((item: any, index: number) => {
          if (isCollapsed) return;
          const itemLabel =
            item?.projectName ||
            item?.productName ||
            item?.title ||
            item?.clusterConfigInfo?.clusterGetResult?.title ||
            `Cluster ${index + 1}`;
          const childId = createNode(
            item,
            String(itemLabel),
            `${rawPath}.children[${index}]`,
            depth + 1,
            currentId,
            currentProjectGuid
          );
          childNodeIds.push(childId);
        });
      }

      fields.push({
        id: `${currentId}_row_children`,
        key: 'کلاسترهای Realm',
        value: `${realmChildCount ?? 0} کلاستر`,
        valueType: 'string',
        isExpandable: true,
        isExpanded: !isCollapsed,
      });
    } else if (isArray) {
      data.forEach((item: any, index: number) => {
        const itemType = getValueType(item);
        const itemPath = `${rawPath}[${index}]`;
        const rowId = `${currentId}_row_${index}`;

        if (itemType === 'object' || itemType === 'array') {
          let childId: string | undefined;

          // فقط در صورت باز بودن نود، فرزندان ساخته می‌شوند تا حافظه و DOM اشغال نشود
          if (!isCollapsed) {
            let itemLabel = `[${index}]`;
            if (item?.__isRealmGroup) itemLabel = item.realmGuid ? `Realm · ${item.realmGuid}` : 'Realm بدون شناسه';
            else if (item?.projectName) itemLabel = `${item.projectName}`;
            else if (item?.productName) itemLabel = `${item.productName}`;
            else if (item?.title) itemLabel = `${item.title}`;
            else if (item?.clusterConfigInfo?.clusterGetResult?.title) {
              itemLabel = item.clusterConfigInfo.clusterGetResult.title;
            }

            childId = createNode(item, itemLabel, itemPath, depth + 1, currentId, currentProjectGuid);
            childNodeIds.push(childId);
          }

          let displayVal = '{Object}';
          if (itemType === 'array') {
            displayVal = `Array(${item.length})`;
          } else if (item?.__isRealmGroup) {
            displayVal = `Realm · ${item.realmGuid || 'بدون شناسه'}`;
          } else if (item?.projectName) {
            displayVal = item.projectName;
          } else if (item?.productName) {
            displayVal = item.productName;
          }

          fields.push({
            id: rowId,
            key: `[${index}]`,
            value: displayVal,
            valueType: itemType,
            childNodeId: childId,
            isExpandable: true,
            isExpanded: !isCollapsed,
          });
        } else {
          fields.push({
            id: rowId,
            key: `[${index}]`,
            value: item,
            valueType: itemType,
            isExpandable: false,
            isExpanded: false,
          });
        }
      });
    } else if (isObject) {
      const keys = Object.keys(data);
      keys.forEach((key, index) => {
        const val = data[key];
        const valType = getValueType(val);
        const itemPath = rawPath ? `${rawPath}.${key}` : key;
        const rowId = `${currentId}_row_${index}`;

        if (valType === 'object' || valType === 'array') {
          if (val === null) {
            fields.push({
              id: rowId,
              key,
              value: null,
              valueType: 'null',
              isExpandable: false,
              isExpanded: false,
            });
          } else {
            let childId: string | undefined;
            if (!isCollapsed) {
              const childLabel = key;
              childId = createNode(val, childLabel, itemPath, depth + 1, currentId, currentProjectGuid);
              childNodeIds.push(childId);
            }

            let displayVal = '{Object}';
            if (valType === 'array') {
              displayVal = `Array(${val.length})`;
            } else if (key === 'consulConfig' && (val.url || val.config?.consul?.url)) {
              displayVal = val.url || val.config?.consul?.url;
            } else if (key === 'jaegerConfig' && (val.ui || val.config?.jaeger?.ui)) {
              displayVal = val.ui || val.config?.jaeger?.ui;
            } else if (key === 'register' && (val.name || val.config?.registery?.name)) {
              displayVal = val.name || val.config?.registery?.name;
            }

            fields.push({
              id: rowId,
              key,
              value: displayVal,
              valueType: valType,
              childNodeId: childId,
              isExpandable: true,
              isExpanded: !isCollapsed,
            });
          }
        } else {
          fields.push({
            id: rowId,
            key,
            value: val,
            valueType: valType,
            isExpandable: false,
            isExpanded: false,
          });
        }
      });

      // در سطح آخر برای هر product، یک بخش فرزند عملیاتی جلویش متصل می‌کنیم
      if (isProductItem) {
        const actionNodeId = `${currentId}_action_pipeline`;
        const actionRawPath = `${rawPath}._actions`;

        if (!isCollapsed) {
          const actionNode: GraphNode = {
            id: actionNodeId,
            label: `⚡ عملیات: ${data.productName || 'محصول'}`,
            type: 'object',
            rawPath: actionRawPath,
            depth: depth + 1,
            fields: [
              {
                id: `${actionNodeId}_step1`,
                key: '۱. ساخت HelmChart',
                value: 'InstallModuleCommand',
                valueType: 'string',
                isExpandable: false,
                isExpanded: false,
              },
              {
                id: `${actionNodeId}_step2`,
                key: '۲. ثبت دوباره Package',
                value: 'در صورت هشدار رجیستری',
                valueType: 'string',
                isExpandable: false,
                isExpanded: false,
              },
              {
                id: `${actionNodeId}_step3`,
                key: '۳. ساخت ModuleProduct',
                value: 'قفل تا دریافت PackageGuid',
                valueType: 'string',
                isExpandable: false,
                isExpanded: false,
              },
            ],
            x: 0,
            y: 0,
            width: 320,
            height: 240,
            isCollapsed: false,
            childNodeIds: [],
            parentId: currentId,
            isActionNode: true,
            actionMetadata: {
              productId: data.product,
              productName: data.productName || 'محصول',
              branchGuid: data.branchMain,
              projectGuid: currentProjectGuid || '',
            },
            metadata: {
              title: `پایپ‌لاین عملیاتی ${data.productName || 'محصول'}`,
            },
          };

          nodes.push(actionNode);
          childNodeIds.push(actionNodeId);
        }

        fields.push({
          id: `${currentId}_row_actions`,
          key: '⚡ عملیات و پایپ‌لاین',
          value: 'HelmChart / Module',
          valueType: 'object',
          childNodeId: !isCollapsed ? actionNodeId : undefined,
          isExpandable: true,
          isExpanded: !isCollapsed,
        });
      }
    } else {
      fields.push({
        id: `${currentId}_row_0`,
        key: 'value',
        value: data,
        valueType: getValueType(data),
        isExpandable: false,
        isExpanded: false,
      });
    }

    const calculatedHeight = headerHeight + fields.length * rowHeight + 10;

    nodes.push({
      id: currentId,
      label,
      type: isCluster ? 'cluster' : isArray ? 'array' : 'object',
      rawPath,
      depth,
      fields,
      x: 0,
      y: 0,
      width: nodeWidth,
      height: Math.max(calculatedHeight, 64),
      isCollapsed,
      childNodeIds,
      parentId,
      itemCount: isArray ? data.length : isObject ? Object.keys(data).length : 1,
      isClusterNode: isCluster,
      isRealmGroup,
      actionMetadata: isProductItem
        ? {
            productId: data.product,
            productName: data.productName || 'محصول',
            branchGuid: data.branchMain,
            projectGuid: currentProjectGuid || '',
          }
        : undefined,
      metadata: {
        isCluster,
        projectName,
        title,
        productCount,
        realmGuid,
        realmChildCount,
      },
    });

    return currentId;
  }

  // ایجاد ریشه داده
  const rootLabel = Array.isArray(dataToProcess)
    ? `Root Array [${dataToProcess.length} items]`
    : 'Root Object';
  createNode(dataToProcess, rootLabel, '$', 0);

  // مرحله ۲: چیدمان درختی بدون هم‌پوشانی و با فواصل منظم
  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  function calculateSubtreeHeight(nodeId: string): number {
    const node = nodeMap.get(nodeId);
    if (!node) return 0;
    if (node.isCollapsed || node.childNodeIds.length === 0) {
      return node.height;
    }

    let childrenTotalHeight = 0;
    node.childNodeIds.forEach((childId, idx) => {
      childrenTotalHeight += calculateSubtreeHeight(childId);
      if (idx > 0) childrenTotalHeight += vertSpacing;
    });

    return Math.max(node.height, childrenTotalHeight);
  }

  function layoutSubtree(nodeId: string, currentX: number, currentY: number): number {
    const node = nodeMap.get(nodeId);
    if (!node) return currentY;

    node.x = currentX;

    if (node.isCollapsed || node.childNodeIds.length === 0) {
      node.y = currentY;
      return currentY + node.height + vertSpacing;
    }

    const nextX = currentX + nodeWidth + horizSpacing;
    let childY = currentY;
    let firstChildY = currentY;
    let lastChildY = currentY;

    node.childNodeIds.forEach((childId, idx) => {
      const child = nodeMap.get(childId);
      if (idx === 0) firstChildY = childY;
      const nextChildY = layoutSubtree(childId, nextX, childY);
      if (child) lastChildY = child.y;
      childY = nextChildY;
    });

    const centerChildY = (firstChildY + lastChildY) / 2;
    node.y = Math.max(currentY, centerChildY - (node.height - 40) / 2);

    return Math.max(node.y + node.height + vertSpacing, childY);
  }

  const rootNodes = nodes.filter((n) => n.depth === 0);
  let globalY = 40;
  rootNodes.forEach((root) => {
    globalY = layoutSubtree(root.id, 40, globalY);
  });

  // مرحله ۳: ایجاد یال‌های بهینه
  nodes.forEach((node) => {
    // A Realm group fans out directly to its cluster cards from one clean anchor.
    if (node.isRealmGroup && node.childNodeIds.length > 0) {
      const anchorY = node.y + headerHeight / 2;
      node.childNodeIds.forEach((childId, index) => {
        const childNode = nodeMap.get(childId);
        if (!childNode) return;
        edges.push({
          id: `edge_${node.id}_realm_child_${index}_${childId}`,
          sourceNodeId: node.id,
          sourceRowId: `${node.id}_row_children`,
          targetNodeId: childId,
          startX: node.x + node.width,
          startY: anchorY,
          endX: childNode.x,
          endY: childNode.y + headerHeight / 2,
          label: 'Realm',
        });
      });
    }

    node.fields.forEach((field, rowIndex) => {
      if (field.childNodeId) {
        const childNode = nodeMap.get(field.childNodeId);
        if (childNode) {
          const startX = node.x + node.width;
          const startY = node.y + headerHeight + rowIndex * rowHeight + rowHeight / 2;
          const endX = childNode.x;
          const endY = childNode.y + headerHeight / 2;

          edges.push({
            id: `edge_${node.id}_${field.id}_to_${childNode.id}`,
            sourceNodeId: node.id,
            sourceRowId: field.id,
            targetNodeId: childNode.id,
            startX,
            startY,
            endX,
            endY,
            label: field.key,
          });
        }
      }
    });
  });

  return { nodes, edges };
}

/**
 * تولید مسیر منحنی بزیر درجه سه نرم بین دو پورت در دیاگرام
 */
export function generateSmoothBezierPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string {
  const dx = Math.abs(endX - startX);
  const controlOffset = Math.max(dx * 0.5, 36);

  const c1x = startX + controlOffset;
  const c1y = startY;
  const c2x = endX - controlOffset;
  const c2y = endY;

  return `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;
}
