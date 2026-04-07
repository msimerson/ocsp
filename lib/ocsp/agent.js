'use strict'

const ocsp = require('../ocsp')

const http = require('node:http')
const https = require('node:https')
const rfc5280 = require('asn1.js-rfc5280')
const SimpleCache = require('simple-lru-cache')

class Agent extends https.Agent {
  constructor (options) {
    options = Object.assign({ CACacheSize: 1024 }, options)
    super(options)

    this.caCache = new SimpleCache({ maxSize: options.CACacheSize })
  }

  createConnection (options, connectListener) {
    options.requestOCSP = true
    const socket = super.createConnection(options, connectListener)

    let stapling = null
    socket.on('OCSPResponse', (data) => { stapling = data })

    socket.on('secure', () => {
      return this.handleOCSPResponse(socket, stapling, (err) => {
        if (err) return socket.destroy(err)
        // Time to allow all writes!
        socket.uncork()
      })
    })

    // Do not let any writes come through until we will verify OCSP
    socket.cork()

    return socket
  }

  handleOCSPResponse (socket, stapling, cb) {
    if (!socket.authorized) {
      return cb(new Error(socket.authorizationError))
    }

    let cert
    let issuer

    try {
      cert = (socket.ssl ?? socket).getPeerCertificate(true)
      issuer = cert?.issuerCertificate
      cert = cert?.raw
      cert = rfc5280.Certificate.decode(cert, 'der')

      if (issuer) {
        issuer = issuer.raw
        issuer = rfc5280.Certificate.decode(issuer, 'der')
      }
    } catch (e) {
      return cb(e)
    }

    const onIssuer = (err, x509) => {
      if (err) return cb(err)

      issuer = x509

      if (stapling) {
        const req = ocsp.request.generate(cert, issuer)
        ocsp.verify({ request: req, response: stapling }, cb)
      } else {
        return ocsp.check({ cert, issuer }, (err, result) => {
          // If the certificate has no OCSP URL, skip OCSP validation and allow the connection
          if (err?.message?.includes('not found in AuthorityInfoAccess')) return cb(null)
          return cb(err, result)
        })
      }
    }

    if (issuer) {
      return onIssuer(null, issuer)
    } else {
      return this.fetchIssuer(cert, stapling, onIssuer)
    }
  }

  fetchIssuer (cert, stapling, cb) {
    const issuers = ocsp.utils['id-ad-caIssuers'].join('.')

    // TODO(indutny): use info from stapling response
    ocsp.utils.getAuthorityInfo(cert, issuers, (err, uri) => {
      if (err) return cb(err)

      const ca = this.caCache.get(uri)
      if (ca) return cb(null, ca)

      const { promise, resolve, reject } = Promise.withResolvers()
      promise.then(x509 => cb(null, x509)).catch(e => cb(e))

      const onResponse = (res) => {
        if (res.statusCode < 200 || res.statusCode >= 400) {
          return reject(new Error(`Failed to fetch CA: ${res.statusCode}`))
        }

        const chunks = []
        res.on('readable', () => {
          const chunk = res.read()
          if (!chunk) return
          chunks.push(chunk)
        })

        res.on('end', () => {
          let fetched = Buffer.concat(chunks)

          try {
            fetched = rfc5280.Certificate.decode(fetched, 'der')
          } catch (e) {
            return reject(e)
          }

          this.caCache.set(uri, fetched)
          resolve(fetched)
        })
      }

      try {
        http.get(uri)
          .on('error', reject)
          .on('response', onResponse)
      } catch (e) {
        reject(e)
      }
    })
  }
}

module.exports = Agent
