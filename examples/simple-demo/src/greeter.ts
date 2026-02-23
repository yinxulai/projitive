export interface GreetingOptions {
  name: string;
  language?: 'en' | 'zh' | 'es';
}

export interface GreetingResult {
  success: boolean;
  message: string;
  timestamp: Date;
}

const greetings = {
  en: (name: string) => `Hello, ${name}!`,
  zh: (name: string) => `你好, ${name}!`,
  es: (name: string) => `¡Hola, ${name}!`,
};

/**
 * Generate a personalized greeting.
 * 
 * @param options - Greeting options including name and optional language
 * @returns Greeting result with success status, message, and timestamp
 * 
 * @example
 * ```typescript
 * const result = greet({ name: 'Alice' });
 * console.log(result.message); // "Hello, Alice!"
 * 
 * const result2 = greet({ name: 'Bob', language: 'zh' });
 * console.log(result2.message); // "你好, Bob!"
 * ```
 */
export function greet(options: GreetingOptions): GreetingResult {
  const timestamp = new Date();

  // Validate required name field
  if (!options.name || options.name.trim() === '') {
    return {
      success: false,
      message: 'Name is required and cannot be empty',
      timestamp,
    };
  }

  const name = options.name.trim();
  const language = options.language || 'en';

  // Validate language
  if (!greetings[language as keyof typeof greetings]) {
    return {
      success: false,
      message: `Unsupported language: ${language}. Supported languages: en, zh, es`,
      timestamp,
    };
  }

  // Generate greeting
  const greetingFn = greetings[language as keyof typeof greetings];
  const message = greetingFn(name);

  return {
    success: true,
    message,
    timestamp,
  };
}
