import { greet } from './greeter';

// Example usage
console.log('=== Projitive Simple Demo ===\n');

// English greeting
const englishResult = greet({ name: 'Alice' });
console.log('English:');
console.log(`  Success: ${englishResult.success}`);
console.log(`  Message: ${englishResult.message}`);
console.log(`  Time: ${englishResult.timestamp.toISOString()}\n`);

// Chinese greeting
const chineseResult = greet({ name: 'Bob', language: 'zh' });
console.log('Chinese:');
console.log(`  Success: ${chineseResult.success}`);
console.log(`  Message: ${chineseResult.message}\n`);

// Spanish greeting
const spanishResult = greet({ name: 'Charlie', language: 'es' });
console.log('Spanish:');
console.log(`  Success: ${spanishResult.success}`);
console.log(`  Message: ${spanishResult.message}\n`);

// Error case: empty name
const emptyNameResult = greet({ name: '' });
console.log('Error - Empty Name:');
console.log(`  Success: ${emptyNameResult.success}`);
console.log(`  Message: ${emptyNameResult.message}\n`);

// Error case: invalid language
const invalidLangResult = greet({ name: 'Dave', language: 'fr' as any });
console.log('Error - Invalid Language:');
console.log(`  Success: ${invalidLangResult.success}`);
console.log(`  Message: ${invalidLangResult.message}\n`);

console.log('=== Demo Complete ===');
