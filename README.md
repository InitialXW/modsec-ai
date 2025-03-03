# AI assisted ModeSec rule migration to AWS WAF
## Prerequisite
1. AWS SAM installed. SAM is used to build AWS Lambda package to be deployed by AWS CDK
2. AWS CDK installed
3. 1x AWS account with appropriate permissions to use Anthropic Claud 3.7 Sonnet model on Amazon Bedrock with cross-region inference.

## Stack Deployment
- create a ***.env*** file in project root directory that looks like the below:
```text
CDK_PROCESSING_ACCOUNT=123456789012
CDK_PROCESSING_REGION=us-west-2
```
- then run below:
```shell
# in project directory run:
npm install
sam build --use-container
cdk deploy --all --require-approval never
```
## Test
- Go to 'research-input-123456789012-your-region' S3 bucket in your AWS account
- Upload the input text file that contains valid ModSecurity rules.
- Go to 'research-output-123456789012-your-region' S3 bucket to check analysis report and test code as a Lambda function zip package.
- Tune content in '/lambda/src/handlers/researchIt/prompt.md' to suit your analysis needs.
