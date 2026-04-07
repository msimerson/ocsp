# Changelog

### Unreleased

### [1.2.0] - 2026-04-07

- dep(simple-lru-cache): replaced with native Map

## [1.1.1] (@haraka/ocsp — msimerson)

- doc(README): updated with modern syntax
- feat: added index.d.ts

## [1.1.0] (@haraka/ocsp — msimerson)

- node >= 20
- getResponses is now async
- chore: fully qualify node modules (eg. http -> node:http)
- style(es6/7): replace forEach with for...of
  - function -> () (arrow functions)
  - || -> ?? (nullish coalescing)
- fix: skip OCSP validation when cert has no OCSP URL (e.g. LE certs)
- added `caCert` option to `ocsp.Server.create()` (separate CA from server cert)
- ci: replace Travis with GitHub Actions
- dep(async): refactored away with Promise.all
- deps: refactored test setup to remove all dev dependencies
- deps: bump dependency versions
- test: replace mocha with node:test
- test fixes due to tests running concurrently

## 1.0.2 (@ranierimazili/ocsp — ranierimazili)
- added `requestByGet` option to `ocsp.check()` to make OCSP requests via HTTP GET instead of POST

## 1.0.1 (@ranierimazili/ocsp — TechTeamer)
- Node 16 and 18 compatibility
- test fixes

## 1.0.0 (@ranierimazili/ocsp — ranierimazili)
- Node 14 compatibility
- dependency upgrades
- ES6 classes
- standardjs instead of jshint
- fixed tests
- fixes merged from the GitHub fork network:
  - [cache timeout fix](https://github.com/JoneXie1986/ocsp/commit/63b25b4e194d2ae162b02257a8d255728ee6560f)
  - [add server's cert to OCSP response](https://github.com/enumatech/ocsp/commit/b2d428f1a2e4108ec7922f366ef7a80e0c4b4957)
  - [signature algorithms updated](https://github.com/spoopy-link/ocsp/commit/945fbafaa3f7a2bde80e6bc6f02eb7943e094396)
  - [OCSP agent error handling](https://github.com/Mustek/ocsp/commit/d9c3f63f55723cb25f16754d328791b27f1e89a8)
  - [return more details on OCSP error](https://github.com/lukeadickinson/ocsp/commit/8a52f42a66a6df81fa4b45d70a3dfdb99438acf5)
  - [OCSP cache invalidation fix](https://github.com/ad737079/ocsp/commit/811068724f9bf155d61efd6aced0a55c1ccb9168)
  - [fix crash on expired certs](https://github.com/indutny/ocsp/pull/37)
  - [catch verify errors](https://github.com/indutny/ocsp/pull/36/files) & [#22](https://github.com/indutny/ocsp/pull/22)
  - [null reference fix](https://github.com/KSR-Yasuda/ocsp/commit/317dc96ac9056b50a04dba606a1b5a8d910dbb17)
  - [cache clear feature](https://github.com/spurreiter/ocsp/commit/6a2f012a11d2fd7a515c16a80bc12e628cc29853)

## Prior history

See the [indutny/ocsp](https://github.com/indutny/ocsp) repository for the
original version history by Fedor Indutny.

[1.2.0]: https://github.com/msimerson/ocsp/releases/tag/v1.2.0
[1.1.1]: https://github.com/msimerson/ocsp/releases/tag/v1.1.1
[1.1.0]: https://github.com/msimerson/ocsp/releases/tag/v1.1.0
