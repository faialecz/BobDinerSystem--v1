from flask import Blueprint, jsonify, request
from database.db_config import get_connection
from datetime import date, timedelta
import json

orders_bp = Blueprint("orders", __name__, url_prefix="/api/orders")

# ===================== SUMMARY =====================
@orders_bp.route("/summary", methods=["GET"])
def orders_summary():
    conn = get_connection()
    cur = conn.cursor()

    try:
        today = date.today()

        def count_orders(status_code, for_date=None):
            query = """
                SELECT COUNT(*)
                FROM order_transaction ot
                JOIN static_status sl ON ot.order_status_id = sl.status_id
                WHERE sl.status_scope = 'ORDER_STATUS'
                  AND sl.status_code ILIKE %s
            """
            params = [status_code]
            if for_date:
                query += " AND ot.order_date = %s"
                params.append(for_date)
            cur.execute(query, params)
            return cur.fetchone()[0]

        completed_today = count_orders("COMPLETED", today)
        total_completed = count_orders("COMPLETED")
        cancelled_today = count_orders("CANCELLED", today)

        cur.execute("SELECT COUNT(*) FROM order_transaction")
        total_orders = cur.fetchone()[0]

        # --- MTD GROWTH CALCULATION ---
        this_month_start = today.replace(day=1)
        last_month_end   = this_month_start - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        current_day      = today.day
        try:
            last_month_same_day = last_month_start.replace(day=current_day)
        except ValueError:
            last_month_same_day = last_month_end

        def get_order_count(start_date, end_date=None):
            query  = "SELECT COUNT(*) FROM order_transaction WHERE order_date >= %s"
            params = [start_date]
            if end_date:
                query += " AND order_date <= %s"
                params.append(end_date)
            cur.execute(query, params)
            return float(cur.fetchone()[0])

        mtd_current = get_order_count(this_month_start)
        mtd_last    = get_order_count(last_month_start, last_month_same_day)

        if mtd_last == 0:
            growth = 100.0 if mtd_current > 0 else 0.0
        else:
            growth = round(((mtd_current - mtd_last) / mtd_last) * 100, 1)

        return jsonify({
            "completedToday": {"current": completed_today, "total": total_completed},
            "cancelled":      {"current": cancelled_today},
            "totalOrders":    {"count": total_orders, "growth": growth}
        })
    except Exception as e:
        print("Error fetching summary:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ===================== LIST =====================
@orders_bp.route("/list", methods=["GET"])
def orders_list():
    conn = get_connection()
    cur  = conn.cursor()

    try:
        # ── Query 1: order headers (no item joins — avoids schema guessing) ──
        cur.execute("""
            SELECT
                ot.order_id,
                c.customer_name,
                c.customer_contact,
                ot.order_date,
                COALESCE(sl_status.status_name, 'Preparing') AS order_status,
                COALESCE(sl_pm.status_name,     'Cash')      AS payment_method_name,
                sl_ps.status_name                            AS payment_status_name,
                sl_ps.status_code                            AS payment_status_code,
                COALESCE(ot.total_amount,  0)                AS total_amount,
                COALESCE(ot.amount_paid,   0)                AS amount_paid,
                ot.payment_status_id,
                ot.deposit_date,
                ot.final_payment_date,
                ot.shipped_date,
                ot.cancelled_date
            FROM order_transaction ot
            JOIN  customer          c         ON c.customer_id       = ot.customer_id
            LEFT JOIN static_status sl_status ON sl_status.status_id = ot.order_status_id
            LEFT JOIN static_status sl_pm     ON sl_pm.status_id     = ot.payment_method_id
            LEFT JOIN static_status sl_ps     ON sl_ps.status_id     = ot.payment_status_id
            ORDER BY ot.order_id DESC
        """)
        rows = cur.fetchall()

        # ── Query 2: BOM items from order_menu_item (new system) ─────────────
        cur.execute("""
            SELECT
                omi.order_id,
                json_agg(
                    json_build_object(
                        'menu_item_id',   omi.menu_item_id,
                        'item_name',      mi.menu_item_name,
                        'order_quantity', omi.quantity,
                        'unit_price',     omi.unit_price,
                        'amount',         omi.unit_price * omi.quantity,
                        'notes',          COALESCE(omi.notes, '')
                    )
                    ORDER BY omi.order_menu_item_id
                ) AS items
            FROM order_menu_item omi
            JOIN menu_item mi ON mi.menu_item_id = omi.menu_item_id
            GROUP BY omi.order_id
        """)
        bom_items_map = {row[0]: row[1] for row in cur.fetchall()}

    except Exception as e:
        import traceback
        traceback.print_exc()
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

    orders = []
    for row in rows:
        (order_id, customer_name, customer_contact,
         order_date, order_status, payment_method, payment_status,
         payment_status_code,
         total_amount, amount_paid, payment_status_id,
         deposit_date, final_payment_date,
         shipped_date, cancelled_date) = row

        order_status_upper = (order_status or "").upper()
        # Normalise legacy statuses that no longer exist in the workflow
        if order_status_upper == 'RECEIVED':
            order_status_upper = 'COMPLETED'
        is_archived = order_status_upper == 'ARCHIVED'

        raw_items = bom_items_map.get(order_id)
        if isinstance(raw_items, str):
            try:
                items_list = json.loads(raw_items)
            except json.JSONDecodeError:
                items_list = []
        else:
            items_list = raw_items if isinstance(raw_items, list) else []

        total_qty = sum(int(it.get('order_quantity') or 0) for it in items_list)

        orders.append({
            "id":                 order_id,
            "customer":           customer_name,
            "contact":            customer_contact,
            "date":               order_date.strftime("%m/%d/%y") if order_date else None,
            "status":             order_status_upper.replace("_", " ").title(),
            "paymentMethod":      payment_method,
            "paymentStatus":      (payment_status_code or "").upper(),
            "totalQty":           total_qty,
            "totalAmount":        float(total_amount) if total_amount is not None else 0.0,
            "amount_paid":        float(amount_paid)  if amount_paid  is not None else 0.0,
            "payment_status_id":  payment_status_id,
            "deposit_date":       deposit_date.isoformat()        if deposit_date        else None,
            "final_payment_date": final_payment_date.isoformat()  if final_payment_date  else None,
            "is_archived":        is_archived,
            "shipped_date":       shipped_date.isoformat()        if shipped_date        else None,
            "cancelled_date":     cancelled_date.isoformat()      if cancelled_date      else None,
            "items":              items_list,
        })

    return jsonify(orders)


# ===================== TOGGLE ARCHIVE =====================
@orders_bp.route("/archive/<string:order_id>", methods=["PUT", "OPTIONS"])
def toggle_order_archive(order_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    conn = get_connection()
    cur  = conn.cursor()

    try:
        cur.execute("""
            SELECT ss.status_code
            FROM order_transaction ot
            JOIN static_status ss ON ot.order_status_id = ss.status_id
            WHERE ot.order_id = %s
        """, (order_id,))

        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Order not found."}), 404

        current_status = row[0].upper()

        # Unarchive: ARCHIVED → COMPLETED
        if current_status == 'ARCHIVED':
            cur.execute("""
                SELECT status_id FROM static_status
                WHERE status_scope = 'ORDER_STATUS' AND status_code = 'COMPLETED'
                LIMIT 1
            """)
            res         = cur.fetchone()
            is_archived = False
            action_msg  = "Order restored from Archive"
        else:
            # Only COMPLETED orders can be archived
            if current_status != 'COMPLETED':
                return jsonify({"error": "Only completed orders can be archived."}), 400
            cur.execute("""
                SELECT status_id FROM static_status
                WHERE status_scope = 'ORDER_STATUS' AND status_code = 'ARCHIVED'
                LIMIT 1
            """)
            res         = cur.fetchone()
            is_archived = True
            action_msg  = "Order moved to Archive"

        if not res:
            return jsonify({"error": "Target status not found in static_status."}), 404

        new_status_id = res[0]
        cur.execute("""
            UPDATE order_transaction SET order_status_id = %s WHERE order_id = %s
        """, (new_status_id, order_id))

        conn.commit()
        return jsonify({"message": action_msg, "is_archived": is_archived}), 200

    except Exception as e:
        conn.rollback()
        print("Error toggling order archive:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ================= GET STATUSES =================
@orders_bp.route("/status", methods=["GET"])
def get_order_statuses():
    scope = request.args.get('scope')
    conn  = get_connection()
    cur   = conn.cursor()

    try:
        if scope:
            cur.execute("SELECT status_id, status_name FROM static_status WHERE status_scope = %s", (scope,))
        else:
            cur.execute("SELECT status_id, status_name FROM static_status")
        rows   = cur.fetchall()
        result = [{"status_id": r[0], "status_name": r[1]} for r in rows]
        return jsonify(result), 200
    except Exception as e:
        print("Error fetching statuses:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ===================== PAYMENT HELPERS =====================

def _get_paid_status_id(cur):
    """Return the status_id for PAYMENT_STATUS = 'PAID'. Raises on missing."""
    cur.execute("""
        SELECT status_id FROM static_status
        WHERE status_scope = 'PAYMENT_STATUS'
          AND (status_code IN ('PAID', 'Paid', 'paid')
               OR status_name ILIKE 'Paid')
        LIMIT 1
    """)
    row = cur.fetchone()
    if not row:
        raise Exception("'PAID' payment status not found in static_status.")
    return row[0]


def _get_pending_status_id(cur):
    """Return the status_id for the default unpaid/pending payment status. Raises on missing."""
    cur.execute("""
        SELECT status_id FROM static_status
        WHERE status_scope = 'PAYMENT_STATUS'
          AND (status_code IN ('PENDING', 'Pending', 'pending', 'UNPAID', 'Unpaid', 'unpaid')
               OR status_name ILIKE 'Unpaid'
               OR status_name ILIKE 'Pending')
        LIMIT 1
    """)
    row = cur.fetchone()
    if not row:
        raise Exception(
            "'PENDING'/'UNPAID' payment status not found in static_status. "
            "Expected a row with status_scope='PAYMENT_STATUS' and "
            "status_code IN ('PENDING','UNPAID') or status_name like 'Unpaid'."
        )
    return row[0]


def _apply_completed_payment(cur, order_id, new_status_id):
    """
    Atomically set an order to COMPLETED and force full payment.
    Called whenever an order transitions to COMPLETED from any route.
    """
    paid_id = _get_paid_status_id(cur)
    cur.execute("""
        UPDATE order_transaction
        SET order_status_id    = %s,
            payment_status_id  = %s,
            amount_paid        = total_amount,
            final_payment_date = COALESCE(final_payment_date, CURRENT_TIMESTAMP)
        WHERE order_id = %s
    """, (new_status_id, paid_id, order_id))


# ===================== SHARED FIFO HELPERS =====================

def _fifo_allocate_ingredient(cur, ingredient_brand_id, qty_needed):
    """
    Expiry-date-aware FIFO for ingredient batches.
    Ordered by expiry_date ASC NULLS LAST, then date_created ASC so the
    soonest-to-expire stock is consumed first.
    Raises Exception (caught by caller as HTTP 400) if stock is insufficient.
    """
    cur.execute("""
        SELECT batch_id, quantity_on_hand
        FROM inventory_batch
        WHERE inventory_brand_id = %s
          AND quantity_on_hand > 0
        ORDER BY expiry_date ASC NULLS LAST, date_created ASC
    """, (ingredient_brand_id,))
    batches         = cur.fetchall()
    total_available = sum(r[1] for r in batches)

    if total_available < qty_needed:
        raise Exception(
            f"Insufficient stock for ingredient ID {ingredient_brand_id}: "
            f"need {qty_needed}, have {total_available}."
        )

    allocation = []
    remaining  = qty_needed
    for batch_id, on_hand in batches:
        if remaining <= 0:
            break
        take      = min(on_hand, remaining)
        allocation.append((batch_id, take))
        remaining -= take
    return allocation


def _fifo_allocate(cur, inv_brand_id, qty_needed):
    """
    Returns list of (batch_id, qty_to_take) using FIFO (oldest date_created first).
    Raises Exception if total available stock < qty_needed.
    """
    cur.execute("""
        SELECT batch_id, quantity_on_hand
        FROM inventory_batch
        WHERE inventory_brand_id = %s
          AND quantity_on_hand > 0
        ORDER BY date_created ASC
    """, (inv_brand_id,))
    batches         = cur.fetchall()
    total_available = sum(r[1] for r in batches)

    if total_available < qty_needed:
        raise Exception(
            f"Insufficient stock for inventory_brand_id {inv_brand_id}: "
            f"need {qty_needed}, available {total_available}."
        )

    allocation = []
    remaining  = qty_needed
    for batch_id, on_hand in batches:
        if remaining <= 0:
            break
        take = min(on_hand, remaining)
        allocation.append((batch_id, take))
        remaining -= take

    return allocation


def _restore_batch_items(cur, order_id):
    """
    Returns stock to inventory_batch for every order_details row on this order.
    Flips inventory back to AVAILABLE if stock is now positive.
    """
    cur.execute("""
        SELECT od.batch_id, od.order_quantity, ib.inventory_brand_id
        FROM order_details od
        JOIN inventory_batch ib ON ib.batch_id = od.batch_id
        WHERE od.order_id = %s
    """, (order_id,))
    rows = cur.fetchall()

    for batch_id, qty, inv_brand_id in rows:
        cur.execute("""
            UPDATE inventory_batch
            SET quantity_on_hand = quantity_on_hand + %s
            WHERE batch_id = %s
        """, (qty, batch_id))

        cur.execute("""
            SELECT inventory_id FROM inventory_brand WHERE inventory_brand_id = %s
        """, (inv_brand_id,))
        inv_row = cur.fetchone()
        if inv_row:
            inv_id = inv_row[0]
            cur.execute("""
                UPDATE inventory
                SET item_status_id = (
                    SELECT status_id FROM static_status
                    WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'AVAILABLE'
                    LIMIT 1
                )
                WHERE inventory_id = %s
                  AND COALESCE(
                        (SELECT SUM(quantity_on_hand) FROM inventory_batch
                         WHERE inventory_brand_id = %s), 0) > 0
                  AND item_status_id = (
                    SELECT status_id FROM static_status
                    WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'OUT_OF_STOCK'
                    LIMIT 1
                  )
            """, (inv_id, inv_brand_id))


def _flip_to_available(cur, inv_brand_id):
    """Flip inventory back to AVAILABLE if any stock remains and it's currently OUT_OF_STOCK."""
    cur.execute("""
        SELECT COALESCE(SUM(quantity_on_hand), 0)
        FROM inventory_batch WHERE inventory_brand_id = %s
    """, (inv_brand_id,))
    if cur.fetchone()[0] > 0:
        cur.execute("""
            UPDATE inventory
            SET item_status_id = (
                SELECT status_id FROM static_status
                WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'AVAILABLE' LIMIT 1
            )
            WHERE inventory_id = (
                SELECT inventory_id FROM inventory_brand WHERE inventory_brand_id = %s
            )
            AND item_status_id = (
                SELECT status_id FROM static_status
                WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'OUT_OF_STOCK' LIMIT 1
            )
        """, (inv_brand_id,))


def _mark_out_of_stock_if_empty(cur, inv_brand_id):
    """Mark inventory OUT_OF_STOCK if all batches for this brand are exhausted."""
    cur.execute("""
        SELECT COALESCE(SUM(quantity_on_hand), 0)
        FROM inventory_batch WHERE inventory_brand_id = %s
    """, (inv_brand_id,))
    if cur.fetchone()[0] <= 0:
        cur.execute("""
            UPDATE inventory
            SET item_status_id = (
                SELECT status_id FROM static_status
                WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'OUT_OF_STOCK' LIMIT 1
            )
            WHERE inventory_id = (
                SELECT inventory_id FROM inventory_brand WHERE inventory_brand_id = %s
            )
        """, (inv_brand_id,))


def _delta_update_items(cur, order_id, incoming_items, return_stock_on_delete=True):
    """
    Three-phase delta update that preserves CHECK constraints throughout.

    Proof of safety: after Phase 1+2 (inserts + increases), running total >=
    final total (Phase 3 only lowers). Since final total >= amount_paid
    (pre-validated by caller), total never dips below amount_paid mid-transaction.

    Phases:
      1. INSERT new brands            → total rises
      2. UPDATE increasing qty/price  → total rises or stays
      3. DELETE removed + reduce qty  → total falls to final value

    return_stock_on_delete:
      True  = existing rows hold deducted stock (PREPARING/PACKED/SHIPPING)
      False = existing rows are reference-only (PENDING)
    """

    def _parse_qty_price(item):
        try:
            qty = int(item.get('quantity') or item.get('qty') or item.get('order_quantity') or 1) or 1
        except (ValueError, TypeError):
            qty = 1
        try:
            amount = float(item.get('amount') or item.get('order_total') or 0)
        except (ValueError, TypeError):
            amount = 0.0
        return qty, round(amount / qty, 4) if qty else 0.0

    # ── Load existing rows ────────────────────────────────────────────────────
    cur.execute("""
        SELECT od.batch_id, od.order_quantity, od.unit_price, ib.inventory_brand_id
        FROM   order_details od
        JOIN   inventory_batch ib ON ib.batch_id = od.batch_id
        WHERE  od.order_id = %s
    """, (order_id,))
    existing = {}   # { inv_brand_id: [(batch_id, qty, unit_price), ...] }
    for batch_id, qty, up, ibid in cur.fetchall():
        existing.setdefault(ibid, []).append((batch_id, int(qty), float(up or 0)))

    # ── Parse incoming items ──────────────────────────────────────────────────
    incoming = {}   # { inv_brand_id: (qty, unit_price) }
    for item in incoming_items:
        raw_id = item.get('inventory_brand_id')
        if not raw_id or str(raw_id).strip() == '':
            continue
        qty, up = _parse_qty_price(item)
        incoming[int(raw_id)] = (qty, up)

    new_ids     = set(incoming) - set(existing)
    updated_ids = set(incoming) & set(existing)
    deleted_ids = set(existing) - set(incoming)

    # ════════════════════════════════════════════════════════════════════
    # PHASE 1 — INSERT new brands (raises total)
    # ════════════════════════════════════════════════════════════════════
    for ibid in new_ids:
        qty, up = incoming[ibid]
        alloc = _fifo_allocate(cur, ibid, qty)
        for batch_id, take in alloc:
            cur.execute("""
                INSERT INTO order_details (order_id, batch_id, order_quantity, unit_price, order_total)
                VALUES (%s, %s, %s, %s, %s)
            """, (order_id, batch_id, take, up, round(up * take, 4)))
            cur.execute("""
                UPDATE inventory_batch
                SET quantity_on_hand = quantity_on_hand - %s WHERE batch_id = %s
            """, (take, batch_id))
        _mark_out_of_stock_if_empty(cur, ibid)

    # ════════════════════════════════════════════════════════════════════
    # PHASE 2 — UPDATE existing: qty increases + price changes (raises total)
    # ════════════════════════════════════════════════════════════════════
    for ibid in updated_ids:
        qty, up   = incoming[ibid]
        old_rows  = existing[ibid]
        old_qty   = sum(r[1] for r in old_rows)
        delta     = qty - old_qty

        if delta > 0:
            alloc = _fifo_allocate(cur, ibid, delta)
            for batch_id, take in alloc:
                # If this batch already has a row for this order, merge into it
                cur.execute("""
                    SELECT order_quantity FROM order_details
                    WHERE order_id = %s AND batch_id = %s
                """, (order_id, batch_id))
                existing_row = cur.fetchone()
                if existing_row:
                    new_row_qty = existing_row[0] + take
                    cur.execute("""
                        UPDATE order_details
                        SET order_quantity = %s, order_total = %s, unit_price = %s
                        WHERE order_id = %s AND batch_id = %s
                    """, (new_row_qty, round(up * new_row_qty, 4), up, order_id, batch_id))
                else:
                    cur.execute("""
                        INSERT INTO order_details
                            (order_id, batch_id, order_quantity, unit_price, order_total)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (order_id, batch_id, take, up, round(up * take, 4)))
                cur.execute("""
                    UPDATE inventory_batch
                    SET quantity_on_hand = quantity_on_hand - %s WHERE batch_id = %s
                """, (take, batch_id))
            _mark_out_of_stock_if_empty(cur, ibid)

        # Update unit_price on all pre-existing rows (handles price-only changes)
        for batch_id, row_qty, old_up in old_rows:
            if abs(old_up - up) > 0.0001:
                cur.execute("""
                    UPDATE order_details
                    SET unit_price = %s, order_total = order_quantity * %s
                    WHERE order_id = %s AND batch_id = %s
                """, (up, up, order_id, batch_id))

    # ════════════════════════════════════════════════════════════════════
    # PHASE 3 — Reduce quantities + DELETE removed brands (lowers total last)
    # ════════════════════════════════════════════════════════════════════

    # 3a. Reduce qty for updated items where new_qty < old_qty
    for ibid in updated_ids:
        qty, up  = incoming[ibid]
        old_rows = existing[ibid]
        old_qty  = sum(r[1] for r in old_rows)
        to_trim  = old_qty - qty

        if to_trim > 0:
            for batch_id, row_qty, _ in reversed(old_rows):
                if to_trim <= 0:
                    break
                take      = min(row_qty, to_trim)
                remaining = row_qty - take
                if remaining == 0:
                    cur.execute("""
                        DELETE FROM order_details WHERE order_id = %s AND batch_id = %s
                    """, (order_id, batch_id))
                else:
                    cur.execute("""
                        UPDATE order_details
                        SET order_quantity = %s, order_total = %s, unit_price = %s
                        WHERE order_id = %s AND batch_id = %s
                    """, (remaining, round(up * remaining, 4), up, order_id, batch_id))
                if return_stock_on_delete:
                    cur.execute("""
                        UPDATE inventory_batch
                        SET quantity_on_hand = quantity_on_hand + %s WHERE batch_id = %s
                    """, (take, batch_id))
                    _flip_to_available(cur, ibid)
                to_trim -= take

    # 3b. Delete entirely removed brands
    for ibid in deleted_ids:
        for batch_id, row_qty, _ in existing[ibid]:
            cur.execute("""
                DELETE FROM order_details WHERE order_id = %s AND batch_id = %s
            """, (order_id, batch_id))
            if return_stock_on_delete:
                cur.execute("""
                    UPDATE inventory_batch
                    SET quantity_on_hand = quantity_on_hand + %s WHERE batch_id = %s
                """, (row_qty, batch_id))
        if return_stock_on_delete:
            _flip_to_available(cur, ibid)


def _insert_and_deduct_items(cur, order_id, items):
    """
    Inserts order_details rows using FIFO batch allocation and deducts
    quantity_on_hand from each allocated batch.
    Marks inventory OUT_OF_STOCK when all batches for a brand are exhausted.
    """
    for item in items:
        inv_brand_id = item.get('inventory_brand_id')
        if not inv_brand_id or str(inv_brand_id).strip() == "":
            continue

        # Validate brand / inventory status
        cur.execute("""
            SELECT ibr.inventory_id, ss.status_code, i.item_name
            FROM inventory_brand ibr
            JOIN inventory i ON i.inventory_id = ibr.inventory_id
            JOIN static_status ss ON i.item_status_id = ss.status_id
            WHERE ibr.inventory_brand_id = %s
        """, (inv_brand_id,))
        inv_check = cur.fetchone()
        if not inv_check:
            raise Exception(f"Variant ID {inv_brand_id} not found.")
        inv_id, status_code, item_name = inv_check
        if status_code == 'INACTIVE':
            raise Exception(f"Cannot add '{item_name}' because it has been archived.")

        try:
            qty = int(item.get('quantity') or item.get('qty') or item.get('order_quantity') or 1) or 1
        except (ValueError, TypeError):
            qty = 1
        try:
            amount = float(item.get('amount') or item.get('order_total') or 0)
        except (ValueError, TypeError):
            amount = 0.0

        unit_price = (amount / qty) if qty > 0 else 0.0

        # FIFO allocation across batches
        allocation = _fifo_allocate(cur, inv_brand_id, qty)

        for batch_id, batch_qty in allocation:
            batch_amount = round(unit_price * batch_qty, 4)
            cur.execute("""
                INSERT INTO order_details
                    (order_id, batch_id, order_quantity, unit_price, order_total)
                VALUES (%s, %s, %s, %s, %s)
            """, (order_id, batch_id, batch_qty, unit_price, batch_amount))

            cur.execute("""
                UPDATE inventory_batch
                SET quantity_on_hand = quantity_on_hand - %s
                WHERE batch_id = %s
            """, (batch_qty, batch_id))

        # Mark OUT_OF_STOCK if all batches for this brand are now empty
        cur.execute("""
            SELECT COALESCE(SUM(quantity_on_hand), 0)
            FROM inventory_batch WHERE inventory_brand_id = %s
        """, (inv_brand_id,))
        if cur.fetchone()[0] <= 0:
            cur.execute("""
                UPDATE inventory
                SET item_status_id = (
                    SELECT status_id FROM static_status
                    WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'OUT_OF_STOCK'
                    LIMIT 1
                )
                WHERE inventory_id = %s
            """, (inv_id,))


def _insert_menu_items_bom(cur, order_id, items):
    """
    BOM/Recipe-aware order item insertion with ingredient-level customizations
    and expiry-first FIFO batch deduction.

    Steps performed for each item:
      B  — INSERT into order_menu_item → get order_menu_item_id
      C  — INSERT each modification into order_menu_item_ingredient
      D  — Fetch default recipe from menu_item_ingredient, scale by qty
      E  — Apply modifications in-memory (REMOVED skips, EXTRA adds delta)
      F  — FIFO-deduct each required ingredient from inventory_batch
      G  — Audit every deduction in order_menu_item_ingredient_batch
    """
    for item in items:
        menu_item_id = item.get("menu_item_id")
        if not menu_item_id:
            raise Exception("Each item must include a menu_item_id.")

        try:
            qty        = int(item.get("quantity") or 1) or 1
            unit_price = float(item.get("unit_price") or 0)
        except (ValueError, TypeError):
            qty, unit_price = 1, 0.0

        notes         = item.get("notes") or ""
        modifications = item.get("modifications") or []

        # ── Step B: Insert the menu-item line ────────────────────────────────
        line_total = round(qty * unit_price, 2)
        cur.execute("""
            INSERT INTO order_menu_item
                (order_id, menu_item_id, quantity, unit_price, line_total, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING order_menu_item_id
        """, (order_id, menu_item_id, qty, unit_price, line_total, notes))
        order_menu_item_id = cur.fetchone()[0]

        # ── Step C: Persist customizations ───────────────────────────────────
        for mod in modifications:
            ing_brand_id   = mod.get("ingredient_brand_id")
            action_code    = (mod.get("action_code") or "").upper()
            quantity_delta = mod.get("quantity_delta") or None
            if not ing_brand_id or not action_code:
                continue
            cur.execute("""
                INSERT INTO order_menu_item_ingredient
                    (order_menu_item_id, ingredient_brand_id, action_code, quantity_delta)
                VALUES (%s, %s, %s, %s)
            """, (order_menu_item_id, ing_brand_id, action_code, quantity_delta))

        # ── Step D: Fetch recipe and scale by order quantity ─────────────────
        cur.execute("""
            SELECT ingredient_inventory_brand_id, quantity_required
            FROM menu_item_ingredient
            WHERE menu_item_id = %s
        """, (menu_item_id,))
        # required = { ingredient_inventory_brand_id: total_qty_needed }
        required = {
            row[0]: float(row[1]) * qty
            for row in cur.fetchall()
        }

        # ── Step E: Apply modifications in-memory ────────────────────────────
        for mod in modifications:
            ing_brand_id = mod.get("ingredient_brand_id")
            action       = (mod.get("action_code") or "").upper()
            if not ing_brand_id:
                continue
            if action == "REMOVED":
                required.pop(ing_brand_id, None)
            elif action == "EXTRA":
                delta = float(mod.get("quantity_delta") or 0)
                if ing_brand_id in required:
                    required[ing_brand_id] += delta
                else:
                    # EXTRA on an ingredient not in the base recipe adds it
                    required[ing_brand_id] = delta

        # ── Steps F + G: FIFO deduction and audit trail ───────────────────────
        for ing_brand_id, qty_needed in required.items():
            if qty_needed <= 0:
                continue

            # F — raises Exception (→ 400) if stock is insufficient
            allocation = _fifo_allocate_ingredient(cur, ing_brand_id, qty_needed)

            for batch_id, qty_taken in allocation:
                # Deduct stock from this batch
                cur.execute("""
                    UPDATE inventory_batch
                    SET quantity_on_hand = quantity_on_hand - %s
                    WHERE batch_id = %s
                """, (qty_taken, batch_id))

                # G — audit trail row
                cur.execute("""
                    INSERT INTO order_menu_item_ingredient_batch
                        (order_menu_item_id, inventory_brand_id, batch_id, quantity_deducted)
                    VALUES (%s, %s, %s, %s)
                """, (order_menu_item_id, ing_brand_id, batch_id, qty_taken))

            # Mark ingredient OUT_OF_STOCK if all its batches are now empty
            _mark_out_of_stock_if_empty(cur, ing_brand_id)


def _insert_items_only(cur, order_id, items):
    """
    Inserts order_details rows for a PENDING order without touching stock.
    Picks the oldest available batch per brand for FK reference only.
    """
    for item in items:
        inv_brand_id = item.get('inventory_brand_id')
        if not inv_brand_id or str(inv_brand_id).strip() == "":
            continue
        try:
            qty = int(item.get('quantity') or item.get('qty') or item.get('order_quantity') or 1) or 1
        except (ValueError, TypeError):
            qty = 1
        try:
            amount = float(item.get('amount') or item.get('order_total') or 0)
        except (ValueError, TypeError):
            amount = 0.0
        unit_price = (amount / qty) if qty > 0 else 0.0

        # Pick oldest batch for FK reference — no stock deduction
        cur.execute("""
            SELECT batch_id FROM inventory_batch
            WHERE inventory_brand_id = %s AND quantity_on_hand > 0
            ORDER BY date_created ASC LIMIT 1
        """, (inv_brand_id,))
        batch_row = cur.fetchone()
        if not batch_row:
            continue
        batch_id = batch_row[0]

        cur.execute("""
            INSERT INTO order_details
                (order_id, batch_id, order_quantity, unit_price, order_total)
            VALUES (%s, %s, %s, %s, %s)
        """, (order_id, batch_id, qty, unit_price, amount))



def _create_sales_record(cur, order_id):
    """
    Inserts a row into sales_transaction when an order is marked COMPLETED.
    Skips silently if a record already exists for this order.
    """
    # Check if a sales record already exists
    cur.execute(
        "SELECT sales_id FROM sales_transaction WHERE order_id = %s LIMIT 1",
        (order_id,)
    )
    if cur.fetchone():
        return  # Already recorded — idempotent

    # Resolve the PENDING payment status id (auto-fix will upgrade to PAID later)
    cur.execute("""
        SELECT status_id FROM static_status
        WHERE status_scope = 'SALES_STATUS' AND status_code = 'PENDING'
        LIMIT 1
    """)
    pending_row = cur.fetchone()

    # Fallback: try PAID if PENDING doesn't exist
    if not pending_row:
        cur.execute("""
            SELECT status_id FROM static_status
            WHERE status_scope = 'SALES_STATUS' AND status_code = 'PAID'
            LIMIT 1
        """)
        pending_row = cur.fetchone()

    if not pending_row:
        raise Exception("No PENDING or PAID status found in SALES_STATUS scope.")

    payment_status_id = pending_row[0]

    # Fetch payment_method_id from the order
    cur.execute("""
        SELECT payment_method_id
        FROM order_transaction
        WHERE order_id = %s
    """, (order_id,))
    order_row = cur.fetchone()
    payment_method_id = order_row[0] if order_row else None

    cur.execute("""
        INSERT INTO sales_transaction
            (order_id, sales_date, payment_status_id, employee_id, payment_method_id)
        VALUES (%s, CURRENT_DATE, %s, %s, %s)
    """, (order_id, payment_status_id, 1, payment_method_id))


# ================= STATUS-ONLY UPDATE =================
@orders_bp.route("/<string:order_id>/status", methods=["PATCH", "OPTIONS"])
def update_order_status(order_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    data   = request.json or {}
    status_name = data.get('status', '').strip()
    if not status_name:
        return jsonify({"error": "status is required"}), 400

    conn = get_connection()
    cur  = conn.cursor()
    try:
        # Fetch current status — terminal states block all edits
        cur.execute("""
            SELECT ss.status_code
            FROM order_transaction ot
            JOIN static_status ss ON ot.order_status_id = ss.status_id
            WHERE ot.order_id = %s
        """, (order_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Order not found."}), 404
        current_code = row[0].upper()
        if current_code in ('COMPLETED', 'CANCELLED'):
            return jsonify({"error": f"Cannot edit an order that is already {current_code}."}), 400

        # Resolve target status
        cur.execute("""
            SELECT status_id, status_code FROM static_status
            WHERE status_scope = 'ORDER_STATUS' AND status_name ILIKE %s
        """, (status_name,))
        status_row = cur.fetchone()
        if not status_row:
            return jsonify({"error": f"Unknown status: {status_name}"}), 400

        new_status_id, new_status_code = status_row
        new_status_code = new_status_code.upper()

        # Treat legacy RECEIVED as COMPLETED
        if new_status_code == 'RECEIVED':
            new_status_code = 'COMPLETED'

        # Only COMPLETED and CANCELLED are valid from PREPARING
        if new_status_code not in ('COMPLETED', 'CANCELLED'):
            return jsonify({"error": "Orders can only transition to Completed or Cancelled."}), 400

        cancelled_date = None

        if new_status_code == 'COMPLETED':
            _apply_completed_payment(cur, order_id, new_status_id)

        elif new_status_code == 'CANCELLED':
            _restore_batch_items(cur, order_id)
            cur.execute("""
                UPDATE order_transaction
                SET order_status_id = %s,
                    cancelled_date  = CURRENT_TIMESTAMP
                WHERE order_id = %s
                RETURNING cancelled_date
            """, (new_status_id, order_id))
            row = cur.fetchone()
            cancelled_date = row[0].isoformat() if row and row[0] else None

        conn.commit()
        return jsonify({
            "message":        "Order status updated successfully",
            "cancelled_date": cancelled_date,
        }), 200

    except Exception as e:
        conn.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ================= UPDATE ORDER =================
@orders_bp.route("/update/<string:order_id>", methods=["PUT", "OPTIONS"])
def update_order(order_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    data = request.json
    conn = get_connection()
    cur  = conn.cursor()

    try:
        # Terminal states block all edits
        cur.execute("""
            SELECT ss.status_code
            FROM order_transaction ot
            JOIN static_status ss ON ot.order_status_id = ss.status_id
            WHERE ot.order_id = %s
        """, (order_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Order not found."}), 404
        current_status = row[0].upper()
        if current_status in ('COMPLETED', 'CANCELLED'):
            return jsonify({"error": f"Cannot edit an order that is already {current_status}."}), 400

        # Resolve target status
        status_name = data.get('status', '').strip()
        cur.execute("""
            SELECT status_id, status_code
            FROM static_status
            WHERE status_scope = 'ORDER_STATUS' AND status_name ILIKE %s
        """, (status_name,))
        status_row      = cur.fetchone()
        new_status_id   = status_row[0] if status_row else None
        new_status_code = status_row[1].upper() if status_row else None

        # Resolve payment method
        pm_name = data.get('paymentMethod', '').strip()
        cur.execute("""
            SELECT status_id FROM static_status
            WHERE status_scope = 'PAYMENT_METHOD' AND status_name ILIKE %s
        """, (pm_name,))
        pm_row    = cur.fetchone()
        new_pm_id = pm_row[0] if pm_row else None

        # Update customer info
        cur.execute("SELECT customer_id FROM order_transaction WHERE order_id = %s", (order_id,))
        cust_row = cur.fetchone()
        if cust_row:
            cur.execute("""
                UPDATE customer
                SET customer_name = %s, customer_contact = %s
                WHERE customer_id = %s
            """, (data.get('customerName'), data.get('contact'), cust_row[0]))

        # Treat legacy RECEIVED as COMPLETED
        if new_status_code == 'RECEIVED':
            new_status_code = 'COMPLETED'

        cancelled_date = None

        if new_status_code == 'COMPLETED':
            _apply_completed_payment(cur, order_id, new_status_id)

        elif new_status_code == 'CANCELLED':
            _restore_batch_items(cur, order_id)
            cur.execute("""
                UPDATE order_transaction
                SET order_status_id = %s,
                    cancelled_date  = CURRENT_TIMESTAMP
                WHERE order_id = %s
                RETURNING cancelled_date
            """, (new_status_id, order_id))
            row = cur.fetchone()
            cancelled_date = row[0].isoformat() if row and row[0] else None

        elif new_status_code == 'PREPARING' and new_status_id:
            cur.execute("""
                UPDATE order_transaction SET order_status_id = %s WHERE order_id = %s
            """, (new_status_id, order_id))

        if new_pm_id:
            cur.execute("""
                UPDATE order_transaction SET payment_method_id = %s WHERE order_id = %s
            """, (new_pm_id, order_id))

        conn.commit()
        return jsonify({
            "message":        "Order updated successfully",
            "cancelled_date": cancelled_date,
        }), 200

    except Exception as e:
        conn.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ================= ADD ORDER =================
@orders_bp.route("/add", methods=["POST", "OPTIONS"])
def add_order():
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    data = request.json
    conn = get_connection()
    cur  = conn.cursor()

    try:
        customer_name  = data.get('customerName', '').strip()
        contact_number = (data.get('contactNumber') or data.get('contact') or '').strip() or 'N/A'
        items          = data.get('items', [])

        if not customer_name:
            return jsonify({"error": "customerName is required."}), 400

        # 1. Customer upsert
        cur.execute("SELECT customer_id FROM customer WHERE customer_name = %s", (customer_name,))
        existing_cust = cur.fetchone()
        if existing_cust:
            customer_id = existing_cust[0]
            cur.execute("UPDATE customer SET customer_contact = %s WHERE customer_id = %s",
                        (contact_number, customer_id))
        else:
            cur.execute("""
                INSERT INTO customer (customer_name, customer_contact, customer_email, customer_address)
                VALUES (%s, %s, %s, %s) RETURNING customer_id
            """, (customer_name, contact_number, 'no-email@placeholder.com', 'Walk-in'))
            customer_id = cur.fetchone()[0]

        # 2. All new orders start as PREPARING
        cur.execute("""
            SELECT status_id FROM static_status
            WHERE status_scope = 'ORDER_STATUS' AND status_code = 'PREPARING'
            LIMIT 1
        """)
        status_row = cur.fetchone()
        if not status_row:
            return jsonify({"error": "PREPARING status not found in static_status."}), 500
        status_id = status_row[0]

        # 3. Payment method from first item (optional)
        first_item_pm = items[0].get('paymentMethod', 'Cash').strip() if items else 'Cash'
        cur.execute("""
            SELECT status_id FROM static_status
            WHERE status_scope = 'PAYMENT_METHOD' AND status_name ILIKE %s
        """, (first_item_pm,))
        pm_row = cur.fetchone()
        pm_id  = pm_row[0] if pm_row else None

        # 4. Payment always starts as PENDING (Unpaid)
        payment_status_id = _get_pending_status_id(cur)

        # 5. Create order transaction
        cur.execute("""
            INSERT INTO order_transaction
                (customer_id, order_date, order_status_id, payment_method_id, payment_status_id)
            VALUES (%s, CURRENT_DATE, %s, %s, %s) RETURNING order_id
        """, (customer_id, status_id, pm_id, payment_status_id))
        order_id = cur.fetchone()[0]

        # 6. Insert BOM items with ingredient-level FIFO deduction
        _insert_menu_items_bom(cur, order_id, items)

        # 7. Sync total_amount from inserted BOM lines
        cur.execute("""
            UPDATE order_transaction
            SET total_amount = (
                SELECT COALESCE(SUM(line_total), 0)
                FROM order_menu_item WHERE order_id = %s
            )
            WHERE order_id = %s
        """, (order_id, order_id))

        conn.commit()
        return jsonify({"message": "Order added successfully!", "order_id": order_id}), 201

    except Exception as e:
        conn.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ================= CREATE ORDER — BOM/Recipe (POST /api/orders) =================
@orders_bp.route("", methods=["POST", "OPTIONS"])
def create_order():
    """
    Create an order using the BOM/Recipe system.

    Expected payload:
    {
        "customer_id": 1,
        "status_id": 2,
        "payment_method_id": 3,
        "payment_status_id": 4,
        "items": [
            {
                "menu_item_id": 5,
                "quantity": 2,
                "unit_price": 150.00,
                "notes": "No creamer",
                "modifications": [
                    { "ingredient_brand_id": 12, "action_code": "REMOVED" },
                    { "ingredient_brand_id": 14, "action_code": "EXTRA", "quantity_delta": 5 }
                ]
            }
        ]
    }
    """
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    data = request.json or {}
    conn = get_connection()
    cur  = conn.cursor()

    try:
        customer_id       = data.get("customer_id")
        payment_method_id = data.get("payment_method_id")
        items             = data.get("items") or []

        if not customer_id:
            return jsonify({"error": "customer_id is required."}), 400
        if not items:
            return jsonify({"error": "items cannot be empty."}), 400

        # All orders start as PREPARING
        cur.execute("""
            SELECT status_id FROM static_status
            WHERE status_scope = 'ORDER_STATUS' AND status_code = 'PREPARING' LIMIT 1
        """)
        status_row = cur.fetchone()
        if not status_row:
            return jsonify({"error": "PREPARING status not found in static_status."}), 500
        status_id = status_row[0]

        # Payment always starts as PENDING (Unpaid)
        payment_status_id = _get_pending_status_id(cur)

        # ── Step A: Insert order_transaction ──────────────────────────────────
        total_amount = sum(
            float(i.get("unit_price") or 0) * int(i.get("quantity") or 1)
            for i in items
        )
        cur.execute("""
            INSERT INTO order_transaction
                (customer_id, order_date, order_status_id, payment_method_id,
                 payment_status_id, total_amount)
            VALUES (%s, CURRENT_DATE, %s, %s, %s, %s)
            RETURNING order_id
        """, (customer_id, status_id, payment_method_id, payment_status_id, total_amount))
        order_id = cur.fetchone()[0]

        # ── Steps B–G: BOM item insertion, customizations, FIFO deduction ─────
        _insert_menu_items_bom(cur, order_id, items)

        conn.commit()
        return jsonify({"message": "Order created successfully.", "order_id": order_id}), 201

    except Exception as e:
        conn.rollback()
        import traceback
        traceback.print_exc()
        status_code = 400 if "Insufficient stock" in str(e) else 500
        return jsonify({"error": str(e)}), status_code
    finally:
        cur.close()
        conn.close()


# ================= MENU ITEMS — sellable products only (GET /api/orders/menu) =================
@orders_bp.route("/menu", methods=["GET"])
def get_menu_items():
    """
    Return only sellable menu items for the order-form dropdown.
    The query starts from menu_item (the whitelist table) and INNER JOINs to
    inventory_brand — so raw ingredients that are NOT in menu_item can never
    appear, regardless of what lives in inventory_brand.

    Query param: q  (optional — name / description search)
    Response:    [{ menu_item_id, menu_item_name, base_price, description, inventory_brand_id }]
    """
    print(f"[GET /api/orders/menu] hit — q={request.args.get('q', '')!r}")
    q    = request.args.get("q", "").strip()
    conn = get_connection()
    cur  = conn.cursor()
    try:
        # menu_item is self-contained: name, price, and category are stored directly
        # on the row. linked_inventory_brand_id is the optional FK used only for
        # ingredient fetching. No joins to inventory_brand/inventory needed here.
        sql = """
            SELECT
                mi.menu_item_id,
                mi.menu_item_name,
                mi.base_price,
                COALESCE(mi.menu_category, '')         AS description,
                mi.linked_inventory_brand_id
            FROM  menu_item mi
            WHERE mi.is_active = TRUE
        """
        if q:
            like = f"%{q}%"
            cur.execute(sql + " AND (mi.menu_item_name ILIKE %s OR mi.menu_category ILIKE %s)"
                              " ORDER BY mi.menu_item_name LIMIT 40", (like, like))
        else:
            cur.execute(sql + " ORDER BY mi.menu_item_name LIMIT 40")

        rows   = cur.fetchall()
        result = [
            {
                "menu_item_id":             row[0],
                "menu_item_name":           row[1],
                "base_price":               float(row[2]),
                "description":              row[3],
                "inventory_brand_id":       row[4],   # linked_inventory_brand_id — may be None
            }
            for row in rows
        ]
        print(f"[GET /api/orders/menu] returning {len(result)} item(s)")
        return jsonify(result), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[GET /api/orders/menu] ERROR: {e}")
        conn.rollback()
        # Return an empty list so the dropdown shows "No menu items found"
        # instead of an unhandled 500 that leaves the spinner running.
        return jsonify([]), 200

    finally:
        cur.close()
        conn.close()