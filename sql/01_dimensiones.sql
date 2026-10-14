-- =====================================================================
-- 01_dimensiones.sql — Tablas de DIMENSIONES del modelo estrella
-- =====================================================================
-- Para cada dimensión:
--   1. CREATE TABLE con sus columnas, tipos y PRIMARY KEY.
--   2. INSERT INTO ... SELECT para cargarla desde las tablas de origen.
--
-- Las tablas de origen (los CSV de raw/) están en el esquema raw:
--     FROM raw.product
-- Para ver qué columnas y tipos tiene una:  DESCRIBE raw.product;
-- Para explorarlas antes de escribir nada:  python run_sql.py --explorar
-- =====================================================================


-- ---------------------------------------------------------------------
-- EJEMPLO RESUELTO: dimensión producto
-- ---------------------------------------------------------------------
-- En raw/ la categoría está en otra tabla y tiene jerarquía
-- (Bottles -> Classic / Sport). En la dimensión la "aplanamos":
-- cada producto queda en una sola fila con su categoría y su familia.
--
-- product_key es la clave SUBROGADA: un número propio del data warehouse.
-- product_id es la clave NATURAL: el ID que viene del sistema de origen.
-- Las tablas de hechos usan product_key; product_id sirve para encontrarla.

CREATE TABLE dim_product (
    product_key INTEGER PRIMARY KEY,
    product_id  INTEGER NOT NULL,
    sku         VARCHAR NOT NULL,
    name        VARCHAR NOT NULL,
    category    VARCHAR,             -- Classic / Sport
    family      VARCHAR,             -- Bottles
    list_price  DECIMAL(12, 2)
);

INSERT INTO dim_product
SELECT
    ROW_NUMBER() OVER (ORDER BY p.product_id) AS product_key,
    p.product_id,
    p.sku,
    p.name,
    c.name AS category,
    f.name AS family,
    p.list_price
FROM raw.product AS p
LEFT JOIN raw.product_category AS c ON c.category_id = p.category_id   -- categoría
LEFT JOIN raw.product_category AS f ON f.category_id = c.parent_id;    -- familia (categoría padre)


-- ---------------------------------------------------------------------
-- TU TURNO: el resto de las dimensiones
-- ---------------------------------------------------------------------
-- Pensá qué preguntas tiene que responder el dashboard (por fecha, canal,
-- provincia, producto, cliente, tienda...) y creá una dimensión para cada una.
--
-- Tips:
--   * Generar todas las fechas entre dos días:
--       SELECT CAST(range AS DATE) AS fecha
--       FROM range(DATE '2024-01-01', DATE '2025-10-01', INTERVAL 1 DAY);
--   * Partes de una fecha: year(fecha), month(fecha), monthname(fecha), dayname(fecha)
--   * Clave numérica para una fecha (ej. 20240131):
--       CAST(strftime(fecha, '%Y%m%d') AS INTEGER)
--   * Si algo puede venir vacío (ej. NPS anónimos, sin cliente), podés agregar
--     una fila "Desconocido" con clave -1 y usar COALESCE(clave, -1) en los hechos.


CREATE TABLE dim_channel (
    channel_key INTEGER PRIMARY KEY,
    channel_id INTEGER NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL
);

INSERT INTO dim_channel 
SELECT
    ROW_NUMBER() OVER (ORDER BY channel_id),
    channel_id,
    code,
    name
FROM raw.channel;

CREATE TABLE dim_customer (
    customer_key INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL UNIQUE,
    email VARCHAR(120),
    first_name VARCHAR(80),
    last_name VARCHAR(80),
    phone VARCHAR(30),
    status CHAR(1),
    created_at TIMESTAMP
);

INSERT INTO dim_customer
SELECT
    ROW_NUMBER() OVER (ORDER BY customer_id),
    customer_id,
    email,
    first_name,
    last_name,
    phone,
    status,
    created_at
FROM raw.customer;

CREATE TABLE dim_date (
    date_key INTEGER PRIMARY KEY,
    full_date DATE NOT NULL UNIQUE,
    year SMALLINT NOT NULL,
    month TINYINT NOT NULL,
    day TINYINT NOT NULL,
    quarter TINYINT NOT NULL,
    year_month VARCHAR(7) NOT NULL
);

INSERT INTO dim_date
SELECT
    CAST(strftime(fecha, '%Y%m%d') AS INTEGER) AS date_key,
    CAST(fecha AS DATE) AS full_date,
    YEAR(fecha) AS year,
    MONTH(fecha) AS month,
    DAY(fecha) AS day,
    QUARTER(fecha) AS quarter,
    strftime(fecha, '%Y-%m') AS year_month
FROM range(
    DATE '2024-01-01',
    DATE '2025-10-01',
    INTERVAL 1 DAY
) AS calendario(fecha);

CREATE TABLE dim_province (
    province_key INTEGER PRIMARY KEY,
    province_id INTEGER NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    code VARCHAR(10)
);

INSERT INTO dim_province
SELECT
    ROW_NUMBER() OVER (ORDER BY province_id),
    province_id,
    name,
    code
FROM raw.province;

CREATE TABLE dim_store (
    store_key INTEGER PRIMARY KEY,
    store_id INTEGER NOT NULL UNIQUE,
    name VARCHAR(80) NOT NULL,
    address_id INTEGER
);

INSERT INTO dim_store
SELECT
    ROW_NUMBER() OVER (ORDER BY store_id),
    store_id,
    name,
    address_id
FROM raw.store;

