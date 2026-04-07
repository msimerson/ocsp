const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')

const ocsp = require('../')
const fixtures = require('./fixtures')

const OCSP_PORT = 8002

function getOCSPCert (options) {
  return new Promise((resolve) => {
    fixtures.getOCSPCert(options, (cert, key) => resolve({ cert, key }))
  })
}

describe('OCSP Server', function () {
  let issuer, good, revoked, server

  before(async () => {
    const opts = { size: 1024, OCSPEndPoint: `http://127.0.0.1:${OCSP_PORT}/ocsp` }
    issuer = await getOCSPCert({ ...opts, serial: 42, commonName: 'mega.ca' })
    good = await getOCSPCert({ ...opts, serial: 43, issuer: issuer.cert, issuerKey: issuer.key })
    revoked = await getOCSPCert({ ...opts, serial: 44, issuer: issuer.cert, issuerKey: issuer.key })
  })

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
