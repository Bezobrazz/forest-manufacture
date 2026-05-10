-- Єдиний глобальний queue_rank: спочатку локальні планові (0..L-1), потім CRM (L..).
-- Раніше локальні та CRM мали незалежні 0.. та дубльовались при злитті.

UPDATE public.crm_orders AS o
SET queue_rank = o.queue_rank + COALESCE(
  (SELECT COUNT(*)::integer FROM public.shipment_planning_orders),
  0
);
