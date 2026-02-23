import { describe, it, expect } from 'vitest'
import { catchIt } from './catch.js'

describe('catchIt', () => {
  it('sync function should return value, error undefined, isError false', async () => {
    const result = await catchIt(() => 123)
    expect((result as any).value).toBe(123)
    expect((result as any).error).toBeUndefined()
    expect((result as any).isError()).toBe(false)
  })

  it('async function should return value, error undefined, isError false', async () => {
    const result = await catchIt(async () => 456)
    expect((result as any).value).toBe(456)
    expect((result as any).error).toBeUndefined()
    expect((result as any).isError()).toBe(false)
  })

  it('sync throw should return error, value undefined, isError true', async () => {
    const error = new Error('fail')
    const result = await catchIt(() => { throw error })
    expect((result as any).value).toBeUndefined()
    expect((result as any).error).toBe(error)
    expect((result as any).isError()).toBe(true)
  })

  it('async throw should return error, value undefined, isError true', async () => {
    const error = new Error('fail-async')
    const result = await catchIt(() => Promise.reject(error))
    expect((result as any).value).toBeUndefined()
    expect((result as any).error).toBe(error)
    expect((result as any).isError()).toBe(true)
  })

  it('PromiseLike resolve should return value, error undefined, isError false', async () => {
    const result = await catchIt(Promise.resolve('ok'))
    expect((result as any).value).toBe('ok')
    expect((result as any).error).toBeUndefined()
    expect((result as any).isError()).toBe(false)
  })

  it('PromiseLike reject should return error, value undefined, isError true', async () => {
    const error = new Error('promise-fail')
    const result = await catchIt(Promise.reject(error))
    expect((result as any).value).toBeUndefined()
    expect((result as any).error).toBe(error)
    expect((result as any).isError()).toBe(true)
  })
})
