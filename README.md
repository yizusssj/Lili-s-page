# Lili — Mi espacio

Aplicación privada para organizar tareas, calendario, notas, recordatorios y álbumes de recuerdos. Está construida con React, Vite, Supabase y pnpm, y puede instalarse como PWA en iPhone y escritorio.

## Desarrollo local

```bash
pnpm install
pnpm dev
```

Crea un archivo `.env.local` con las variables públicas del proyecto de Supabase:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
```

## Comprobaciones

```bash
pnpm lint
pnpm test
pnpm build
```

## Base de datos

Las migraciones están ordenadas dentro de `supabase/migrations`. Deben ejecutarse en ese orden desde el SQL Editor de Supabase cuando se agregue una función nueva.

## Instalación en iPhone

1. Abre la URL de producción en Safari.
2. Pulsa **Compartir**.
3. Selecciona **Añadir a pantalla de inicio**.
4. Activa **Abrir como app web** y pulsa **Añadir**.

La PWA guarda únicamente la estructura pública de la aplicación —HTML, CSS, JavaScript e iconos— para acelerar la apertura. Los datos privados y las fotografías continúan consultándose directamente desde Supabase y no se almacenan en la caché del service worker.

Cuando se publique una versión nueva, la aplicación mostrará un aviso para actualizarla de forma segura.
