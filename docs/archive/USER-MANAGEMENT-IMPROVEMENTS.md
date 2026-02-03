# Mejoras en Gestión de Usuarios - PLAN DE IMPLEMENTACIÓN

## 📋 Problemas Actuales

1. **Creación de usuarios sin contraseña**
   - Si el admin no ingresa contraseña, se genera una aleatoria
   - El email de confirmación no muestra la contraseña
   - El usuario no recibe la contraseña por ningún lado
   - Al confirmar email, no se setea automáticamente la contraseña

2. **Falta de recuperación de contraseña**
   - No existe funcionalidad "Olvidé mi contraseña"
   - Usuario olvida contraseña = debe contactar al admin

3. **Falta de usuarios demo**
   - No hay usuarios de ejemplo para demostrar todas las funcionalidades
   - Difícil hacer demos con clientes sin datos reales

---

## ✅ Soluciones Propuestas

### 1. Mejora en Creación de Usuarios (MODAL MEJORADO)

**Opción A: Admin genera contraseña temporal (RECOMENDADO)**
- Admin puede:
  - Dejar en blanco y generar contraseña aleatoria (sugerida en UI)
  - O ingresar contraseña manualmente
- Se muestra la contraseña temporal EN LA PANTALLA (modal de confirmación)
- Email incluye enlace para establecer contraseña, no la contraseña misma
- Primer login obliga a cambiar contraseña temporal

**Cambios necesarios:**
- Tabla: `user_profiles` agregar columna `password_set_by_admin` (BOOLEAN)
- Función JS: Crear función `showPasswordDialog()` que muestre la contraseña generada
- Email: Enviar template mejorado (solo enlace, sin contraseña)
- Database: Trigger para marcar `password_requires_change` en primer login

### 2. Funcionalidad "Olvidé Contraseña"

**Backend (SQL)**
- Tabla: `password_reset_tokens` para almacenar tokens temporales
- Función: `request_password_reset(email)` 
- Trigger: `send_reset_email()` para enviar email con enlace
- Validación: Token vence en 24 horas

**Frontend (React)**
- Nueva página: `PasswordReset.jsx` (accesible sin autenticación)
- Formulario: email → recibe enlace por email → reset contraseña
- Link en página de Login: "¿Olvidaste tu contraseña?"

### 3. Usuarios Demo

**Script SQL: `create-demo-users.sql`**

Crear usuarios de prueba para cada rol/acceso:
- ✅ Admin Sistema
- ✅ Admin Cuenta (Restaurante A - Todo)
- ✅ Manager de Local (Restaurante A - Local 1)
- ✅ Usuario Regular (Restaurante A - Local 1)
- ✅ Admin Cuenta (Restaurante B - Todo) 
- ✅ Manager de Local (Restaurante B - Local 1)
- ✅ Manager de Local (Restaurante B - Local 2)
- ✅ Usuario Regular (Restaurante B - Local 2)

Todas las cuentas usan:
- Email: `demo-[role]@ayau.com`
- Contraseña: `Demo123!@#` (temporal, requiere cambio en primer login)

Todas vinculadas a:
- Cliente 1: "Restaurante Demo A" (3 locales)
- Cliente 2: "Restaurante Demo B" (2 locales)

---

## 🗂️ Archivos a Modificar/Crear

### Nuevo:
- [ ] `database/create-demo-users.sql` - Script para crear usuarios demo
- [ ] `database/setup-password-reset.sql` - Tables y functions para password reset
- [ ] `src/pages/PasswordReset.jsx` - Página de reset de contraseña
- [ ] `src/components/PasswordResetForm.jsx` - Formulario de reset

### Modificar:
- [ ] `src/services/supabase-api.js` - Agregar funciones de password reset
- [ ] `src/components/admin/UserManager.jsx` - Mejorar UI de creación
- [ ] `src/pages/Login.jsx` - Agregar link "Olvidé contraseña"
- [ ] `src/components/admin/UserManager.jsx` - Modal mejorado para mostrar contraseña

---

## 📊 Arquitectura de Password Reset

```
1. Usuario olvida contraseña
2. Accede a página PasswordReset.jsx
3. Ingresa email
4. Frontend llama: requestPasswordReset(email)
5. Backend:
   - Verifica que email exista
   - Genera token aleatorio (36 caracteres)
   - Guarda en `password_reset_tokens` con expiración (24h)
   - Envía email con enlace: `/reset-password?token=XXX`
6. Usuario click en email
7. Verifica token válido y no expirado
8. Muestra formulario: nueva contraseña + confirmar
9. Frontend llama: resetPassword(token, newPassword)
10. Backend:
    - Verifica token válido
    - Actualiza contraseña en auth.users
    - Elimina token
    - Redirige a login con mensaje éxito
```

---

## 🚀 Fase de Implementación

### Fase 1: Password Reset (CRÍTICA)
1. Crear tabla `password_reset_tokens`
2. Crear funciones SQL para generar/validar tokens
3. Crear endpoints API en supabase-api.js
4. Crear página PasswordReset.jsx
5. Agregar link en Login.jsx
6. Probar flujo completo

### Fase 2: Mejora Creación de Usuarios
1. Mejorar modal en UserManager.jsx
2. Agregar campo "Generar contraseña temporal"
3. Mostrar contraseña después de crear usuario
4. Mejorar email de confirmación

### Fase 3: Usuarios Demo
1. Crear `create-demo-users.sql`
2. Crear cuentas y locales de demo
3. Crear usuarios con diferentes roles
4. Documentación de acceso para demostraciones

---

## 📝 Estado de Implementación

- [x] Análisis de código existente
- [x] Identificación de problemas
- [x] Diseño de soluciones
- [ ] Implementación Phase 1 (Password Reset)
- [ ] Implementación Phase 2 (Mejora Creación)
- [ ] Implementación Phase 3 (Demo Users)
- [ ] Testing completo
- [ ] Documentación para usuarios

