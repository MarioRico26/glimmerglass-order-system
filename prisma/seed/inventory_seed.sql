-- LOCATIONS
insert into "InventoryLocation" (id, name, type, active)
values
(gen_random_uuid(), 'Fort Plain', 'FACTORY', true),
(gen_random_uuid(), 'Ashburn', 'FACTORY', true)
on conflict (name) do nothing;

-- CATEGORIES
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

-- ITEMS (ejemplo parcial, seguís el patrón)
insert into "InventoryItem"
(id, sku, name, unit, "categoryId", "sortOrder")
select
gen_random_uuid(),
'643537',
'Gray pigment',
'5 Gal Pail',
c.id,
1
from "InventoryCategory" c where c.name='PIGMENT'
on conflict (sku) do nothing;

insert into "InventoryItem"
(id, sku, name, unit, "categoryId", "sortOrder")
select
gen_random_uuid(),
'692825',
'Blue pigment',
'5 Gal Pail',
c.id,
2
from "InventoryCategory" c where c.name='PIGMENT'
on conflict (sku) do nothing;