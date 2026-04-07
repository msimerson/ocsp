'use strict'

const https = require('node:https')
const fs = require('node:fs')
const path = require('node:path')

require('./gen-certs').checkAndGenerate()

const googleOptions = {
  hostname: 'google.com',
  port: 443,
  path: '/',
  method: 'GET',
  headers: {
    'User-Agent': 'Node.js/https'
  }
}

exports.googleReady = new Promise((resolve, reject) => {
  const req = https.request(googleOptions, res => {
    res.on('data', () => {})
  }).on('error', reject)

  req.on('socket', socket => {
    socket.on('secureConnect', () => {
      const googleCerts = socket.getPeerCertificate(true)
      exports.google = '-----BEGIN CERTIFICATE-----\n' + googleCerts.raw.toString('base64') + '\n-----END CERTIFICATE-----'
      exports.googleIssuer = '-----BEGIN CERTIFICATE-----\n' + googleCerts.issuerCertificate.raw.toString('base64') + '\n-----END CERTIFICATE-----'
      resolve()
    })
  })

  req.end()
})

exports.noExts = fs.readFileSync(path.join(__dirname, 'no-exts-cert.pem'))

exports.certs = {}

for (const name of ['issuer', 'good', 'revoked']) {
  exports.certs[name] = {
    cert: fs.readFileSync(path.join(__dirname, name + '-cert.pem')),
    key: fs.readFileSync(path.join(__dirname, name + '-key.pem'))
  }
}

exports.serverCerts = {}

for (const name of ['issuer', 'good', 'revoked']) {
  exports.serverCerts[name] = {
    cert: fs.readFileSync(path.join(__dirname, 'server', name + '-cert.pem')),
    key: fs.readFileSync(path.join(__dirname, 'server', name + '-key.pem'))
  }
}
