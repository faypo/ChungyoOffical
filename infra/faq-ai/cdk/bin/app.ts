#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FaqAiStack } from '../lib/faq-ai-stack';

const app = new cdk.App();

// 用 DEPLOY_ENV 區分同一個 AWS 帳號底下的測試區／正式區部署，避免 stack 名稱
// 撞在一起（Lambda 函式、S3 bucket、API Gateway 這些沒有明確指定名稱的資源，
// CDK 會依 stack 名稱自動產生實體名稱，所以只要 stack 名稱不同就不會互撞）。
// 例：DEPLOY_ENV=test  → FaqAiStack-test
//     DEPLOY_ENV=prod  → FaqAiStack-prod
const deployEnv = process.env.DEPLOY_ENV || 'test';

new FaqAiStack(app, `FaqAiStack-${deployEnv}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
  },
  tags: { Environment: deployEnv },
});
