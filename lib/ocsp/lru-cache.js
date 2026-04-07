'use strict'

class LRUCache {
  #max
  #cache = new Map()

  constructor (maxSize) {
    this.#max = maxSize
  }

  get (key) {
    if (!this.#cache.has(key)) return undefined
    const value = this.#cache.get(key)
    this.#cache.delete(key)
    this.#cache.set(key, value)
    return value
  }

  set (key, value) {
    if (this.#cache.has(key)) this.#cache.delete(key)
    else if (this.#cache.size >= this.#max) this.#cache.delete(this.#cache.keys().next().value)
    this.#cache.set(key, value)
  }
}

module.exports = LRUCache
