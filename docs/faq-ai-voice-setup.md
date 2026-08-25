# FAQ AI 語音／文字問答 — AWS 設定指南

FAQ 對話框的 AI 問答功能架構：瀏覽器 → Express 後端（沿用既有 `/api/...`）→ API Gateway → Lambda（`infra/faq-ai/lambda`）→ Transcribe / Bedrock Knowledge Base / Polly。Express 完全不碰 AWS SDK，只靠一組共用密鑰打 API Gateway。

本文件分兩部分：**A. Bedrock Knowledge Base 手動建立步驟**（CDK 目前不含這段，一定要照這裡手動建）；**B. Lambda + API Gateway 完全手動建立步驟**（僅在不想用 `infra/faq-ai/cdk` 時的替代方案，正常情況請優先用 CDK）。

---

## A. 建立 Bedrock Knowledge Base（必要，CDK 未涵蓋此步驟）

1. **建立 S3 bucket**：AWS Console → S3 → 建立 bucket（例：`chungyo-faq-kb-docs`），區域必須跟 Bedrock/Lambda 部署的 region 一致（例如 `ap-northeast-1`，要跟 `cdk deploy` 時的 region 相同，否則 Lambda 呼叫不到）。保持預設封鎖公開存取設定即可。

2. **建立 Knowledge Base**：AWS Console → Bedrock → 知識庫 (KB) → 建立受管知識庫 (KB)
   - **KB 詳細資訊**：填 KB 名稱
   - **資料來源類型**：選 Amazon S3，S3 URI 直接貼上一步建立的 bucket（格式 `s3://你的bucket名稱/`），不透過「瀏覽 S3」選單（該選單有時抓不到剛建立的 bucket，直接貼路徑最穩定）
   - **其他組態**（展開）：
     - 內嵌項目模型：維持預設「**受管嵌入模型 – 建議**」（Managed embedding model，免額外費用）
     - IAM Permissions：維持預設「建立並使用新的服務角色」
     - 受管向量存放區的 KMS 金鑰：維持預設（不用勾自訂加密）

     > 注意：新版「受管知識庫」流程**不會**讓你手動選向量儲存（S3 Vectors／OpenSearch Serverless），AWS 會自動管理向量儲存，維持上述預設值即可。
   - 往下捲到底按「建立知識庫」
   - 完成後記下：
     - **Knowledge Base ID**（例：`ABCD1234EF`）
     - **Data Source ID**（例：`GHIJ5678KL`）

   > ⚠️ **重要限制**：「受管知識庫」（Managed Knowledge Base）**不支援 `RetrieveAndGenerate` API**（呼叫會回 `ValidationException: This operation is not supported for managed knowledge bases`）。`infra/faq-ai/lambda/bedrock_client.py` 已經處理這個限制：改成先呼叫 `Retrieve` API 拿檢索片段（要用 `managedSearchConfiguration`，不是傳統 KB 用的 `vectorSearchConfiguration`，且需要 `boto3 >= 1.43`，已寫進 `requirements.txt`），再自己組 prompt 呼叫 `bedrock-runtime` 的 `Converse` API 生成答案。這是既有實作方式，不需要再處理，這裡記錄原因供之後除錯參考。

