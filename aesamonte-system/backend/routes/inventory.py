from flask import Blueprint, jsonify, request
from database.db_config import get_connection
from datetime import datetime

inventory_bp = Blueprint("inventory", __name__)

# ================= GET INVENTORY =================
@inventory_bp.route("/api/inventory", methods=["GET"])
def get_inventory():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                i.inventory_id,
                i.item_name,
                i.item_description,
                i.item_sku,
                i.brand,
                i.item_quantity,
                u.uom_code AS uom,
                s.status_name AS item_status,
                i.item_unit_price,
                i.item_selling_price,
                i.item_status_id
            FROM inventory i
            LEFT JOIN unit_of_measure u ON i.unit_of_measure = u.uom_id
            JOIN static_status s ON i.item_status_id = s.status_id
            ORDER BY i.inventory_id ASC;
        """)
        rows = cur.fetchall()
    except Exception as e:
        print("Inventory GET error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

    result = []
    for r in rows:
        status_id = r[10]
        
        # ID 4 is definitively "INACTIVE" in your static_status table
        is_arch = (status_id == 4) 
        
        # This will print to your Python terminal so we can catch the culprit!
        print(f"DEBUG INVENTORY GET: {r[0]} | Status ID in DB: {status_id} | Sent as Archived: {is_arch}")
        
        result.append({
            "id": r[0],
            "item_name": r[1],
            "item_description": r[2],
            "sku": r[3],
            "brand": r[4],
            "qty": int(r[5] or 0),
            "uom": r[6] or '—',
            "status": r[7] or 'Unknown',
            "unitPrice": float(r[8] or 0),
            "price": float(r[9] or 0),
            "is_archived": is_arch
        })

    return jsonify(result)

# ===================== TOGGLE ARCHIVE =====================
@inventory_bp.route("/api/inventory/archive/<string:inventory_id>", methods=["PUT", "OPTIONS"])
def toggle_inventory_archive(inventory_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    conn = get_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT ss.status_code, i.item_quantity 
            FROM inventory i
            JOIN static_status ss ON i.item_status_id = ss.status_id
            WHERE i.inventory_id = %s
        """, (inventory_id,))
        
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Item not found in DB."}), 404
            
        current_status = row[0]
        qty = int(row[1] or 0)
        
        if current_status == 'INACTIVE':
            # 1. Logic for RESTORING
            target_code = 'AVAILABLE' if qty > 0 else 'OUT_OF_STOCK'
            cur.execute("SELECT status_id, status_name FROM static_status WHERE status_scope = 'INVENTORY_STATUS' AND status_code = %s", (target_code,))
            res = cur.fetchone()
            
            new_status_id = res[0]
            new_status_name = res[1] # Extracts 'Available' or 'Out of Stock' for the UI Pill
            is_archived = False
            action_msg = "Restored from Archive" # Matches Sales Module Toast
            
        else:
            # 2. Logic for ARCHIVING
            cur.execute("SELECT status_id, status_name FROM static_status WHERE status_scope = 'INVENTORY_STATUS' AND status_code = 'INACTIVE'")
            res = cur.fetchone()
            
            new_status_id = res[0]
            new_status_name = res[1] 
            is_archived = True
            action_msg = "Moved to Archive"

        # --- THE MAGIC BULLET (Bypasses PostgreSQL Triggers) ---
        cur.execute("SET LOCAL session_replication_role = 'replica';")
        
        cur.execute("UPDATE inventory SET item_status_id = %s WHERE inventory_id = %s", (new_status_id, inventory_id))
        
        if cur.rowcount == 0:
            raise Exception("Database blocked the update! Check Supabase RLS policies.")
            
        conn.commit()
        
        return jsonify({
            "message": action_msg,             # Populates the Success Toast perfectly
            "is_archived": is_archived,        # Moves item between tables
            "new_status": new_status_name      # Restores the Green/Red colored pill styling!
        }), 200
        
    except Exception as e:
        conn.rollback()
        print("Error archiving:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# ================= ADD BATCH INVENTORY =================
@inventory_bp.route("/api/inventory/add", methods=["POST"])
def add_inventory_batch():
    conn = get_connection()
    cur = conn.cursor()
    try:
        items = request.get_json()
        if not items or not isinstance(items, list):
            return jsonify({"error": "Invalid data format."}), 400

        for item in items:
            import json as _json
            uom_code = item.get('uom')
            if not uom_code or uom_code == 'Select':
                raise Exception(f"UOM missing for {item.get('itemName')}")

            cur.execute("SELECT uom_id FROM unit_of_measure WHERE uom_code = %s", (uom_code,))
            uom_res = cur.fetchone()
            if not uom_res: raise Exception(f"UOM '{uom_code}' not found.")
            uom_id = uom_res[0]

            # Resolve all suppliers; primary is index 0
            suppliers = item.get('suppliers', [])
            if not suppliers and item.get('supplierName'):
                suppliers = [{'supplierName': item['supplierName'], 'leadTime': item.get('leadTime', 0), 'minOrder': item.get('minOrder', 0), 'isPrimary': True}]

            supplier_id = None
            supplier_ids_json = _json.dumps([])
            if suppliers:
                # Resolve all supplier IDs from existing supplier table
                resolved = []
                for sup in suppliers:
                    sname = sup.get('supplierName')
                    if not sname: continue
                    cur.execute("SELECT supplier_id FROM supplier WHERE supplier_name = %s", (sname,))
                    s_res = cur.fetchone()
                    if not s_res: raise Exception(f"Supplier '{sname}' not found.")
                    resolved.append({
                        "supplier_id": s_res[0],
                        "supplierName": sname,
                        "leadTime": int(sup.get('leadTime') or 0),
                        "minOrder": int(sup.get('minOrder') or 0),
                        "isPrimary": sup.get('isPrimary', False),
                    })
                if resolved:
                    supplier_id = resolved[0]['supplier_id']
                    supplier_ids_json = _json.dumps(resolved)

            # Insert inventory (supplier_ids stored as JSONB for multi-supplier)
            cur.execute("""
                INSERT INTO public.inventory (
                    supplier_id, item_name, item_description, item_sku, brand,
                    unit_of_measure, item_quantity, item_unit_price, item_selling_price, item_status_id, supplier_ids
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 1, %s)
                RETURNING inventory_id
            """, (
                supplier_id, item['itemName'], item.get('itemDescription'),
                item.get('internalSku'), item.get('brand'), uom_id,
                int(item.get('qty', 0)), float(item.get('unitPrice', 0)), float(item.get('sellingPrice', 0)),
                supplier_ids_json
            ))
            new_inventory_id = cur.fetchone()[0]

            # Insert inventory_action using primary supplier's lead/min
            primary = suppliers[0] if suppliers else {}
            lead_time = int(primary.get('leadTime') or 0)
            min_order = int(primary.get('minOrder') or 0)
            cur.execute("""
                INSERT INTO public.inventory_action (inventory_id, suggestion_date, stockout_predict, lead_time_days, min_order_qty, reorder_qty)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (new_inventory_id, datetime.now(), False, lead_time, min_order, int(item.get('reorderPoint') or 0)))

        conn.commit()
        return jsonify({"message": f"Successfully saved {len(items)} items"}), 201
    except Exception as e:
        conn.rollback()
        print("Batch Save Error:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# ================= GET UOMs =================
@inventory_bp.route("/api/uom", methods=["GET"])
def get_uoms():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT uom_id, uom_code, uom_name
            FROM unit_of_measure
            WHERE is_active = true
            ORDER BY uom_name ASC
        """)
        rows = cur.fetchall()
    except Exception as e:
        print("UOM GET error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

    return jsonify([{"id": r[0], "code": r[1], "name": r[2]} for r in rows])

# ================= Edit Inventory Item =================
@inventory_bp.route("/api/inventory/<string:id>", methods=["GET"])
def get_inventory_item(id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                i.inventory_id, i.item_name, i.item_description, i.item_sku, i.brand,
                i.item_quantity, u.uom_code, i.item_unit_price, i.item_selling_price,
                s.supplier_name, s.contact_person, s.supplier_contact,
                ia.lead_time_days, ia.min_order_qty, ia.reorder_qty,
                i.supplier_ids
            FROM inventory i
            LEFT JOIN supplier s ON i.supplier_id = s.supplier_id
            LEFT JOIN unit_of_measure u ON i.unit_of_measure = u.uom_id
            LEFT JOIN inventory_action ia ON i.inventory_id = ia.inventory_id
            WHERE i.inventory_id = %s
        """, (id,))
        r = cur.fetchone()

        if not r:
            return jsonify({"error": "Item not found"}), 404

        import json as _json
        raw_sup_ids = r[15]
        if raw_sup_ids:
            suppliers_list = raw_sup_ids if isinstance(raw_sup_ids, list) else _json.loads(raw_sup_ids)
            for sup in suppliers_list:
                if sup.get('supplier_id'):
                    cur.execute("SELECT contact_person, supplier_contact FROM supplier WHERE supplier_id = %s", (sup['supplier_id'],))
                    cr = cur.fetchone()
                    if cr:
                        sup['contactPerson'] = cr[0] or ''
                        sup['contactNumber'] = cr[1] or ''
        else:
            suppliers_list = [{
                "supplierName": r[9] or '', "contactPerson": r[10] or '', "contactNumber": r[11] or '',
                "leadTime": r[12] or 0, "minOrder": r[13] or 0, "isPrimary": True
            }] if r[9] else []

        return jsonify({
            "id": r[0], "itemName": r[1], "itemDescription": r[2], "sku": r[3], "brand": r[4],
            "qty": r[5], "uom": r[6] or 'Select', "unitPrice": float(r[7]), "sellingPrice": float(r[8]),
            "supplierName": r[9] or '', "contactPerson": r[10] or '', "contactNumber": r[11] or '',
            "leadTime": r[12] or 0, "minOrder": r[13] or 0, "reorderPoint": r[14] or 0,
            "suppliers": suppliers_list,
        })
    except Exception as e:
        print("Inventory item GET error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@inventory_bp.route("/api/inventory/update/<string:id>", methods=["PUT"])
def update_inventory_item(id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        data = request.get_json()

        uom_code = data.get('uom')
        if not uom_code or uom_code == 'Select':
            return jsonify({"error": "UOM is required"}), 400

        cur.execute("SELECT uom_id FROM unit_of_measure WHERE uom_code = %s", (uom_code,))
        uom_res = cur.fetchone()
        if not uom_res: return jsonify({"error": "UOM not found"}), 400
        uom_id = uom_res[0]

        import json as _json
        # Resolve all suppliers from supplier table
        suppliers = data.get('suppliers', [])
        if not suppliers and data.get('supplierName'):
            suppliers = [{'supplierName': data['supplierName'], 'leadTime': data.get('leadTime', 0), 'minOrder': data.get('minOrder', 0), 'isPrimary': True}]

        supplier_id = None
        supplier_ids_json = _json.dumps([])
        if suppliers:
            resolved = []
            for sup in suppliers:
                sname = sup.get('supplierName')
                if not sname: continue
                cur.execute("SELECT supplier_id FROM supplier WHERE supplier_name = %s", (sname,))
                s_res = cur.fetchone()
                if not s_res: return jsonify({"error": f"Supplier '{sname}' not found"}), 400
                resolved.append({
                    "supplier_id": s_res[0], "supplierName": sname,
                    "leadTime": int(sup.get('leadTime') or 0),
                    "minOrder": int(sup.get('minOrder') or 0),
                    "isPrimary": sup.get('isPrimary', False),
                })
            if resolved:
                supplier_id = resolved[0]['supplier_id']
                supplier_ids_json = _json.dumps(resolved)

        # Update inventory table
        cur.execute("""
            UPDATE public.inventory SET
                supplier_id = %s, item_name = %s, item_description = %s, brand = %s,
                unit_of_measure = %s, item_quantity = %s, item_unit_price = %s, item_selling_price = %s,
                supplier_ids = %s
            WHERE inventory_id = %s
        """, (supplier_id, data.get('itemName'), data.get('itemDescription'), data.get('brand'),
              uom_id, int(data.get('qty') or 0), float(data.get('unitPrice') or 0), float(data.get('sellingPrice') or 0),
              supplier_ids_json, id))

        primary = suppliers[0] if suppliers else {}
        lead_time = int(primary.get('leadTime') or data.get('leadTime') or 0)
        min_order = int(primary.get('minOrder') or data.get('minOrder') or 0)
        reorder_point = int(data.get('reorderPoint') or 0)
        cur.execute("""
            UPDATE public.inventory_action SET lead_time_days = %s, min_order_qty = %s, reorder_qty = %s
            WHERE inventory_id = %s
        """, (lead_time, min_order, reorder_point, id))
        if cur.rowcount == 0:
            cur.execute("""
                INSERT INTO public.inventory_action (inventory_id, suggestion_date, stockout_predict, lead_time_days, min_order_qty, reorder_qty)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (id, datetime.now(), False, lead_time, min_order, reorder_point))

        conn.commit()
        return jsonify({"message": "Item updated successfully"}), 200
    except Exception as e:
        conn.rollback()
        print("Update Error:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()

# ================= INVENTORY SUMMARY =================
@inventory_bp.route("/api/inventory/summary", methods=["GET"])
def get_inventory_summary():
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                COALESCE(SUM(od.order_quantity) FILTER (
                    WHERE ot.order_date >= NOW() - INTERVAL '7 days'
                ), 0) AS weekly_count,

                COALESCE(SUM(od.order_quantity) FILTER (
                    WHERE ot.order_date >= NOW() - INTERVAL '30 days'
                ), 0) AS monthly_count,

                COALESCE(SUM(od.order_quantity) FILTER (
                    WHERE ot.order_date >= NOW() - INTERVAL '1 year'
                ), 0) AS yearly_count
            FROM order_details od
            JOIN order_transaction ot ON od.order_id = ot.order_id
        """)

        row = cur.fetchone()

        return jsonify({
            "weekly": row[0],
            "monthly": row[1],
            "yearly": row[2]
        })

    except Exception as e:
        print("Error fetching inventory summary:", e)
        return jsonify({"weekly": 0, "monthly": 0, "yearly": 0}), 200

    finally:
        cur.close()
        conn.close()