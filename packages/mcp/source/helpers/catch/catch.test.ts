import { describe, it, expect } from 'vitest'
import { catchIt } from '../../common/catch.js'

describe('catchIt', () => {
  it('同步函数返回值应为 value，error 为 undefined，isError 为 false', async () => {
    const result = await catchIt(() => 123)
    expect((result as any).value).toBe(123)
    expect((result as any).error).toBeUndefined()
    expect((result as any).isError()).toBe(false)
  })

  it('异步函数返回值应为 value，error 为 undefined，isError 为 false', async () => {
    const result = await catchIt(async () => 456)
    expect((result as any).value).toBe(456)
    expect((result as any).error).toBeUndefined()
    expect((result as any).isError()).toBe(false)
  })

  it('同步抛出异常时应返回 error，value 为 undefined，isError 为 true', async () => {
    const error = new Error('fail')
    const result = await catchIt(() => { throw error })
    expect((result as any).value).toBeUndefined()
    expect((result as any).error).toBe(error)
    expect((result as any).isError()).toBe(true)
  })

  it('异步抛出异常时应返回 error，value 为 undefined，isError 为 true', async () => {
    const error = new Error('fail-async')
    const result = await catchIt(() => Promise.reject(error))
    expect((result as any).value).toBeUndefined()
    expect((result as any).error).toBe(error)
    expect((result as any).isError()).toBe(true)
  })

  it('PromiseLike resolve 时应返回 value，error 为 undefined，isError 为 false', async () => {
    const result = await catchIt(Promise.resolve('ok'))
    expect((result as any).value).toBe('ok')
    expect((result as any).error).toBeUndefined()
    expect((result as any).isError()).toBe(false)
  })

  it('PromiseLike reject 时应返回 error，value 为 undefined，isError 为 true', async () => {
    const error = new Error('promise-fail')
    const result = await catchIt(Promise.reject(error))
    expect((result as any).value).toBeUndefined()
    expect((result as any).error).toBe(error)
    expect((result as any).isError()).toBe(true)
  })
})
