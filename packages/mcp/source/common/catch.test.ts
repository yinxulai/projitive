import { describe, it, expect } from 'vitest'
import { catchIt } from './catch.js'

type CatchResultLike = {
  value?: unknown
  error?: unknown
  isError: () => boolean
}

describe('catchIt', () => {
  it('sync function should return value, error undefined, isError false', async () => {
    const result = await catchIt(() => 123) as CatchResultLike
    expect(result.value).toBe(123)
    expect(result.error).toBeUndefined()
    expect(result.isError()).toBe(false)
  })

  it('async function should return value, error undefined, isError false', async () => {
    const result = await catchIt(async () => 456) as CatchResultLike
    expect(result.value).toBe(456)
    expect(result.error).toBeUndefined()
    expect(result.isError()).toBe(false)
  })

  it('sync throw should return error, value undefined, isError true', async () => {
    const error = new Error('fail')
    const result = await catchIt(() => { throw error }) as CatchResultLike
    expect(result.value).toBeUndefined()
    expect(result.error).toBe(error)
    expect(result.isError()).toBe(true)
  })

  it('async throw should return error, value undefined, isError true', async () => {
    const error = new Error('fail-async')
    const result = await catchIt(() => Promise.reject(error)) as CatchResultLike
    expect(result.value).toBeUndefined()
    expect(result.error).toBe(error)
    expect(result.isError()).toBe(true)
  })

  it('PromiseLike resolve should return value, error undefined, isError false', async () => {
    const result = await catchIt(Promise.resolve('ok')) as CatchResultLike
    expect(result.value).toBe('ok')
    expect(result.error).toBeUndefined()
    expect(result.isError()).toBe(false)
  })

  it('PromiseLike reject should return error, value undefined, isError true', async () => {
    const error = new Error('promise-fail')
    const result = await catchIt(Promise.reject(error)) as CatchResultLike
    expect(result.value).toBeUndefined()
    expect(result.error).toBe(error)
    expect(result.isError()).toBe(true)
  })
})
