# Changelog

## [1.2.1](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/compare/v1.2.0...v1.2.1) (2024-12-20)

### Bug Fixes

- check collaborator admin grants before checking on org level ([079442e](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/079442ee13893014819d7fab383afdb216e2fc83))
- ignore limit for assigned users ([377e8f2](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/377e8f2c3981083aa6b0f59f85bc10108b309825))
- remove unnecessary mock in favour of mocked api endpoint ([a5d16a2](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/a5d16a2beaca73d2b9978ee7f0cd59fbb7d5407f))
- set relevance to multiply the whole result (revert 8c4fe1b5) ([d5838e6](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/d5838e603cd886aeeca4ab049783d85841b85be6))
- the capping message is not displayed if there is no task reward ([28d3b88](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/28d3b8841b6a91baa874b1cf0f1d95a307e296d7))

## [1.2.0](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/compare/v1.1.0...v1.2.0) (2024-11-30)

### Features

- add Bun package manager and refactor createPlugin ([f66b609](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/f66b6097fccd4d341f220d072094af48f6eda126))
- add loading state to form submission ([1ebc1a5](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/1ebc1a538cd2254b762db7e590b810fe4ea6c65e))
- add navigation section to main component ([e49e52f](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/e49e52f591ff42f7ca58db5f8a059c269565490a))
- add payload creator for issue close event ([dfd04f5](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/dfd04f5ea5f0d3c4a8d62a61e2d8fe65a66959bd))
- add startup instructions and update payload config handling ([c1c727f](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/c1c727faf8fdf7e32b9b4596038e2e4c719693bc))
- command input ([6b3a53b](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/6b3a53bc8aeb5cc41444225969bfaf08d8e1f469))
- command interface ([1925cb9](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/1925cb9daddbda52b87f9ea3ee70a96a274236b4))
- enhance issue submission form and update URLs ([dee2589](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/dee258982532d0514f7e74ff7bfd7d29c72162c7))
- multiply conv reward with priority for higher reward ([a1fc779](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/a1fc779ec7276914cc32670b125a70042f69f9e0))
- remove SQLite dependency and add hono package ([8bcf6c8](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/8bcf6c81cac40a6de228b67294fc20a29dfb6177))
- **rewards:** add limitRewards to cap non-task rewards ([9ff6ba9](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/9ff6ba960f055488a10f7689e904936c6490c263))
- track unique URLs in formatting evaluator ([8e8fc82](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/8e8fc8212dd9a4447cbca8bbb542cef472788952))
- **web:** add initial setup for Hono-based frontend ([925c7ac](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/925c7ac330da16cf39f77f73c10fd942d1f542db))

### Bug Fixes

