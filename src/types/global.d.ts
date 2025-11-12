// (Place once in your project, e.g. src/types/global.d.ts)
declare global {
  interface Window {
    __PSHORT__?: string;
  }
  interface ImportMetaEnv {
    readonly VITE_PSHORT?: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
export {};
