#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as dotenv from "dotenv";
import * as path from "path";

import { KbStack } from '../lib/kb-stack';

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = new cdk.App();


const kbStack = new KbStack(app, 'KbStack', {
  stackName: `KbStack`,
  tags: {
    env: 'prod',
    "ManagedBy": 'KbStack',
    "auto-delete": "no"
  },
  env: {
    account: process.env.CDK_PROCESSING_ACCOUNT,
    region: process.env.CDK_PROCESSING_REGION,
  },
});


