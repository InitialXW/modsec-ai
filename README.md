# AI assisted ModeSec rule migration to AWS WAF
## Prerequisite
1. AWS SAM installed. SAM is used to build AWS Lambda package to be deployed by AWS CDK
2. AWS CDK installed
3. 1 AWS account with appropriate permissions to use Anthropic Claud 3.7 Sonnet model on Amazon Bedrock in cross-region inference.

## Stack Deployment
```shell
# in project directory run:
sam build --use-container
cdk deploy --all --require-approval never
```
## Test
- Go to 'research-input-123456789012-your-region' S3 bucket
- Upload the input text file that contains valid ModSecurity rules.
- Go to 'research-output-123456789012-your-region' S3 bucket to check analysis report and test code as a Lambda function zip package.
- Tune content in '/lambda/src/handlers/researchIt/prompt.md' to suit your analysis needs.
