/* Vite client types disabled to avoid TS parseAst resolution issue */

declare module 'rollup/parseAst' {
  export interface AcornNode {
    type: string;
    start: number;
    end: number;
    [key: string]: any;
  }
}

