/// <reference types="node" />

import * as http from 'node:http'
import * as https from 'node:https'

/**
 * An opaque parsed X.509 certificate decoded by asn1.js-rfc5280.
 * Returned by `request.generate()` on the `cert` and `issuer` fields.
 */
export interface ParsedCertificate {
  tbsCertificate: unknown
  [key: string]: unknown
}

/**
 * Accepts a PEM string, a DER-encoded Buffer, or an already-parsed
 * certificate object (e.g. from a prior `request.generate()` call).
 */
export type CertInput = string | Buffer | ParsedCertificate

export type RevocationReason =
  | 'unspecified'
  | 'keyCompromise'
  | 'CACompromise'
  | 'affiliationChanged'
  | 'superseded'
  | 'cessationOfOperation'
  | 'certificateHold'
  | 'removeFromCRL'
  | 'privelegeWithdrawn'
  | 'AACompromise'

/** The object returned by `request.generate()`. */
export interface OcspRequest {
  /** SHA-1 hash of the DER-encoded CertID; suitable for use as a cache key. */
  id: Buffer
  /** ASN.1-decoded CertID structure. */
  certID: unknown
  /** DER-encoded OCSPRequest bytes, ready to POST to an OCSP responder. */
  data: Buffer
  /** Parsed end-entity certificate. */
  cert: ParsedCertificate
  /** Parsed issuer certificate. */
  issuer: ParsedCertificate
}

/**
 * A single OCSP response entry as decoded from the ASN.1 BasicOCSPResponse.
 * This is what the `verify()` and `check()` callbacks receive on success.
 */
export interface OcspSingleResponse {
  certId: unknown
  certStatus: {
    type: 'good' | 'revoked' | 'unknown'
    value: unknown
  }
  thisUpdate: Date
  nextUpdate: Date
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export interface AgentOptions extends https.AgentOptions {
  /** Maximum number of issuer CA certificates to keep in the LRU cache. Default: `1024` */
  CACacheSize?: number
}

/**
 * An HTTPS Agent that validates server certificates via OCSP before allowing
 * any data to flow. Supports both OCSP stapling and live OCSP requests.
 * If a certificate does not advertise an OCSP URL the connection is allowed.
 */
export class Agent extends https.Agent {
  constructor(options?: AgentOptions)
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/** An entry stored in the in-memory cache. */
export interface CachedEntry {
  response: Buffer
  timer: NodeJS.Timeout
}

export interface CacheOptions {
  /**
   * Override the built-in `probe` method.
   * Receives `(id, callback)` and should call `callback(null, entry | false)`.
   */
  probe?: (
    id: string | Buffer,
    callback: (err: Error | null, cached: CachedEntry | false) => void
  ) => void

  /**
   * Override the built-in `store` method.
   * Receives `(id, response, maxTime, callback)`.
   */
  store?: (
    id: string | Buffer,
    response: Buffer,
    maxTime: number,
    callback: (err: Error | null) => void
  ) => void

  /**
   * Optional filter called before each outbound OCSP request.
   * Call `callback(null)` to allow, `callback(new Error(...))` to block.
   */
  filter?: (url: string, callback: (err: Error | null) => void) => void
}

export interface CacheRequestData {
  /** The URL of the OCSP responder. */
  url: string
  /** DER-encoded OCSP request bytes (from `request.generate().data`). */
  ocsp: Buffer
}

/**
 * In-memory OCSP response cache with pluggable probe/store/filter.
 * Intended for use in TLS servers that need to provide OCSP stapling.
 */
export class Cache {
  constructor(options?: CacheOptions)

  /** Look up a cached OCSP response by its request ID. */
  probe(
    id: string | Buffer,
    callback: (err: Error | null, cached: CachedEntry | false) => void
  ): void

  /** Store an OCSP response, expiring after `maxTime` milliseconds. */
  store(
    id: string | Buffer,
    response: Buffer,
    maxTime: number,
    callback: (err: Error | null) => void
  ): void

  /**
   * Fetch a fresh OCSP response from the responder, deliver it immediately,
   * then cache it for future probes.
   */
  request(
    id: string | Buffer,
    data: CacheRequestData,
    callback: (err: Error | null, response: Buffer) => void
  ): void

  /** Clear all cached entries and cancel all pending expiry timers. */
  clear(): void
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export interface ServerOptions {
  /** The server's own certificate (PEM or DER Buffer). */
  cert: string | Buffer
  /** The server's private key (PEM or DER Buffer). */
  key: string | Buffer
  /** The issuing CA certificate (PEM or DER Buffer). Defaults to `cert`. */
  caCert?: string | Buffer
  /** Milliseconds ahead to set the `nextUpdate` field in responses. Default: `86400000` (24 h) */
  nextUpdate?: number
}

export interface RevocationInfo {
  revocationTime?: Date
  revocationReason?: RevocationReason
}

/**
 * An HTTP server that answers OCSP requests for certificates it manages.
 * Extends `http.Server` so all standard server methods are available.
 */
export class Server extends http.Server {
  constructor(options: ServerOptions)

  /** Factory helper — equivalent to `new Server(options)`. */
  static create(options: ServerOptions): Server

  /** Register a certificate serial as `good`. */
  addCert(serialNumber: number | bigint, status: 'good'): void
  /** Register a certificate serial as `revoked` with optional reason/time. */
  addCert(
    serialNumber: number | bigint,
    status: 'revoked',
    info: RevocationInfo
  ): void
}

// ---------------------------------------------------------------------------
// check()
// ---------------------------------------------------------------------------

export interface CheckOptions {
  /** The end-entity certificate to validate. */
  cert: CertInput
  /** The issuing CA certificate. */
  issuer: CertInput
  /** Send the OCSP request via HTTP GET instead of POST. Default: `false` */
  requestByGet?: boolean
}

/**
 * Contact the CA's OCSP responder and verify that `cert` has not been revoked.
 */
export function check(
  options: CheckOptions,
  callback: (err: Error | null, response: OcspSingleResponse) => void
): void

// ---------------------------------------------------------------------------
// verify()
// ---------------------------------------------------------------------------

export interface VerifyOptions {
  /** OCSP request object produced by `request.generate()`. */
  request: OcspRequest
  /** Raw DER-encoded OCSP response bytes received from the responder. */
  response: Buffer
  /**
   * Issuing CA certificate if `request.issuer` is not already populated.
   */
  issuer?: CertInput
  /**
   * Allowed clock skew in milliseconds when checking `thisUpdate`/`nextUpdate`.
   * Default: `60000` (1 minute)
   */
  nudge?: number
}

/**
 * Verify that an OCSP response is correctly signed and covers the given request.
 */
export function verify(
  options: VerifyOptions,
  callback: (err: Error | null, response: OcspSingleResponse) => void
): void

// ---------------------------------------------------------------------------
// request
// ---------------------------------------------------------------------------

export const request: {
  /**
   * Build a DER-encoded OCSPRequest and return metadata needed by `verify()`.
   */
  generate(cert: CertInput, issuerCert: CertInput): OcspRequest
}

// ---------------------------------------------------------------------------
// getOCSPURI()
// ---------------------------------------------------------------------------

/**
 * Extract the OCSP responder URL from a certificate's Authority Information
 * Access extension.  `uri` is `null` if no OCSP URL is present.
 */
export function getOCSPURI(
  cert: CertInput,
  callback: (err: Error | null, uri: string | null) => void
): void
