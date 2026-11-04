
-- KPIs DE VENTAS PARA EL DASHBOARD


CREATE TABLE mart_kpi_ventas AS

WITH productos_pedido AS (
    SELECT DISTINCT
        order_id,
        producto
    FROM mart_detalle_productos
),

ventas_producto AS (
    -- Pedidos sin filtro de producto
    SELECT
        v.*,
        'Todos' AS producto
    FROM mart_ventas AS v

    UNION ALL

    -- Pedidos que contienen cada producto
    SELECT
        v.*,
        p.producto
    FROM mart_ventas AS v
    INNER JOIN productos_pedido AS p
        ON v.order_id = p.order_id
),

ventas_periodo AS (
    -- Período completo
    SELECT *, 'Todo' AS periodo
    FROM ventas_producto

    UNION ALL

    -- Por año
    SELECT *, LEFT(mes, 4) AS periodo
    FROM ventas_producto

    UNION ALL

    -- Por mes
    SELECT *, mes AS periodo
    FROM ventas_producto
)

SELECT
    periodo,

    CASE
        WHEN GROUPING(canal) = 1 THEN 'Todos'
        ELSE canal
    END AS canal,

    CASE
        WHEN GROUPING(provincia) = 1 THEN 'Todas'
        ELSE provincia
    END AS provincia,

    producto,

    COUNT(*) AS pedidos,

    SUM(ventas_con_iva) AS ventas_con_iva,
    SUM(ventas_sin_iva) AS ventas_sin_iva,

    ROUND(
        SUM(ventas_con_iva) / NULLIF(COUNT(*), 0), 2
    ) AS ticket_con_iva,

    ROUND(
        SUM(ventas_sin_iva) / NULLIF(COUNT(*), 0), 2
    ) AS ticket_sin_iva

FROM ventas_periodo

GROUP BY
    periodo,
    producto,
    CUBE(canal, provincia);


