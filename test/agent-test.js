const { describe, it, beforeEach } = require('node:test')
const https = require('node:https')

const ocsp = require('../')

describe('OCSP Agent', function () {
  let a
  beforeEach(function () {
    a = new ocsp.Agent()
  })

  const websites = [
    'www.google.com',
    'google.com',
    'helloworld.letsencrypt.org',
    'yahoo.com',
    'nytimes.com',
    'microsoft.com'
  ]

  for (const host of websites) {
    it('should connect and validate ' + host, (t, done) => {
      https.get({
        host,
        port: 443,
        agent: a
      }, function (res) {
        res.resume()
        done()
      })
    })
  }
})

describe('OCSP Agent failed', function () {
  let a
  beforeEach(function () {
    a = new ocsp.Agent()
  })

  const websites = [
    'p.vj-vid.com',
    'vast.bp3861034.btrll.com',
    'self-signed.badssl.com',
    'untrusted-root.badssl.com'
  ]

  for (const host of websites) {
    it('should connect and emit error ' + host, { timeout: 4000 }, (t, done) => {
      https.get({
        host,
        port: 443,
        agent: a
      }).on('error', () => {
        done()
      })
    })
  }
})
