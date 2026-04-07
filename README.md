# OCSP APIs for node.js

Various [OCSP][0]-related APIs to be used with node.js.

This package is a maintained fork of [indutny/ocsp][fork], which incorporates
fixes and improvements from across the GitHub fork network. See [CHANGELOG.md]
for the full history.

## Installing

```bash
$ npm install @haraka/ocsp
```

## Parts

1. Agent
2. Cache
3. Server
4. `check()`/`verify()`
5. `request.generate()`
6. `getOCSPURI()`

## Agent

Usage:

```javascript
const agent = new ocsp.Agent()

https.request({
  method: ...,
  host: ...,
  port: ...,
  path: ...,
  // Other options

  agent
}, (res) => {
  // ...
})
```

The following code snippet will perform a request to the specified server and
verify the server's certificate using OCSP (either stapling or a response from
the CA). If the certificate does not advertise an OCSP URL, the connection is
allowed to proceed.

NOTE: You may pass an `options` object to `new ocsp.Agent(options)`. It may
have the following properties:

* `CACacheSize`: number of CA certificates to keep in the cache. (Default: 1024)

## Cache

Usage:

```javascript
const cache = new ocsp.Cache()

const server = https.createServer({
  cert: cert,
  key: key
}, (req, res) => {
  res.end('hello world')
})

server.on('OCSPRequest', (cert, issuer, cb) => {
  ocsp.getOCSPURI(cert, (err, uri) => {
    if (err) return cb(err)
    if (uri === null) return cb()

    const req = ocsp.request.generate(cert, issuer)
    cache.probe(req.id, (err, cached) => {
      if (err) return cb(err)
      if (cached !== false) return cb(null, cached.response)

      cache.request(req.id, { url: uri, ocsp: req.data }, cb)
    })
  })
})
```

Cache should be used to provide [OCSP Stapling][1] responses to the client.

NOTE: Constructor accepts an `options` object with the following properties:

* `probe`: override `.probe()` method
* `store`: override `.store()` method
* `filter`: `filter(url, callback)` to whitelist CA URLs to request

Has the following methods:

* `.probe(id, callback)` — check if a response is cached
* `.request(id, options, callback)` — fetch and cache a fresh OCSP response
* `.store(id, response, maxTime, callback)` — store a response manually
* `.clear()` — clear all cached responses and cancel all pending timers

## Server

Usage:

```js
const server = ocsp.Server.create({
  caCert: cacert, // optional, defaults to `cert` if not supplied
  cert: cert,
  key: key
})

server.addCert(43, 'good')
server.addCert(44, 'revoked', {
  revocationTime: new Date(),
  revocationReason: 'CACompromise'
})

server.listen(8000)
```

OCSP Server, i.e. an HTTP server providing OCSP responses for supplied OCSP
requests.

Has the following methods:

* `.addCert(serialNumber, status, info)`, where:
  * `serialNumber` can be either a plain number or an instance of `bn.js`
  * `status` is one of `good`, `revoked`
  * `info` should be empty for `good` and should contain an object for `revoked`
    (see example above; `revocationReason` is one of: `unspecified`,
     `keyCompromise`, `CACompromise`, `affiliationChanged`, `superseded`,
     `cessationOfOperation`, `certificateHold`, `removeFromCRL`,
     `privelegeWithdrawn`, `AACompromise`)
* All of `http.Server` methods!

Constructor options:

* `cert`: the server's certificate (PEM or Buffer)
* `key`: the server's private key (PEM or Buffer)
* `caCert`: the issuing CA certificate (PEM or Buffer); defaults to `cert`
* `nextUpdate`: ms until the `nextUpdate` field in responses (Default: `86400000` — 24 hours)

## .check()

Usage:

```js
ocsp.check({
  cert: cert,
  issuer: issuerCert
}, (err, res) => {
  if (err) throw err
  console.log(res)
})
```

Send an OCSP request to the CA and ask if the cert is still valid. `res`
contains the info.

Options:

* `cert`: the certificate to check (PEM, DER Buffer, or parsed)
* `issuer`: the issuing CA certificate (PEM, DER Buffer, or parsed)
* `requestByGet`: if `true`, the OCSP request is sent via HTTP GET instead of
  POST (Default: `false`)

## .verify()

Usage:

```js
ocsp.verify({
  request: request,
  // Optional, `issuer: issuerCert,`
  response: response
}, (err, res) => {
})
```

Verify that `response` matches the `request` and is signed by the CA.

Options:

* `request`: an OCSP request object (from `request.generate()`)
* `response`: raw OCSP response Buffer
* `issuer`: issuing CA certificate, if not already present on `request.issuer`
* `nudge`: clock skew tolerance in ms for `thisUpdate`/`nextUpdate` checks (Default: `60000`)

## request.generate()

Usage:

```javascript
const req = ocsp.request.generate(cert, issuerCert)
```

Generate an OCSP request for `.verify()` or for sending manually to an OCSP server.

## getOCSPURI()

Usage:

```javascript
ocsp.getOCSPURI(cert, (err, uri) => {
})
```

Get the URI of the OCSP server from a certificate.

## Attribution

Originally authored by [Fedor Indutny][indutny] as [indutny/ocsp][fork].
Continued by [TechTeamer][techteamer], [Ranieri Mazili][ranieri], and
[Matt Simerson][matt], incorporating fixes from across the GitHub fork network.

#### LICENSE

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2015.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.

[0]: http://en.wikipedia.org/wiki/Online_Certificate_Status_Protocol
[1]: http://en.wikipedia.org/wiki/OCSP_stapling
[fork]: https://github.com/indutny/ocsp
[indutny]: https://github.com/indutny
[techteamer]: https://github.com/TechTeamer
[ranieri]: https://github.com/ranierimazili
[matt]: https://github.com/msimerson
