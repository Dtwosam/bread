// Runtime resolution bridge for browser bundlers that require the physical
// `.js` target used by the NodeNext-authored SDK source. The ABI data remains
// single-source in generated.ts; do not add ABI content here.
export { breadAbiRegistry } from './generated.ts';
