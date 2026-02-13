# Publishing Guide

本指南說明如何將此 MCP server 發佈到 npm。

## 準備工作

### 1. 建立 npm 帳號

如果還沒有 npm 帳號：

1. 前往 https://www.npmjs.com/signup
2. 建立帳號
3. 驗證 email

### 2. 設置 GitHub Repository

1. 在 GitHub 上建立新的 repository：
   ```bash
   # 在 GitHub 網站上建立 repository，然後：
   git remote add origin https://github.com/Wootz/ado-onprem-mcp.git
   git branch -M main
   git push -u origin main
   ```

2. Repository URLs 已設定為：
   - `https://github.com/Wootz/ado-onprem-mcp`

### 3. 設置 NPM Token

1. 登入 npm：
   ```bash
   npm login
   ```

2. 建立 access token：
   - 前往 https://www.npmjs.com/settings/[YOUR_USERNAME]/tokens
   - 點擊 "Generate New Token" → "Classic Token"
   - 選擇 "Automation" 類型
   - 複製 token

3. 在 GitHub repository 設定 Secret：
   - 前往 repository → Settings → Secrets and variables → Actions
   - 點擊 "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: 貼上剛才複製的 npm token

## 發佈流程

### 方法 1：透過 GitHub Release（推薦）

1. 更新版本號（如果需要）：
   ```bash
   # 更新版本號並建立 git tag
   npm version patch  # 或 minor, major
   ```

2. 推送 tag 到 GitHub：
   ```bash
   git push --follow-tags
   ```

3. 在 GitHub 建立 Release：
   - 前往 repository → Releases → "Draft a new release"
   - 選擇剛才推送的 tag
   - 填寫 release notes
   - 點擊 "Publish release"

4. GitHub Actions 會自動：
   - 執行 build 和 lint
   - 發佈到 npm

### 方法 2：手動觸發 Workflow

1. 前往 repository → Actions → "Publish to npm"
2. 點擊 "Run workflow"
3. 選擇 branch（通常是 main）
4. 可選：輸入特定版本號
5. 點擊 "Run workflow"

### 方法 3：本地手動發佈

```bash
# 1. 確保程式碼是最新的
git pull

# 2. 安裝依賴
pnpm install

# 3. 執行測試和 lint
pnpm run lint
pnpm run build

# 4. 登入 npm（如果還沒登入）
npm login

# 5. 發佈
pnpm publish --access public
```

## 版本管理

使用語義化版本（Semantic Versioning）：

- **Patch** (1.0.x)：Bug 修復
  ```bash
  npm version patch
  ```

- **Minor** (1.x.0)：新增功能（向後相容）
  ```bash
  npm version minor
  ```

- **Major** (x.0.0)：重大變更（不向後相容）
  ```bash
  npm version major
  ```

## 發佈前檢查清單

- [ ] 所有測試通過
- [ ] Lint 沒有錯誤
- [ ] 更新 README.md（如果有新功能）
- [ ] 更新 CHANGELOG.md（如果有）
- [ ] 版本號已正確更新
- [ ] Build 成功（`pnpm run build`）
- [ ] 檢查 `dist/` 目錄內容

## 驗證發佈

發佈後，驗證 package：

```bash
# 1. 檢查 npm 上的 package
npm view ado-onprem-mcp

# 2. 在新目錄中測試安裝
mkdir test-install && cd test-install
npm install ado-onprem-mcp
node node_modules/ado-onprem-mcp/dist/index.js --version
```

## 疑難排解

### 發佈失敗：需要 2FA

如果你的 npm 帳號啟用了 2FA：

1. 建立 automation token（在上面的步驟 3 中已說明）
2. 確保使用 "Automation" 類型的 token

### 發佈失敗：Package 名稱已存在

如果名稱已被使用，需要修改 `package.json` 中的 `name` 欄位：

```json
{
  "name": "@wootz/ado-onprem-mcp"
}
```

使用 scoped package 名稱（@username/package-name）。

### Build 失敗

確保所有依賴都已安裝：

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm run build
```

## 更多資源

- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [GitHub Actions for npm](https://docs.github.com/en/actions/publishing-packages/publishing-nodejs-packages)
