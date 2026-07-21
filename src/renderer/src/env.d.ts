/// <reference types="vite/client" />

declare module '*.svg' {
  import type { DefineComponent } from 'react'
  const component: DefineComponent
  export default component
}
