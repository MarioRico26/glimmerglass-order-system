# Glimmerglass Order System — ArchiMate Reference

> Documento de referencia para el modelo ArchiMate. El archivo importable a Archi es `glimmerglass-architecture.xml`.

---

## Vistas incluidas

| # | Vista | Propósito |
|---|-------|-----------|
| 00 | System Context | Actores externos, el sistema, servicios externos |
| 01 | Business Process View | Roles, procesos de negocio, ciclo de vida de órdenes |
| 02 | Application Layer | Componentes, servicios e interfaces de la aplicación |
| 03 | Technology Layer | Infraestructura: Vercel, Neon, Blob, SMTP |
| 04 | Domain Data Model | Entidades de datos y sus relaciones (Prisma schema) |

---

## Capa de Negocio (Business Layer)

### Actores y Roles

| Actor | Rol | Descripción |
|-------|-----|-------------|
| Admin | ADMIN | Staff interno. Gestiona órdenes, producción, inventario, dealers. |
| Dealer / Distribuidor | DEALER | Distribuidor externo. Crea órdenes, sube comprobantes, sigue estatus. |
| SuperAdmin | SUPERADMIN | Administrador del sistema. Gestiona usuarios y accesos. |

### Procesos de Negocio

#### Ciclo de Vida de la Orden (cadena de Triggering)

```
[Dealer] Crear Orden
    ↓ TRIGGERING
[Admin] Aprobar Pago
    ↓ TRIGGERING
[Admin] Gestión de Producción
    ↓ TRIGGERING
[Admin] Gestión de Envío → COMPLETED
```

#### Estados de la Orden (OrderStatus enum)

```
PENDING_PAYMENT_APPROVAL → IN_PRODUCTION → PRE_SHIPPING → COMPLETED
                                                              ↓
                                                      SERVICE_WARRANTY
PENDING_PAYMENT_APPROVAL / IN_PRODUCTION / PRE_SHIPPING → CANCELED
```

#### Procesos de Soporte

| Proceso | Actor Principal | Descripción |
|---------|----------------|-------------|
| Onboarding de Dealer | Admin + Dealer | Registro, firma de acuerdo, subida de docs fiscales, aprobación. |
| Gestión de Inventario | Admin | Stock de piscinas terminadas + materiales/insumos con reorder sheets. |
| Configurar Workflow de Dealer | Admin | Asigna WorkflowProfile personalizado por dealer con requisitos por estatus. |
| Gestión de Catálogo | Admin | Modelos de piscina, colores, ubicaciones de fábrica. |
| Gestión de Usuarios | SuperAdmin | Crear/editar admins, asignar acceso por módulo (VIEW/EDIT) y fábrica. |
| Notificaciones | Sistema | Alertas automáticas al dealer en cambios de estatus. |

### Objetos de Negocio

| Objeto | Descripción |
|--------|-------------|
| Orden | Entidad central. Pool model, color, estatus, build metadata, serial number. |
| Modelo de Piscina | Diseño de piscina: dimensiones, forma, integración de spa. |
| Color / Finish | Acabados disponibles con swatch. |
| Perfil de Dealer | Info de empresa, estatus de acuerdo, progreso de onboarding. |
| Invoice / Comprobante | Documentos financieros asociados a la orden. |
| Registro de Producción | Equipo, peso de casco, uso de materiales (gel coat, resin, chop). |
| Stock de Piscinas Terminadas | Inventario: READY, RESERVED, IN_PRODUCTION, DAMAGED. |
| Perfil de Workflow | Requisitos personalizados (docs + campos) por estatus por dealer. |
| Inventario de Materiales | Insumos (pigmento, resina, gel coat, chop) por ubicación. |

---

## Capa de Aplicación (Application Layer)

### Componentes Principales

