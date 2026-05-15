from flask import Blueprint, jsonify, request
from database.db_config import get_connection
from datetime import datetime, timedelta, timezone

event_log_bp = Blueprint("event_log", __name__)


def _strip_tz(dt):
    if dt is None:
        return None
    if hasattr(dt, 'tzinfo') and dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _relative_time(dt: datetime) -> str:
    if dt is None:
        return ""
    now = datetime.utcnow()
    dt = _strip_tz(dt)
    diff = now - dt
    seconds = int(diff.total_seconds())
    if seconds < 60:
        return "just now"
    if seconds < 3600:
        m = seconds // 60
        return f"{m} minute{'s' if m != 1 else ''} ago"
    if seconds < 86400:
        h = seconds // 3600
        return f"{h} hour{'s' if h != 1 else ''} ago"
    d = seconds // 86400
    return f"{d} day{'s' if d != 1 else ''} ago"


def _get_period_start(period: str) -> datetime:
    now = datetime.utcnow()
    if period == "last_week":
        # Monday of the previous week
        today = now.date()
        start_of_this_week = today - timedelta(days=today.weekday())
        start_of_last_week = start_of_this_week - timedelta(weeks=1)
        return datetime.combine(start_of_last_week, datetime.min.time())
    if period == "last_month":
        first_of_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_month_end = first_of_this_month - timedelta(days=1)
        first_of_last_month = last_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return first_of_last_month
    # default: last 7 days
    return now - timedelta(days=7)


def _get_period_end(period: str) -> datetime:
    now = datetime.utcnow()
    if period == "last_week":
        today = now.date()
        start_of_this_week = today - timedelta(days=today.weekday())
        return datetime.combine(start_of_this_week, datetime.min.time())
    if period == "last_month":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return now


