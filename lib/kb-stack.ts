import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as evtTargets from "aws-cdk-lib/aws-events-targets";
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from "aws-cdk-lib/aws-events";
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { bedrock } from '@cdklabs/generative-ai-cdk-constructs';
import { Construct } from 'constructs';
import * as fs from 'fs';

import * as path from "path";

export interface KbStackProps extends cdk.StackProps {

}

export class KbStack extends cdk.Stack {

  public readonly modSecKnowledgeBase: bedrock.KnowledgeBaseBase;
  public readonly awsWafKnowledgeBase: bedrock.KnowledgeBaseBase;

  constructor(scope: Construct, id: string, props: KbStackProps) {
    super(scope, id, props);

    this.awsWafKnowledgeBase = new bedrock.VectorKnowledgeBase(this, 'AwsWafKnowledgeBase', {
      name: 'AwsWafKnowledgeBase',
      embeddingsModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
      instruction: `Contains documentation and best practices for AWS WAF.`,
    });

    const awsWafDataSource = new bedrock.WebCrawlerDataSource(this, 'awsWafDataSource', {
      knowledgeBase: this.awsWafKnowledgeBase,
      dataSourceName: 'aws-waf',
      sourceUrls: ['https://docs.aws.amazon.com/waf/latest/developerguide/waf-chapter.html'],
      crawlingScope: bedrock.CrawlingScope.DEFAULT,
      crawlingRate: 100,
      chunkingStrategy: bedrock.ChunkingStrategy.hierarchical({
        overlapTokens: 1000,
        maxParentTokenSize: 8192,
        maxChildTokenSize: 4096
        // maxTokens: 1000,
        // overlapPercentage: 10,
      })
    })

    // this.modSecKnowledgeBase = new bedrock.VectorKnowledgeBase(this, 'ModSecKnowledgeBase', {
    //   name: 'ModSecKnowledgeBase',
    //   embeddingsModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
    //   instruction: `Contains documentation for ModSecurity.`,
    // });

    // const modSecDataSource = new bedrock.WebCrawlerDataSource(this, 'ModSecDataSource', {
    //   knowledgeBase: this.modSecKnowledgeBase,
    //   dataSourceName: 'modsec',
    //   sourceUrls: ['https://github.com/owasp-modsecurity/ModSecurity/wiki/Reference-Manual-%28v2.x%29'],
    //   crawlingScope: bedrock.CrawlingScope.DEFAULT,
    //   crawlingRate: 5,
    //   chunkingStrategy: bedrock.ChunkingStrategy.hierarchical({
    //     overlapTokens: 1000,
    //     maxParentTokenSize: 8192,
    //     maxChildTokenSize: 4096
    //     // maxTokens: 1000,
    //     // overlapPercentage: 10,
    //   })
    // })

    const tasksManagementTable = new dynamodb.Table(this, 'TasksManagementTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: "PK",
        type: dynamodb.AttributeType.STRING
      },
    });

    const inputBucket = new s3.Bucket(this, 'ModeSecResearchInputBucket', {
      bucketName: `research-input-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      eventBridgeEnabled: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    const outputBucket = new s3.Bucket(this, 'ModeSecResearchOutputBucket', {
      bucketName: `research-output-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      eventBridgeEnabled: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    inputBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.AccountPrincipal(cdk.Aws.ACCOUNT_ID)],
        actions: [
          "s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject",
          "s3:PutObjectAcl"
        ],
        resources: [inputBucket.arnForObjects("*"), inputBucket.bucketArn]
      }),
    );

    const researchInputSqs = new sqs.Queue(this, 'ResearchInputSqs', {
      visibilityTimeout: cdk.Duration.minutes(30), //6 times the function timeout, plus the value of MaximumBatchingWindowInSeconds
      receiveMessageWaitTime: cdk.Duration.seconds(20), // Enable long polling
    })

    new events.Rule(this, `ResearchInputFileArrivalRule`, {
      // from default event bus
      eventPattern: {
        source: [
          "aws.s3"
        ],
        detailType: [
          "Object Created",
          // "Object Deleted"
        ],
        detail: {
          bucket: {
            name: [
              inputBucket.bucketName
            ]
          }
        }
      },
      targets: [new evtTargets.SqsQueue(researchInputSqs)]
    });

    // let funcCode = fs.readFileSync('lambda/src/handlers/researchIt/app.py').toString();
    const researchItFunction = new lambda.Function(this, 'ResearchItFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      // code: new lambda.InlineCode(funcCode),
      // handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset('lambda/src/.aws-sam/build/ResearchItFunction'),
      handler: 'app.lambda_handler',
      timeout: cdk.Duration.minutes(5),
      memorySize: 128,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        TABLE_NAME: tasksManagementTable.tableName,
        INPUT_BUCKET: inputBucket.bucketName,
        OUTPUT_BUCKET: outputBucket.bucketName
      },
      reservedConcurrentExecutions: 1
    });
    const researchItFunctionPolicy = new iam.PolicyStatement({
      actions: [
        "bedrock:*",
        "s3:*",
        "dynamodb:*"
      ],
      resources: ['*'],
      effect: cdk.aws_iam.Effect.ALLOW
    });

    researchItFunction.role?.attachInlinePolicy(
      new iam.Policy(this, 'ResearchItFunctionPolicy', {
        statements: [researchItFunctionPolicy],
      }),
    );
    const ResearchItLogGroup = new logs.LogGroup(this, 'FormatAnswerLogGroup', {
      logGroupName: `/aws/lambda/${researchItFunction.functionName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    researchItFunction.addEventSource(new SqsEventSource(researchInputSqs, {
      batchSize: 1,
    }));

  }
}