# Archive - Scripts de Debug Antiguos

Esta carpeta contiene scripts SQL que fueron útiles durante el desarrollo pero ya no son necesarios para el setup normal.

## 📦 Contenido

### Scripts de Testing
- `setup-test-user.sql` - Creación de usuario de prueba
- `add-test-songs.sql` - Agregar canciones de prueba
- `verify-data.sql` - Verificar datos en tablas

### Scripts de Debug RLS
- `check-current-user.sql` - Verificar usuario actual
- `debug-user-access.sql` - Debug de acceso de usuarios
- `disable-rls.sql` - Deshabilitar RLS (NO usar en producción)
- `enable-rls-with-policies.sql` - Versión antigua de políticas RLS
- `reset-and-enable-rls.sql` - Reset completo de RLS

### Scripts de Corrección Obsoletos
- `fix-permissions.sql` - Corrección de permisos (versión antigua)
- `fix-admin-access.sql` - Fix de acceso admin (versión antigua)
- `fix-rls-policies.sql` - Fix de políticas (versión antigua)
- `fix-infinite-recursion.sql` - Fix de recursión infinita (resuelto con SECURITY DEFINER)

### Scripts de Creación de Usuarios
- `create-admin-user.sql` - Crear usuario admin (reemplazado por UI)
- `example-create-regular-user.sql` - Ejemplo de creación de usuario

### Scripts de Queries de Testing
- `test-exact-query.sql` - Query de prueba

## ⚠️ Importante

Estos scripts NO deben usarse en producción. Se mantienen aquí solo como referencia histórica.

Para setup actual, usar los scripts en la carpeta `database/` padre.

## 🗑️ ¿Eliminar?

Estos scripts pueden eliminarse sin problema si:
- La base de datos está funcionando correctamente
- No necesitas referencia histórica del proceso de desarrollo
- Quieres mantener el repo limpio

Si tienes dudas, déjalos aquí - no ocupan mucho espacio y pueden ser útiles como referencia.
