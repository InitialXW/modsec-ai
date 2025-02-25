## Analyze the rules
- Use Markdown format.
- Explain in details the effect of each ModSecurity rule in the config.
- Come up with AWS WAF rules that can be used to best replace the ModSecurity rules.
- Explain any discrepancies of effect between the ModSecurity rule and the replacement AWS WAF rules.
## Generate test code
- Use AWS lambda function in Python with lambda_handler to verify the effect of each rule.
- Take into consideration false positives, false negatives, and edge cases.
- Include doc string in the function that describes what the tested rule does and all assumptions made.
- Follow AAA (Arrange-Act-Assert) pattern.
- Handle exceptions appropriately.
- Provide test events with thorough coverage on false positives, false negatives and edge cases.
- Take into consideration regex expressions in designing test events, especially when the rule uses regex with the following features:
    - Backreferences and capturing subexpressions
    - Arbitrary zero-width assertions
    - Subroutine references and recursive patterns
    - Conditional patterns
    - Backtracking control verbs
    - The \C single-byte directive
    - The \R newline match directive
    - The \K start of match reset directive
    - Callouts and embedded code
    - Atomic grouping and possessive quantifiers
- Return test results in a dictionary like this:
```python
{
    "pass": false,
    "failReason": "why it failed if pass is false"
}
```
