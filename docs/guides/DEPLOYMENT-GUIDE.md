# 🚀 Guía de Despliegue: 4 Mejoras en AYAU

**Objetivo:** Completar la implementación de las 4 mejoras y desplegarlas en producción.

---

## Fase 1: Despliegue de Scripts SQL en Supabase ⭐ PRIORITARIO

### Paso 1.1: Acceder a Supabase SQL Editor

1. Ir a https://app.supabase.com
2. Seleccionar tu proyecto AYAU
3. Ir a **SQL Editor**
4. Crear una nueva query

### Paso 1.2: Ejecutar Script #1 - Password Change + Analytics Exclusion

**Archivo:** `database/force-password-change-and-analytics.sql`

```
✅ Acciones:
  - Agrega columna password_changed_at a user_profiles
  - Agrega columna exclude_from_analytics a user_profiles
  - Agrega columna exclude_reason a user_profiles
  - Crea funciones RPC: user_needs_password_change(), mark_password_changed(), toggle_user_analytics_exclusion()
  - Crea vistas: analytics_valid_plays (filtra usuarios excluidos), excluded_analytics_users
  - Configura RLS policies
  - Crea índices de performance
```

1. Copiar todo el contenido de `database/force-password-change-and-analytics.sql`
2. Pegar en SQL Editor
3. Click **Run** (Command + Enter)
4. ✅ Verificar que no hay errores

**Verificación:**
```sql
-- Ejecutar esta query para verificar
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name IN ('password_changed_at', 'exclude_from_analytics');
-- Debe retornar 2 filas
```

### Paso 1.3: Ejecutar Script #2 - Email Notifications System

**Archivo:** `database/email-notifications-system.sql`

```
✅ Acciones:
  - Crea tabla email_notifications (cola de emails)
  - Crea tabla email_templates (6 templates pre-insertados)
  - Crea funciones: send_email_notification(), send_user_created_email(), send_password_changed_email(), send_excluded_analytics_email()
  - Crea triggers automáticos
  - Configura RLS policies
  - Crea vista email_notifications_status para auditoría
```

1. Copiar todo el contenido de `database/email-notifications-system.sql`
2. Pegar en nueva query en SQL Editor
3. Click **Run**
4. ✅ Verificar que no hay errores

**Verificación:**
```sql
-- Ejecutar para verificar
SELECT COUNT(*) as template_count FROM email_templates;
-- Debe retornar 6
```

### Paso 1.4: Ejecutar Script #3 - Analytics Dashboard Improvements

**Archivo:** `database/analytics-dashboard-improved.sql`

```
✅ Acciones:
  - Crea 10 vistas analytics nuevas
  - Crea funciones: export_analytics_json(), export_analytics_csv()
  - Crea índices de performance
  - Todas las vistas filtran automáticamente usuarios con exclude_from_analytics = true
```

1. Copiar todo el contenido de `database/analytics-dashboard-improved.sql`
2. Pegar en nueva query en SQL Editor
3. Click **Run**
4. ✅ Verificar que no hay errores

**Verificación:**
```sql
-- Ejecutar para verificar
SELECT COUNT(*) as views_created FROM information_schema.views 
WHERE table_schema = 'public' AND table_name LIKE 'analytics_%';
-- Debe retornar 10
```

---

## Fase 2: Integración en React Components

### Paso 2.1: Integrar ForcePasswordChangeModal en App.jsx

**Archivo:** `src/App.jsx`

Agregar el import:
```jsx
import ForcePasswordChangeModal from './components/ForcePasswordChangeModal';
```

En el JSX principal, después del login, agregar:
```jsx
{session && (
  <>
    <ForcePasswordChangeModal session={session} />
    {/* Rest of app content */}
  </>
)}
```

**Ubicación recomendada:** Antes de cualquier contenido en el dashboard.

**Resultado:** Los usuarios nuevos verán un modal bloqueante en el primer login pidiéndoles cambiar contraseña.

### Paso 2.2: Verificar AnalyticsDashboard Actualizado

**Archivo:** `src/components/admin/AnalyticsDashboard.jsx`

✅ Ya está actualizado con:
- 8 tabs nuevos
- Botones de exportación CSV/JSON
- Nuevas vistas analytics
- Usuarios excluidos mostrados con alerta

No requiere cambios adicionales.

**Próxima mejora:** Agregar UI para excluir usuarios (ver Paso 2.3)

### Paso 2.3: Agregar Checkbox en UserManager para Excluir de Analytics

**Archivo:** `src/components/admin/UserManager.jsx`

Este paso requiere acceso al código actual de UserManager. Estructura sugerida:

