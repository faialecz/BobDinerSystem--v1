from flask import Blueprint, jsonify
from database.db_config import get_connection
from datetime import date, timedelta
import time

dashboard_bp = Blueprint("dashboard", __name__)

# ── Simple in-memory cache (60-second TTL) ────────────────────────────────────
_cache: dict = {}


def _get(key: str):
    entry = _cache.get(key)
    if entry and time.time() < entry["expires"]:
        return entry["data"]
    return None


def _set(key: str, data, ttl: int = 60):
    _cache[key] = {"data": data, "expires": time.time() + ttl}


# ── /api/dashboard ────────────────────────────────────────────────────────────

@dashboard_bp.route("/api/dashboard", methods=["GET"])
def get_dashboard():
    cached = _get("dashboard")
    if cached:
        return jsonify(cached), 200

    conn = get_connection()
    cur  = conn.cursor()
    try:
        today     = date.today()
        yesterday = today - timedelta(days=1)

        # ── 1. Sales today vs yesterday ───────────────────────────────────────
        # Adjust table/column names if your schema differs:
        #   order_transaction.order_date  → date column for the transaction
        #   order_transaction.total_amount → the billed amount per order
        cur.execute("""
            SELECT
                COALESCE(SUM(CASE WHEN order_date = %s THEN total_amount END), 0) AS today,
                COALESCE(SUM(CASE WHEN order_date = %s THEN total_amount END), 0) AS yesterday
            FROM order_transaction
            WHERE order_date IN (%s, %s)
        """, (today, yesterday, today, yesterday))
        row             = cur.fetchone()
        sales_today     = float(row[0] or 0)
        sales_yesterday = float(row[1] or 0)

        if sales_yesterday > 0:
            sales_trend_pct = round(
                ((sales_today - sales_yesterday) / sales_yesterday) * 100, 1
            )
        else:
            sales_trend_pct = 100.0 if sales_today > 0 else 0.0

        # ── 2. Inventory health + alert rows (single CTE pass) ────────────────
        # Adjust column names if your schema differs:
        #   inventory_brand.inventory_brand_id  → PK
        #   inventory_brand.item_sku            → SKU string
        #   inventory_brand.item_name           → display name (or join to inventory table)
        #   inventory_batch.inventory_brand_id  → FK to inventory_brand
        #   inventory_batch.quantity_on_hand    → current stock units
        #   inventory_batch.expiry_date         → used to exclude expired batches
        #   inventory_action.inventory_brand_id → FK to inventory_brand
        #   inventory_action.low_stock_qty      → reorder threshold / warning level
        #   inventory_brand.item_status_id      → FK to static_status
        #   static_status.status_code           → 'INACTIVE' excluded
        cur.execute("""
            WITH brand_stock AS (
                -- Current non-expired stock per brand — raw ingredients only.
                -- Exclude any inventory_brand that is a finished menu item
                -- (i.e. referenced by menu_item.linked_inventory_brand_id).
                SELECT
                    ib.inventory_brand_id,
                    COALESCE(SUM(bat.quantity_on_hand), 0)::int AS qty
                FROM inventory_brand ib
                LEFT JOIN inventory_batch bat
                       ON bat.inventory_brand_id = ib.inventory_brand_id
                      AND bat.expiry_date > CURRENT_DATE
                JOIN static_status ss ON ss.status_id = ib.item_status_id
                LEFT JOIN menu_item mi
                       ON mi.linked_inventory_brand_id = ib.inventory_brand_id
                WHERE ss.status_code != 'INACTIVE'
                  AND mi.menu_item_id IS NULL
                GROUP BY ib.inventory_brand_id
            ),
            brand_threshold AS (
                -- Lowest warning threshold per brand
                SELECT
                    inventory_brand_id,
                    COALESCE(MIN(low_stock_qty), 10)::int AS threshold
                FROM inventory_action
                GROUP BY inventory_brand_id
            ),
            brand_classified AS (
                SELECT
                    bs.inventory_brand_id,
                    bs.qty,
                    COALESCE(bt.threshold, 10) AS threshold,
                    CASE
                        WHEN bs.qty = 0                        THEN 'critical'
                        WHEN bs.qty <= COALESCE(bt.threshold, 10) THEN 'low'
                        ELSE                                        'optimal'
                    END AS status_class
                FROM brand_stock bs
                LEFT JOIN brand_threshold bt USING (inventory_brand_id)
            )
            SELECT
                -- active_total counts distinct inventory items (matches inventory module)
                COUNT(DISTINCT i.inventory_id)                       AS active_total,
                COUNT(*) FILTER (WHERE status_class = 'critical')   AS critical,
                COUNT(*) FILTER (WHERE status_class = 'low')        AS low_stock,
                COUNT(*) FILTER (WHERE status_class = 'optimal')    AS optimal,
                -- Alert detail rows (top 10, critical first then lowest stock)
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id',        bc.inventory_brand_id::text,
                        'name',      i.item_name,
                        'stock',     bc.qty,
                        'level',     bc.threshold,
                        'status',    bc.status_class
                    )
                    ORDER BY
                        CASE WHEN bc.status_class = 'critical' THEN 0 ELSE 1 END,
                        bc.qty ASC
                ) FILTER (WHERE status_class IN ('critical', 'low'))  AS alert_rows
            FROM brand_classified bc
            JOIN inventory_brand ib ON ib.inventory_brand_id = bc.inventory_brand_id
            JOIN inventory i        ON i.inventory_id        = ib.inventory_id
        """)
        h = cur.fetchone()

        active_total = int(h[0] or 0)
        critical     = int(h[1] or 0)
        low_stock    = int(h[2] or 0)
        optimal      = int(h[3] or 0)
        alert_rows   = h[4] or []

        # Limit to top 10 alerts
        alert_rows = alert_rows[:10]

        # ── 3. Smart Reorder — most urgent single item ────────────────────────
        # Adjust if your schema differs:
        #   product_statistics.inventory_brand_id → FK to inventory_brand
        #   product_statistics.reorder_point      → desired target stock level
        cur.execute("""
            WITH brand_stock AS (
                SELECT
                    ib.inventory_brand_id,
                    i.item_name,
                    ib.item_sku,
                    COALESCE(u.uom_name, 'pcs')                    AS unit,
                    COALESCE(SUM(bat.quantity_on_hand), 0)::int    AS current_stock
                FROM inventory_brand ib
                JOIN inventory i          ON i.inventory_id         = ib.inventory_id
                LEFT JOIN inventory_batch bat
                       ON bat.inventory_brand_id = ib.inventory_brand_id
                      AND bat.expiry_date > CURRENT_DATE
                LEFT JOIN unit_of_measure u ON u.uom_id = ib.uom_id
                JOIN static_status ss ON ss.status_id = ib.item_status_id
                WHERE ss.status_code != 'INACTIVE'
                GROUP BY ib.inventory_brand_id, i.item_name, ib.item_sku, u.uom_name
            ),
            with_target AS (
                SELECT
                    bs.inventory_brand_id,
                    bs.item_name,
                    bs.item_sku,
                    bs.unit,
                    bs.current_stock,
                    -- target = reorder threshold from inventory_action
                    COALESCE(
                        (SELECT ia.low_stock_qty
                         FROM inventory_action ia
                         WHERE ia.inventory_brand_id = bs.inventory_brand_id
                         LIMIT 1),
                        10
                    )::int AS target
                FROM brand_stock bs
                WHERE bs.current_stock <= COALESCE(
                    (SELECT ia2.low_stock_qty
                     FROM inventory_action ia2
                     WHERE ia2.inventory_brand_id = bs.inventory_brand_id
                     LIMIT 1), 10
                )
            )
            SELECT
                item_name,
                COALESCE(item_sku, '')                    AS sku,
                unit,
                target,
                current_stock,
                GREATEST(0, target - current_stock)      AS suggested
            FROM with_target
            ORDER BY
                CASE WHEN current_stock = 0 THEN 0 ELSE 1 END ASC,
                current_stock ASC
            LIMIT 1
        """)
        sr = cur.fetchone()

        if sr:
            smart_reorder = {
                "itemName":  sr[0],
                "sku":       sr[1],
                "unit":      sr[2],
                "target":    int(sr[3]),
                "current":   int(sr[4]),
                "suggested": int(sr[5]),
            }
        else:
            smart_reorder = None

        # ── Build response ────────────────────────────────────────────────────
        result = {
            "metrics": {
                "salesToday":       sales_today,
                "salesTrendPct":    sales_trend_pct,
                "lowStockCount":    critical + low_stock,
                "criticalAlerts":   critical,
                "warningAlerts":    low_stock,
                "activeItemsCount": active_total,
            },
            "health": {
                "optimal":  optimal,
                "lowStock": low_stock,
                "critical": critical,
            },
            "alerts":      alert_rows,
            "smartReorder": smart_reorder,
        }

        _set("dashboard", result, ttl=60)
        return jsonify(result), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()
