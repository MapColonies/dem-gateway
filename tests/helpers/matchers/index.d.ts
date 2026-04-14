import 'vitest';

declare module 'vitest' {
  interface Matchers<T = any> extends CustomMatchers<T> {
    toSatisfyApiSpec: () => T;
  }
}
