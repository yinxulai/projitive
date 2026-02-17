// 辅助函数：检查是否为 PromiseLike
function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return value != null && typeof value === 'object' && 'then' in value && typeof value.then === 'function'
}

// 用于类型推断函数返回值类型
type CatchType<F extends () => unknown> = F extends () => PromiseLike<infer R> ? R : F extends () => infer R ? R : never

/**
 * 成功结果类型
 * 只包含 value 字段，error 字段为 undefined
 */
export interface CatchSuccess<T> {
  value: T
}

/**
 * 失败结果类型
 * error 字段类型永远为 unknown（或用户自定义），这样最安全，防止误用。
 * 推荐在 error 分支内用 instanceof/typeof 等类型守卫自行收窄类型。
 */
export interface CatchFailure<E> {
  error: E
}

/**
 * 捕获结果联合类型，使用判别联合类型以支持类型守卫
 *
 * 设计说明：
 * - 通过 isError 方法进行类型守卫，推荐始终用 result.isError() 判断是否为错误分支。
 * - isError 方法为 function 写法（而非箭头函数），以支持类型谓词，且 this 不会被转移。
 * - 不建议直接用 error !== undefined 判断错误分支，该方式依赖 error 的值，推荐统一用 isError()。
 */
export type CatchResult<T, E = unknown> = (CatchSuccess<T> | CatchFailure<E>) & {
  /**
   * 类型守卫方法，判断当前对象是否为 CatchFailure。
   * function 写法，返回类型谓词，保证类型收窄。
   * 推荐用法：if (result.isError()) { ... }
   */
  isError: (this: unknown) => this is CatchFailure<E>
}

/**
 * 构造成功结果对象
 * isError 始终返回 false
 */
function createSuccess<T>(value: T): CatchResult<T, unknown> {
  return {
    value,
    error: undefined,
    isError(this: unknown): this is CatchFailure<unknown> { return false }
  } as CatchResult<T, unknown>
}

/**
 * 构造失败结果对象
 * isError 始终返回 true
 */
function createFailure<E>(error: E): CatchResult<unknown, E> {
  return {
    error,
    value: undefined,
    isError(this: unknown): this is CatchFailure<E> { return true }
  } as CatchResult<unknown, E>
}

/**
 * 通用错误捕获函数，支持 PromiseLike 和函数执行
 * 返回 { value, error } 的对象格式，便于类型判断
 *
 * 设计说明：
 * - 支持同步/异步/thenable 场景
 * - 推荐通过 isError() 进行类型守卫
 * - error 字段类型为 unknown，需用户自行收窄
 */
export async function catchIt<T, E = unknown>(input: PromiseLike<T>): Promise<CatchResult<T, E>>
export async function catchIt<F extends () => unknown, E = unknown>(input: F): Promise<CatchResult<CatchType<F>, E>>
export async function catchIt<T, F extends () => unknown, E = unknown>(
  input: PromiseLike<T> | F
): Promise<CatchResult<T | CatchType<F>, E>> {
  try {
    if (isPromiseLike(input)) {
      const result = await Promise.resolve(input)
      return createSuccess(result) as CatchResult<T, E>
    } else if (typeof input === 'function') {
      const result = input()
      if (isPromiseLike(result)) {
        return catchIt(result) as Promise<CatchResult<T | CatchType<F>, E>>
      } else {
        return createSuccess(result) as CatchResult<CatchType<F>, E>
      }
    }
  } catch (error) {
    return createFailure(error as E) as CatchResult<T | CatchType<F>, E>
  }
  // 理论上不会到达这里，兜底类型安全
  return createFailure(new Error('Unexpected input type') as E) as CatchResult<T | CatchType<F>, E>
}
