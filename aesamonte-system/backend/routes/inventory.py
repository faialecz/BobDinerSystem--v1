from flask import Blueprint, jsonify, request
from database.db_config import get_connection
from datetime import datetime

inventory_bp = Blueprint("inventory", __name__)

# ================= GET INVENTORY =================
@inventory_bp.route("/api/inventory", methods=["GET"])
def get_inventory():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            i.inventory_id,
            i.item_name,
            i.item_description,
            i.item_sku,
            i.brand,
            i.item_quantity,
            u.uom_code AS uom,  -- Fetching uom_code (e.g., 'PCS') to match frontend
            s.status_name AS item_status,
            i.item_unit_price,
            i.item_selling_price
        FROM inventory i
        LEFT JOIN unit_of_measure u ON i.unit_of_measure = u.uom_id
        LEFT JOIN status_like s ON i.item_status_id = s.status_id AND s.status_scope='INVENTORY_STATUS'
        ORDER BY i.inventory_id ASC;
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "id": str(r[0]),
            "item_name": r[1],
            "item_description": r[2],
            "sku": r[3],
            "brand": r[4],
            "qty": r[5],
            "uom": r[6] or '—',
            "status": "Out of Stock" if r[5] <= 0 else f"Low Stock ({r[5]})" if r[5] <= 5 else "Available",
            "unitPrice": float(r[8]),
            "price": float(r[9])
        })

    return jsonify(result)

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
            # --- 1. Validation & Lookups ---
            supplier_name = item.get('detailSupplierName') # Fixed key
            uom_code = item.get('uom')
            
            if not supplier_name or supplier_name == 'Select':
                raise Exception(f"Supplier missing for {item.get('itemName')}")
            if not uom_code or uom_code == 'Select':
                raise Exception(f"UOM missing for {item.get('itemName')}")

            # Get Supplier ID
            cur.execute("SELECT supplier_id FROM supplier WHERE supplier_name = %s", (supplier_name,))
            sup_res = cur.fetchone()
            if not sup_res: raise Exception(f"Supplier '{supplier_name}' not found.")
            supplier_id = sup_res[0]

            # Get UOM ID
            cur.execute("SELECT uom_id FROM unit_of_measure WHERE uom_code = %s", (uom_code,))
            uom_res = cur.fetchone()
            if not uom_res: raise Exception(f"UOM '{uom_code}' not found.")
            uom_id = uom_res[0]

            # --- 2. Insert into INVENTORY Table ---
            # (Basic Item Details Only)
            cur.execute("""
                INSERT INTO public.inventory (
                    supplier_id, item_name, item_description, item_sku, brand, 
                    unit_of_measure, item_quantity, item_unit_price, item_selling_price,
                    item_status_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 1)
                RETURNING inventory_id
            """, (
                supplier_id, item['itemName'], item.get('itemDescription'), 
                item.get('internalSku'), item.get('brand'), uom_id,
                int(item.get('qty', 0)), float(item.get('unitPrice', 0)), 
                float(item.get('sellingPrice', 0))
            ))
            
            new_inventory_id = cur.fetchone()[0]

            # --- 3. Insert into INVENTORY_ACTION Table ---
            # (Lead time, MOQ, Reorder Point)
            cur.execute("""
                INSERT INTO public.inventory_action (
                    inventory_id, 
                    suggestion_date, 
                    stockout_predict, 
                    lead_time_days, 
                    min_order_qty, 
                    reorder_qty
                ) VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                new_inventory_id,
                datetime.now(), # suggestion_date (Required by your schema)
                False,          # stockout_predict (Required by your schema)
                int(item.get('detailLeadTime') or 0),
                int(item.get('detailMinOrder') or 0),
                int(item.get('reorderPoint') or 0)
            ))

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

    cur.execute("""
        SELECT uom_id, uom_code, uom_name 
        FROM unit_of_measure 
        WHERE is_active = true 
        ORDER BY uom_name ASC
    """)
    
    rows = cur.fetchall()
    cur.close()
    conn.close()

    uoms = [
        {"id": r[0], "code": r[1], "name": r[2]}
        for r in rows
    ]

    return jsonify(uoms)