```
Next.js 15 App (monolito)
├── Frontend
│   ├── Admin Portal          → /admin/** (React 19 + Shadcn/UI)
│   └── Dealer Portal         → /dealer/** (React 19 + Shadcn/UI)
│
├── Core Services
│   ├── Auth (NextAuth 4)     → JWT + Credentials, bcryptjs
│   └── RBAC Middleware       → requireRole/requireAdmin + ModuleAccess
│
├── Backend / API Routes
│   ├── Order API             → /api/admin/orders, /api/orders
│   ├── Dealer API            → /api/admin/dealers, /api/dealer
│   ├── Catalog API           → /api/admin/catalog, /api/catalog
│   ├── Inventory API         → /api/admin/inventory
│   ├── Notification Service  → /api/dealer/notifications
│   ├── Audit Logger          → lib/audit.ts (AuditLog table)
│   ├── Workflow Engine       → lib/orderRequirements.ts (status gates)
│   └── Mailer                → lib/mailer.ts (SMTP, password reset)
│
└── Data Layer
    └── Prisma ORM            → lib/prisma.ts (@prisma/adapter-neon)
```

### Servicios de Aplicación

| Servicio | Realizado por | Descripción |
|----------|--------------|-------------|
| Autenticación JWT | Auth (NextAuth) | JWT sessions con rol embebido |
| Gestión de Órdenes | Order API | CRUD, transiciones de estatus, validación de requisitos |
| Carga de Archivos | Order API + Vercel Blob | Docs de órdenes, fotos, acuerdos |
| Notificaciones Dealer | Notification Service | Alertas en tiempo real, unread count, mark-read |
| Control de Acceso (RBAC) | RBAC Middleware | Roles + módulos + fábricas |

### Interfaces de Aplicación

