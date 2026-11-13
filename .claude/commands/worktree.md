---
description: Crea un git worktree aislado en .trees/[nombre] y ejecuta allí el requerimiento indicado
argument-hint: <requerimiento a implementar>
---

Requerimiento del usuario: $ARGUMENTS

Sigue estos pasos en orden:

1. **Nombre del worktree**: deduce un nombre corto en kebab-case (minúsculas, sin acentos, máx. 4 palabras) a partir del requerimiento, p. ej. `modo-oscuro` o `fix-rotacion`. Si `.trees/<nombre>` ya existe, añade un sufijo numérico (`-2`, `-3`...).
2. **Crear el worktree** desde la raíz del repo, con rama nueva del mismo nombre:
   `git worktree add .trees/<nombre> -b worktree/<nombre>`
   (si la rama ya existe, usa `git worktree add .trees/<nombre> worktree/<nombre>` o elige otro nombre).
3. **Asegurar que `.trees/` esté en `.gitignore`**; si no está, añádelo.
4. **Trabajar de forma aislada**: ejecuta el requerimiento SOLO dentro de `.trees/<nombre>`. Todas las rutas de lectura/edición y todos los comandos (usa `cd` a esa carpeta o rutas absolutas dentro de ella) deben apuntar al worktree. No modifiques archivos del directorio principal.
5. Sigue las convenciones de `CLAUDE.md` (vanilla JS, textos de UI en español, tests con `node --test tests/` si aplica). Verifica los cambios dentro del worktree.
6. **Commit** de los cambios en la rama del worktree (mensaje claro, en español). No hagas push ni merge a menos que el usuario lo pida.
7. **Informe final**: indica el nombre del worktree, su ruta, la rama, un resumen de los cambios, y cómo integrarlo (`git merge worktree/<nombre>`) o eliminarlo (`git worktree remove .trees/<nombre>`).

Si `$ARGUMENTS` está vacío, pregunta al usuario qué requerimiento quiere ejecutar antes de crear nada.
