# `@ubiquibot/conversation-rewards`

This is intended to be the proper implementation of comment incentives, based on our learnings from the first go-around. 

As of 28 February: test driven development to aggregate all necessary information based on a URL to an issue. 
- pass in closed as complete issue URL and receive all the timeline events and activities of all humans who helped close the issue as complete. 
- most importantly: this can inherit bot authentication and link pull requests to issues in private repositories. 

Be sure to review all `*.test.*` files for implementation details. 

## Data structure

```json
{
  "userName": {
    "total": 40.5,
    "task": {
      "reward": 37.5
    },
    "comments": [
      {
        "content": "comment content",
        "url": "https://url-to-item",
        "type": 18,
        "score": {
          "formatting": {
            "content": {
              "p": {
                "count": 16,
                "score": 1
              }
            },
            "wordValue": 0.1,
            "formattingMultiplier": 1
          },
          "reward": 0.8,
          "relevance": 0.5
      }
    }]
  }
}
```

Reward formula: `((count * wordValue) * (score * formattingMultiplier) * n) * relevance + task.reward = total`
