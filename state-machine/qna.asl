{
  "Comment": "Using Map state in Distributed mode",
  "StartAt": "ProcessFile",
  "States": {
    "ProcessFile": {
      "Type": "Map",
      "ItemProcessor": {
        "ProcessorConfig": {
          "Mode": "DISTRIBUTED",
          "ExecutionType": "STANDARD"
        },
        "StartAt": "ValidateRecord",
        "States": {
          "ValidateRecord": {
            "Type": "Choice",
            "Choices": [
              {
                "Or": [
                  {
                    "Variable": "$.QuestionId",
                    "StringEquals": ""
                  },
                  {
                    "Variable": "$.Question",
                    "StringEquals": ""
                  }
                ],
                "Next": "Finish"
              }
            ],
            "Default": "RetrieveAndGenerate"
          },
          "Finish": {
            "Type": "Pass",
            "End": true
          },
          "RetrieveAndGenerate": {
            "Type": "Task",
            "Parameters": {
              "Input": {
                "Text.$": "States.Format('You are a technical advisor, provide your recommendations based on the following question. {}', $.Question)"
              },
              "RetrieveAndGenerateConfiguration": {
                "Type": "KNOWLEDGE_BASE",
                "KnowledgeBaseConfiguration": {
                  "KnowledgeBaseId": "${KnowledgeBaseIdPlaceHolder}",
                  "ModelArn": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0",
                  "RetrievalConfiguration": {
                    "VectorSearchConfiguration": {
                      "NumberOfResults": 5
                    }
                  }
                }
              }
            },
            "Resource": "arn:aws:states:::aws-sdk:bedrockagentruntime:retrieveAndGenerate",
            "ResultPath": "$.BedrockResponse",
            "Next": "FormatAnswer",
            "Retry": [
              {
                "ErrorEquals": [
                  "States.ALL"
                ],
                "BackoffRate": 2,
                "IntervalSeconds": 1,
                "MaxAttempts": 30,
                "MaxDelaySeconds": 5,
                "JitterStrategy": "FULL"
              }
            ]
          },
          "FormatAnswer": {
            "Type": "Task",
            "Resource": "arn:aws:states:::lambda:invoke",
            "Parameters": {
              "Payload.$": "$",
              "FunctionName": "${FormatAnswerFunctionArnPlaceHolder}"
            },
            "Retry": [
              {
                "ErrorEquals": [
                  "Lambda.ServiceException",
                  "Lambda.AWSLambdaException",
                  "Lambda.SdkClientException",
                  "Lambda.TooManyRequestsException"
                ],
                "IntervalSeconds": 1,
                "MaxAttempts": 3,
                "BackoffRate": 2
              }
            ],
            "Next": "DynamoDBWrite",
            "ResultPath": "$.FormatAnswer"
          },
          "DynamoDBWrite": {
            "Type": "Task",
            "Resource": "arn:aws:states:::dynamodb:putItem",
            "Parameters": {
              "TableName": "${QuestionTableNamePlaceHolder}",
              "Item": {
                "PK": {
                  "S.$": "$.QuestionId"
                },
                "Question": {
                  "S.$": "$.Question"
                },
                "Answer": {
                  "S.$": "$.FormatAnswer.Payload.Payload"
                }
              }
            },
            "Next": "Finish",
            "Catch": [
              {
                "ErrorEquals": [
                  "States.ALL"
                ],
                "Next": "Finish"
              }
            ],
            "ResultPath": null,
          "OutputPath": null
          }
        }
      },
      "ItemReader": {
        "Resource": "arn:aws:states:::s3:getObject",
        "ReaderConfig": {
          "InputType": "CSV",
          "CSVHeaderLocation": "FIRST_ROW"
        },
        "Parameters": {
          "Bucket.$": "$.detail.bucket.name",
          "Key.$": "$.detail.object.key"
        }
      },
      "MaxConcurrency": 10,
      "Label": "ProcessFile",
      "End": true
    }
  }
}