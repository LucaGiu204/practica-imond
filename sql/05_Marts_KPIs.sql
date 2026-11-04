-- =====================================================================
-- 05_Marts_KPIs.sql - Data Marts de indicadores para el dashboard
-- =====================================================================
-- Objetivo:
--   Calcular los KPIs y sus combinaciones de filtros en SQL,
--   evitando realizar cálculos de negocio en JavaScript.

-- KPIs DE VENTAS PARA EL DASHBOARD

CREATE TABLE mart_kpi_ventas AS

WITH productos_pedido AS (  --WITH genera una tabla temporal para usar en esta única consulta
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
        WHEN GROUPING(canal) = 1 THEN 'Todos' --GROUPING devuelve un booleano 0/1 
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
    CUBE(canal, provincia); -- calcula todas las posibles combinaciones de agrupación


-- KPI: NPS y distribución de respuestas

CREATE TABLE mart_kpi_nps AS

WITH periodos AS (
    -- Período completo
    SELECT
        'Todo' AS periodo,
        canal,
        categoria_nps
    FROM mart_nps

    UNION ALL

    -- Por año
    SELECT
        LEFT(mes, 4) AS periodo,
        canal,
        categoria_nps
    FROM mart_nps

    UNION ALL

    -- Por mes
    SELECT
        mes AS periodo,
        canal,
        categoria_nps
    FROM mart_nps
)

SELECT
    periodo,

    CASE
        WHEN GROUPING(canal) = 1 THEN 'Todos'
        ELSE canal
    END AS canal,

    COUNT(*) AS respuestas,

    COUNT(*) FILTER (
        WHERE categoria_nps = 'Promotores'
    ) AS promotores,

    COUNT(*) FILTER (
        WHERE categoria_nps = 'Pasivos'
    ) AS pasivos,

    COUNT(*) FILTER (
        WHERE categoria_nps = 'Detractores'
    ) AS detractores,

    -- NPS
    ROUND(
        (
            COUNT(*) FILTER (
                WHERE categoria_nps = 'Promotores'
            )
            -
            COUNT(*) FILTER (
                WHERE categoria_nps = 'Detractores'
            )
        ) * 100.0 / NULLIF(COUNT(*), 0),
        4
    ) AS nps,

    -- Porcentajes para el gráfico de satisfacción
    ROUND(
        COUNT(*) FILTER (
            WHERE categoria_nps = 'Promotores'
        ) * 100.0 / NULLIF(COUNT(*), 0),
        4
    ) AS porcentaje_promotores,

    ROUND(
        COUNT(*) FILTER (
            WHERE categoria_nps = 'Pasivos'
        ) * 100.0 / NULLIF(COUNT(*), 0),
        4
    ) AS porcentaje_pasivos,

    ROUND(
        COUNT(*) FILTER (
            WHERE categoria_nps = 'Detractores'
        ) * 100.0 / NULLIF(COUNT(*), 0),
        4
    ) AS porcentaje_detractores

FROM periodos

GROUP BY
    periodo,
    CUBE(canal);



-- KPI 3: Usuarios activos

CREATE TABLE mart_kpi_usuarios AS

WITH periodos AS (
    -- Período completo
    SELECT
        'Todo' AS periodo,
        usuario_analitico_id
    FROM mart_actividad_web

    UNION ALL

    -- Por año
    SELECT
        LEFT(mes, 4) AS periodo,
        usuario_analitico_id
    FROM mart_actividad_web

    UNION ALL

    -- Por mes
    SELECT
        mes AS periodo,
        usuario_analitico_id
    FROM mart_actividad_web
)

SELECT
    periodo,
    COUNT(DISTINCT usuario_analitico_id) AS usuarios_activos

FROM periodos

GROUP BY periodo
ORDER BY periodo;
