/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "development" on the dev console, "production" on the real one. */
  readonly VITE_MILO_ENV?: string;
}
