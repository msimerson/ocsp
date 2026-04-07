#!/usr/bin/env node

'use strict'

const { execFileSync } = require('node:child_process')
const { X509Certificate } = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FIXTURES_DIR = __dirname
const SERVER_FIXTURES_DIR = path.join(FIXTURES_DIR, 'server')

const CERT_LIFETIME_DAYS = 730
const REGEN_THRESHOLD_DAYS = 180

function certNeedsRegen (certPath) {
  if (!fs.existsSync(certPath)) return true
  try {
    const cert = new X509Certificate(fs.readFileSync(certPath))
    const daysRemaining = (new Date(cert.validTo) - Date.now()) / 86_400_000
    return daysRemaining < REGEN_THRESHOLD_DAYS
  } catch {
    return true
  }
}

function generateFixtureSet (outDir, ocspUrl) {
  fs.mkdirSync(outDir, { recursive: true })
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocsp-fixtures-'))
  try {
    // CA config: self-signed issuer cert with OCSP AIA extension
    const caConfig = path.join(tmpDir, 'ca.cnf')
    fs.writeFileSync(caConfig, [
      '[req]',
      'distinguished_name = req_dn',
      'x509_extensions = ca_ext',
      'prompt = no',
      '',
      '[req_dn]',
      'CN = mega.ca',
      '',
      '[ca_ext]',
      'basicConstraints = CA:TRUE',
      `authorityInfoAccess = OCSP;URI:${ocspUrl}`
    ].join('\n'))

    // Leaf extension file: OCSP AIA only
    const leafExt = path.join(tmpDir, 'leaf.ext')
    fs.writeFileSync(leafExt, `authorityInfoAccess = OCSP;URI:${ocspUrl}\n`)

    const issuerKey = path.join(outDir, 'issuer-key.pem')
    const issuerCert = path.join(outDir, 'issuer-cert.pem')

    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048',
      '-keyout', issuerKey, '-out', issuerCert,
      '-days', String(CERT_LIFETIME_DAYS), '-nodes',
      '-set_serial', '42', '-config', caConfig
    ], { stdio: 'pipe' })

    for (const [name, serial] of [['good', 43], ['revoked', 44]]) {
      const key = path.join(outDir, `${name}-key.pem`)
      const cert = path.join(outDir, `${name}-cert.pem`)
      const csr = path.join(tmpDir, `${name}.csr`)

      execFileSync('openssl', [
        'req', '-newkey', 'rsa:2048', '-keyout', key,
        '-out', csr, '-nodes', '-subj', '/CN=local.host'
      ], { stdio: 'pipe' })

      execFileSync('openssl', [
        'x509', '-req', '-in', csr,
        '-CA', issuerCert, '-CAkey', issuerKey,
        '-out', cert, '-days', String(CERT_LIFETIME_DAYS),
        '-set_serial', String(serial), '-extfile', leafExt
      ], { stdio: 'pipe' })
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function checkAndGenerate () {
  if (certNeedsRegen(path.join(FIXTURES_DIR, 'issuer-cert.pem'))) {
    generateFixtureSet(FIXTURES_DIR, 'http://127.0.0.1:8000/ocsp')
  }
  if (certNeedsRegen(path.join(SERVER_FIXTURES_DIR, 'issuer-cert.pem'))) {
    generateFixtureSet(SERVER_FIXTURES_DIR, 'http://127.0.0.1:8002/ocsp')
  }
}

if (require.main === module) {
  generateFixtureSet(FIXTURES_DIR, 'http://127.0.0.1:8000/ocsp')
  generateFixtureSet(SERVER_FIXTURES_DIR, 'http://127.0.0.1:8002/ocsp')
}

module.exports = { checkAndGenerate }
