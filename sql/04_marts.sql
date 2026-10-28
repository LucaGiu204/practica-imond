-- =====================================================
-- 04_marts.sql - Data Marts para Power BI
-- =====================================================
-- Materializacion de indicadores calculados desde el DW.
-- Los Data Marts consumen las dimensiones y hechos,
-- sin consultar directamente los archivos RAW.


-- MART 1: Ventas
-- Acá se consiguen las ventas totales por provincia y canal, con y sin IVA, para cada pedido.

CREATE TABLE mart_ventas AS
SELECT
    o.order_id,
    CAST(o.order_date AS DATE) AS fecha,
    d.year_month AS mes,
    c.name AS canal,
    COALESCE(p.name, 'Sin provincia') AS provincia,
    o.total_amount AS ventas_con_iva,
    o.total_amount - o.tax_amount AS ventas_sin_iva
FROM fact_sales_order AS o
INNER JOIN dim_date AS d
    ON o.date_key = d.date_key
INNER JOIN dim_channel AS c
    ON o.channel_key = c.channel_key
LEFT JOIN dim_province AS p
    ON o.province_key = p.province_key
WHERE o.status IN ('PAID', 'FULFILLED');




