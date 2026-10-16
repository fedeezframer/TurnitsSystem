# Mapas de Turnits — Argentina

La web sirve las librerías, el worker, el estilo, los glifos y los datos desde su
propio alojamiento. Perfil público, selección de sucursal y editor de ubicación
comparten `BranchMap`. No hay proxy de un proveedor, API cartográfica externa,
CDN de mapas, credencial de mapas ni descarga del país completo por visitante.

## Copia nacional instalada

- Fuente: [Argentina, Geofabrik](https://download.geofabrik.de/south-america/argentina.html),
  archivo `argentina-shortbread-1.0.mbtiles`, descargado el 15/10/2026.
- Datos: OpenStreetMap bajo ODbL. Shortbread es un esquema CC0.
- Se conservan únicamente calles transitables y sus nombres, con geometría real.
  Se descartan POIs, edificios, terreno, ferrocarriles, aeropuertos y atributos
  que el diseño no utiliza. Se mantienen clase y nombre; no se alteran trazados.
- Zoom de los datos: hasta 14, ampliable visualmente hasta 19. Cobertura y detalle
  corresponden al extracto citado; no son actualizaciones en vivo.
- Archivo PMTiles: 273.659.080 bytes (261 MiB), SHA-256
  `cb5d92c12d545fe1157c525961ff60906cf65b33b015ea7faa783ce94adaf42f`.
- Se distribuye en seis bloques menores a 50 MiB en `web/public/maps/argentina/`.
  El manifiesto incluye tamaños, orden y SHA-256 de cada bloque. Concatenarlos
  en ese orden reconstruye un PMTiles estándar.
- `LocalMapSource` adapta lecturas por rango al almacenamiento en bloques;
  PMTiles mantiene su lector y directorio estándar. El navegador recibe sólo
  los bytes requeridos para la zona visible. Render soporta HTTP 206.
- URLs con hash, glifos locales y manifiesto incluidos en el mismo despliegue.
  La compilación comprueba todos los hashes; falla ante datos incompletos.
- Son archivos estáticos, no requieren cambios en Express ni Supabase.

La copia nacional ocupa espacio en el repositorio y en cada despliegue. Para
actualizaciones frecuentes o más países conviene pasar los bloques a un
almacenamiento del proyecto con dominio propio, manteniendo el mismo contrato.
No se creó ningún servicio ni suscripción adicional para esta versión.

## Actualización manual

Herramientas: Node 24 y [go-pmtiles](https://github.com/protomaps/go-pmtiles/releases).
Se utilizó v1.31.2, ZIP Windows x86_64 SHA-256
`a658baa4d7e55020aef6ca17bd9ff9faa1582671266b36f58c52db0ac8e785a1`,
verificado contra el digest publicado por GitHub.

Descargar el MBTiles completo desde la fuente anterior a un directorio de trabajo
fuera de Git y comprobar su integridad SQLite. Desde la raíz del repositorio:

```sh
node web/scripts/build-argentina-map.mjs /trabajo/original.mbtiles /trabajo/calles.mbtiles
pmtiles convert /trabajo/calles.mbtiles /trabajo/calles.pmtiles
pmtiles verify /trabajo/calles.pmtiles
node web/scripts/package-argentina-map.mjs /trabajo/calles.pmtiles web
node web/scripts/copy-map-fonts.mjs /trabajo/calles.mbtiles.glyph-ranges.json web
npm --prefix web run build
```

Usar una salida nueva para el filtrado; la herramienta no sobreescribe bases
existentes. Actualizar la fecha, origen y hashes de esta documentación y los
avisos de datos al renovar el extracto. Revisar los cambios antes de publicar.
Las descargas externas sólo ocurren al preparar una actualización.

## Licencias

Se conserva un enlace discreto a OpenStreetMap dentro del mapa. Alojar los datos
localmente no elimina la atribución requerida. Los avisos, la licencia de Noto
Sans y las de las librerías están en `web/public/maps/`. El manifiesto público
permite obtener la base derivada, distribuida bajo la misma ODbL.

Referencias: [licencia OSM](https://www.openstreetmap.org/copyright),
[Shortbread](https://shortbread-tiles.org/copyright/),
[PMTiles](https://docs.protomaps.com/pmtiles/).

## Verificación

El conjunto nacional se verificó con el CLI PMTiles y con lecturas MVT reales de
Córdoba, Buenos Aires, Rosario, Mendoza, Salta, Ushuaia, Bariloche y Posadas.
`work/maps-argentina/verify-data.mjs` (fuera del repositorio) comprueba calles,
nombres y ausencia de capas extra. `work/verify-selfhosted-map-ui.cjs` prueba las
peticiones de rango/glifos locales con conexiones externas bloqueadas, selección
de sucursal, edición del pin y móvil. No modifica datos reales.