- add a th to display priority and fix it being not being multiplied ([69ff0e4](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/69ff0e4fe000f2b4b9d9663acad278912eaa33d2))
- add non-breaking spaces around Ubiquity Dollar link ([2fb75b6](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/2fb75b6764be75ca665bca8fdc02b7cda7907832))
- add priority parsing tests ([dbf0ab3](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/dbf0ab3af5379d69a964772d5c356b7e2d86edf7))
- add priority parsing tests ([7889d58](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/7889d5815c128ae439918166e7566ce35e998654))
- add useCache option to payload processing ([134a18f](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/134a18f1ab2a584c5a6db491eaba522312bf81ee))
- add useCache option to payload processing ([b01dc77](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/b01dc778efb61b0c0514be2f5a16577d6a69ee95))
- **configuration:** adjust role-based multiplier and rewards ([ebb4940](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/ebb4940a44abc971fec0f58b232bfe4cc649cfb2))
- enhance error logging and update regex for comments ([2ccdc8a](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/2ccdc8a670a9575e4b84173ffd9a906373f1c595))
- environment for compute ([d99e3f3](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/d99e3f35b3021b465f7b86cd7a4faa3330bf55b9))
- exclude and octokit ([8c0a729](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/8c0a729cbbdfa678a9eee667638a81e79eca5812))
- fees.test.ts ([e549b35](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/e549b356a868d6983357791c3028fd2d7a6b8111))
- handle undefined scores with explicit comparison ([11e2d8a](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/11e2d8ae6b97c3a38aa26cfef5e81f79d3c306fd))
- import error regarding parsePriorityLabel ([d080448](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/d080448cd65e734b6bbb0cb85a7dfa3d82456df7))
- improve error logging and add route parsing in server ([49e87b4](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/49e87b4031d9282ad36678800e3d85e604129a1d))
- **parser:** handle URLs with query parameters correctly ([c7b55dc](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/c7b55dc10d31ebf89e94ef8c75cc53308fcaf7ab))
- **parser:** remove footnotes and improve URL extraction ([ab2f9be](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/ab2f9be0f8e70ab5c7f7784a72e269ded83cb2f0))
- **parser:** simplify priority label parsing ([94ec7de](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/94ec7de2caf725bc34af0b2095421bf6b98bb347))
- **parser:** simplify priority label parsing ([17070e6](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/17070e6e022552cd849c9ecd613622d4851c852b))
- payload for backend uses the owner and repo payload ([cd42282](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/cd422826a858cbee388504a9487f1476bf8284a5))
- process.issue.test.ts by changing output ([9ff121f](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/9ff121f92cacedad689327f190b402803ee41ebc))
- properly mul priority level ([ca27c90](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/ca27c909e3402f32e8bab5f1879c04f3c447cb0d))
- refactor .call to ._callee_$ ([c4327dd](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/c4327ddf516d0fbaaa8b9a3a2c1c6896b3045032))
- replace ubiquity-os-kernel with plugin-sdk ([a94a75c](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/a94a75cfa050933e39ba08f29840be8409c0c7b5))
- **reward-limits:** adjust rewards limit calculation ([171f523](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/171f5233eea4d762ea247a9a1b40f558b3263c32))
- rewards.test.ts and have precison upto 3 decimal places ([c09b16b](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/c09b16b8310239d3a2eeb0c4a5b7c9c8d6caacca))
- simplify commentType generation and default multipliers ([0b0243e](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/0b0243e152bac1f63cb2632a564a62e40b923129))
- update Octokit import in test file ([6a2acc7](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/6a2acc7d5a5a8aadd6d7bc8fa2fff6c7b25b03c4))
- update OpenAI endpoint and improve GitHub comment metadata ([7da861e](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/7da861eee91c50be5f39a2285440b72e2cf7056c))
- update regex and parsing for OpenAI responses ([93b33df](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/93b33df573b4c5d417df324a08242ffdda3dbe5c))
- update regex for OpenAI route validation ([0d5995b](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/0d5995b9eecc93957d0f3c6299e2e93c4eaf8d03))
- **web:** update Form types and enhance URL handling ([017b048](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/017b048e899e519f9289534bce51f7a419ac602d))

## [1.1.0](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/compare/v1.0.0...v1.1.0) (2024-11-19)

### Features

- add Bun package manager and refactor createPlugin ([f66b609](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/f66b6097fccd4d341f220d072094af48f6eda126))
- add loading state to form submission ([1ebc1a5](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/1ebc1a538cd2254b762db7e590b810fe4ea6c65e))
- add navigation section to main component ([e49e52f](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/e49e52f591ff42f7ca58db5f8a059c269565490a))
- add payload creator for issue close event ([dfd04f5](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/dfd04f5ea5f0d3c4a8d62a61e2d8fe65a66959bd))
- add startup instructions and update payload config handling ([c1c727f](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/c1c727faf8fdf7e32b9b4596038e2e4c719693bc))
- enhance issue submission form and update URLs ([dee2589](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/dee258982532d0514f7e74ff7bfd7d29c72162c7))
- multiply conv reward with priority for higher reward ([a1fc779](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/a1fc779ec7276914cc32670b125a70042f69f9e0))
- remove SQLite dependency and add hono package ([8bcf6c8](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/8bcf6c81cac40a6de228b67294fc20a29dfb6177))
- **web:** add initial setup for Hono-based frontend ([925c7ac](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/925c7ac330da16cf39f77f73c10fd942d1f542db))

### Bug Fixes

