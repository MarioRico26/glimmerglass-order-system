# Glimmerglass Order System - Architecture & Flow Diagrams

Reference date: **2026-02-17**

## 1) System context

```mermaid
flowchart LR
  Dealer["Dealer Portal User"]
  Admin["Admin / Operations User"]
  SuperAdmin["SuperAdmin User"]
  System["Glimmerglass Order System (Next.js Monolith)"]
  DB["PostgreSQL (Neon)"]
  Blob["Vercel Blob Storage"]
  Auth["NextAuth (sessions + roles)"]

  Dealer -->|"Create orders, in-stock, history"| System
  Admin -->|"Order ops, media, pool stock, inventory"| System
  SuperAdmin -->|"User governance"| System
  System --> Auth
  System --> DB
  System --> Blob
```

## 2) Internal monolith blocks

```mermaid
flowchart TB
  UI["App Router UI (Admin/Dealer/Auth)"]
  API["Route Handlers / Server Actions"]
  Domain["Domain Rules (orderFlow, validations, guards)"]
  Prisma["Prisma Client"]
  Neon["PostgreSQL (Neon)"]
  Blob["Blob Storage"]
  Notify["Notifications"]

  UI --> API
  API --> Domain
  API --> Prisma
  Prisma --> Neon
  API --> Blob
  API --> Notify
```

## 3) Domain map (high level)

```mermaid
erDiagram
  USER ||--o| DEALER : "profile-link"
  DEALER ||--o{ ORDER : "places"
  ORDER ||--o{ ORDER_HISTORY : "has"
  ORDER ||--o{ ORDER_MEDIA : "has"
  ORDER }o--|| POOL_MODEL : "selects"
  ORDER }o--|| COLOR : "selects"
  ORDER }o--o| FACTORY_LOCATION : "assigned_to"

  FACTORY_LOCATION ||--o{ POOL_STOCK : "has"
  POOL_MODEL ||--o{ POOL_STOCK : "has"
  COLOR ||--o{ POOL_STOCK : "optional color"
  POOL_STOCK ||--o{ POOL_STOCK_TXN : "movement_log"
  ORDER ||--o{ POOL_STOCK_TXN : "reference_order"

  INVENTORY_CATEGORY ||--o{ INVENTORY_ITEM : "contains"
  INVENTORY_LOCATION ||--o{ INVENTORY_STOCK : "holds"
  INVENTORY_ITEM ||--o{ INVENTORY_STOCK : "quantity_by_location"
  INVENTORY_ITEM ||--o{ INVENTORY_TXN : "movement_log"
  INVENTORY_LOCATION ||--o{ INVENTORY_TXN : "movement_log"
  USER ||--o{ INVENTORY_TXN : "actor"
```

## 4) Main order lifecycle

```mermaid
flowchart TD
  A["Dealer: New Order"] --> B["Upload initial payment proof (required)"]
  B --> C["Order created: PENDING_PAYMENT_APPROVAL"]
  C --> D["Admin review + stage requirements"]
  D --> E{"IN_PRODUCTION requirements met?"}
  E -- "No" --> D
  E -- "Yes" --> F["Status -> IN_PRODUCTION"]
  F --> G["Upload BUILD_SHEET + POST_PRODUCTION_MEDIA"]
  G --> H["Set serial number"]
  H --> I{"PRE_SHIPPING requirements met?"}
  I -- "No" --> G
  I -- "Yes" --> J["Status -> PRE_SHIPPING"]
  J --> K["Upload shipping/final docs"]
  K --> L{"COMPLETED requirements met?"}
  L -- "No" --> K
  L -- "Yes" --> M["Status -> COMPLETED"]
```

## 5) Status gates

```mermaid
stateDiagram-v2
  [*] --> PENDING_PAYMENT_APPROVAL
  PENDING_PAYMENT_APPROVAL --> IN_PRODUCTION: "PROOF_OF_PAYMENT + QUOTE + INVOICE"
  IN_PRODUCTION --> PRE_SHIPPING: "BUILD_SHEET + POST_PRODUCTION_MEDIA + serialNumber"
  PRE_SHIPPING --> COMPLETED: "SHIPPING_CHECKLIST + PRE_SHIPPING_MEDIA + BILL_OF_LADING + PROOF_OF_FINAL_PAYMENT + PAID_INVOICE + serialNumber"
  PENDING_PAYMENT_APPROVAL --> CANCELED
  IN_PRODUCTION --> CANCELED
  PRE_SHIPPING --> CANCELED
  COMPLETED --> [*]
  CANCELED --> [*]
```

## 6) Finished pool stock flow

```mermaid
flowchart TD
  A["Admin Pool Stock Console"] --> B["Create or adjust PoolStock row"]
  B --> C["Log movement: ADD/ADJUST/RESERVE/RELEASE/SHIP"]
  C --> D["Dealer In-Stock view (READY rows)"]
  D --> E["Dealer selects model in New Order"]
  E --> F{"READY stock exists?"}
  F -- "Yes" --> G["Show immediate availability badge"]
  F -- "No" --> H["No immediate stock message"]
```

## 7) Material/supplies inventory flow

```mermaid
flowchart TD
  A["Admin defines Category + Item"] --> B["Set active/inactive, minStock, sortOrder"]
  B --> C["Track stock by location"]
  C --> D["Record IN/OUT/ADJUST transactions"]
  D --> E["Daily reorder sheet by location/date"]
  E --> F["Reorder lines: onHand + qtyToOrder"]
```

## 8) Files visibility flow

```mermaid
flowchart LR
  AdminUpload["Admin uploads docs/media"] --> Save["OrderMedia (docType, visibleToDealer)"]
  DealerUpload["Dealer uploads initial payment proof"] --> OrderField["Order.paymentProofUrl"]
  Save --> AdminView["Admin: full media set"]
  Save --> DealerView["Dealer: only visibleToDealer=true"]
  OrderField --> Gate["Status gate counts initial proof"]
```

## 9) Blueprint marker flow

```mermaid
flowchart TD
  A["Dealer New Order blueprint"] --> B["Click markers (x,y,type)"]
  B --> C["Store in Order.blueprintMarkers JSON"]
  C --> D["Dealer Order History: Blueprint Markers card"]
  C --> E["Admin Order History: Blueprint Markers card"]
```
