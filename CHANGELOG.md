# Changelog

## [1.4.0](https://github.com/ubiquibot/conversation-rewards/compare/v1.3.1...v1.4.0) (2024-08-28)


### Features

* added configuration for OpenAI settings ([bab8e3a](https://github.com/ubiquibot/conversation-rewards/commit/bab8e3a61b03eb54bbb7d5288cbaeae67a41171c))
* changed pull-request by graphql ([4de373f](https://github.com/ubiquibot/conversation-rewards/commit/4de373fc13fea8fc18c7d016379ad5b909321b87))
* only extracting the last pull request ([313f11b](https://github.com/ubiquibot/conversation-rewards/commit/313f11b209a3b79a8d4ada2022505a510d253a56))


### Bug Fixes

* relevances are not sent to OpenAI if empty ([d0e5bac](https://github.com/ubiquibot/conversation-rewards/commit/d0e5baccc6bf25f85a95751ae1f3e82684860d13))
* waiting message is only displayed on issue completed ([6b6698b](https://github.com/ubiquibot/conversation-rewards/commit/6b6698b41459d8d8ecf0b8d019b40b385a7f4fe3))

## [1.3.1](https://github.com/ubiquibot/conversation-rewards/compare/v1.3.0...v1.3.1) (2024-08-20)


### Bug Fixes

* increased max tokens for ChatGpt based on the prompt ([6132345](https://github.com/ubiquibot/conversation-rewards/commit/6132345bc16dbfc68bd0c9444781aa511d73a32d))

## [1.3.0](https://github.com/ubiquibot/conversation-rewards/compare/v1.2.0...v1.3.0) (2024-08-13)


### Features

* add erc20RewardToken config param ([2b53e68](https://github.com/ubiquibot/conversation-rewards/commit/2b53e6875178d8f4ead54a620dc13e0e5f8c2322))
* add permit env variables ([d24b5a7](https://github.com/ubiquibot/conversation-rewards/commit/d24b5a734909f19fbdb7cfadbc53662c1de7d791))
* add relevance config for content evaluator ([16d6c61](https://github.com/ubiquibot/conversation-rewards/commit/16d6c61fb7fa400702956b720e540fcb9e0488a9))
* add test ([33bb5d9](https://github.com/ubiquibot/conversation-rewards/commit/33bb5d93f195069e846ebd6a06fb4119f75458de))
* added ubiquibot logger ([9318652](https://github.com/ubiquibot/conversation-rewards/commit/93186521150281ecef6dc2c92257e0ae528404ef))
* added ubiquibot logger ([0533eba](https://github.com/ubiquibot/conversation-rewards/commit/0533eba12c78860633a5009796e0928a22e68bfe))
* changed configuration for rewards ([a0cc8a4](https://github.com/ubiquibot/conversation-rewards/commit/a0cc8a45c1e024e57c91e1c9e61f604b19ccb7fb))
* cli argument to pass the issue URL to the program ([d4e9116](https://github.com/ubiquibot/conversation-rewards/commit/d4e91169ffd22b0f3bd0c26adc5829391c37437f))
* configuration for data collection ([26a0bed](https://github.com/ubiquibot/conversation-rewards/commit/26a0bed151188b95d901e79a58e874ab4c5280db))
* fixed error, added test ([6791fed](https://github.com/ubiquibot/conversation-rewards/commit/6791fed0da8aa41d55e8d2f86d6c56afa325a5a2))
* github app login ([f4f4896](https://github.com/ubiquibot/conversation-rewards/commit/f4f4896b8611acd53f61685a6774665b5dfb8928))
* github app login ([b2efc68](https://github.com/ubiquibot/conversation-rewards/commit/b2efc68d996d9202ff4bd6a3385e9922e8eda846))
* github app login ([df34aa7](https://github.com/ubiquibot/conversation-rewards/commit/df34aa71a1c36563f34a14ea1fb4220642332012))
* github app login ([8add964](https://github.com/ubiquibot/conversation-rewards/commit/8add9648f2717d71b6fb32b806fb97fd7cad800c))
* github app login ([ad16266](https://github.com/ubiquibot/conversation-rewards/commit/ad1626672a42d5e2ba3f6404cb51db6d233e0c9c))
* github app login ([013519d](https://github.com/ubiquibot/conversation-rewards/commit/013519d80fad987f7ca7bfb2774f7d5ed00d9468))
* github app login ([39fa39d](https://github.com/ubiquibot/conversation-rewards/commit/39fa39d58f38e984e3b3120d09338becef753e36))
* moved tsx to production dependencies ([423f49e](https://github.com/ubiquibot/conversation-rewards/commit/423f49e2dfaff1b8ca4603100cd89aa41b0b6e52))
* pass token address on permit generation ([6fd15dd](https://github.com/ubiquibot/conversation-rewards/commit/6fd15ddcdf71062f905a14ddf4c4dd5fe8051e38))
* permit generation module ([925243f](https://github.com/ubiquibot/conversation-rewards/commit/925243f8ac5cc847b4b63ac76195d0d3de3c9fed))
* permit generation module ([50b396b](https://github.com/ubiquibot/conversation-rewards/commit/50b396b26e1bec433f193481004a7db6505f5ba5))
* prompt openai for json response ([0c063a8](https://github.com/ubiquibot/conversation-rewards/commit/0c063a8ef485b8f7b86d41b3cb13734a5c828344))
* read inputs from GitHub inputs instead of CLI ([30ac759](https://github.com/ubiquibot/conversation-rewards/commit/30ac759a2e81633304f91ff127a7d6848af420d2))
* retry configuration ([d53060f](https://github.com/ubiquibot/conversation-rewards/commit/d53060f7562b4e3cd9daa2ec8be2d352c034c1c4))
* retry plugin ([6bdd49f](https://github.com/ubiquibot/conversation-rewards/commit/6bdd49f05dbb68ea39a4bd19b4c9174c4c5cc8a0))
* retry to fetch on error ([a89fffd](https://github.com/ubiquibot/conversation-rewards/commit/a89fffd130e566803281a7a519efc7fc59aa5d99))
* reward is now split if there are multiple assignees ([b556238](https://github.com/ubiquibot/conversation-rewards/commit/b55623812633bc48760e07bbbd7a1c8f7509121d))
* saving permit to database ([aecd4e1](https://github.com/ubiquibot/conversation-rewards/commit/aecd4e127e9341ae18c18b14bf7c1c5dc8f98a6b))
* set default erc20 reward param to WXDAI ([f7ad975](https://github.com/ubiquibot/conversation-rewards/commit/f7ad97538c7a5da1dfee37f309be4a2885847574))
* subtract fees ([b7154c4](https://github.com/ubiquibot/conversation-rewards/commit/b7154c4ec6b01bc9717f821b3656c1f8653e3f64))
* updated jest test workflow ([a69f8d9](https://github.com/ubiquibot/conversation-rewards/commit/a69f8d9c82a8316b90f4c9f14b177185ebefcb25))
* updated jest test workflow ([834f821](https://github.com/ubiquibot/conversation-rewards/commit/834f821b42079c30d8e194749e6538e2d5a17ceb))


### Bug Fixes

* assignees are added to the reward even without commenting ([170cdcc](https://github.com/ubiquibot/conversation-rewards/commit/170cdcc694cf4499eb8210beff1a58885c99c5a4))
* comments are ignored for the final result ([ee14b90](https://github.com/ubiquibot/conversation-rewards/commit/ee14b90501db7aead0eb91056608fb8025e1bbcc))
* content preview is properly stripped down to 64 characters ([7206411](https://github.com/ubiquibot/conversation-rewards/commit/72064110674b5270085c20494ade1d6a42023ae2))
* cspell ignore words ([1160614](https://github.com/ubiquibot/conversation-rewards/commit/11606142d26cbd57c7c33f9e08d0e0a6bab689d2))
* do not apply fee to user.total ([6e09210](https://github.com/ubiquibot/conversation-rewards/commit/6e092104d25f8a2bedff71143c886ca6005c5b09))
* error comment ([9c776e5](https://github.com/ubiquibot/conversation-rewards/commit/9c776e54fba2c51c0e4ce9aa39f4b04bdb8a4cbb))
* fixed path for evm values ([2f3c2ee](https://github.com/ubiquibot/conversation-rewards/commit/2f3c2ee229400031e1fd95324d91677eda84925e))
* improve specification comment identification ([264869f](https://github.com/ubiquibot/conversation-rewards/commit/264869f87744d978afccdeed0a5d3c3315ac22c4))
* include missing h5 and other html tags ([a22defd](https://github.com/ubiquibot/conversation-rewards/commit/a22defd7785cffb6dc97601dfbda23d3f1f67e6c))
* linked PRs are properly collected ([8ea2713](https://github.com/ubiquibot/conversation-rewards/commit/8ea2713c093e94a63152f56008be25fb851fe6ae))
* mock ([dd64253](https://github.com/ubiquibot/conversation-rewards/commit/dd64253371f5565dee8438646569a85f91b74c25))
* mock ([b02ee29](https://github.com/ubiquibot/conversation-rewards/commit/b02ee290637738a9f8427c1d38d66de53adac011))
* mock ([5bde793](https://github.com/ubiquibot/conversation-rewards/commit/5bde79337cc1bacd7b80106edd74af752c037a6a))
* more characters are escaped (backtick, ampersand) to avoid display issues ([550869c](https://github.com/ubiquibot/conversation-rewards/commit/550869c13e48e4bb2865acb629bed66b6a3ab1e6))
* number conversion ([a0fa350](https://github.com/ubiquibot/conversation-rewards/commit/a0fa350572865d7b02d8160454ffc1a41ae119d8))
* permit generation is skipped if price label is missing (configurable) ([d59cb0a](https://github.com/ubiquibot/conversation-rewards/commit/d59cb0a93c50770ec946514627ca34406e3da2e0))
* remove build action and changed trigger for Jest testing ([146580e](https://github.com/ubiquibot/conversation-rewards/commit/146580efc68b6d8ccaf56ba3873bc2dead03bd68))
* remove unnecessary toFixed() ([0206639](https://github.com/ubiquibot/conversation-rewards/commit/02066394ba1f3aee553ea6082d453b37ecc260e8))
* removed enabled setting from configuration ([bf0d08a](https://github.com/ubiquibot/conversation-rewards/commit/bf0d08afb08a259c7ffd5858db27fb83a29d02f2))
* replace console logs with logger ([324234f](https://github.com/ubiquibot/conversation-rewards/commit/324234f946d3801a0fd72cc83acb629cf098e904))
* resolve conflicts ([05e19bf](https://github.com/ubiquibot/conversation-rewards/commit/05e19bf7eef5eefd5b69619319c66695b957ddad))
* resolve conflicts ([f8159e1](https://github.com/ubiquibot/conversation-rewards/commit/f8159e16d7988ba7346208fba8d18b25115fe4bb))
* score as 0 for unlisted html tags ([8a5a3ef](https://github.com/ubiquibot/conversation-rewards/commit/8a5a3ef4d59f61fa42207a500db7f2ca87bcd982))
* set relevance as 1 on chatgpt failure ([708db4e](https://github.com/ubiquibot/conversation-rewards/commit/708db4edee438f780c7f39e09ee62cb655c4edbe))
* set review comments relevance as 1 ([4d574b8](https://github.com/ubiquibot/conversation-rewards/commit/4d574b8b5aa334cb57790d98df61607f4ff98d97))
* set specs relevance as 1 ([101d176](https://github.com/ubiquibot/conversation-rewards/commit/101d176a64a56f75e816e0eda6c0c0ca3e5780c2))
* skip on issue close not completed status ([2c15e7c](https://github.com/ubiquibot/conversation-rewards/commit/2c15e7c44ea878221cce0afba4b93ffa3f4da067))
* stop evaluataion on openai failure ([3835202](https://github.com/ubiquibot/conversation-rewards/commit/3835202bd27b32a53b363544f95268f2cc366010))
* the metadata is properly escaped to avoid html rendering ([6b512c5](https://github.com/ubiquibot/conversation-rewards/commit/6b512c547bb1ebcd4afa0139d901cd407526c122))
* updated test suite to match the new schema, fixed the async test to not run after tear down ([ca6e472](https://github.com/ubiquibot/conversation-rewards/commit/ca6e472511cbecad9a7b3ce7ba137e9c6b3ce3ff))
* use decimal correctly get correct floating point ([135105d](https://github.com/ubiquibot/conversation-rewards/commit/135105d4d00a11fd6993eb2990ac53daf9a7b475))
* use typebox to validate openai response ([f468888](https://github.com/ubiquibot/conversation-rewards/commit/f4688887b803e6bd1e34ce19eb1047593d3da27b))
* users with no comment now can see their issue task on multiple assignees ([615d221](https://github.com/ubiquibot/conversation-rewards/commit/615d221bc1d0a8129f58e2c0ff5c06339d177792))

## [1.2.0](https://github.com/ubiquibot/conversation-rewards/compare/v1.1.0...v1.2.0) (2024-07-10)


### Features

* reward is now split if there are multiple assignees ([b556238](https://github.com/ubiquibot/conversation-rewards/commit/b55623812633bc48760e07bbbd7a1c8f7509121d))


### Bug Fixes

* assignees are added to the reward even without commenting ([170cdcc](https://github.com/ubiquibot/conversation-rewards/commit/170cdcc694cf4499eb8210beff1a58885c99c5a4))
* users with no comment now can see their issue task on multiple assignees ([615d221](https://github.com/ubiquibot/conversation-rewards/commit/615d221bc1d0a8129f58e2c0ff5c06339d177792))

## [1.1.0](https://github.com/ubiquibot/conversation-rewards/compare/v1.0.0...v1.1.0) (2024-07-07)


### Features

* add erc20RewardToken config param ([2b53e68](https://github.com/ubiquibot/conversation-rewards/commit/2b53e6875178d8f4ead54a620dc13e0e5f8c2322))
* pass token address on permit generation ([6fd15dd](https://github.com/ubiquibot/conversation-rewards/commit/6fd15ddcdf71062f905a14ddf4c4dd5fe8051e38))
* set default erc20 reward param to WXDAI ([f7ad975](https://github.com/ubiquibot/conversation-rewards/commit/f7ad97538c7a5da1dfee37f309be4a2885847574))


### Bug Fixes

* resolve conflicts ([f8159e1](https://github.com/ubiquibot/conversation-rewards/commit/f8159e16d7988ba7346208fba8d18b25115fe4bb))
* updated test suite to match the new schema, fixed the async test to not run after tear down ([ca6e472](https://github.com/ubiquibot/conversation-rewards/commit/ca6e472511cbecad9a7b3ce7ba137e9c6b3ce3ff))

## 1.0.0 (2024-06-11)


### Features

* cli argument to pass the issue URL to the program ([d4e9116](https://github.com/ubiquibot/conversation-rewards/commit/d4e91169ffd22b0f3bd0c26adc5829391c37437f))
* collect all user events ([147ba83](https://github.com/ubiquibot/conversation-rewards/commit/147ba83525c8626ebfccae97c30f368e087f4029))
* command line parsing arguments ([af93229](https://github.com/ubiquibot/conversation-rewards/commit/af932291d1b17f535b2cc5e5c02ce2ad4cfe7028))
* configuration parser ([0e6f3d1](https://github.com/ubiquibot/conversation-rewards/commit/0e6f3d192713bf5803b82aa5c80f73d8fab0989a))
* formatting is evaluated and influences the final score ([45d2831](https://github.com/ubiquibot/conversation-rewards/commit/45d2831ffb0337a68d4d4280f6a550c12c712d68))
* **get-activity:** properly fetches everything according to test ([6e067f7](https://github.com/ubiquibot/conversation-rewards/commit/6e067f71b69f58f1f1391ccce522c67fafd8fb94))
* github app login ([f4f4896](https://github.com/ubiquibot/conversation-rewards/commit/f4f4896b8611acd53f61685a6774665b5dfb8928))
* github app login ([b2efc68](https://github.com/ubiquibot/conversation-rewards/commit/b2efc68d996d9202ff4bd6a3385e9922e8eda846))
* github app login ([df34aa7](https://github.com/ubiquibot/conversation-rewards/commit/df34aa71a1c36563f34a14ea1fb4220642332012))
* github app login ([8add964](https://github.com/ubiquibot/conversation-rewards/commit/8add9648f2717d71b6fb32b806fb97fd7cad800c))
* github app login ([ad16266](https://github.com/ubiquibot/conversation-rewards/commit/ad1626672a42d5e2ba3f6404cb51db6d233e0c9c))
* github app login ([013519d](https://github.com/ubiquibot/conversation-rewards/commit/013519d80fad987f7ca7bfb2774f7d5ed00d9468))
* github app login ([39fa39d](https://github.com/ubiquibot/conversation-rewards/commit/39fa39d58f38e984e3b3120d09338becef753e36))
* link pull request from issue (not other way around) ([e6aa979](https://github.com/ubiquibot/conversation-rewards/commit/e6aa97973e7b8bb64551bd060ab6e2e005b6d4d3))
* moved tsx to production dependencies ([423f49e](https://github.com/ubiquibot/conversation-rewards/commit/423f49e2dfaff1b8ca4603100cd89aa41b0b6e52))
* pass in token from kernel to authenticate octokit client ([1f4ba00](https://github.com/ubiquibot/conversation-rewards/commit/1f4ba009bd81b3cbea79e8cde1735407d0504037))
* permit generation module ([925243f](https://github.com/ubiquibot/conversation-rewards/commit/925243f8ac5cc847b4b63ac76195d0d3de3c9fed))
* permit generation module ([50b396b](https://github.com/ubiquibot/conversation-rewards/commit/50b396b26e1bec433f193481004a7db6505f5ba5))
* read inputs from GitHub inputs instead of CLI ([30ac759](https://github.com/ubiquibot/conversation-rewards/commit/30ac759a2e81633304f91ff127a7d6848af420d2))
* saving permit to database ([aecd4e1](https://github.com/ubiquibot/conversation-rewards/commit/aecd4e127e9341ae18c18b14bf7c1c5dc8f98a6b))
* untested class to get all information ([f5104e1](https://github.com/ubiquibot/conversation-rewards/commit/f5104e14034cf2b6174bff1c6d3669aa177e438c))
* untested class to get all information ([a86c62f](https://github.com/ubiquibot/conversation-rewards/commit/a86c62f67c48a129dcb904d6fd69663c9e847f0d))
* updated jest test workflow ([a69f8d9](https://github.com/ubiquibot/conversation-rewards/commit/a69f8d9c82a8316b90f4c9f14b177185ebefcb25))
* updated jest test workflow ([834f821](https://github.com/ubiquibot/conversation-rewards/commit/834f821b42079c30d8e194749e6538e2d5a17ceb))


### Bug Fixes

* all tests pass ([db1868e](https://github.com/ubiquibot/conversation-rewards/commit/db1868e60fe96ea9f8a30a347d40e1cac7c9e067))
* **ci:** auth ([e897fdb](https://github.com/ubiquibot/conversation-rewards/commit/e897fdb4c0bcaeecbd6b6445a85a58d26b613338))
* cspell ([890a4a4](https://github.com/ubiquibot/conversation-rewards/commit/890a4a4c250d40d99fb6e127664c02544eef0826))
* cspell ignore words ([1160614](https://github.com/ubiquibot/conversation-rewards/commit/11606142d26cbd57c7c33f9e08d0e0a6bab689d2))
* fixed path for evm values ([2f3c2ee](https://github.com/ubiquibot/conversation-rewards/commit/2f3c2ee229400031e1fd95324d91677eda84925e))
* more characters are escaped (backtick, ampersand) to avoid display issues ([550869c](https://github.com/ubiquibot/conversation-rewards/commit/550869c13e48e4bb2865acb629bed66b6a3ab1e6))
* permit generation is skipped if price label is missing (configurable) ([d59cb0a](https://github.com/ubiquibot/conversation-rewards/commit/d59cb0a93c50770ec946514627ca34406e3da2e0))
* remove build action and changed trigger for Jest testing ([146580e](https://github.com/ubiquibot/conversation-rewards/commit/146580efc68b6d8ccaf56ba3873bc2dead03bd68))
* skip on issue close not completed status ([2c15e7c](https://github.com/ubiquibot/conversation-rewards/commit/2c15e7c44ea878221cce0afba4b93ffa3f4da067))
* **test:** resolve promises ([9d57104](https://github.com/ubiquibot/conversation-rewards/commit/9d571040cc8219c23a506ff8809273b991058f49))
* **test:** resolve promises ([1d62274](https://github.com/ubiquibot/conversation-rewards/commit/1d62274efb1cafea37356cf7d59069a4413bc436))
* types ([c4ad907](https://github.com/ubiquibot/conversation-rewards/commit/c4ad90732a3ba25098866ecb09103d8b780f05c8))
