# Verificación visual de Supabase Storage

La captura proporcionada por el usuario muestra el bucket `photovault-media` en el área **Storage → Files → Buckets**. La fila indica que el bucket es **público**, contiene **4 políticas** y tiene un límite de archivo de **10 MB**. La sección final confirma los tipos MIME permitidos: `image/jpeg`, `image/png` e `image/webp`.

La verificación se hizo leyendo los cuatro recortes horizontales en orden, con solapamiento entre ellos. La consulta anónima al endpoint administrativo de buckets no es una prueba concluyente de existencia, pues el endpoint puede ocultar buckets a claves públicas; la evidencia visual aportada por el administrador sí confirma la configuración del bucket.

Como comprobación técnica adicional, se consultó una ruta pública inexistente dentro de `photovault-media`. Supabase respondió `NoSuchKey` / `Object not found`, en lugar de `NoSuchBucket`, lo que confirma que el bucket existe y que el endpoint público resuelve correctamente el contenedor.

La evidencia adicional del usuario confirma una carga real en `photovault-media/evidences`: se observan las carpetas `blueprints` y `evidences`, subcarpetas por elemento `plan-…` y archivos `01.jpg` a `04.jpg`. La previsualización de `02.jpg` muestra una imagen de inspección disponible desde Storage. Esto valida la carga de evidencias y su organización por elemento.

La recuperación remota se verificó sin leer IndexedDB ni `localStorage`: las URLs públicas de `evidences/plan-1787674009671/02.jpg` y `blueprints/active-plan.jpg` respondieron HTTP 200, con 258.610 y 415.293 bytes, respectivamente. Esto confirma que el plano y una evidencia ya se pueden recuperar directamente desde Storage en un navegador sin caché local.

Como prueba final dentro de la aplicación, el usuario abrió la vista previa en una ventana de incógnito y confirmó: **“plano y evidencia recuperados”**. Ambos recursos se mostraron sin cargarlos nuevamente y no se reportaron errores durante la recuperación.
