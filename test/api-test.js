const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const tls = require('node:tls')
const net = require('node:net')

const ocsp = require('../')
const fixtures = require('./fixtures')

describe('OCSP Stapling Provider', function () {
  before(async () => {
    await fixtures.googleReady
  })

  describe('.check()', function () {
    it('should validate google.com', (t, done) => {
      ocsp.check({
        cert: fixtures.google,
        issuer: fixtures.googleIssuer
      }, function (err, res) {
        if (err) return done(err)
        assert.strictEqual(res.certStatus.type, 'good')
        done()
      })
    })
  })

  describe('.verify()', function () {
    it("should verify reddit.com's stapling", (t, done) => {
      try {
        const socket = new net.Socket()
        socket.setEncoding('utf8')

        socket.once('connect', () => {
          const client = tls.connect({
            host: 'reddit.com',
            port: 443,
            requestOCSP: true
          })

          client.on('OCSPResponse', function (stapling) {
            if (stapling) {
              const cert = client.getPeerCertificate(true)
              const req = ocsp.request.generate(cert.raw, cert.issuerCertificate.raw)
              ocsp.verify({ request: req, response: stapling }, function (err, res) {
                if (err) return done(err)
                assert.strictEqual(res.certStatus.type, 'good')
                client.destroy()
                socket.end(done)
              })
            } else {
              done(new Error('empty stapling'))
            }
          })
        })

        socket.connect(443, 'reddit.com')
      } catch (e) {
        done(e)
      }
    })
  })

  describe('.getOCSPURI()', function () {
    it('should work on cert without extensions', (t, done) => {
      ocsp.getOCSPURI(fixtures.noExts, function (err) {
        assert.ok(err)
        done()
      })
    })
  })
})