@event_log_bp.route("/api/event-log", methods=["GET"])
def get_event_log():
    period = request.args.get("period", "7days")
    period_start = _get_period_start(period)
    period_end   = _get_period_end(period)

    conn = get_connection()
    cur  = conn.cursor()
    events = []

    try:
        # ── REORDER events ──────────────────────────────────────────────
        # Items whose reorder config was touched within the period AND
        # whose current qty is at or below the buffer (low_stock_qty).
        cur.execute("""
            SELECT
                i.item_name || CASE
                    WHEN b.brand_name IS NOT NULL AND b.brand_name != 'No Brand'
                    THEN ' (' || b.brand_name || ')'
                    ELSE '' END                         AS item_name,
                COALESCE(SUM(bat.quantity_on_hand), 0) AS current_qty,
                COALESCE(ia.low_stock_qty, 0)           AS threshold_qty,
                ia.action_date
            FROM inventory_action ia
            JOIN inventory_brand ib ON ib.inventory_brand_id = ia.inventory_brand_id
            JOIN inventory i        ON i.inventory_id        = ib.inventory_id
            LEFT JOIN brand b       ON b.brand_id            = ib.brand_id
            LEFT JOIN inventory_batch bat
                   ON bat.inventory_brand_id = ib.inventory_brand_id
                  AND bat.expiry_date > CURRENT_DATE
            LEFT JOIN static_status ss ON ss.status_id = i.item_status_id
            WHERE ss.status_code NOT IN ('INACTIVE','ARCHIVED')
              AND ia.action_date >= %s
              AND ia.action_date <  %s
            GROUP BY i.item_name, b.brand_name, ia.low_stock_qty, ia.action_date
            HAVING COALESCE(SUM(bat.quantity_on_hand), 0) <= COALESCE(ia.low_stock_qty, 0)
            ORDER BY ia.action_date DESC
            LIMIT 50
        """, (period_start, period_end))
        for row in cur.fetchall():
            item_name, current_qty, threshold_qty, action_date = row
            events.append({
                "type":        "reorder",
                "label":       "Reorder",
                "item_name":   item_name,
                "from_qty":    float(current_qty),
                "to_qty":      float(threshold_qty),
                "description": f"{item_name} stock is critical — at or below buffer stock.",
                "event_time":  _strip_tz(action_date),
            })

        # ── ALERT events ────────────────────────────────────────────────
        # Items that reached zero stock within the period.
        cur.execute("""
            SELECT
                i.item_name || CASE
                    WHEN b.brand_name IS NOT NULL AND b.brand_name != 'No Brand'
                    THEN ' (' || b.brand_name || ')'
                    ELSE '' END AS item_name,
                i.item_created_at
            FROM inventory_brand ib
            JOIN inventory i   ON i.inventory_id   = ib.inventory_id
            LEFT JOIN brand b  ON b.brand_id        = ib.brand_id
            LEFT JOIN inventory_batch bat
                   ON bat.inventory_brand_id = ib.inventory_brand_id
                  AND bat.expiry_date > CURRENT_DATE
            LEFT JOIN static_status ss ON ss.status_id = i.item_status_id
            WHERE ss.status_code NOT IN ('INACTIVE','ARCHIVED')
              AND i.item_created_at >= %s
              AND i.item_created_at <  %s
            GROUP BY i.item_name, b.brand_name, i.item_created_at
            HAVING COALESCE(SUM(bat.quantity_on_hand), 0) = 0
            ORDER BY i.item_created_at DESC
            LIMIT 50
        """, (period_start, period_end))
        for row in cur.fetchall():
            item_name, event_time = row
            events.append({
                "type":        "alert",
                "label":       "Alert",
                "item_name":   item_name,
                "from_qty":    0.0,
                "to_qty":      0.0,
                "description": f"{item_name} is out of stock.",
                "event_time":  _strip_tz(event_time),
            })

        # ── ADJUSTMENT events ────────────────────────────────────────────
        # New inventory batches added within the period.
        cur.execute("""
            SELECT
                i.item_name || CASE
                    WHEN b.brand_name IS NOT NULL AND b.brand_name != 'No Brand'
                    THEN ' (' || b.brand_name || ')'
                    ELSE '' END        AS item_name,
                0                      AS from_qty,
                bat.quantity_on_hand   AS to_qty,
                bat.date_created
            FROM inventory_batch bat
            JOIN inventory_brand ib ON ib.inventory_brand_id = bat.inventory_brand_id
            JOIN inventory i        ON i.inventory_id        = ib.inventory_id
            LEFT JOIN brand b       ON b.brand_id            = ib.brand_id
            LEFT JOIN static_status ss ON ss.status_id = i.item_status_id
            WHERE ss.status_code NOT IN ('INACTIVE','ARCHIVED')
              AND bat.date_created >= %s
              AND bat.date_created <  %s
            ORDER BY bat.date_created DESC
            LIMIT 50
        """, (period_start, period_end))
        for row in cur.fetchall():
            item_name, from_qty, to_qty, event_time = row
            events.append({
                "type":        "adjustment",
                "label":       "Stock Adjustment",
                "item_name":   item_name,
                "from_qty":    float(from_qty),
                "to_qty":      float(to_qty),
                "description": f"Stock adjusted: {item_name} received {float(to_qty):.2f} units.",
                "event_time":  _strip_tz(event_time),
            })

        # Sort all events newest-first
        events.sort(key=lambda e: e["event_time"] or datetime.min, reverse=True)

        # Build summary counts
        total     = len(events)
        reorders  = sum(1 for e in events if e["type"] == "reorder")
        alerts    = sum(1 for e in events if e["type"] == "alert")
        adjustments = sum(1 for e in events if e["type"] == "adjustment")

        result = []
        for idx, e in enumerate(events):
            et = e["event_time"]
            result.append({
                "id":          idx + 1,
                "type":        e["type"],
                "label":       e["label"],
                "item_name":   e["item_name"],
                "from_qty":    e["from_qty"],
                "to_qty":      e["to_qty"],
                "description": e["description"],
                "event_date":  et.strftime("%b %d, %Y") if et else "",
                "event_time":  et.strftime("%I:%M %p")  if et else "",
                "relative":    _relative_time(et),
            })

        return jsonify({
            "summary": {
                "total":       total,
                "reorders":    reorders,
                "alerts":      alerts,
                "adjustments": adjustments,
            },
            "events": result,
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()
