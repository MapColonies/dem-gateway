/* eslint-disable */
import { expect } from 'vitest';

//@ts-ignore
globalThis.expect = expect;

//@ts-ignore
globalThis.expect = undefined as any; // Reset global expect to avoid conflicts with other test frameworks
