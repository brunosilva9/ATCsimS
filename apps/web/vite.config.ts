import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const resolve = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // GitHub Pages sirve el sitio bajo /ATCsimS/ y no en la raiz del dominio, asi que las rutas
  // absolutas a los assets no valen. Se usan relativas al documento, que funcionan igual en los
  // dos sitios: asi no hay una variable de entorno que alguien pueda olvidar y descubrir rota
  // solo despues de publicar. El rutado va todo en el hash, que no depende del base.
  base: './',
  plugins: [react()],
  resolve: {
    // Los workspaces exportan TypeScript sin compilar. El alias evita que Vite los
    // trate como dependencias ya construidas y los deja pasar por esbuild.
    alias: {
      '@atcsims/core': resolve('../../packages/core/src/index.ts'),
      '@atcsims/navdata': resolve('../../packages/navdata/src/index.ts'),
    },
  },
  server: { fs: { allow: [resolve('../..')] } },
});