- add a th to display priority and fix it being not being multiplied ([69ff0e4](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/69ff0e4fe000f2b4b9d9663acad278912eaa33d2))
- add non-breaking spaces around Ubiquity Dollar link ([2fb75b6](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/2fb75b6764be75ca665bca8fdc02b7cda7907832))
- add priority parsing tests ([dbf0ab3](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/dbf0ab3af5379d69a964772d5c356b7e2d86edf7))
- add priority parsing tests ([7889d58](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/7889d5815c128ae439918166e7566ce35e998654))
- add useCache option to payload processing ([134a18f](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/134a18f1ab2a584c5a6db491eaba522312bf81ee))
- **configuration:** adjust role-based multiplier and rewards ([ebb4940](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/ebb4940a44abc971fec0f58b232bfe4cc649cfb2))
- enhance error logging and update regex for comments ([2ccdc8a](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/2ccdc8a670a9575e4b84173ffd9a906373f1c595))
- environment for compute ([d99e3f3](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/d99e3f35b3021b465f7b86cd7a4faa3330bf55b9))
- exclude and octokit ([8c0a729](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/8c0a729cbbdfa678a9eee667638a81e79eca5812))
- fees.test.ts ([e549b35](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/e549b356a868d6983357791c3028fd2d7a6b8111))
- handle undefined scores with explicit comparison ([11e2d8a](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/11e2d8ae6b97c3a38aa26cfef5e81f79d3c306fd))
- import error regarding parsePriorityLabel ([d080448](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/d080448cd65e734b6bbb0cb85a7dfa3d82456df7))
- improve error logging and add route parsing in server ([49e87b4](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/49e87b4031d9282ad36678800e3d85e604129a1d))
- **parser:** simplify priority label parsing ([94ec7de](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/94ec7de2caf725bc34af0b2095421bf6b98bb347))
- **parser:** simplify priority label parsing ([17070e6](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/17070e6e022552cd849c9ecd613622d4851c852b))
- process.issue.test.ts by changing output ([9ff121f](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/9ff121f92cacedad689327f190b402803ee41ebc))
- properly mul priority level ([ca27c90](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/ca27c909e3402f32e8bab5f1879c04f3c447cb0d))
- refactor .call to ._callee_$ ([c4327dd](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/c4327ddf516d0fbaaa8b9a3a2c1c6896b3045032))
- replace ubiquity-os-kernel with plugin-sdk ([a94a75c](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/a94a75cfa050933e39ba08f29840be8409c0c7b5))
- rewards.test.ts and have precison upto 3 decimal places ([c09b16b](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/c09b16b8310239d3a2eeb0c4a5b7c9c8d6caacca))
- simplify commentType generation and default multipliers ([0b0243e](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/0b0243e152bac1f63cb2632a564a62e40b923129))
- update Octokit import in test file ([6a2acc7](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/6a2acc7d5a5a8aadd6d7bc8fa2fff6c7b25b03c4))
- update OpenAI endpoint and improve GitHub comment metadata ([7da861e](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/7da861eee91c50be5f39a2285440b72e2cf7056c))
- update regex and parsing for OpenAI responses ([93b33df](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/93b33df573b4c5d417df324a08242ffdda3dbe5c))
- update regex for OpenAI route validation ([0d5995b](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/0d5995b9eecc93957d0f3c6299e2e93c4eaf8d03))
- **web:** update Form types and enhance URL handling ([017b048](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/017b048e899e519f9289534bce51f7a419ac602d))

## 1.0.0 (2024-11-18)

### Features

- add Bun package manager and refactor createPlugin ([f66b609](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/f66b6097fccd4d341f220d072094af48f6eda126))
- multiply conv reward with priority for higher reward ([a1fc779](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/a1fc779ec7276914cc32670b125a70042f69f9e0))

### Bug Fixes

- add a th to display priority and fix it being not being multiplied ([69ff0e4](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/69ff0e4fe000f2b4b9d9663acad278912eaa33d2))
- add non-breaking spaces around Ubiquity Dollar link ([2fb75b6](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/2fb75b6764be75ca665bca8fdc02b7cda7907832))
- add priority parsing tests ([dbf0ab3](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/dbf0ab3af5379d69a964772d5c356b7e2d86edf7))
- environment for compute ([d99e3f3](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/d99e3f35b3021b465f7b86cd7a4faa3330bf55b9))
- exclude and octokit ([8c0a729](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/8c0a729cbbdfa678a9eee667638a81e79eca5812))
- fees.test.ts ([e549b35](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/e549b356a868d6983357791c3028fd2d7a6b8111))
- handle undefined scores with explicit comparison ([11e2d8a](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/11e2d8ae6b97c3a38aa26cfef5e81f79d3c306fd))
- import error regarding parsePriorityLabel ([d080448](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/d080448cd65e734b6bbb0cb85a7dfa3d82456df7))
- **parser:** simplify priority label parsing ([94ec7de](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/94ec7de2caf725bc34af0b2095421bf6b98bb347))
- process.issue.test.ts by changing output ([9ff121f](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/9ff121f92cacedad689327f190b402803ee41ebc))
- properly mul priority level ([ca27c90](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/ca27c909e3402f32e8bab5f1879c04f3c447cb0d))
- refactor .call to ._callee_$ ([c4327dd](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/c4327ddf516d0fbaaa8b9a3a2c1c6896b3045032))
- replace ubiquity-os-kernel with plugin-sdk ([a94a75c](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/a94a75cfa050933e39ba08f29840be8409c0c7b5))
- rewards.test.ts and have precison upto 3 decimal places ([c09b16b](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/c09b16b8310239d3a2eeb0c4a5b7c9c8d6caacca))
- simplify commentType generation and default multipliers ([0b0243e](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/0b0243e152bac1f63cb2632a564a62e40b923129))
- update OpenAI endpoint and improve GitHub comment metadata ([7da861e](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/7da861eee91c50be5f39a2285440b72e2cf7056c))