```jsx
// Agregar en la fila de la tabla de usuarios:
<TableCell>
  <Checkbox 
    checked={user.exclude_from_analytics || false}
    onChange={() => handleToggleAnalyticsExclusion(user.id)}
    disabled={loading}
    title="Excluir de analytics y regalías"
  />
</TableCell>

// Agregar función:
const handleToggleAnalyticsExclusion = async (userId) => {
  const reason = prompt('Razón de exclusión (ej: "Usuario de ventas"):');
  if (!reason) return;
  
  try {
    const { error } = await supabase.rpc('toggle_user_analytics_exclusion', {
      p_user_id: userId,
      p_exclude: !user.exclude_from_analytics,
      p_reason: reason
    });
    
    if (error) throw error;
    alert('✅ Usuario actualizado. Se enviará email de notificación.');
    // Recargar lista de usuarios
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
};
```

---

## Fase 3: Configuración de Email Notifications

### Paso 3.1: Personalizar Templates de Email (Opcional)

**En Supabase SQL Editor:**

```sql
-- Editar template de bienvenida
UPDATE email_templates 
SET html_template = '<h2>¡Bienvenido a AYAU {user_name}!</h2>
  <p>Tu cuenta ha sido creada exitosamente.</p>
  <p>Por favor accede aquí: <a href="https://tu-app.com/login">Login</a></p>'
WHERE template_name = 'user_created';

-- Editar template de cambio de contraseña
UPDATE email_templates 
SET subject = 'Tu contraseña en AYAU ha sido cambiada'
WHERE template_name = 'password_changed';
```

### Paso 3.2: Procesar Queue de Emails (NECESARIO PARA PRODUCCIÓN)

Los emails no se envían automáticamente. Necesitas una de estas soluciones:

**Opción A: Supabase Cron Extension (Recomendado)**

```sql
-- En Supabase SQL, crear una función que procese la queue
CREATE OR REPLACE FUNCTION process_email_queue()
RETURNS void AS $$
BEGIN
  -- Implementar lógica de envío
  -- Por ahora, solo marca como procesadas
  UPDATE email_notifications 
  SET sent_at = NOW()
  WHERE sent_at IS NULL AND retry_count < 3;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar cada 5 minutos con cron extension
SELECT cron.schedule('process-emails', '*/5 * * * *', 'SELECT process_email_queue()');
```

**Opción B: Edge Function de Supabase**

Crear en `supabase/functions/process-emails/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Obtener emails pendientes
  const { data: pendingEmails } = await supabase
    .from('email_notifications')
    .select('*')
    .is('sent_at', null)
    .lt('retry_count', 3)
    .limit(10)

  // Aquí iría la lógica de envío real (usar SendGrid, etc.)
  
  // Marcar como enviados
  for (const email of pendingEmails || []) {
    await supabase
      .from('email_notifications')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', email.id)
  }

  return new Response('OK')
})
```

**Opción C: Webhook Externo**

Configurar un servicio externo (Make, Zapier, etc.) para procesar la queue cada 5 minutos.

---

## Fase 4: Testing End-to-End

### Test 1: Password Forzado en Primer Login ✓

1. Crear usuario nuevo en Supabase Auth Dashboard
2. Ir a la aplicación y hacer login con ese usuario
3. ✅ Debe aparecer modal de cambio de contraseña
4. ✅ No se puede cerrar ni navegar
5. ✅ Ingresar contraseña válida
6. ✅ Click en "Cambiar Contraseña"
7. ✅ Modal desaparece, acceso a app concedido
8. ✅ Debe recibir email de confirmación

### Test 2: Exclusión de Usuario de Analytics ✓

1. Ir a Admin → User Manager
2. Buscar usuario de testing/ventas
3. Click en checkbox "Excluir de Analytics"
4. Ingresar razón: "Usuario de testing"
5. ✅ Usuario marcado como excluido
6. ✅ Usuario recibe email de notificación
7. ✅ Reproductoras del usuario NO aparecen en analytics

### Test 3: Analytics Dashboard ✓

1. Ir a Admin → Analytics
2. Verificar todas las tabs funcionan:
   - [x] Resumen Clásico - Debe mostrar tabla con plays
   - [x] Top Canciones - Debe mostrar gráfico bar + tabla
   - [x] Top Usuarios - Debe mostrar tabla de usuarios
   - [x] Tendencias Diarias - Gráfico de línea
   - [x] Tendencias Mensuales - Gráfico de barras
   - [x] Por Ubicación - Tabla con locales
   - [x] Por Cuenta - Gráfico pie
   - [x] Excluidos (Regalías) - Tabla con usuarios excluidos
3. ✅ Botón CSV Daily - Descargar CSV
4. ✅ Botón CSV Canciones - Descargar CSV
5. ✅ Botón CSV Locales - Descargar CSV
6. ✅ Botón JSON - Descargar JSON

### Test 4: Verificar que Usuarios Excluidos NO Cuentan ✓