| Interfaz | Tipo | Descripción |
|----------|------|-------------|
| Admin Portal UI | Web UI (React) | SPA para operaciones internas |
| Dealer Portal UI | Web UI (React) | Portal self-service para distribuidores |
| REST API (/api/*) | HTTP/JSON | Todas las rutas de API del sistema |

### Control de Acceso (RBAC)

```
Role: SUPERADMIN
  → Todos los módulos + gestión de usuarios

Role: ADMIN
  → UserModuleAccess: módulos asignados con nivel VIEW o EDIT
  → UserFactoryAccess: restricción por fábrica
  → Módulos: DASHBOARD, ORDER_LIST, NEW_ORDER, PRODUCTION_SCHEDULE,
             SHIP_SCHEDULE, POOL_STOCK, POOL_CATALOG, WORKFLOW_REQUIREMENTS,
             INVENTORY, DEALERS, USERS

Role: DEALER
  → Solo su propia data (órdenes, notificaciones, catálogo)
  → Requiere account approval y agreement firmado
```

---

## Capa de Tecnología (Technology Layer)

### Topología de Deployment

```
┌─────────────────────────────────────────┐
│  Vercel Platform                        │
│  ┌───────────────────────────────────┐  │
│  │  Next.js 15 Runtime               │  │
│  │  (Serverless Functions + CDN)     │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
         │              │           │         │
         ▼              ▼           ▼         ▼
   ┌──────────┐  ┌──────────┐  ┌────────┐  ┌──────┐
   │  Neon    │  │  Vercel  │  │  SMTP  │  │  (CDN│
   │PostgreSQL│  │   Blob   │  │ Server │  │ edge)│
   └──────────┘  └──────────┘  └────────┘  └──────┘
   @neondatabase  @vercel/blob   nodemailer
   /serverless
```

### Servicios de Tecnología

| Servicio | Nodo | Sirve a |
|----------|------|---------|
| Hosting & CDN | Vercel Platform | Next.js App |
| Database Service | Neon PostgreSQL | Prisma ORM |
| File Storage Service | Vercel Blob | Order API (documentos, fotos) |
| Email Service | SMTP Server | Mailer (password reset) |

### Variables de Entorno Requeridas

| Variable | Propósito |
|----------|-----------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Firma de JWT |
| `NEXTAUTH_URL` | URL de callback de auth |
| `BLOB_READ_WRITE_TOKEN` | Acceso a Vercel Blob |
| `SMTP_*` | Configuración del servidor de correo |

---

## Modelo de Datos (Data Layer)

### Dominios y Entidades

#### Dominio: Órdenes
```
Order ──agg──► OrderHistory
         ├──agg──► OrderMedia        (PROOF_OF_PAYMENT, QUOTE, INVOICE,
         │                             BUILD_SHEET, POST_PRODUCTION_MEDIA,
         │                             SHIPPING_CHECKLIST, BOL, etc.)
         ├──agg──► OrderBuildRecord  (+ OrderBuildMaterialUsage)
         ├──ass──► PoolModel
         ├──ass──► Color
         └──ass──► PoolStock ──agg──► PoolStockTxn
```

#### Dominio: Dealers y Usuarios
```
User ──agg──► UserModuleAccess   (módulo + nivel VIEW/EDIT)
     └──agg──► UserFactoryAccess (restricción por FactoryLocation)

Dealer ──ass──► Order
        └──ass──► WorkflowProfile ──agg──► WorkflowProfileRequirementTemplate
```

#### Dominio: Inventario de Materiales
```
InventoryItem ──agg──► InventoryStock  (by InventoryLocation)
               └──agg──► InventoryTxn  (IN/OUT/ADJUST)

InventoryReorderSheet ──agg──► InventoryReorderLine (qty + target por item)
```

#### Notificaciones y Auditoría
```
Notification ──ass──► Order
              └──ass──► Dealer

AuditLog (actor, role, dealer, order, action, meta JSON)
  Acciones: USER_LOGIN, ORDER_CREATED, FILE_UPLOADED,
            AGREEMENT_SIGNED, STATUS_CHANGED, etc.
```

### Enums Clave

| Enum | Valores |
|------|---------|
| `OrderStatus` | PENDING_PAYMENT_APPROVAL, IN_PRODUCTION, PRE_SHIPPING, COMPLETED, SERVICE_WARRANTY, CANCELED |
| `Role` | ADMIN, DEALER, SUPERADMIN |
| `AdminModule` | DASHBOARD, ORDER_LIST, NEW_ORDER, PRODUCTION_SCHEDULE, SHIP_SCHEDULE, POOL_STOCK, POOL_CATALOG, WORKFLOW_REQUIREMENTS, INVENTORY, DEALERS, USERS |
| `OrderDocType` | PROOF_OF_PAYMENT, QUOTE, INVOICE, BUILD_SHEET, POST_PRODUCTION_MEDIA, SHIPPING_CHECKLIST, PRE_SHIPPING_MEDIA, BILL_OF_LADING, PROOF_OF_FINAL_PAYMENT, PAID_INVOICE, OTHER |
| `PoolStockStatus` | READY, RESERVED, IN_PRODUCTION, DAMAGED |
| `BuildMaterialCategory` | GEL_COAT, SKIN_RESIN, BUILD_UP_RESIN, CHOP, OIL |
| `InventoryLocationType` | WAREHOUSE, FACTORY, TRUCK, OTHER |

---

## Decisiones Arquitectónicas Clave

| Decisión | Justificación |
|----------|--------------|
| Monolito Next.js | Deployment simplificado, un solo codebase para API + UI |
| Neon PostgreSQL serverless | Escalabilidad sin gestionar infraestructura, consistencia fuerte para workflows |
| Prisma ORM | Tipo-safety, migraciones automáticas, adapter pattern para Neon |
| NextAuth JWT (stateless) | Rol embebido en token, sin hits extra a DB por sesión |
| Vercel Blob | Storage gestionado para docs/fotos, sin infraestructura S3 propia |
| WorkflowProfiles por dealer | Flexibilidad multi-tenant: requisitos personalizados por cliente |
| Dos sistemas de inventario | Stock terminado (piscinas) separado de materiales/insumos |

---

## Cómo importar en Archi

1. Abrir Archi
2. `File → Import → Open Exchange XML File...`
3. Seleccionar `glimmerglass-architecture.xml`
4. Las 5 vistas aparecerán en el panel de Modelos bajo `Views`
5. Para ajustar layout: arrastrar elementos en cada vista
6. Los colores por capa se pueden configurar en `View → Manage Appearance`
