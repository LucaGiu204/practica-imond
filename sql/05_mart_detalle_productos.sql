-- =====================================================================
-- MART 5: Detalle de productos para filtros del dashboard web
-- =====================================================================
-- Granularidad: una línea de producto por pedido válido.
-- Esta Mart permite cruzar producto con fecha, canal y provincia,
-- y vincular el pedido completo SIN duplicar la facturación.
-- La web filtra pedidos de mart_ventas a través de order_id.

CREATE TABLE mart_detalle_productos AS
SELECT
    i.order_item_id,
    i.order_id,
    d.full_date AS fecha,
    d.year_month AS mes,
    c.name AS canal,
    COALESCE(prov.name, 'Sin provincia') AS provincia,
    p.name AS producto,
    i.quantity AS unidades,
    i.line_total AS ventas_producto
FROM fact_sales_order_item AS i
INNER JOIN dim_date AS d ON d.date_key = i.date_key
INNER JOIN dim_channel AS c ON c.channel_key = i.channel_key
LEFT JOIN dim_province AS prov ON prov.province_key = i.province_key
INNER JOIN dim_product AS p ON p.product_key = i.product_key
WHERE i.status IN ('PAID', 'FULFILLED');
