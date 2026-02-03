# ✅ CHECKLIST DE TESTING - Mejoras en Gestión de Usuarios

## 📋 Pre-requisitos

Antes de comenzar el testing, verificar:

- [ ] Scripts SQL ejecutados exitosamente
- [ ] Aplicación React compilada y funcionando
- [ ] Navegador actualizado (Chrome, Firefox, Safari)
- [ ] Sesión de desarrollo abierta (F12)

---

## 🧪 PARTE 1: Password Reset (Recuperación de Contraseña)

### Test 1.1: Accesibilidad de Link
- [ ] Abrir página de Login (`/`)
- [ ] Verificar que aparezca link "¿Olvidaste tu contraseña?"
- [ ] Link debe estar debajo del botón "INICIAR SESIÓN"
- [ ] Link debe estar en color amarillo/gold (#F4D03F)

### Test 1.2: Página de Password Reset Sin Token
- [ ] Click en link "¿Olvidaste tu contraseña?"
- [ ] Verificar que redirige a `/password-reset`
- [ ] Debe mostrar:
  - [ ] Título: "Recuperar Contraseña"
  - [ ] Stepper mostrando "Paso 1: Ingresar Email"
  - [ ] Campo de email vacío
  - [ ] Botón "Enviar Enlace de Recuperación"
  - [ ] Link "Volver a Login"

### Test 1.3: Solicitud de Reset con Email Válido
- [ ] Ingresar email de usuario existente (ej: `demo-user-a1@ayau.com`)
- [ ] Click en "Enviar Enlace de Recuperación"
- [ ] Verificar que:
  - [ ] Botón muestra "Cargando..." brevemente
  - [ ] Aparece Alert verde con mensaje
  - [ ] Email se borra del campo
  - [ ] Mensaje dice "Si el correo existe, recibirá un enlace..."

### Test 1.4: Solicitud de Reset con Email Inválido
- [ ] Ingresar email inexistente (ej: `noexiste@test.com`)
- [ ] Click en "Enviar Enlace de Recuperación"
- [ ] Verificar que:
  - [ ] Muestra mismo mensaje que email válido (por seguridad)
  - [ ] No revela si email existe o no

### Test 1.5: Validación de Token
- [ ] Acceder a `/password-reset?token=tokeninvalido`
- [ ] Verificar que:
  - [ ] Muestra "Validando enlace de recuperación..."
  - [ ] Luego de 1-2 segundos, muestra error rojo
  - [ ] Error dice "Token inválido o expirado"
  - [ ] Vuelve a mostrar formulario de email

### Test 1.6: Reset de Contraseña Exitoso
- [ ] En consola de navegador (F12), ejecutar:
  ```javascript
  // Obtener token válido (simulado para testing)
  // Nota: En producción, usar el enlace del email
  ```
- [ ] Acceder a `/password-reset?token=<token_válido>`
- [ ] Verificar que:
  - [ ] Valida token correctamente
  - [ ] Muestra Stepper en "Paso 2: Nueva Contraseña"
  - [ ] Campos de contraseña aparecen
  - [ ] Indicador de fortaleza funciona

### Test 1.7: Indicador de Fortaleza de Contraseña
- [ ] En campo "Nueva Contraseña", escribir: `abc`
- [ ] Verificar que barra de fortaleza muestre 1/6 llena (roja)
- [ ] Borrar y escribir: `Abc123!@#Pass`
- [ ] Verificar que barra muestre 6/6 completa (verde)
- [ ] Probar diferentes combinaciones

### Test 1.8: Validaciones de Contraseña
- [ ] Intentar enviar sin llenar campos
  - [ ] Debe mostrar error: "Por favor, ingresa la nueva contraseña..."
- [ ] Llenar con contraseñas diferentes
  - [ ] Debe mostrar error: "Las contraseñas no coinciden"
- [ ] Llenar con contraseña corta (< 8 caracteres)
  - [ ] Debe mostrar error: "Debe tener al menos 8 caracteres"

### Test 1.9: Reset Exitoso
- [ ] Ingresar contraseña válida (ej: `NewPass123!@#`) en ambos campos
- [ ] Click en "Restablecer Contraseña"
- [ ] Verificar que:
  - [ ] Muestra "Cargando..." brevemente
  - [ ] Alert verde: "Tu contraseña ha sido restablecida exitosamente"
  - [ ] Redirige a login automáticamente (2 segundos)

### Test 1.10: Login con Nueva Contraseña
- [ ] Login con usuario y nueva contraseña
- [ ] Verificar que:
  - [ ] Login es exitoso
  - [ ] Redirige a página principal
  - [ ] Sesión activa correctamente

---

## 🧪 PARTE 2: Creación de Usuarios (Modal de Contraseña)

### Test 2.1: Acceso a Creación de Usuarios
- [ ] Login como admin (demo-admin@ayau.com o equivalente)
- [ ] Ir a Admin → Gestión de Usuarios
- [ ] Verificar que botón "Nuevo Usuario" es visible
- [ ] Botón debe estar en amarillo/gold (#F4D03F)

### Test 2.2: Abrir Diálogo de Creación
- [ ] Click en "Nuevo Usuario"
- [ ] Verificar que se abre diálogo con:
  - [ ] Campo "Email"
  - [ ] Campo "Nombre Completo"
  - [ ] Campo "Contraseña" (OPCIONAL)
  - [ ] Campo "Rol"
  - [ ] Campo "Nivel de Acceso"
  - [ ] Campos dinámicos según nivel de acceso

### Test 2.3: Llenar Formulario SIN Contraseña
- [ ] Email: `test-user@ejemplo.com`
- [ ] Nombre: `Usuario de Prueba`
- [ ] Rol: `user`
- [ ] Acceso: `location`
- [ ] Seleccionar una cuenta y local
- [ ] Dejar campo "Contraseña" vacío
- [ ] Click en "Crear Usuario"

### Test 2.4: Verificar Modal de Contraseña
- [ ] Debe aparecer modal verde con:
  - [ ] Título: "✓ Usuario Creado Exitosamente"
  - [ ] Mensaje: "El usuario Usuario de Prueba ha sido creado."
  - [ ] Contraseña mostrada (ej: `aB3!xYz$Qw9`)
  - [ ] Botón "Copiar Contraseña"
  - [ ] Sección de advertencias/información

### Test 2.5: Copiar Contraseña
- [ ] Click en "Copiar Contraseña"
- [ ] Verificar que:
  - [ ] Muestra alert: "Contraseña copiada al portapapeles"
  - [ ] Puede pegar en otro lugar (Ctrl+V)
  - [ ] Contraseña se copia correctamente

### Test 2.6: Información en Modal
- [ ] Verificar que modal muestra:
  - [ ] ⚠️ IMPORTANTE:
    - [ ] 1. Contraseña requerida en primer login
    - [ ] 2. Email de confirmación será enviado
    - [ ] 3. Recomendación de compartir de forma segura
    - [ ] 4. Usuario puede cambiar después
  - [ ] Información sobre "Olvidé contraseña"

### Test 2.7: Cerrar Modal
- [ ] Click en "Entendido, Cerrar"
- [ ] Verificar que:
  - [ ] Modal se cierra
  - [ ] Vuelve a página de usuarios
  - [ ] Nuevo usuario aparece en la lista
  - [ ] Tiene estado "Activo" ✓

### Test 2.8: Llenar Formulario CON Contraseña
- [ ] Crear otro usuario con:
  - [ ] Email: `test-manager@ejemplo.com`
  - [ ] Nombre: `Manager de Prueba`
  - [ ] Contraseña: `MiContraseña123!@#` (llenar manualmente)
  - [ ] Rol: `manager`
  - [ ] Acceso: `location`
- [ ] Click en "Crear Usuario"

### Test 2.9: Verificar Contraseña Proporcionada
- [ ] En modal de contraseña:
  - [ ] Debe mostrar la contraseña que el admin ingresó
  - [ ] No debe generar contraseña aleatoria

### Test 2.10: Validaciones del Formulario
- [ ] Intentar crear sin email
  - [ ] Error: "Email y nombre completo son requeridos"
- [ ] Intentar crear sin nombre
  - [ ] Error: "Email y nombre completo son requeridos"
- [ ] Seleccionar acceso "account" sin elegir cuenta
  - [ ] Error: "Debes seleccionar una cuenta..."
- [ ] Seleccionar acceso "location" sin elegir local
  - [ ] Error: "Debes seleccionar un local..."

---

## 🧪 PARTE 3: Usuarios Demo

### Test 3.1: Verificar que Usuarios Demo Existen
- [ ] En BD, ejecutar:
  ```sql
  SELECT email FROM auth.users WHERE email LIKE 'demo-%@ayau.com';
  ```
- [ ] Verificar que retorna 8 usuarios

### Test 3.2: Login con Admin del Sistema
- [ ] Email: `demo-admin@ayau.com`
- [ ] Contraseña: `Demo123!@#`
- [ ] Verificar que:
  - [ ] Login exitoso
  - [ ] Acceso a Admin completo
  - [ ] Puede ver todas las cuentas y usuarios

### Test 3.3: Login con Owner de Cuenta A
- [ ] Email: `demo-owner-a@ayau.com`
- [ ] Contraseña: `Demo123!@#`
- [ ] Verificar que:
  - [ ] Login exitoso
  - [ ] Acceso a "Restaurante Demo A"
  - [ ] No puede ver "Restaurante Demo B"
  - [ ] Puede ver los 3 locales de A

### Test 3.4: Login con Manager de Local
- [ ] Email: `demo-manager-a1@ayau.com`
- [ ] Contraseña: `Demo123!@#`
- [ ] Verificar que:
  - [ ] Login exitoso
  - [ ] Solo acceso a "Demo A - Zona 10"
  - [ ] No puede ver otros locales
  - [ ] Puede controlar música del local

### Test 3.5: Login con Usuario Regular
- [ ] Email: `demo-user-a1@ayau.com`
- [ ] Contraseña: `Demo123!@#`
- [ ] Verificar que:
  - [ ] Login exitoso
  - [ ] Acceso limitado al local
  - [ ] Puede ver playlists
  - [ ] No puede crear/editar usuarios

### Test 3.6: Verificar Permisos Correctos
Cambiar entre usuarios y verificar:
- [ ] Demo Owner A: Restaurante A (todos los locales)
- [ ] Demo Manager A1: Local A Zona 10
- [ ] Demo User A1: Local A Zona 10 (lectura)
- [ ] Demo Owner B: Restaurante B (todos los locales)
- [ ] Demo Manager B1: Local B Zona 1
- [ ] Demo Manager B2: Local B Zona 4
- [ ] Demo User B2: Local B Zona 4 (lectura)

---

## 🔍 PARTE 4: Integración Completa

### Test 4.1: Flujo Nuevo Usuario → Reset
1. [ ] Admin crea usuario sin contraseña
2. [ ] Se muestra contraseña temporal en modal
3. [ ] Comparte contraseña con usuario
4. [ ] Usuario intenta login
5. [ ] Usuario usa "Olvidé contraseña" para cambiar
6. [ ] Usuario logra hacer login con nueva contraseña

### Test 4.2: Flujo Olvidé Contraseña
1. [ ] Usuario en login olvida contraseña
2. [ ] Click "¿Olvidaste tu contraseña?"
3. [ ] Ingresa email
4. [ ] Recibe enlace en email
5. [ ] Click en enlace
6. [ ] Ingresa nueva contraseña
7. [ ] Vuelve a login exitosamente

### Test 4.3: Cambio de Contraseña Múltiple
1. [ ] Usuario hace password reset
2. [ ] Login con nueva contraseña
3. [ ] User puede volver a hacer password reset
4. [ ] Nuevamente login con otra contraseña

---

## 📊 Tabla de Verificación Final

| Feature | Test | Status |
|---------|------|--------|
| Link "Olvidé contraseña" visible | 1.1 | [ ] ✓ |
| Página Password Reset funciona | 1.2 | [ ] ✓ |
| Request password reset funciona | 1.3 | [ ] ✓ |
| Token válido/inválido | 1.5-1.6 | [ ] ✓ |
| Reset de contraseña exitoso | 1.9 | [ ] ✓ |
| Login con nueva contraseña | 1.10 | [ ] ✓ |
| Modal de contraseña se muestra | 2.4 | [ ] ✓ |
| Copiar contraseña funciona | 2.5 | [ ] ✓ |
| Información en modal completa | 2.6 | [ ] ✓ |
| Usuarios demo existen | 3.1 | [ ] ✓ |
| Permisos de usuarios correctos | 3.6 | [ ] ✓ |
| Flujo completo integrado | 4.1 | [ ] ✓ |

---

## 🐛 Reporte de Issues

Si encuentras problemas, reporta:

### Información a Incluir:
- [ ] Navegador y versión
- [ ] Paso donde falla
- [ ] Error exacto (F12 → Console)
- [ ] Screenshot si es posible
- [ ] Usuario/email usado

### Posibles Issues Comunes:

**"Email de confirmación no llega"**
- [ ] Revisar spam/basura
- [ ] Verificar configuración de emails en Supabase
- [ ] En desarrollo, emails pueden no enviarse

**"Token inválido después de usar"**
- [ ] Normal, tokens son de un solo uso
- [ ] Solicitar nuevo reset

**"Contraseña no se muestra en modal"**
- [ ] Revisar consola del navegador (F12)
- [ ] Verificar que usuario se creó correctamente

**"Usuarios demo no aparecen"**
- [ ] Verificar que scripts SQL fueron ejecutados
- [ ] Ejecutar verify-implementation.sql

---

## ✅ Checklist Final

- [ ] Todos los tests de Password Reset PASARON
- [ ] Todos los tests de Creación de Usuarios PASARON
- [ ] Todos los tests de Usuarios Demo PASARON
- [ ] Flujo integrado completo FUNCIONA
- [ ] No hay errores en consola (F12)
- [ ] Base de datos está limpia/consistente
- [ ] Documentación actualizada

---

## 🎉 ¡IMPLEMENTACIÓN COMPLETA!

Si todos los checks pasaron, la implementación está lista para:
- [ ] Demostración con clientes
- [ ] Uso en producción
- [ ] Testing extendido

**Fecha de Verificación:** ___________  
**Responsable:** ___________  
**Status:** ____________
