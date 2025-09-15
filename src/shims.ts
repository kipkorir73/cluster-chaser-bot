// Project-wide TypeScript shims to fix external type resolution issues
// 1) Vite re-exports types from 'rollup/parseAst' which may not resolve under certain moduleResolution settings.
//    Provide a minimal ambient module so TS can typecheck without error.
declare module 'rollup/parseAst' {
  // Minimal surface to satisfy Vite's type re-export without relying on Rollup's internal path
  export type AcornNode = any;
  export const parseAst: any;
  const _default: any;
  export default _default;
}

// 2) Static asset modules
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.jpeg' {
  const src: string;
  export default src;
}
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
