-- =========================
-- LOCATIONS
-- =========================
insert into "InventoryLocation" (id, name, type, active)
values
(gen_random_uuid(), 'Fort Plain', 'FACTORY', true),
(gen_random_uuid(), 'Ashburn', 'FACTORY', true)
on conflict (name) do nothing;

-- =========================
-- CATEGORIES
-- =========================
insert into "InventoryCategory" (id, name)
values
(gen_random_uuid(), 'PIGMENT'),
(gen_random_uuid(), 'RESIN'),
(gen_random_uuid(), 'CHOP / GUN ROVING'),
(gen_random_uuid(), 'ACETONE'),
(gen_random_uuid(), 'MOLD RELEASE'),
(gen_random_uuid(), 'BUFFING COMPOUND'),
(gen_random_uuid(), 'CATALYST'),
(gen_random_uuid(), 'HONEYCOMB'),
(gen_random_uuid(), 'COMBO MAT'),
(gen_random_uuid(), 'GELCOAT')
on conflict (name) do nothing;

-- =========================
-- ITEMS
-- =========================

-- PIGMENT
insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'643537','Gray pigment','5 Gal Pail',c.id,1 from "InventoryCategory" c where c.name='PIGMENT'
on conflict (sku) do nothing;

insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'692825','Blue pigment','5 Gal Pail',c.id,2 from "InventoryCategory" c where c.name='PIGMENT'
on conflict (sku) do nothing;

-- RESIN
insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'626607','GP Resin','Drum',c.id,1 from "InventoryCategory" c where c.name='RESIN'
on conflict (sku) do nothing;

insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'839520','VE Resin','Drum',c.id,2 from "InventoryCategory" c where c.name='RESIN'
on conflict (sku) do nothing;

-- CHOP / GUN ROVING
insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'557069','Gun roving','Rolls',c.id,1 from "InventoryCategory" c where c.name='CHOP / GUN ROVING'
on conflict (sku) do nothing;

-- ACETONE
insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'40001','Acetone','Drum',c.id,1 from "InventoryCategory" c where c.name='ACETONE'
on conflict (sku) do nothing;

-- MOLD RELEASE
insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'518121','Frekote WOLO','1 Gal Can',c.id,1 from "InventoryCategory" c where c.name='MOLD RELEASE'
on conflict (sku) do nothing;

insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'508879','Axel Mold Cleaner','1 Gal Can',c.id,2 from "InventoryCategory" c where c.name='MOLD RELEASE'
on conflict (sku) do nothing;

-- BUFFING COMPOUND
insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'667281','Aqua Blue buffing compound','5 Gal Pail',c.id,1 from "InventoryCategory" c where c.name='BUFFING COMPOUND'
on conflict (sku) do nothing;

insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'51517','Aqua Buff 2000','2 Gal Pail',c.id,2 from "InventoryCategory" c where c.name='BUFFING COMPOUND'
on conflict (sku) do nothing;

insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'103630','Offset to Aqua Buff (lower cost)','5 Gal Pail',c.id,3 from "InventoryCategory" c where c.name='BUFFING COMPOUND'
on conflict (sku) do nothing;

-- CATALYST
insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'82001','L-50A clear','1 Gal Jug',c.id,1 from "InventoryCategory" c where c.name='CATALYST'
on conflict (sku) do nothing;

insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'531575','L-30A clear','1 Gal Jug',c.id,2 from "InventoryCategory" c where c.name='CATALYST'
on conflict (sku) do nothing;

insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'529701','L-50A vanishing red','1 Gal Jug',c.id,3 from "InventoryCategory" c where c.name='CATALYST'
on conflict (sku) do nothing;

-- HONEYCOMB
insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'618036','1 inch honeycomb','384 sf Case',c.id,1 from "InventoryCategory" c where c.name='HONEYCOMB'
on conflict (sku) do nothing;

insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'617745','1/2 inch honeycomb','768 sf Case',c.id,2 from "InventoryCategory" c where c.name='HONEYCOMB'
on conflict (sku) do nothing;

-- COMBO MAT
insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'699430','Combo Mat','Rolls',c.id,1 from "InventoryCategory" c where c.name='COMBO MAT'
on conflict (sku) do nothing;

-- GELCOAT
insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'639819','White gelcoat','Drum',c.id,1 from "InventoryCategory" c where c.name='GELCOAT'
on conflict (sku) do nothing;

insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'697686','Arctic White','Drum',c.id,2 from "InventoryCategory" c where c.name='GELCOAT'
on conflict (sku) do nothing;

insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'698666','Glacier','Drum',c.id,3 from "InventoryCategory" c where c.name='GELCOAT'
on conflict (sku) do nothing;

insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'697688','Steel','Drum',c.id,4 from "InventoryCategory" c where c.name='GELCOAT'
on conflict (sku) do nothing;

insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'697689','Midnight','Drum',c.id,5 from "InventoryCategory" c where c.name='GELCOAT'
on conflict (sku) do nothing;

insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'696937','Ocean','Drum',c.id,6 from "InventoryCategory" c where c.name='GELCOAT'
on conflict (sku) do nothing;

insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'697685','Coastal Bronze','Drum',c.id,7 from "InventoryCategory" c where c.name='GELCOAT'
on conflict (sku) do nothing;

insert into "InventoryItem"(id, sku, name, unit, "categoryId", "sortOrder")
select gen_random_uuid(),'850044','Sapphire','Drum',c.id,8 from "InventoryCategory" c where c.name='GELCOAT'
on conflict (sku) do nothing;