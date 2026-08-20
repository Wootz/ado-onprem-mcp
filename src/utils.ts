export function createErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message, isError: true }, null, 2) }],
    isError: true,
  };
}

export function createSuccessResponse(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * ADO identity 物件的判斷特徵：帶 displayName，且含 _links / imageUrl / descriptor
 * 之類的冗餘欄位。單一 identity 展開後可達數百字元，實際有用的只有名稱。
 */
function isIdentityRef(value: Record<string, unknown>): boolean {
  if (typeof value.displayName !== 'string') return false;
  // 只認 identity 專屬的冗餘欄位；'id' 太常見（work item 本身也有），不納入判斷
  return (
    '_links' in value ||
    'imageUrl' in value ||
    'descriptor' in value ||
    'avatar' in value ||
    'uniqueName' in value
  );
}

/**
 * 遞迴精簡回應中的 identity 物件，只保留 displayName 與 uniqueName。
 * 呼叫端可用 raw:true 取回完整內容。
 */
export function trimIdentities<T>(data: T): T {
  if (Array.isArray(data)) {
    return data.map((item) => trimIdentities(item)) as unknown as T;
  }

  if (data === null || typeof data !== 'object') {
    return data;
  }

  const record = data as Record<string, unknown>;

  if (isIdentityRef(record)) {
    const trimmed: Record<string, unknown> = { displayName: record.displayName };
    if (typeof record.uniqueName === 'string') {
      trimmed.uniqueName = record.uniqueName;
    }
    return trimmed as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = trimIdentities(value);
  }
  return result as unknown as T;
}

/**
 * 回應包裝：預設精簡 identity，raw:true 時回傳原始資料。
 */
export function createWorkItemResponse(data: unknown, raw?: boolean) {
  return createSuccessResponse(raw ? data : trimIdentities(data));
}