```javascript
// En browser console:
const data1 = await supabase.from('play_history').select('*').eq('user_id', EXCLUDED_USER_ID);
console.log('Play history (sin filtro):', data1.data.length); // 100 plays

const data2 = await supabase.from('analytics_top_songs').select('*');
console.log('Top songs (con filtro):', data2.data); // No incluye plays del usuario excluido

// ✅ El usuario excluido NO debe aparecer en ningún total
```

---

## Fase 5: Verificación Pre-Producción

### Checklist de Seguridad

- [ ] RLS policies aplicadas correctamente
  ```sql
  SELECT * FROM pg_policies WHERE schemaname = 'public';
  ```

- [ ] Usuarios no pueden modificar su propio exclude_from_analytics
  - Intentar desde cliente (debe fallar por RLS)

- [ ] Email templates no exponen data sensible
  - Revisar variables en cada template

- [ ] Password change es requerido (no saltable)
  - Modal tiene disableEscapeKeyDown = true
  - No hay botón cancelar

### Checklist de Performance

- [ ] Índices creados en tablas analytics
  ```sql
  SELECT indexname FROM pg_indexes WHERE tablename = 'play_history';
  ```

- [ ] Vistas analytics son rápidas (< 500ms)
  - Probar desde Analytics tab

- [ ] No hay N+1 queries en React components
  - Usar React DevTools Profiler

### Checklist de Data Integrity

- [ ] Total plays en analytics = Total en play_history - plays de usuarios excluidos
- [ ] Ningún usuario excluido aparece en reportes
- [ ] Exportación CSV/JSON incluye datos correctos

---

## Fase 6: Deploy a Producción

### Paso 6.1: Backup de Database

```sql
-- En Supabase, ir a Backups y hacer un manual backup antes de cambios
```

### Paso 6.2: Deploy Scripts SQL (Ya Hecho)

✅ Scripts ejecutados en Supabase SQL Editor

### Paso 6.3: Deploy React Components

```bash
# En tu proyecto local:
git add src/components/ForcePasswordChangeModal.jsx
git add src/components/admin/AnalyticsDashboard.jsx
git add src/App.jsx  # (si modificaste)
git commit -m "feat: Agregar 4 mejoras - password forzado, exclusión analytics, emails, dashboard mejorado"
git push origin main
```

### Paso 6.4: Deploy a Hosting

```bash
# Si usas Vercel:
vercel --prod

# Si usas Netlify:
netlify deploy --prod

# Si usas otro hosting, seguir sus instrucciones
```

### Paso 6.5: Monitoreo Post-Deploy

```javascript
// En aplicación, verificar:
1. Modal de password aparece para usuarios nuevos
2. Emails se envían (revisar email_notifications tabla)
3. Analytics dashboard carga sin errores
4. Usuarios excluidos no aparecen en reportes
```

---

## ⚠️ Troubleshooting

### Problema: Modal no aparece en login

**Solución:**
```jsx
// Verificar que ForcePasswordChangeModal está en App.jsx
// Verificar que session es pasado correctamente
// Verificar que user_needs_password_change() RPC existe
```

### Problema: Emails no se envían

**Solución:**
```sql
-- Verificar que table email_notifications tiene datos
SELECT COUNT(*) FROM email_notifications;

-- Verificar que hay un proceso enviando emails
-- (Necesitas implementar la función/edge function de envío)
```

### Problema: Analytics queries son lentas

**Solución:**
```sql
-- Verificar índices están creados
SELECT indexname FROM pg_indexes WHERE tablename = 'play_history';

-- Crear índices faltantes
CREATE INDEX idx_play_history_date ON play_history(played_at DESC);
CREATE INDEX idx_play_history_user ON play_history(user_id);
CREATE INDEX idx_play_history_exclude ON user_profiles(exclude_from_analytics);
```

### Problema: RLS impide acceso a datos

**Solución:**
```sql
-- Verificar RLS policies
SELECT * FROM pg_policies WHERE tablename = 'email_notifications';

-- Verificar role del usuario actual
SELECT current_user, current_role;
```

---

## 📞 Support

Si encuentras problemas:

1. Revisar logs en Supabase dashboard
2. Revisar browser console para errores React
3. Ejecutar verificaciones SQL en Supabase SQL Editor
4. Revisar RLS policies en Supabase Auth

---

## ✅ Checklist Final de Implementación

- [ ] Fase 1: Scripts SQL ejecutados y verificados
- [ ] Fase 2: React components integrados
- [ ] Fase 3: Email notifications configurado
- [ ] Fase 4: Testing E2E completado
- [ ] Fase 5: Pre-producción verificado
- [ ] Fase 6: Deploy completado

**Estimado de Tiempo:** 2-4 horas (con testing)

**Complejidad:** Media-Alta (principalmente SQL + React integration)

**Riesgo:** Bajo (cambios aislados, con RLS protection)

---

**Última Actualización:** Febrero 2026
