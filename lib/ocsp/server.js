const ocsp = require('../ocsp')

const http = require('node:http')
const httpServer = http.Server
const crypto = require('node:crypto')

const rfc2560 = require('asn1.js-rfc2560')
const rfc5280 = require('asn1.js-rfc5280')

async function handler (req, res) {
  if (req.method !== 'POST') {
    return res.writeHead(400)
  }

  if (req.headers['content-type'] !== 'application/ocsp-request') {
    return res.writeHead(400)
  }

  function errRes (status) {
    return rfc2560.OCSPResponse.encode({
      responseStatus: status
    }, 'der')
  }

  function done (out) {
    res.writeHead(200, {
      'Content-Type': 'application/ocsp-response',
      'Content-Length': out.length
    })
    res.end(out)
  }

  const body = await new Promise((resolve, reject) => {
    const chunks = []
    req.on('readable', () => {
      const chunk = req.read()
      if (chunk) chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

  let ocspReq
  try {
    ocspReq = rfc2560.OCSPRequest.decode(body, 'der')
  } catch {
    return done(errRes('malformed_request'))
  }

  try {
    done(await this.getResponses(ocspReq))
  } catch {
    res.writeHead(404)
    res.end()
  }
}

class Server extends httpServer {
  constructor (options) {
    super(handler)

    this.options = Object.assign({ nextUpdate: 24 * 3600 * 1e3 }, options)

    if (!options.caCert) {
      options.caCert = options.cert
    }
    this.key = this.options.key
    this.caCertroot = rfc5280.Certificate.decode(
      ocsp.utils.toDER(options.caCert, 'CERTIFICATE'),
      'der')
    this.caCert = this.caCertroot.tbsCertificate
    this.certroot = rfc5280.Certificate.decode(
      ocsp.utils.toDER(options.cert, 'CERTIFICATE'),
      'der')
    this.cert = this.certroot.tbsCertificate

    const issuerName = rfc5280.Name.encode(this.caCert.subject, 'der')
    const issuerKey = this.caCert.subjectPublicKeyInfo.subjectPublicKey.data

    const subjectKey = this.cert.subjectPublicKeyInfo.subjectPublicKey.data

    this.certID = {}
    for (const digest of Object.keys(ocsp.utils.digestRev)) {
      this.certID[digest] = {
        issuerNameHash: crypto.createHash(digest).update(issuerName).digest(),
        issuerKeyHash: crypto.createHash(digest).update(issuerKey).digest(),
        subjectKeyHash: crypto.createHash(digest).update(subjectKey).digest()
      }
    }

    this.certs = {}
  }

  static create (options) {
    return new Server(options)
  }

  addCert (serial, status, info) {
    this.certs[serial.toString(16)] = {
      type: status,
      value: info
    }
  }

  async getResponses (req) {
    const reqList = req.tbsRequest.requestList
    const responses = await Promise.all(reqList.map(r => this.getResponse(r)))

    // TODO(indutny): send extensions
    const basic = {
      tbsResponseData: {
        version: 'v1',
        responderID: {
          type: 'byKey',
          value: this.certID.sha1.subjectKeyHash
        },
        producedAt: new Date(),
        responses
      },

      signatureAlgorithm: {
        algorithm: ocsp.utils.signRev.sha512WithRSAEncryption
      },
      signature: null,

      certs: [
        this.certroot
      ]
    }

    const sign = crypto.createSign('sha512WithRSAEncryption')
    sign.update(rfc2560.ResponseData.encode(basic.tbsResponseData, 'der'))
    basic.signature = {
      unused: 0,
      data: sign.sign(this.key)
    }

    const res = {
      responseStatus: 'successful',
      responseBytes: {
        responseType: 'id-pkix-ocsp-basic',
        response: rfc2560.BasicOCSPResponse.encode(basic, 'der')
      }
    }

    return rfc2560.OCSPResponse.encode(res, 'der')
  }

  getResponse (req) {
    const certID = req.reqCert

    const digestId = certID.hashAlgorithm.algorithm.join('.')
    const digest = ocsp.utils.digest[digestId]
    if (!digest) throw new Error('Unknown digest: ' + digestId)

    const expectedID = this.certID[digest]
    if (!expectedID) throw new Error('No pre-generated CertID for digest: ' + digest)

    if (expectedID.issuerNameHash.toString('hex') !==
      certID.issuerNameHash.toString('hex')) {
      throw new Error('Issuer name mismatch')
    }

    if (expectedID.issuerKeyHash.toString('hex') !==
      certID.issuerKeyHash.toString('hex')) {
      throw new Error('Issuer key mismatch')
    }

    const serial = certID.serialNumber.toString(16)
    const cert = this.certs[serial]

    return {
      certId: certID,
      certStatus: cert ?? { type: 'unknown', value: null },
      thisUpdate: new Date(),
      nextUpdate: new Date(+new Date() + this.options.nextUpdate)
    }
  }
}

module.exports = Server
