# Azure DevOps 地端部署 MCP 伺服器

適用於 **Azure DevOps Server 2022（地端部署）** 的 Model Context Protocol (MCP) 伺服器。讓 AI 助手能夠透過 15 個工具與你的地端 Azure DevOps Server 互動。

## 設定

在支援 MCP 的客戶端設定檔中加入：

```json
{
  "mcpServers": {
    "azure-devops-onprem": {
      "command": "npx",
      "args": ["-y", "@wootz/ado-onprem-mcp"],
      "env": {
        "ADO_SERVER_URL": "https://tfs.company.com/DefaultCollection",
        "ADO_PAT_TOKEN": "your-pat-token-here",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0" // 使用自簽憑證
      }
    }
  }
}
```

**環境變數說明：**
- `ADO_SERVER_URL`：必填，完整的集合路徑（例如：`https://tfs.company.com/DefaultCollection`）
- `ADO_PAT_TOKEN`：必填，個人存取權杖
- `NODE_TLS_REJECT_UNAUTHORIZED`：必填，設為 `"0"` 以支援自簽憑證（地端部署環境常見）

> **⚠️ 安全提示**：`NODE_TLS_REJECT_UNAUTHORIZED=0` 會略過 SSL 憑證驗證，僅適用於內部網路的地端部署環境。請勿在公開網路環境使用。

### 產生個人存取權杖 (PAT)

1. 前往你的 Azure DevOps Server：`https://your-server/DefaultCollection`
2. 點擊右上角的個人資料圖示 → 安全性 → 個人存取權杖
3. 建立新權杖並設定以下範圍：
   - **程式碼**：讀取與寫入（用於 Pull Request 操作）
   - **工作項目**：讀取與寫入（用於工作項目操作）
   - **專案與小組**：讀取（用於專案資訊）

## 系統需求

- Node.js >= 20.0.0
- Azure DevOps Server 2022（地端部署版本）
- 有效的個人存取權杖 (PAT)

## 可用工具

### Core (1 個工具)

- `mcp_ado_core_list_projects` - 列出所有專案

### Work Items (10 個工具)

- `mcp_ado_work_items_get` - 取得工作項目詳細資訊
- `mcp_ado_work_items_create` - 建立新的工作項目
- `mcp_ado_work_items_update` - 更新工作項目
- `mcp_ado_work_items_delete` - 刪除工作項目
- `mcp_ado_work_items_query_by_wiql` - 查詢工作項目
- `mcp_ado_work_items_add_comment` - 新增註解
- `mcp_ado_work_items_get_comments` - 取得註解
- `mcp_ado_work_items_add_link` - 新增工作項目連結
- `mcp_ado_work_items_get_updates` - 取得修訂歷史
- `mcp_ado_work_items_batch_get` - 批次取得工作項目

### Repositories (4 個工具)

- `mcp_ado_repos_list_pull_requests` - 列出 Pull Requests
- `mcp_ado_repos_get_pull_request` - 取得 PR 詳細資訊
- `mcp_ado_repos_create_pull_request` - 建立 Pull Request
- `mcp_ado_repos_update_pull_request` - 更新 Pull Request

**總計：15 個工具**

完整的工具定義和參數說明，請參閱原始碼中的 `src/tools/` 目錄。

## 使用範例

你可以用自然語言與 AI 助手互動，執行各種 Azure DevOps 操作：

### 查看專案和工作項目

- "列出所有專案"
- "顯示工作項目 #1234"
- "查詢 MyProject 中分配給我的工作項目"
- "列出所有狀態為進行中的 bug"
- "顯示最近 7 天修改過的工作項目"

### 建立和更新工作項目

- "在 MyProject 中建立一個 bug，標題為「登入頁面錯誤」"
- "建立一個 User Story，標題為「新增登出功能」，分配給 john@company.com"
- "更新工作項目 #5678，將狀態改為已完成"
- "將工作項目 #1234 的優先順序設為 1"
- "對工作項目 #1234 新增註解：已確認重現問題"

### 管理工作項目關聯

- "將工作項目 #100 連結到 #200，類型為 Related"
- "顯示工作項目 #1234 的所有註解"
- "查看工作項目 #5678 的修改歷史"
- "列出工作項目 #999 的所有關聯項目"

### Pull Request 操作

- "列出 MainRepo 儲存庫中所有活動的 pull request"
- "顯示 pull request #123 的詳細資訊"
- "建立一個從 feature/new-api 到 develop 的 PR，標題為「新增 API 端點」"
- "更新 PR #789，將狀態改為已完成"
- "取得 PR #456 的所有審查討論"
- "在 PR #123 上新增審查評論：建議改用 async/await"

### 完整工作流程範例

你可以串連多個操作來完成完整的工作流程：

**回報和修復 Bug**：
1. "在 MyProject 中建立一個 bug，標題為「登入頁面無法載入」"
2. "將這個 bug 分配給 developer@company.com"
3. "新增註解：發生在 Chrome 瀏覽器，Firefox 正常"
4. "建立一個從 bugfix/login 到 main 的 pull request 來修復這個問題"
5. "在 PR 上新增說明：修正了 CSS 載入順序問題"

**追蹤功能開發**：
1. "建立一個 User Story：實作使用者個人檔案頁面"
2. "建立一個 Task：設計個人檔案 UI，並連結到上面的 User Story"
3. "建立另一個 Task：實作個人檔案 API，也連結到同一個 User Story"
4. "當完成時，更新所有相關工作項目的狀態為已完成"

## 開發

### 建置專案

```bash
pnpm install
pnpm run build
```

### 監看模式

```bash
pnpm run watch
```

### 執行測試

```bash
pnpm test
```

### 執行 Linter

```bash
pnpm run lint
```

## 專案架構

```
src/
├── index.ts             # CLI 入口點
├── auth.ts              # PAT 認證
├── server.ts            # MCP 伺服器設定
├── tools.ts             # 工具註冊
├── tools/
│   ├── core.ts          # 專案管理 (1 個工具)
│   ├── work-items.ts    # 工作項目 (10 個工具)
│   └── repositories.ts  # Pull Requests (4 個工具)
├── utils.ts             # 回應輔助函式
├── logger.ts            # Winston 日誌
└── version.ts           # 版本資訊
```

## 特色功能

- ✅ **地端部署專用**：專為 Azure DevOps Server 2022 設計
- ✅ **集合式 URL**：支援 `https://{server}/{collection}` 格式
- ✅ **PAT 認證**：僅使用個人存取權杖，無需 Azure CLI
- ✅ **輕量化**：最少依賴，架構簡潔
- ✅ **完整功能**：涵蓋工作項目和 Pull Request 的核心操作

## 授權

MIT License

## 貢獻

歡迎提交 Issue 和 Pull Request！

專案倉庫：[https://github.com/Wootz/ado-onprem-mcp](https://github.com/Wootz/ado-onprem-mcp)

## 支援

如有問題或建議，請在 GitHub 上提交 Issue：
[https://github.com/Wootz/ado-onprem-mcp/issues](https://github.com/Wootz/ado-onprem-mcp/issues)
