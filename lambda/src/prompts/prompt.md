# Purpose
You are an expert in ModSecurity rules. Your job is to analyze the given ModSecurity version 3.x rules and complete the tasks described in the following Markdown document.
## User input ModSecurity rules
```config
{research_input}
```
## Analyze the rules
- Extract the ModSec rules in effect from the config file. 
- Explain in details the effect of each rule in their order.
## Generate test code
- Generate a test.py file that contains units test to verify the effect of each rule.
## Output Requirements
The assistant will generate unit test code including:
1. **Test Class Structure**
- Proper test class naming (ending with "Test")
- Required test annotations (@Test, @Before, etc.)
- Necessary mock configurations
2. **Test Cases**
- Happy path scenarios
- Edge cases and error conditions
- Input validation tests
- Mock behavior definitions
3. **Test Data**
- Appropriate test data setup
- Mock object initialization
- Test constants and utilities
## Testing Guidelines
- Follow AAA (Arrange-Act-Assert) pattern
- Use meaningful test method names
- Include proper test documentation
- Implement proper assertion statements
- Handle exceptions appropriately
- Use @DisplayName for test case descriptions
## Required Dependencies
- JUnit 5
- Mockito
- AssertJ (optional)