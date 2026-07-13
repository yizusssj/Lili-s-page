# Base de datos de Lili's Page

Esta carpeta conserva el esquema de Supabase dentro de Git para que la base de datos sea reproducible y revisable.

## Ejecutar la migración inicial

1. Confirma que el proyecto aparezca como `Healthy` en Supabase.
2. Abre `SQL Editor` en el menú lateral y selecciona `New query`.
3. Copia todo el contenido de `migrations/20260712221500_initial_workspace_schema.sql`.
4. Pégalo en el editor y presiona `Run` una sola vez.
5. Debe terminar con el mensaje `Success. No rows returned`.

La migración crea `tasks`, `notes`, `today_priorities` y `quick_notes`. También habilita RLS, retira el acceso anónimo y añade políticas para que una sesión autenticada solo pueda administrar sus propios registros.

## Comprobar el resultado

Abre otra consulta, copia `verify.sql` y presiona `Run`. El primer resultado debe mostrar cuatro tablas con `rowsecurity = true`; el segundo debe mostrar dieciséis políticas.

No copies claves, contraseñas ni variables de `.env.local` en el SQL Editor.

## Convertirlo en un workspace compartido

La migración inicial separa los registros por usuario. Antes de guardar datos reales, ejecuta una sola vez `migrations/20260712224500_shared_workspace.sql` para que dos cuentas puedan trabajar sobre el mismo contenido.

Esta segunda migración se detiene automáticamente si detecta registros existentes en las cuatro tablas de contenido. Así evita borrar o dejar huérfanos datos por accidente.

Después sigue este orden:

1. Crea tu cuenta normal desde `Authentication > Users`.
2. Copia `bootstrap_owner.sql`, reemplaza `OWNER_EMAIL_HERE` por tu correo y ejecútalo. Tu rol interno será `owner`.
3. Cuando tengas el correo de ella, crea su cuenta normal desde `Authentication > Users`.
4. Copia `add_member.sql`, reemplaza ambos correos y ejecútalo. Su rol interno será `member`.
5. Ejecuta `verify_shared_workspace.sql` para comprobar las seis tablas, las veinticuatro políticas y los miembros.

`owner` y `member` siguen siendo usuarios normales de Supabase con el rol técnico `authenticated`. El rol `owner` solo permite administrar miembros dentro de Lili's Workspace; nunca utiliza `service_role` ni una clave secreta en el navegador.

## Activar el guardado compartido en la aplicación

Después de crear el workspace y su owner, ejecuta una sola vez `migrations/20260712234000_initialize_shared_data.sql`.

Esta migración:

- añade una marca remota para importar `localStorage` una sola vez;
- evita duplicados si se abre la aplicación en dos dispositivos al mismo tiempo;
- crea `initialize_workspace_data`, que realiza la importación en una transacción;
- crea `save_workspace_priorities`, que guarda las tres posiciones de forma consistente.

En el primer inicio posterior a la migración, la cuenta `owner` inicializa el workspace. Si ya existía contenido remoto, se conserva. Desde ese momento Supabase es la fuente principal y `localStorage` queda únicamente como copia local del último estado cargado.

Vuelve a ejecutar `verify_shared_workspace.sql` para comprobar que la columna y las dos funciones nuevas existen. Después del primer inicio, `data_initialized_at` debe contener una fecha.

## Activar la galería privada de recuerdos

Ejecuta una sola vez `migrations/20260713004000_memories_gallery.sql` después de las migraciones anteriores.

Esta migración crea:

- la tabla `memories`, vinculada al workspace compartido;
- el bucket privado `memory-images`, limitado a 8 MB por archivo;
- políticas RLS para que únicamente los miembros del workspace puedan listar, subir o eliminar sus imágenes;
- enlaces temporales firmados, generados por la aplicación al mostrar la galería.

La aplicación acepta JPG, PNG, WebP y HEIC de hasta 20 MB. Antes de subir cada fotografía, el navegador corrige su orientación, reduce su lado mayor a 2400 píxeles y la convierte a JPEG de hasta 8 MB.

Después ejecuta `migrations/20260713010000_memory_albums.sql`. Esta segunda migración permite crear álbumes libres —por ejemplo, personas, viajes, celebraciones o momentos personales— y relaciona cada fotografía con uno de ellos. Si ya existían recuerdos, los conserva dentro de un álbum llamado `Momentos`.

Finalmente vuelve a correr `verify_shared_workspace.sql`. Deben aparecer ocho tablas públicas con RLS, treinta y dos políticas públicas, el bucket privado y tres políticas sobre `storage.objects`.
