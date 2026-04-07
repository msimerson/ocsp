const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')

const ocsp = require('../')
const fixtures = require('./fixtures')

const OCSP_PORT = 8002

describe('OCSP Server', function () {
  let server

  const issuer = fixtures.serverCerts.issuer
  const good = fixtures.serverCerts.good
  const revoked = fixtures.serverCerts.revoked

  after((t, done) => {
    server.close(done)
  })

  it('should provide ocsp response to the client', (t, done) => {
    server = ocsp.Server.create({
      cert: issuer.cert,
      key: issuer.key
    })

    server.addCert(43, 'good')
    server.addCert(44, 'revoked', {
      revocationTime: new Date(),
      revocationReason: 'cACompromise'
    })

    server.listen(OCSP_PORT, function () {
      ocsp.check({
        cert: good.cert,
        issuer: issuer.cert
      }, function (err, res) {
        if (err) return done(err)
        assert.strictEqual(res.certStatus.type, 'good')
        next()
      })
    })

    function next () {
      ocsp.check({
        cert: revoked.cert,
        issuer: issuer.cert
      }, function (err, res) {
        assert.ok(err)
        assert.strictEqual(res.certStatus.type, 'revoked')
        done()
      })
    }
  })
})