## [1.5.1](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/compare/v1.5.0...v1.5.1) (2024-10-12)

### Bug Fixes

- add log message for closed pull requests ([d640681](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/d640681cbcbbf5961e61c4f41eec8b82d963444d))
- add logging for payload truncation ([bf0f4c5](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/bf0f4c5f6aaa8714baf8e4653f36f275f695374f))
- added custom configuration and related tests ([2fc8136](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/2fc8136813c94553cc1631d50b87901831405484))
- downgrade ethers to 5.7.2 and update web3 helper ([c5e8e3c](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/c5e8e3c0877bd21e80d745bdae557d28c74bd7f4))
- enhance error logging for missing multiplier cases ([a8cab80](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/a8cab808e30cd1e156e795de22a63a386c39c591))
- enhance error logging for missing multiplier cases ([72d0d47](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/72d0d4711eec68f7880e95762ccb5a853cf2299a))
- remove redundant console log in run.ts ([7851b75](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/7851b7524822c42b62e1c67dca4a00bcbe9d7f4f))
- upgrade permit generation package ([5300022](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/commit/5300022f2b45d0d1b5c48b2d0db46014a5643bf5))

## [1.5.0](https://github.com/ubiquity-os-marketplace/conversation-rewards/compare/v1.4.0...v1.5.0) (2024-09-30)

### Features

- add private key formats ([43ffc4d](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/43ffc4d11692c9f4f6129288c7c0513698c60b34))
- added log level ([f41393a](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/f41393ac5651a16b9af79a406997fcdcfdbf1d03))
- changed word count and introduced elementCount ([6911a5d](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/6911a5d0586cfbb415e3653d3ddaf15d5dc311ea))
- compressing html output ([741ee20](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/741ee20362c00963d8444d7cb8c0c95857420d9d))
- content is stripped if it is too large for a comment ([f2ca2bb](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/f2ca2bb27b2a6be04304d9b6e02e5b1b9f18a286))
- skip minimized comments ([0a7576d](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/0a7576d65ea6845f771c9b2c26c39481743ee32c))
- support individual repos ([0d34345](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/0d343459bdd42f23c22077c8fc9d2ddce46fa2ca))

### Bug Fixes

