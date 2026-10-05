# Modelo estrella

Generado por `run_sql.py` a partir de las tablas de `warehouse.duckdb`.

```mermaid
erDiagram
    dim_channel {
        INTEGER channel_id PK
        VARCHAR channel_name
    }
    dim_customer {
        INTEGER customer_id PK
        VARCHAR email
        VARCHAR full_name
        VARCHAR status
        TIMESTAMP created_at
    }
    dim_date {
        INTEGER date_id PK
        DATE date
        INTEGER year
        INTEGER month
        VARCHAR month_name
        INTEGER day
        VARCHAR day_name
    }
    dim_product {
        INTEGER product_key PK
        INTEGER product_id
        VARCHAR sku
        VARCHAR name
        VARCHAR category
        VARCHAR family
        DECIMAL list_price
    }
    dim_province {
        INTEGER province_id PK
        VARCHAR name
        VARCHAR code
    }
    dim_store {
        INTEGER store_id PK
        VARCHAR name
        INTEGER address_id
    }
    fact_nps_response {
        BIGINT nps_id PK
        INTEGER customer_id
        INTEGER channel_id
        INTEGER score
        VARCHAR comment
        TIMESTAMP responded_at
        DATE response_date
    }
    fact_sales {
        BIGINT order_item_id PK
        INTEGER order_id
        INTEGER product_id
        INTEGER customer_id
        INTEGER store_id
        INTEGER channel_id
        INTEGER province_id
        TIMESTAMP order_date
        DATE sale_date
        INTEGER quantity
        DECIMAL unit_price
        DECIMAL discount_amount
        DECIMAL line_total
    }
    fact_web_session {
        BIGINT session_id PK
        INTEGER customer_id
        TIMESTAMP started_at
        DATE session_date
        TIMESTAMP ended_at
        VARCHAR source
        VARCHAR device
    }
```
