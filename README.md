# Fagus

Estudio local para diseñar marcapáginas. Los proyectos, las fotos y los textos se guardan en un SQLite de esta máquina (`data/fagus.db`). No hay cuenta ni servidor remoto.

## Arranque

Requiere Node 22 o superior y pnpm.

```bash
pnpm install
pnpm dev
```

Abre http://localhost:5173. Para una copia ya compilada:

```bash
pnpm start
```

## Qué puedes hacer

- Crear proyectos y, dentro, varios diseños. El tamaño por defecto es 50 × 155 mm (5 × 15,5 cm).
- Encajar una foto, colocar citas, textos bíblicos y la identidad de la iglesia (un título corto o un logo).
- Dejar una cita o un texto bíblico fijos, o sortearlos desde la biblioteca. La semilla se guarda con el diseño: Barajar cambia el resultado y Fijar este resultado lo deja quieto.
- Diseñar a una o dos caras.
- Exportar cada cara en PNG, un PDF a tamaño real y un pliego A4 o A3 con marcas de corte. En doble cara, el reverso se coloca volteando por el borde largo o el corto, sin espejar el dibujo.

## Pruebas

```bash
pnpm test
```
