import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import * as path from 'path';

const LAMBDA_DIR = path.join(__dirname, '..', '..', 'lambda');

// Bedrock Knowledge Base (S3 Vectors) 是 2025 年才推出的功能，目前 CDK 對應的 L1
// construct（aws_bedrock.CfnKnowledgeBase/CfnDataSource + S3 Vectors 屬性）尚未有把握
// 在各版本間穩定，因此本 stack 不嘗試自動建立 Knowledge Base 本身 —— 那部分請照
// docs/faq-ai-voice-setup.md 在 AWS Console 手動建立，並把產生的
// Knowledge Base ID / Data Source ID 透過下方環境變數帶進來。
// 本 stack 只負責：S3 bucket（放 FAQ 文件）＋ 兩個 Lambda ＋ HTTP API Gateway ＋ IAM。
export class FaqAiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const apiSharedSecret = process.env.API_SHARED_SECRET;
    if (!apiSharedSecret) {
      throw new Error(
        'API_SHARED_SECRET 未設定。請先 export API_SHARED_SECRET=<自訂亂數密鑰> 再執行 cdk deploy，' +
          '這組密鑰之後要原封不動填入 backend/.env 的 FAQ_AI_API_SECRET。',
      );
    }

    const bedrockKbId = process.env.BEDROCK_KB_ID ?? '';
    const bedrockModelArn = process.env.BEDROCK_MODEL_ARN ?? '';
    const bedrockDataSourceId = process.env.BEDROCK_DATA_SOURCE_ID ?? '';
    const faqKbS3Prefix = process.env.FAQ_KB_S3_PREFIX ?? 'faq-kb/';

    // ── S3：存放同步進來的 FAQ 文件（Bedrock Knowledge Base 的資料來源）──────────
    const docsBucket = new s3.Bucket(this, 'FaqKbDocsBucket', {
      // 內容完全由 MySQL 的 faq_nodes 同步產生，非唯一真實來源，方便反覆部署測試。
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ── Lambda：chat（STT + RetrieveAndGenerate + TTS）與 sync（S3 同步 + ingestion）──
    // 兩個 handler 共用同一份程式碼目錄（含 bedrock_client.py/transcribe_client.py/
    // polly_client.py 等共用模組），用 index 指到各自的進入檔案。
    const commonEnv = {
      API_SHARED_SECRET: apiSharedSecret,
      BEDROCK_KB_ID: bedrockKbId,
      BEDROCK_MODEL_ARN: bedrockModelArn,
    };

    const chatHandler = new PythonFunction(this, 'ChatHandler', {
      entry: LAMBDA_DIR,
      runtime: lambda.Runtime.PYTHON_3_12,
      index: 'chat_handler.py',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: commonEnv,
    });

    const syncHandler = new PythonFunction(this, 'SyncHandler', {
      entry: LAMBDA_DIR,
      runtime: lambda.Runtime.PYTHON_3_12,
      index: 'sync_handler.py',
      handler: 'handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        ...commonEnv,
        FAQ_KB_S3_BUCKET: docsBucket.bucketName,
        FAQ_KB_S3_PREFIX: faqKbS3Prefix,
        BEDROCK_DATA_SOURCE_ID: bedrockDataSourceId,
      },
    });

    // ── IAM：chatHandler 需要 Transcribe / Bedrock RetrieveAndGenerate / Polly ──
    const kbResource = bedrockKbId
      ? `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/${bedrockKbId}`
      : '*';

    chatHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['transcribe:StartStreamTranscription'],
        resources: ['*'], // Transcribe streaming 不支援資源層級限制
      }),
    );

    chatHandler.addToRolePolicy(
      new iam.PolicyStatement({
        // 注意：不管是用哪個 API 用戶端（bedrock-agent-runtime），IAM 權限一律用
        // bedrock: 這個命名空間，跟 API/SDK 服務名稱不一致，是 AWS 的已知坑。
        actions: ['bedrock:RetrieveAndGenerate', 'bedrock:Retrieve'],
        resources: [kbResource],
      }),
    );

    chatHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: ['*'], // Converse 呼叫此模型，資源限制較不直觀，維持寬鬆
      }),
    );

    // 第三方模型（如 Anthropic）在 Bedrock 底層透過 AWS Marketplace 訂閱授權，
    // 呼叫端的 IAM 身分（這裡是 Lambda 執行角色）需要這兩個權限才能通過檢查，
    // 否則會出現 AccessDeniedException: ... AWS Marketplace actions。
    chatHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['aws-marketplace:ViewSubscriptions', 'aws-marketplace:Subscribe'],
        resources: ['*'],
      }),
    );

    chatHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['polly:SynthesizeSpeech'],
        resources: ['*'], // Polly 不支援資源層級限制
      }),
    );

    // ── IAM：syncHandler 需要對 docsBucket 讀寫、以及觸發 Bedrock ingestion job ──
    docsBucket.grantReadWrite(syncHandler);
    docsBucket.grantDelete(syncHandler);

    syncHandler.addToRolePolicy(
      new iam.PolicyStatement({
        // 同上，StartIngestionJob/GetIngestionJob 的 IAM 權限也是 bedrock: 命名空間，
        // 不是 bedrock-agent:。
        actions: ['bedrock:StartIngestionJob', 'bedrock:GetIngestionJob'],
        resources: [kbResource],
      }),
    );

    // ── API Gateway（HTTP API，非 WebSocket——單次請求-回應即可）──────────────
    const httpApi = new apigwv2.HttpApi(this, 'FaqAiHttpApi', {
      description: 'FAQ AI 問答（chat）與知識庫同步（sync）的入口，僅供 Chungyo 後端以共用密鑰呼叫',
    });

    httpApi.addRoutes({
      path: '/chat',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('ChatIntegration', chatHandler),
    });

    httpApi.addRoutes({
      path: '/sync',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('SyncIntegration', syncHandler),
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
      description: '填入 backend/.env 的 FAQ_AI_API_URL（結尾不要加斜線）',
    });
  }
}
