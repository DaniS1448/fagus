# Despliegue con Docker

Fagus guarda proyectos, textos y fotos en un SQLite. Dentro del contenedor ese archivo es `/app/data/fagus.db`. El volumen tiene que montarse en `/app/data`: cada despliegue crea un contenedor nuevo, y lo que esté solo dentro de la imagen desaparece.

Usa una sola réplica. Dos procesos a la vez sobre el mismo archivo se pisan.

La contraseña es opcional. Si defines `BASIC_AUTH_USER` y `BASIC_AUTH_PASSWORD`, el navegador las pide al entrar y las envía también en `/api`. Hacen falta las dos; si solo existe una, el proceso no arranca. Sin ninguna, el estudio queda abierto. `/api/health` no pide contraseña.

## Dokploy

Crea un servicio de tipo **Application** (no Compose). En el proveedor deja el repositorio `fagus`, la rama `main` y Build Path `/`. En Build Type elige **Dockerfile** y deja los tres campos en su valor por defecto:

| Campo | Valor |
| --- | --- |
| Docker File | vacío, o `Dockerfile` |
| Docker Context Path | vacío, o `.` |
| Docker Build Stage | vacío |

El archivo está en la raíz y no tiene etapas con nombre. Publish Directory también se queda vacío: eso es para un sitio estático, y Fagus arranca un servidor Node.

Nixpacks no vale. Detectaría Node y usaría `pnpm start`, que vuelve a compilar en cada arranque, y el directorio de trabajo puede no ser `/app`, así que el volumen no coincidiría con la base. El Dockerfile ya compila `better-sqlite3`, construye el frontend una vez y escucha en el `4173`.

Docker Compose no sale en Build Type. Es otro tipo de servicio. El `docker-compose.yml` del repo es para arrancar sin Dokploy. Con una Application, Dokploy construye la imagen, publica el dominio y engancha el volumen.

Puerto del contenedor: `4173`. Réplicas: `1`. En Environment añade `BASIC_AUTH_USER` y `BASIC_AUTH_PASSWORD`. En el dominio activa HTTPS y deja el puerto `4173` sin publicar en el host: entran el 80 y el 443 por Traefik.

En la aplicación, Volumes / Mounts, pestaña **Volume Mount**:

| Campo | Valor |
| --- | --- |
| Volume Name | `fagus-data` |
| Mount Path (In the container) | `/app/data` |

Dokploy crea el volumen al guardar. No hace falta `mkdir`. Después del primer despliegue aparece en Docker → Volumes, con la carpeta real en la columna Mountpoint (`/var/lib/docker/volumes/.../_data`). Ahí viven `fagus.db`, `fagus.db-wal` y `fagus.db-shm`. El volumen que ya sale en esa lista, con nombre largo y unos 283 MB, es de otro uso: no lo montes en Fagus.

Ese volumen con nombre es el que Dokploy puede copiar a S3. En Volume Backups crea una copia programada: nombre `fagus`, horario en cron (por ejemplo `0 0 * * *`, cada noche), el destino S3 que hayas dado de alta, el servicio de Fagus y el volumen `fagus-data`. Activa **Turn off Container**. Dokploy para el contenedor, archiva el volumen y lo vuelve a arrancar. Con el contenedor en marcha la copia puede pillar la base a medias, porque SQLite escribe en `fagus.db` y en los archivos `-wal` y `-shm`. Un bind mount no entra en Volume Backups.

Para restaurar, en Volume Backups elige Restore, el destino, el archivo y el nombre del volumen. El volumen de destino no puede existir todavía y ningún contenedor puede tenerlo montado: para la aplicación, borra el volumen vacío si hace falta y restaura antes de arrancar.

Para llevar la base de tu ordenador, para la aplicación, copia el archivo a la carpeta Mountpoint de `fagus-data` y arranca de nuevo. Al iniciar se añaden las columnas que falten sobre ese mismo archivo.

Si quieres un archivo suelto en el VPS, con la aplicación en marcha:

```bash
sqlite3 /var/lib/docker/volumes/fagus-data/_data/fagus.db ".backup '/var/backups/fagus.db'"
```

Si en la tabla el nombre no es exactamente `fagus-data`, usa el Mountpoint que muestra Dokploy.

El volumen crece con las fotos: cada una puede ocupar hasta 20 MB dentro de la base.

La pestaña Bind Mount es la otra opción: Host Path `/var/dokploy/fagus/data` y el mismo Mount Path `/app/data`. Esa carpeta sí hay que crearla antes. No la uses si quieres la copia a S3: Volume Backups solo archiva volúmenes con nombre.

## Docker Compose

En el servidor, junto al código:

```bash
printf '%s\n' 'BASIC_AUTH_USER=estudio' 'BASIC_AUTH_PASSWORD=una-frase-larga' > .env
docker compose up -d --build
```

Abre `http://servidor:4173`. El archivo `docker-compose.yml` publica el puerto y guarda la base en el volumen `fagus-data`. Un `docker compose up -d --build` posterior actualiza el código y conserva el volumen.

Para sustituir la base por la de tu máquina, para el servicio y copia el archivo dentro del volumen:

```bash
docker compose stop
docker compose run --rm --no-deps --entrypoint sh -v ./data:/import fagus -c "cp /import/fagus.db /app/data/fagus.db && rm -f /app/data/fagus.db-wal /app/data/fagus.db-shm"
docker compose start
```

`./data/fagus.db` es la base local. El `rm` evita que un journal viejo se mezcle con el archivo nuevo.

## Docker

```bash
docker build -t fagus .
docker run -d --name fagus --restart unless-stopped \
  -p 4173:4173 \
  -e BASIC_AUTH_USER=estudio \
  -e BASIC_AUTH_PASSWORD=una-frase-larga \
  -v fagus-data:/app/data \
  fagus
```

`-v fagus-data:/app/data` es el volumen con nombre. Para una carpeta del disco, cambia esa parte por `-v /var/dokploy/fagus/data:/app/data` después de crear la carpeta.
