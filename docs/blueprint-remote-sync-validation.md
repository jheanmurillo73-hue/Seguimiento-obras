# Validación de actualización remota del plano

## Objetivo

Garantizar que un inspector vea el JPG vigente cargado por el administrador aunque su navegador conserve una copia anterior del plano en IndexedDB.

## Escenario controlado

| Fuente | Estado simulado | Resultado esperado |
| --- | --- | --- |
| Supabase Storage | `blueprints/active-plan.jpg` actualizado por el administrador | Debe ser la imagen mostrada al inspector. |
| IndexedDB del inspector | JPG anterior disponible como respaldo local | No debe reemplazar el plano remoto cuando existe conexión. |

La restauración inicial llama en paralelo a `getCloudBlueprintUrl` y `loadBlueprintImage`. La función `restoreBlueprintFromSources` prioriza la URL remota; solo usa IndexedDB si Storage no devuelve un plano disponible. La URL pública incorpora la marca de tiempo `updated_at` como parámetro `v`, de modo que un nuevo JPG invalida la caché del navegador asociada a la versión anterior.

## Resultado obtenido

La prueba integrada `server/supabaseStorageRecovery.test.ts` simula un JPG nuevo en Storage y una copia local obsoleta. El resultado recuperado para el mapa corresponde a la URL remota con versión nueva. La validación ejecutada el 26 de agosto de 2026 finalizó con 6 pruebas aprobadas, comprobación TypeScript correcta y compilación de producción exitosa.

> Esta validación cubre el contrato de sincronización administrador → inspector. En operación, tras cargar el plano como administrador, el inspector debe recargar la vista o iniciar sesión de nuevo para iniciar una nueva restauración remota.
