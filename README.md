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

## Plugin configuration

Here is a possible valid configuration to enable this plugin.


```yaml
plugin: ubiquibot/conversation-rewards
with:
    evmNetworkId: 100
    evmPrivateEncrypted: "encrypted-key"
    incentives:
      enabled: true
      contentEvaluator:
        enabled: true
      userExtractor:
        enabled: true
        redeemTask: true
      dataPurge:
        enabled: true
      formattingEvaluator:
        enabled: true
        scores:
          br: 0
          code: 1
          p: 1
          em: 0
          img: 0
          strong: 0
          blockquote: 0
          h1: 1
          h2: 1
          h3: 1
          h4: 1
          h5: 1
          h6: 1
          a: 1
          li: 1
          td: 1
          hr: 0
        multipliers:
          - type: [ ISSUE, ISSUER, SPECIFICATION ]
            formattingMultiplier: 1
            wordValue: 0.1
          - type: [ ISSUE, ISSUER, COMMENTED ]
            formattingMultiplier: 1
            wordValue: 0.2
          - type: [ ISSUE, ASSIGNEE, COMMENTED ]
            formattingMultiplier: 0
            wordValue: 0
          - type: [ ISSUE, COLLABORATOR, COMMENTED ]
            formattingMultiplier: 1
            wordValue: 0.1
          - type: [ ISSUE, CONTRIBUTOR, COMMENTED ]
            formattingMultiplier: 0.25
            wordValue: 0.1
          - type: [ REVIEW, ISSUER, TASK ]
            formattingMultiplier: 0
            wordValue: 0
          - type: [ REVIEW, ISSUER, COMMENTED ]
            formattingMultiplier: 2
            wordValue: 0.2
          - type: [ REVIEW, ASSIGNEE, COMMENTED ]
            formattingMultiplier: 1
            wordValue: 0.1
          - type: [ REVIEW, COLLABORATOR, COMMENTED ]
            formattingMultiplier: 1
            wordValue: 0.1
          - type: [ REVIEW, CONTRIBUTOR, COMMENTED ]
            formattingMultiplier: 0.25
            wordValue: 0.1
      permitGeneration:
        enabled: false
      githubComment:
        enabled: true
        post: true
        debug: false
```
