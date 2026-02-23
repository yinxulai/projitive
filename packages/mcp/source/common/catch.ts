// Helper function: check if value is PromiseLike
function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return value != null && typeof value === 'object' && 'then' in value && typeof value.then === 'function'
}

// For type inference of function return types
type CatchType<F extends () => unknown> = F extends () => PromiseLike<infer R> ? R : F extends () => infer R ? R : never

/**
 * Success result type
 * Only contains value field, error field is undefined
 */
export interface CatchSuccess<T> {
  value: T
}

/**
 * Failure result type
 * error field type is always unknown (or user-defined), which is safest to prevent misuse.
 * Recommended to use instanceof/typeof type guards in the error branch to narrow types.
 */
export interface CatchFailure<E> {
  error: E
}

/**
 * Catch result union type, using discriminated union to support type guards
 *
 * Design notes:
 * - Use isError method for type guarding, recommend always using result.isError() to check for error branch.
 * - isError method is written as a function (not arrow function) to support type predicates, and this won't be bound.
 * - Not recommended to directly use error !== undefined to check error branch, as it depends on error value, recommend using isError() uniformly.
 */
export type CatchResult<T, E = unknown> = (CatchSuccess<T> | CatchFailure<E>) & {
  /**
   * Type guard method to check if current object is CatchFailure.
   * Written as a function, returns type predicate to ensure type narrowing.
   * Recommended usage: if (result.isError()) { ... }
   */
  isError: (this: unknown) => this is CatchFailure<E>
}

/**
 * Construct success result object
 * isError always returns false
 */
function createSuccess<T>(value: T): CatchResult<T, unknown> {
  return {
    value,
    error: undefined,
    isError(this: unknown): this is CatchFailure<unknown> { return false }
  } as CatchResult<T, unknown>
}

/**
 * Construct failure result object
 * isError always returns true
 */
function createFailure<E>(error: E): CatchResult<unknown, E> {
  return {
    error,
    value: undefined,
    isError(this: unknown): this is CatchFailure<E> { return true }
  } as CatchResult<unknown, E>
}

/**
 * Generic error catch function, supports PromiseLike and function execution
 * Returns { value, error } object format for easy type checking
 *
 * Design notes:
 * - Supports sync/async/thenable scenarios
 * - Recommended to use isError() for type guarding
 * - error field type is unknown, user needs to narrow it
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
  // Theoretically shouldn't reach here, fallback for type safety
  return createFailure(new Error('Unexpected input type') as E) as CatchResult<T | CatchType<F>, E>
}
