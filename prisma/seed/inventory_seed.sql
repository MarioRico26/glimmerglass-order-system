-- prisma/seed/inventory_seed.sql
-- Requiere pgcrypto para gen_random_uuid()
create extension if not exists pgcrypto;

begin;

-- 1) FactoryLocation (si no existen)
insert into "FactoryLocation" ("id","name","active","createdAt")
values
  (gen_random_uuid(), 'Fort Plain', true, now()),
  (gen_random_uuid(), 'Ashburn', true, now())
on conflict ("name") do update
set "active" = true;

-- 2) InventoryLocation (SOLO estas dos, sin "Main Warehouse" de regalo)
-- Las marcamos como FACTORY y las linkeamos a FactoryLocation
insert into "InventoryLocation" ("id","name","type","factoryLocationId","active","createdAt")
select gen_random_uuid(), f."name", 'FACTORY', f."id", true, now()
from "FactoryLocation" f
where f."name" in ('Fort Plain','Ashburn')
on conflict ("name") do update
set
  "type" = excluded."type",
  "factoryLocationId" = excluded."factoryLocationId",
  "active" = true;

-- (Opcional) apaga cualquier location vieja que no sea estas dos
update "InventoryLocation"
set "active" = false
where "name" not in ('Fort Plain','Ashburn');

-- 3) Categories con sortOrder como Excel
-- Nota: esto asume que ya agregaste InventoryCategory.sortOrder y migraste.
insert into "InventoryCategory" ("id","name","sortOrder","active","createdAt")
values
  (gen_random_uuid(), 'PIGMENT', 10, true, now()),
  (gen_random_uuid(), 'RESIN', 20, true, now()),
  (gen_random_uuid(), 'CHOP/ GUN ROVING', 30, true, now()),
  (gen_random_uuid(), 'ACETONE', 40, true, now()),
  (gen_random_uuid(), 'MOLD RELEASE', 50, true, now()),
  (gen_random_uuid(), 'BUFFING COMPOUND', 60, true, now()),
  (gen_random_uuid(), 'CATALYST', 70, true, now()),
  (gen_random_uuid(), 'HONEYCOMB', 80, true, now()),
  (gen_random_uuid(), 'COMBO MAT', 90, true, now()),
  (gen_random_uuid(), 'GELCOAT', 100, true, now())
on conflict ("name") do update
set "active" = true;

-- helper: get category id by name
-- 4) Items (SKU + name + unit + categoryId + sortOrder)
--    sortOrder aqui respeta exactamente el orden dentro de cada bloque.
with cat as (
  select "id","name" from "InventoryCategory"
),
ins as (
  select * from (values
    -- PIGMENT
    ('643537','Gray pigment','5 Gal Pail','PIGMENT',10),
    ('692825','Blue pigment','5 Gal Pail','PIGMENT',20),

    -- RESIN
    ('626607','GP Resin','Drum','RESIN',10),
    ('839520','VE resin','Drum','RESIN',20),

    -- CHOP/ GUN ROVING
    ('557069','Gun Roving','Rolls','CHOP/ GUN ROVING',10),

    -- ACETONE
    ('40001','Acetone','Drum','ACETONE',10),

    -- MOLD RELEASE
    ('518121','Frekote WOLO','1 Gal Can','MOLD RELEASE',10),
    ('508879','Axel Mold Cleaner','1 Gal Can','MOLD RELEASE',20),

    -- BUFFING COMPOUND
    ('667281','Aqua Blue buffing compound','5 Gal Pail','BUFFING COMPOUND',10),
    ('51517','Aqua Buff 2000','2 Gal Pail','BUFFING COMPOUND',20),
    ('103630','offset to Aqua Buff (LOWER COST)','5 Gal Pail','BUFFING COMPOUND',30),

    -- CATALYST
    ('82001','L-50A clear','1 Gal Jug','CATALYST',10),
    ('531575','L-30A clear','1 Gal Jug','CATALYST',20),
    ('529701','L-50A vanishing red','1 Gal Jug','CATALYST',30),

    -- HONEYCOMB
    ('618036','1 inch honeycomb','384 sf Case','HONEYCOMB',10),
    ('617745','1/2 inch honeycomb','768 sf Case','HONEYCOMB',20),

    -- COMBO MAT
    ('699430','Combo Mat','Rolls','COMBO MAT',10),

    -- GELCOAT
    ('639819','WHITE','Drum','GELCOAT',10),
    ('697686','ARCTIC WHITE','Drum','GELCOAT',20),
    ('698666','GLACIER','Drum','GELCOAT',30),
    ('697688','STEEL','Drum','GELCOAT',40),
    ('697689','MIDNIGHT','Drum','GELCOAT',50),
    ('696937','OCEAN','Drum','GELCOAT',60),
    ('697685','COASTAL BRONZE','Drum','GELCOAT',70),
    ('850044','SAPPHIRE','Drum','GELCOAT',80)
  ) as t(sku,name,unit,catName,sortOrder)
)
insert into "InventoryItem" ("id","sku","name","unit","categoryId","sortOrder","active","minStock","createdAt")
select
  gen_random_uuid(),
  ins.sku,
  ins.name,
  ins.unit,
  cat."id",
  ins.sortOrder,
  true,
  0,
  now()
from ins
join cat on cat."name" = ins.catName
on conflict ("sku") do update
set
  "name" = excluded."name",
  "unit" = excluded."unit",
  "categoryId" = excluded."categoryId",
  "sortOrder" = excluded."sortOrder",
  "active" = true;

-- 5) Stocks: crea fila item x location (onHand 0)
insert into "InventoryStock" ("id","itemId","locationId","onHand")
select gen_random_uuid(), i."id", l."id", 0
from "InventoryItem" i
cross join "InventoryLocation" l
where l."active" = true
on conflict ("itemId","locationId") do nothing;

commit;