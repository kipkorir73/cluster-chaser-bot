/* Minimal Vite client env types to enable import.meta.env usage */

declare module 'rollup/parseAst' {
  export interface AcornNode {
    type: string;
    start: number;
    end: number;
    [key: string]: any;
  }
}

interface ImportMetaEnv {
  readonly VITE_DERIV_API_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Static asset modules (for ESLint/TS awareness in imports)
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