3. **選擇要使用的生成模型，並取得可用的 ARN**：這步很容易踩坑，實測過程發現：
   - `Claude 3.5 Haiku` 在部分 region（例如東京 `ap-northeast-1`）**完全沒有上架**，模型目錄搜尋會 0 結果。
   - `Claude 3 Haiku` 雖然上架，但已被 AWS 標記為「舊式」（Legacy），若帳號超過 30 天沒實際呼叫過會被拒絕存取（`ResourceNotFoundException: ... marked by provider as Legacy`）。
   - 建議直接用 **Claude Haiku 4.5**（`anthropic.claude-haiku-4-5-20251001-v1:0`，主動維護中，不會有 Legacy 問題）。到 Bedrock → 模型目錄搜尋確認該 region 有上架、且「模型存取」已授予。
   - **這個模型的推論類型是「跨區域推論」（Cross-region inference）**，不能用一般的 foundation-model ARN 直接呼叫，必須用跨區域推論設定檔（inference profile）的 ARN，格式：
     ```
     arn:aws:bedrock:<region>:<你的AWS帳號ID>:inference-profile/<geo前綴>.anthropic.claude-haiku-4-5-20251001-v1:0
     ```
     `<geo前綴>` 依 region 決定（日本用 `jp`、美國用 `us`、歐洲用 `eu`、澳洲用 `au`），例如東京：
     ```
     arn:aws:bedrock:ap-northeast-1:035826730621:inference-profile/jp.anthropic.claude-haiku-4-5-20251001-v1:0
     ```
     模型頁面上如果顯示「推論類型：跨區域推論」，就代表一定要用這種 inference-profile ARN，不能用 `foundation-model/` 開頭的 ARN。
   - **首次呼叫 Anthropic 模型前**，Bedrock Console 該模型頁面可能會跳出「Anthropic requires first-time customers to submit use case details before invoking a model」提示，需要點「Submit use case details」填寫用途說明（會分享給 Anthropic），每個帳號/組織只需要填一次，沒填的話呼叫會被拒絕。
   - **AWS Marketplace 訂閱權限**：第三方模型（Anthropic）在 Bedrock 底層透過 AWS Marketplace 訂閱授權，**呼叫端的 IAM 身分**（不是你自己登入 Console 的身分，是 Lambda 執行角色）也需要 `aws-marketplace:ViewSubscriptions`、`aws-marketplace:Subscribe` 這兩個權限，否則會出現 `AccessDeniedException: ... required AWS Marketplace actions`。`infra/faq-ai/cdk` 的 `ChatHandler` 已經內建這兩個權限；若照本文件 C 節手動建立 Lambda，記得也要加上。

4. **這幾個值等一下要用到**：
   | 名稱 | 用途 |
   |---|---|
   | Knowledge Base ID | CDK 部署時的 `BEDROCK_KB_ID` |
   | Data Source ID | CDK 部署時的 `BEDROCK_DATA_SOURCE_ID` |
   | 模型 ARN | CDK 部署時的 `BEDROCK_MODEL_ARN` |
   | S3 bucket 名稱 | 若沒有讓 CDK 建立文件用的 bucket，這裡也需要記下（見下方 CDK 說明） |

> `infra/faq-ai/cdk` 目前只會另外建立**一個**存放 FAQ 文件的 S3 bucket（`FaqKbDocsBucket`）並輸出其名稱——這個 bucket 就是步驟 1 要選的「Data source」bucket。建議順序：先 `cdk deploy` 一次（此時 KB 相關環境變數留空即可，chat/sync Lambda 會先不可用），拿到 CDK 輸出的 bucket 名稱後，回來完成本節的 A 步驟 1-3，再把 KB 相關 ID 補進環境變數重新 `cdk deploy` 一次。

---

## B. 用 AWS CDK 部署 Lambda + API Gateway（建議方式）

```bash
cd infra/faq-ai/cdk
npm install

# DEPLOY_ENV 用來區分同一個 AWS 帳號底下的測試區／正式區（stack 名稱會變成
# FaqAiStack-test / FaqAiStack-prod，不會互相撞名），預設值是 test。
export DEPLOY_ENV="test"

# 必填：兩個 Lambda 都要驗證的共用密鑰，之後要填進 backend/.env 的 FAQ_AI_API_SECRET
# 測試區、正式區要各自產生一組不同的密鑰，不可共用。
export API_SHARED_SECRET="<自訂一組隨機字串>"

# 第一次部署可以先留空，之後補齊 A 節取得的值再重新部署一次
export BEDROCK_KB_ID="<Knowledge Base ID>"
export BEDROCK_MODEL_ARN="<模型 ARN>"
export BEDROCK_DATA_SOURCE_ID="<Data Source ID>"

npx cdk bootstrap   # 該 AWS 帳號/region 若還沒 bootstrap 過才需要，只需一次
npx cdk deploy
```

PowerShell 環境變數語法不同，要用 `$env:DEPLOY_ENV = "test"` 這種寫法，不是 `export`。

