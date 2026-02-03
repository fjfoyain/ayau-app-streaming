# Explicación de Roles de Usuario - Sistema Ayau

## Resumen de Roles

### 👑 Administrador (admin)
- **Propósito**: Acceso total al sistema
- **Equipo**: Parte de logística/equipo interno Ayau
- **Acceso**: Global (todo el sistema)
- **Requiere cuenta/local**: ❌ NO
- **Casos de uso**:
  - Gestión completa de usuarios, cuentas, locales
  - Configuración del sistema
  - Acceso a analytics y reportes completos
  - Gestión de playlists globales

### 🔧 Manager (manager)
- **Propósito**: Gestión de contenido y operaciones
- **Equipo**: Parte de logística/equipo interno Ayau
- **Acceso**: Global (contenido y operaciones)
- **Requiere cuenta/local**: ❌ NO
- **Casos de uso**:
  - Gestión de canciones y playlists
  - Curación de contenido
  - Soporte a clientes
  - Analytics limitados

### 🏪 Usuario Cadena (user)
- **Propósito**: Administrador de cuenta de cliente
- **Equipo**: Cliente externo
- **Acceso**: Nivel Cuenta (todos los locales de un cliente)
- **Requiere cuenta/local**: ✅ SÍ - Requiere cuenta
- **Casos de uso**:
  - Gerente de cadena de restaurantes
  - Administrador de múltiples sucursales
  - Puede ver y gestionar todos los locales de su cuenta
  - Analytics de su cuenta completa

### 🏢 Usuario Local (client_user)
- **Propósito**: Usuario final de un local específico
- **Equipo**: Cliente externo
- **Acceso**: Nivel Local (un local específico)
- **Requiere cuenta/local**: ✅ SÍ - Requiere cuenta Y local
- **Casos de uso**:
  - DJ o empleado de un restaurante/bar específico
  - Solo puede reproducir música en su local
  - Analytics limitados a su local
  - No puede ver otros locales de la misma cuenta

## Jerarquía de Acceso

```
Sistema Ayau
│
├── 👑 Admin (Equipo Ayau)
│   └── Acceso total al sistema
│
├── 🔧 Manager (Equipo Ayau)
│   └── Gestión de contenido global
│
├── Cuenta: "Restaurante XYZ"
│   │
│   ├── 🏪 Usuario Cadena: "Juan - Gerente General"
│   │   └── Acceso a TODOS los locales de "Restaurante XYZ"
│   │
│   ├── Local: "XYZ Sucursal Centro"
│   │   └── 🏢 Usuario Local: "María - DJ Centro"
│   │
│   ├── Local: "XYZ Sucursal Zona 10"
│   │   └── 🏢 Usuario Local: "Pedro - DJ Z10"
│   │
│   └── Local: "XYZ Sucursal Carretera"
│       └── 🏢 Usuario Local: "Ana - DJ Carretera"
```

## Diferencias Clave

### Usuario Cadena vs Usuario Local

| Aspecto | Usuario Cadena | Usuario Local |
|---------|----------------|-----------------|
| **Alcance** | Todos los locales de una cuenta | Un local específico |
| **Tipo** | Administrador de cliente | Usuario final |
| **Ejemplo** | Gerente de cadena | DJ de un bar |
| **Requiere** | Solo cuenta | Cuenta + Local |
| **Analytics** | Toda la cuenta | Solo su local |

### Usuarios Internos (Admin/Manager) vs Externos (Usuario Cadena/Usuario Local)

| Aspecto | Internos | Externos |
|---------|----------|----------|
| **Equipo** | Ayau (logística) | Clientes |
| **Requiere cuenta** | ❌ NO | ✅ SÍ |
| **Alcance** | Sistema completo | Su cuenta/local |
| **Gestión** | Contenido y sistema | Solo reproducción |

## Flujo de Creación

### Para Equipo Interno (Admin/Manager):
1. Seleccionar rol: Admin o Manager
2. Ingresar email y nombre
3. ✅ **No se requiere seleccionar cuenta o local**
4. Crear usuario

### Para Clientes (Usuario Cadena):
1. Seleccionar rol: Usuario Cadena
2. Ingresar email y nombre
3. Seleccionar la **cuenta del cliente**
4. ✅ **No se requiere seleccionar local** (tiene acceso a todos)
5. Crear usuario

### Para Usuario Final (Usuario Local):
1. Seleccionar rol: Usuario Local
2. Ingresar email y nombre
3. Seleccionar la **cuenta del cliente**
4. Seleccionar el **local específico**
5. Crear usuario

## Exclusión de Analytics

Todos los tipos de usuario pueden ser marcados como "Excluir de Analytics y Regalías":
- **Uso típico**: Usuarios de prueba, empleados internos, demos
- **Efecto**: Sus reproducciones no cuentan para regalías ni estadísticas
- **Recomendado para**: Admin, Manager, y usuarios de testing

## Notas Importantes

1. **Admin y Manager NO necesitan cuenta**: Son parte del equipo de logística
2. **Usuario Cadena administra toda una cuenta**: Ideal para gerentes de cadena
3. **Usuario Local es para locales individuales**: Ideal para DJs o empleados
4. **Cambios de rol**: Pueden requerir reasignación de cuentas/locales
