// 安全的异步错误捕获工具

/**
 * 安全的异步错误捕获
 */
export async function catchIt<T>(
  promise: Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await promise
  } catch (error) {
    console.error(error)
    return fallback
  }
}
