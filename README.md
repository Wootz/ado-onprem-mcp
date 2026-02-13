# Azure DevOps 地端部署 MCP 伺服器

適用於 **Azure DevOps Server 2022（地端部署）** 的 Model Context Protocol (MCP) 伺服器。讓 AI 助手能夠透過 15 個工具與你的地端 Azure DevOps Server 互動。

## 設定

### 建置專案

本專案使用 [pnpm](https://pnpm.io/) 進行套件管理。

```bash
pnpm install
pnpm run build
```

### MCP 設定

在支援 MCP 的客戶端設定檔中加入：

```json
{
  "mcpServers": {
    "azure-devops-onprem": {
      "command": "node",
      "args": [
        "/absolute/path/to/azure-devops-on-premises-mcp/dist/index.js"
      ],
      "env": {
        "ADO_SERVER_URL": "https://tfs.company.com/DefaultCollection",
        "ADO_PAT_TOKEN": "your-pat-token-here",
        // 如果使用自簽憑證，取消註解下一行（僅限開發環境）
        // "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

### 產生個人存取權杖 (PAT)

1. 前往你的 Azure DevOps Server：`https://your-server/DefaultCollection`
2. 點擊右上角的個人資料圖示 → 安全性 → 個人存取權杖
3. 建立新權杖並設定以下範圍：
   - **程式碼**：讀取與寫入（用於 Pull Request 操作）
   - **工作項目**：讀取與寫入（用於工作項目操作）
   - **專案與小組**：讀取（用於專案資訊）

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
- `mcp_ado_repos_get_pr_threads` - 取得 PR 審查討論串
- `mcp_ado_repos_create_pr_thread` - 建立 PR 審查討論串

**總計：15 個工具**

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