部署完成後，終端機會印出 `FaqAiStack-test.ApiUrl`（依 `DEPLOY_ENV` 值變化），把這個網址填進 `backend/.env` 的 `FAQ_AI_API_URL`。之後要部署正式區時，同一份程式碼，只要把 `DEPLOY_ENV` 改成 `prod`、`API_SHARED_SECRET` 換成另一組新密鑰、`BEDROCK_KB_ID`／`BEDROCK_MODEL_ARN`／`BEDROCK_DATA_SOURCE_ID` 換成正式區自己的 Knowledge Base 資訊，再跑一次 `npx cdk deploy` 即可，會建立一個獨立的 `FaqAiStack-prod`，不會影響測試區。

### 之後要重新同步環境變數
改了 `BEDROCK_KB_ID`/`BEDROCK_MODEL_ARN`/`BEDROCK_DATA_SOURCE_ID` 後，重新設定該環境變數並再跑一次 `npx cdk deploy`（`DEPLOY_ENV` 要跟原本部署時一致）即可更新 Lambda 設定，不需要整個重建。

---

## C. 完全手動建立（不用 CDK 時的替代方案）

1. **打包 Lambda 程式碼**：在 `infra/faq-ai/lambda` 目錄下安裝依賴並打包：
   ```bash
   cd infra/faq-ai/lambda
   pip install -r requirements.txt -t package
   cp *.py package/
   cd package && zip -r ../faq-ai-lambda.zip . && cd ..
   ```
2. **建立兩個 Lambda 函式**（Console → Lambda → Create function，Runtime 選 Python 3.12）：
   - `faq-chat-handler`：上傳 `faq-ai-lambda.zip`，Handler 設為 `chat_handler.handler`
   - `faq-sync-handler`：上傳同一份 zip，Handler 設為 `sync_handler.handler`
3. **各自的環境變數**：
   - `faq-chat-handler`：`API_SHARED_SECRET`、`BEDROCK_KB_ID`、`BEDROCK_MODEL_ARN`
   - `faq-sync-handler`：`API_SHARED_SECRET`、`BEDROCK_KB_ID`、`BEDROCK_DATA_SOURCE_ID`、`FAQ_KB_S3_BUCKET`、`FAQ_KB_S3_PREFIX`（例：`faq-kb/`）
4. **IAM 權限**（各自的執行角色 → 附加內嵌政策）：
   - `faq-chat-handler`：`transcribe:StartStreamTranscription`、`bedrock:Retrieve`、`bedrock:InvokeModel`、`polly:SynthesizeSpeech`、`aws-marketplace:ViewSubscriptions`、`aws-marketplace:Subscribe`
   - `faq-sync-handler`：對指定 S3 bucket 的 `s3:PutObject`/`s3:DeleteObject`/`s3:ListBucket`、`bedrock:StartIngestionJob`、`bedrock:GetIngestionJob`

   > ⚠️ **命名陷阱**：雖然呼叫的 API 用戶端分別是 `bedrock-agent-runtime`（Retrieve）跟 `bedrock-agent`（StartIngestionJob），但**實際 IAM 權限的命名空間統一都是 `bedrock:`**，不是 `bedrock-agent-runtime:` 或 `bedrock-agent:`。這是 AWS 已知的命名不一致問題，若照 API 用戶端名稱寫 IAM policy 會導致 `AccessDeniedException`。
5. **建立 API Gateway（HTTP API）**：Console → API Gateway → Create API → HTTP API
   - 新增路由 `POST /chat` → 整合到 `faq-chat-handler`
   - 新增路由 `POST /sync` → 整合到 `faq-sync-handler`
   - Deploy 到一個 stage（例如 `$default`），記下 Invoke URL 填入 `backend/.env` 的 `FAQ_AI_API_URL`

---

## 驗證

```bash
curl -X POST "$FAQ_AI_API_URL/chat" \
  -H "x-api-key: $API_SHARED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"text":"停車怎麼收費"}'
```
預期回傳 JSON 含 `replyText`（文字答案）與 `audioBase64`（mp3 語音，base64 編碼）。若回傳 401，檢查密鑰是否一致；若 500，查看該 Lambda 的 CloudWatch Logs。

同步知識庫請透過 Chungyo 後台「FAQ 管理」頁面的「立即同步知識庫」按鈕觸發（對應 `POST /api/admin/faq/sync-knowledge-base`），不需要手動呼叫 `/sync`。
