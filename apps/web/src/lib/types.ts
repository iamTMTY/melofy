// Re-export the shared types from @melofy/core so existing `@/lib/types` imports
// keep working while the canonical definitions live in the shared package
// (consumed by web, extension, and eval).
export * from '@melofy/core';
