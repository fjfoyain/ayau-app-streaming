# AYAU Music Streaming

Plataforma de streaming de música con tracking preciso de reproducción para cálculo de regalías.

## 🎯 Stack Tecnológico

- **Frontend**: React 19 + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Storage**: Cloudflare R2
- **Deploy**: Vercel

## 📊 Características Principales

### Sistema de Regalías
- Tracking exacto de segundos reproducidos por canción
- Validación automática de streams (>30 segundos = válido)
- Reportes mensuales, anuales y por país
- Soporte para códigos ISRC, ISWC, IPI

### Multi-Tenant
- Clientes → Locales → Usuarios
- Control centralizado de reproducción (broadcasting)
- Modo independiente por local

### Analytics
- Total de segundos reproducidos por canción
- Listeners únicos
- Distribución geográfica
- Reportes por cliente y por local

## 🚀 Setup Local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Ya existe un archivo `.env.local` con las credenciales de Supabase.

### 3. Ejecutar en desarrollo

```bash
npm run dev
```

### 4. Base de Datos

El schema completo está en `supabase-schema-reportes.sql` y ya fue ejecutado en Supabase.

## 📁 Estructura del Proyecto

```
ayau-app/
├── src/
│   ├── lib/
│   │   └── supabase.js          # Cliente de Supabase
│   ├── services/
│   │   └── supabase-api.js      # Funciones de API
│   ├── App.jsx                  # Componente principal
│   ├── main.jsx                 # Entry point
│   └── index.css                # Estilos globales
├── supabase-schema-reportes.sql # Schema de BD
├── PLAN-IMPLEMENTACION.md       # Plan de implementación
├── TRACKING-REPRODUCCION.md     # Guía de tracking
└── package.json
```

## 📋 Roadmap

- [x] Fase 1: Setup de Supabase
- [x] Fase 2: Configuración local
- [ ] Fase 3: Admin Panel (drag & drop, CSV import)
- [ ] Fase 4: Frontend (Auth + Tracking)
- [ ] Fase 5: Testing
- [ ] Fase 6: Deploy a Vercel

## 📚 Documentación

- [Plan de Implementación](PLAN-IMPLEMENTACION.md)
- [Tracking de Reproducción](TRACKING-REPRODUCCION.md)
- [Schema de Base de Datos](supabase-schema-reportes.sql)

## 💰 Costos Estimados

- Supabase: $0/mes (Free tier)
- Cloudflare R2: ~$1-2/mes
- Vercel: $0/mes (Free tier)

**Total**: ~$2/mes (vs $50-200/mes en AWS)

---

Desarrollado por AYAU 🎵
