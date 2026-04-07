'use strict'

const ocsp = require('../ocsp')

const rfc2560 = require('asn1.js-rfc2560')

module.exports = function check (options, cb) {
  let req

  try {
    req = ocsp.request.generate(options.cert, options.issuer)
  } catch (e) {
    queueMicrotask(() => cb(e))
    return
  }

  const ocspMethod = rfc2560['id-pkix-ocsp'].join('.')
  ocsp.utils.getAuthorityInfo(req.cert, ocspMethod, (err, uri) => {
    if (err) return cb(err)

    ocsp.utils.getResponse(uri, req.data, (err, raw) => {
      if (err) return cb(err)

      try {
        ocsp.verify({ request: req, response: raw }, cb)
      } catch (e) {
        cb(e)
      }
    }, options.requestByGet)
  })
}
