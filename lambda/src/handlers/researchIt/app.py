import os, re, zipfile
import json
import boto3
from datetime import datetime

# Initialize AWS clients
dynamodb = boto3.client('dynamodb')
s3 = boto3.client('s3')
bedrock = boto3.client('bedrock-runtime')
table_name = os.environ["TABLE_NAME"]
input_bucket = os.environ["INPUT_BUCKET"]
output_bucket = os.environ["OUTPUT_BUCKET"]

def lambda_handler(event, context):
    print("Incoming Event:", json.dumps(event))
    try:
        # Log incoming event

        # Parse SQS event to get S3 details
        sqs_body = json.loads(event['Records'][0]['body'])
        object_key = sqs_body['detail']['object']['key']

        # Download file from input bucket
        response = s3.get_object(Bucket=input_bucket, Key=object_key)
        research_input = response['Body'].read().decode('utf-8')

        # Prepare Bedrock prompt
        with open('prompt.md', 'r') as file:
            prompt_content = file.read()
        prompt = f'''You are an expert in ModSecurity rules. Your job is to analyze the given ModSecurity version 3.x rules and complete the tasks described in the following Markdown document.
# Tasks
## User input ModSecurity rules
```config
{research_input}
```
{prompt_content}
'''
        # Prepare Bedrock request body
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 8192,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0
        }

        # Invoke Bedrock
        bedrock_response = bedrock.invoke_model(
            # modelId='anthropic.claude-3-5-sonnet-20241022-v2:0',
            # modelId='anthropic.claude-3-7-sonnet-20250219-v1:0',
            modelId='us.anthropic.claude-3-7-sonnet-20250219-v1:0',
            body=json.dumps(request_body)
        )

        # Parse Bedrock response
        response_body = json.loads(bedrock_response['body'].read())
        llm_response = response_body['content'][0]['text']
        code = extract_code(llm_response.strip())
        print("Bedrock Response:", llm_response)
        # print("!!! Code !!!", code)

        current_time = datetime.now().strftime("%H%M%S")
        temp_file_path = f"/tmp/app.py"

        # Save code to a temporary file
        with open(temp_file_path, 'w') as temp_file:
            temp_file.write(code)

        # Generate output filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_key = f"{timestamp}_{object_key}_analysis.md"

        # Create and upload zip file to S3
        zip_file_path = f"/tmp/{timestamp}.zip"
        create_zip_file(zip_file_path, temp_file_path)

        code_key = f"{timestamp}_{object_key}_test.zip"
        s3.upload_file(zip_file_path, output_bucket, code_key)
        print(f"Code saved to S3: s3://{output_bucket}/{code_key}")

        # Upload response to output bucket
        s3.put_object(
            Bucket=output_bucket,
            Key=output_key,
            Body=llm_response.encode('utf-8'),
            ContentType='text/plain'
        )

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Analysis completed successfully",
                "input_file": object_key,
                # "output_file": output_key
            })
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        raise e

def extract_code(response_text):
    """
    Extract Python code block from response text using regex.

    Parameters:
    - response_text (str): Text containing the Python code block.

    Returns:
    - str: Extracted Python code block.
    """
    match = re.search(r'```python\n(.*?)\n```', response_text, re.DOTALL)
    if match:
        return match.group(1)
    return response_text  # Return the whole text if no code block is found

def create_zip_file(zip_file_name, file_to_zip):
    """
    Create a zip file containing the given file.

    Parameters:
    - zip_file_name (str): Name of the zip file to create.
    - file_to_zip (str): Path to the file to include in the zip.
    """
    print(f"Creating zip file: {zip_file_name}")
    with zipfile.ZipFile(zip_file_name, 'w') as zipf:
        zipf.write(file_to_zip, os.path.basename(file_to_zip))
    print(f"{zip_file_name} created successfully.")


