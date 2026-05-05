from flask import Blueprint, jsonify
from database.db_config import get_connection
from datetime import datetime, timezone, date, timedelta
import psycopg2

notifications_bp = Blueprint("notifications", __name__)


def _strip_tz(dt):
    if dt is None:
        return datetime.min
    if hasattr(dt, 'tzinfo') and dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt

@notifications_bp.route("/api/notifications", methods=["GET"])
def get_notifications():
    conn = get_connection()
    cur  = conn.cursor()
    notifications = []

    def safe(fn, label):
        try:
            fn()
        except Exception as e:
            print(f"Notifications [{label}] error:", e)
            try: conn.rollback()
            except: pass

    def fetch_low_stock():
        cur.execute("""
            SELECT
                ib.inventory_brand_id,
                i.item_name || CASE
                    WHEN b.brand_name IS NOT NULL AND b.brand_name != 'No Brand'
                    THEN ' (' || b.brand_name || ')'
                    ELSE ''
                END AS display_name,
                COALESCE(SUM(bat.quantity_on_hand), 0) AS qty,
                COALESCE(ia.low_stock_qty, 10)          AS threshold,
                i.item_created_at
            FROM inventory_brand ib
            JOIN inventory i       ON i.inventory_id        = ib.inventory_id
            LEFT JOIN brand b      ON b.brand_id            = ib.brand_id
            JOIN static_status ss  ON i.item_status_id      = ss.status_id
            LEFT JOIN inventory_batch bat ON bat.inventory_brand_id = ib.inventory_brand_id
                AND bat.expiry_date > CURRENT_DATE
            LEFT JOIN inventory_action ia ON ia.inventory_brand_id = ib.inventory_brand_id
            WHERE ss.status_code NOT IN ('INACTIVE', 'ARCHIVED')
            GROUP BY ib.inventory_brand_id, i.item_name, b.brand_name,
                     i.item_created_at, ia.low_stock_qty
            HAVING COALESCE(SUM(bat.quantity_on_hand), 0) > 0
               AND COALESCE(SUM(bat.quantity_on_hand), 0) <= COALESCE(ia.low_stock_qty, 10)
            ORDER BY qty ASC
            LIMIT 15
        """)
        for row in cur.fetchall():
            ibid, name, qty, threshold, created_at = row
            notifications.append({
                "status_code": "LOW_STOCK",
                "status_name": "Low Stock",
                "category":    "INVENTORY",
                "reference":   str(ibid),
                "item_name":   name,
                "detail":      f"{int(qty)} left (threshold: {int(threshold)})",
                "event_time":  created_at,
                "severity":    "warning",
            })
    safe(fetch_low_stock, "low_stock")

    def fetch_out_of_stock():
        cur.execute("""
            SELECT
                ib.inventory_brand_id,
                i.item_name || CASE
                    WHEN b.brand_name IS NOT NULL AND b.brand_name != 'No Brand'
                    THEN ' (' || b.brand_name || ')'
                    ELSE ''
                END AS display_name,
                i.item_created_at
            FROM inventory_brand ib
            JOIN inventory i       ON i.inventory_id   = ib.inventory_id
            LEFT JOIN brand b      ON b.brand_id       = ib.brand_id
            JOIN static_status ss  ON i.item_status_id = ss.status_id
            LEFT JOIN inventory_batch bat ON bat.inventory_brand_id = ib.inventory_brand_id
                AND bat.expiry_date > CURRENT_DATE
            WHERE ss.status_code NOT IN ('INACTIVE', 'ARCHIVED')
            GROUP BY ib.inventory_brand_id, i.item_name, b.brand_name, i.item_created_at
            HAVING COALESCE(SUM(bat.quantity_on_hand), 0) = 0
            ORDER BY i.item_created_at DESC
            LIMIT 15
        """)
        for row in cur.fetchall():
            ibid, name, created_at = row
            notifications.append({
                "status_code": "OUT_OF_STOCK",
                "status_name": "Out of Stock",
                "category":    "INVENTORY",
                "reference":   str(ibid),
                "item_name":   name,
                "detail":      "No stock remaining",
                "event_time":  created_at,
                "severity":    "critical",
            })
    safe(fetch_out_of_stock, "out_of_stock")

    def fetch_expiring():
        cur.execute("""
            SELECT
                ib.inventory_brand_id,
                i.item_name || CASE
                    WHEN b.brand_name IS NOT NULL AND b.brand_name != 'No Brand'
                    THEN ' (' || b.brand_name || ')'
                    ELSE ''
                END AS display_name,
                MIN(bat.expiry_date) AS nearest_expiry,
                i.item_created_at
            FROM inventory_brand ib
            JOIN inventory i       ON i.inventory_id   = ib.inventory_id
            LEFT JOIN brand b      ON b.brand_id       = ib.brand_id
            JOIN static_status ss  ON i.item_status_id = ss.status_id
            JOIN inventory_batch bat ON bat.inventory_brand_id = ib.inventory_brand_id
                AND bat.quantity_on_hand > 0
                AND bat.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
            WHERE ss.status_code NOT IN ('INACTIVE', 'ARCHIVED')
            GROUP BY ib.inventory_brand_id, i.item_name, b.brand_name, i.item_created_at
            ORDER BY nearest_expiry ASC
            LIMIT 15
        """)
        today = date.today()
        for row in cur.fetchall():
            ibid, name, expiry, created_at = row
            if hasattr(expiry, 'date'):
                expiry = expiry.date()
            days_left = (expiry - today).days
            severity = "critical" if days_left <= 14 else "warning"
            notifications.append({
                "status_code": "EXPIRING_SOON",
                "status_name": "Expiring Soon",
                "category":    "INVENTORY",
                "reference":   str(ibid),
                "item_name":   name,
                "detail":      f"Expires {expiry.strftime('%b %d, %Y')} ({days_left}d left)",
                "event_time":  created_at,
                "severity":    severity,
            })
    safe(fetch_expiring, "expiring_soon")

    def fetch_inactive_suppliers():
        cur.execute("""
            SELECT
                s.supplier_id,
                s.supplier_name,
                NOW()
            FROM supplier s
            JOIN static_status ss ON s.supplier_status_id = ss.status_id
            WHERE ss.status_scope = 'SUPPLIER_STATUS'
              AND ss.status_code  = 'INACTIVE'
            ORDER BY s.supplier_id DESC
            LIMIT 10
        """)
        for row in cur.fetchall():
            sid, name, event_time = row
            notifications.append({
                "status_code": "INACTIVE_SUPPLIER",
                "status_name": "Inactive Supplier",
                "category":    "SUPPLIER",
                "reference":   str(sid),
                "item_name":   name,
                "detail":      "Supplier is marked inactive",
                "event_time":  event_time,
                "severity":    "info",
            })
    safe(fetch_inactive_suppliers, "inactive_suppliers")

    def fetch_overdue_payments():
        cur.execute("""
            SELECT
                ot.order_id,
                c.customer_name,
                ot.total_amount,
                ot.order_date,
                CURRENT_DATE - ot.order_date AS days_overdue
            FROM order_transaction ot
            JOIN customer c ON c.customer_id = ot.customer_id
            JOIN static_status ss_order ON ss_order.status_id = ot.order_status_id
            JOIN static_status ss_pay   ON ss_pay.status_id   = ot.payment_status_id
            WHERE ss_order.status_code NOT IN ('CANCELLED', 'ARCHIVED')
              AND ss_pay.status_code   = 'UNPAID'
              AND ot.order_date <= CURRENT_DATE - INTERVAL '7 days'
            ORDER BY ot.order_date ASC
            LIMIT 10
        """)
        for row in cur.fetchall():
            order_id, customer, amount, order_date, days_overdue = row
            if hasattr(order_date, 'date'):
                order_date = order_date.date()
            notifications.append({
                "status_code":   "OVERDUE_PAYMENT",
                "status_name":   "Overdue Payment",
                "category":      "ORDER",
                "reference":     str(order_id),
                "item_name":     customer,
                "detail":        f"Unpaid for {int(days_overdue)} days — ₱{float(amount or 0):,.2f}",
                "event_time":    datetime.combine(order_date, datetime.min.time()) if order_date else datetime.now(),
                "severity":      "critical" if int(days_overdue) >= 14 else "warning",
            })
    safe(fetch_overdue_payments, "overdue_payments")

    cur.close()
    conn.close()

    SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2}
    notifications.sort(key=lambda x: (
        SEVERITY_ORDER.get(x.get("severity", "info"), 9),
        -_strip_tz(x["event_time"]).timestamp() if x["event_time"] else 0,
    ))
    notifications = notifications[:30]

    result = []
    for idx, n in enumerate(notifications):
        et = n["event_time"]
        if et:
            dt = _strip_tz(et) if isinstance(et, datetime) else datetime.combine(et, datetime.min.time())
            date_str = dt.strftime("%b %d, %Y")
            time_str = dt.strftime("%I:%M %p")
        else:
            date_str = ""
            time_str = ""

        result.append({
            "id":        idx + 1,
            "key":       f"{n['status_code'].lower()}:{n['reference']}",
            "type":      n["status_code"].lower(),
            "label":     n["status_name"],
            "reference": n["reference"],
            "name":      n.get("item_name") or "Unknown",
            "detail":    n.get("detail", ""),
            "severity":  n.get("severity", "info"),
            "category":  n.get("category", ""),
            "date":      date_str,
            "time":      time_str,
        })

    return jsonify(result), 200