- apply fixes to broken merge ([bbb22e6](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/bbb22e641255085bdb97c01cee4da00455239b57))
- edited the mock results to match new calculation module ([a0d007c](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/a0d007cde2deb51385d72984e88f945deea42d41))
- fix github comment and reward split tests ([4e24f40](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/4e24f40430473211ffed8aab72a5998f6df48660))
- fix github comment and reward split tests ([3cee864](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/3cee86421ae55c74736380cc98beba018c75c4ff))
- fixed decimal issues with evaluation ([1e30cd2](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/1e30cd22a30ce460859cfda45eb63fc549776ea8))
- fixed issues with permit generation and mock results ([aa3affa](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/aa3affa772945618a51caffbc7705489b9233204))
- html content is stripped from metadata ([a595751](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/a59575127e688503335e9d81d5790029b64bdf74))
- include forgotten reward-split calculation changes ([b171bb6](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/b171bb68383b8d5e20dc38cd86fd052fb0334a48))
- no message is posted on skip ([512519d](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/512519db690d81a8eeb6178e40f61bccec6e9b14))
- refactored extra calculation and fixed mock results ([834910e](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/834910e777ab751e9bef4255f8b418ab31c8cb5b))
- relevance is only applied to content ([8c4fe1b](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/8c4fe1b57e154581186d97148725d6c4e04ba7b1))
- removed regex from configuration ([19e70a4](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/19e70a4e946e8b6560a9265de95198c6c2d56b46))
- resolve conflicts ([434d28a](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/434d28a58f9aa815f5df0481e8d654190ad08176))
- test permit related mock test result fixes ([0b6f245](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/0b6f24537696ea3d621a6b27e12e27d72136830b))
- typo ([cd740ab](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/cd740ab0ec3c7cbe33c50c550e082631afb0704e))
- use camel casing for property name ([2da6b86](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/2da6b868c9700b68e5bbedfb64683e42b384755c))
- use issue.node_id for permit nonces ([1d2ad4d](https://github.com/ubiquity-os-marketplace/conversation-rewards/commit/1d2ad4d04c43184de6559aabb36be7f506287a79))

## [1.2.0](https://github.com/ubiquibot/conversation-rewards/compare/v1.1.0...v1.2.0) (2024-07-10)

### Features

- reward is now split if there are multiple assignees ([b556238](https://github.com/ubiquity-os/conversation-rewards/commit/b55623812633bc48760e07bbbd7a1c8f7509121d))

### Bug Fixes

- assignees are added to the reward even without commenting ([170cdcc](https://github.com/ubiquity-os/conversation-rewards/commit/170cdcc694cf4499eb8210beff1a58885c99c5a4))
- users with no comment now can see their issue task on multiple assignees ([615d221](https://github.com/ubiquity-os/conversation-rewards/commit/615d221bc1d0a8129f58e2c0ff5c06339d177792))

## [1.1.0](https://github.com/ubiquity-os/conversation-rewards/compare/v1.0.0...v1.1.0) (2024-07-07)

### Features

- add erc20RewardToken config param ([2b53e68](https://github.com/ubiquity-os/conversation-rewards/commit/2b53e6875178d8f4ead54a620dc13e0e5f8c2322))
- pass token address on permit generation ([6fd15dd](https://github.com/ubiquity-os/conversation-rewards/commit/6fd15ddcdf71062f905a14ddf4c4dd5fe8051e38))
- set default erc20 reward param to WXDAI ([f7ad975](https://github.com/ubiquity-os/conversation-rewards/commit/f7ad97538c7a5da1dfee37f309be4a2885847574))

### Bug Fixes

- resolve conflicts ([f8159e1](https://github.com/ubiquity-os/conversation-rewards/commit/f8159e16d7988ba7346208fba8d18b25115fe4bb))
- updated test suite to match the new schema, fixed the async test to not run after tear down ([ca6e472](https://github.com/ubiquity-os/conversation-rewards/commit/ca6e472511cbecad9a7b3ce7ba137e9c6b3ce3ff))

## 1.0.0 (2024-06-11)

### Features

- cli argument to pass the issue URL to the program ([d4e9116](https://github.com/ubiquity-os/conversation-rewards/commit/d4e91169ffd22b0f3bd0c26adc5829391c37437f))
- collect all user events ([147ba83](https://github.com/ubiquity-os/conversation-rewards/commit/147ba83525c8626ebfccae97c30f368e087f4029))
- command line parsing arguments ([af93229](https://github.com/ubiquity-os/conversation-rewards/commit/af932291d1b17f535b2cc5e5c02ce2ad4cfe7028))
- configuration parser ([0e6f3d1](https://github.com/ubiquity-os/conversation-rewards/commit/0e6f3d192713bf5803b82aa5c80f73d8fab0989a))
- formatting is evaluated and influences the final score ([45d2831](https://github.com/ubiquity-os/conversation-rewards/commit/45d2831ffb0337a68d4d4280f6a550c12c712d68))
- **get-activity:** properly fetches everything according to test ([6e067f7](https://github.com/ubiquity-os/conversation-rewards/commit/6e067f71b69f58f1f1391ccce522c67fafd8fb94))
- github app login ([f4f4896](https://github.com/ubiquity-os/conversation-rewards/commit/f4f4896b8611acd53f61685a6774665b5dfb8928))
- github app login ([b2efc68](https://github.com/ubiquity-os/conversation-rewards/commit/b2efc68d996d9202ff4bd6a3385e9922e8eda846))
- github app login ([df34aa7](https://github.com/ubiquity-os/conversation-rewards/commit/df34aa71a1c36563f34a14ea1fb4220642332012))
- github app login ([8add964](https://github.com/ubiquity-os/conversation-rewards/commit/8add9648f2717d71b6fb32b806fb97fd7cad800c))
- github app login ([ad16266](https://github.com/ubiquity-os/conversation-rewards/commit/ad1626672a42d5e2ba3f6404cb51db6d233e0c9c))
- github app login ([013519d](https://github.com/ubiquity-os/conversation-rewards/commit/013519d80fad987f7ca7bfb2774f7d5ed00d9468))
- github app login ([39fa39d](https://github.com/ubiquity-os/conversation-rewards/commit/39fa39d58f38e984e3b3120d09338becef753e36))
- link pull request from issue (not other way around) ([e6aa979](https://github.com/ubiquity-os/conversation-rewards/commit/e6aa97973e7b8bb64551bd060ab6e2e005b6d4d3))
- moved tsx to production dependencies ([423f49e](https://github.com/ubiquity-os/conversation-rewards/commit/423f49e2dfaff1b8ca4603100cd89aa41b0b6e52))
- pass in token from kernel to authenticate octokit client ([1f4ba00](https://github.com/ubiquity-os/conversation-rewards/commit/1f4ba009bd81b3cbea79e8cde1735407d0504037))
- permit generation module ([925243f](https://github.com/ubiquity-os/conversation-rewards/commit/925243f8ac5cc847b4b63ac76195d0d3de3c9fed))
- permit generation module ([50b396b](https://github.com/ubiquity-os/conversation-rewards/commit/50b396b26e1bec433f193481004a7db6505f5ba5))
- read inputs from GitHub inputs instead of CLI ([30ac759](https://github.com/ubiquity-os/conversation-rewards/commit/30ac759a2e81633304f91ff127a7d6848af420d2))
- saving permit to database ([aecd4e1](https://github.com/ubiquity-os/conversation-rewards/commit/aecd4e127e9341ae18c18b14bf7c1c5dc8f98a6b))
- untested class to get all information ([f5104e1](https://github.com/ubiquity-os/conversation-rewards/commit/f5104e14034cf2b6174bff1c6d3669aa177e438c))
- untested class to get all information ([a86c62f](https://github.com/ubiquity-os/conversation-rewards/commit/a86c62f67c48a129dcb904d6fd69663c9e847f0d))
- updated jest test workflow ([a69f8d9](https://github.com/ubiquity-os/conversation-rewards/commit/a69f8d9c82a8316b90f4c9f14b177185ebefcb25))
- updated jest test workflow ([834f821](https://github.com/ubiquity-os/conversation-rewards/commit/834f821b42079c30d8e194749e6538e2d5a17ceb))

### Bug Fixes

- all tests pass ([db1868e](https://github.com/ubiquity-os/conversation-rewards/commit/db1868e60fe96ea9f8a30a347d40e1cac7c9e067))
- **ci:** auth ([e897fdb](https://github.com/ubiquity-os/conversation-rewards/commit/e897fdb4c0bcaeecbd6b6445a85a58d26b613338))
- cspell ([890a4a4](https://github.com/ubiquity-os/conversation-rewards/commit/890a4a4c250d40d99fb6e127664c02544eef0826))
- cspell ignore words ([1160614](https://github.com/ubiquity-os/conversation-rewards/commit/11606142d26cbd57c7c33f9e08d0e0a6bab689d2))
- fixed path for evm values ([2f3c2ee](https://github.com/ubiquity-os/conversation-rewards/commit/2f3c2ee229400031e1fd95324d91677eda84925e))
- more characters are escaped (backtick, ampersand) to avoid display issues ([550869c](https://github.com/ubiquity-os/conversation-rewards/commit/550869c13e48e4bb2865acb629bed66b6a3ab1e6))
- permit generation is skipped if price label is missing (configurable) ([d59cb0a](https://github.com/ubiquity-os/conversation-rewards/commit/d59cb0a93c50770ec946514627ca34406e3da2e0))
- remove build action and changed trigger for Jest testing ([146580e](https://github.com/ubiquity-os/conversation-rewards/commit/146580efc68b6d8ccaf56ba3873bc2dead03bd68))
- skip on issue close not completed status ([2c15e7c](https://github.com/ubiquity-os/conversation-rewards/commit/2c15e7c44ea878221cce0afba4b93ffa3f4da067))
- **test:** resolve promises ([9d57104](https://github.com/ubiquity-os/conversation-rewards/commit/9d571040cc8219c23a506ff8809273b991058f49))
- **test:** resolve promises ([1d62274](https://github.com/ubiquity-os/conversation-rewards/commit/1d62274efb1cafea37356cf7d59069a4413bc436))
- types ([c4ad907](https://github.com/ubiquity-os/conversation-rewards/commit/c4ad90732a3ba25098866ecb09103d8b780f05c8))
