from flask import Blueprint, jsonify
from database.db_config import get_connection
from flask import request, jsonify

supplier_bp = Blueprint("supplier", __name__, url_prefix="/api/suppliers")

# ── Friendly error messages ───────────────────────────────────────────────────
def _friendly_error(e: Exception) -> tuple[str, int]:
    s = str(e)
    if 'chk_supplier_email' in s:
        return "Please enter a valid email address (e.g. supplier@email.com).", 400
    if 'chk_supplier_contact' in s or 'supplier_contact' in s and 'check' in s.lower():
        return "Contact number must be digits only and up to 11 characters.", 400
    if 'chk_supplier_name' in s or ('supplier_name' in s and 'check' in s.lower()):
        return "Supplier name contains invalid characters.", 400
    if 'unique' in s.lower() and 'supplier_name' in s:
        return "A supplier with this name already exists.", 409
    if 'unique' in s.lower() and 'supplier_email' in s:
        return "This email address is already registered to another supplier.", 409
    if 'unique' in s.lower() and 'supplier_contact' in s:
        return "This contact number is already registered to another supplier.", 409
    if 'not null' in s.lower() or 'null value' in s.lower():
        return "One or more required fields are missing.", 400
    if 'foreign key' in s.lower():
        return "Invalid reference — please check your selections and try again.", 400
    if 'violates check constraint' in s:
        return "One or more fields contain invalid values. Please review and try again.", 400
    return "Something went wrong. Please try again.", 500

# ===================== LIST SUPPLIERS =====================
@supplier_bp.route("", methods=["GET"])
def get_suppliers():
    conn = get_connection()
    cur = conn.cursor()
    try:
        # Check which date column exists on the supplier table
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'supplier'
              AND column_name IN ('date_added','created_at','date_created','registered_at')
            LIMIT 1
        """)
        date_row = cur.fetchone()
        date_col = f"TO_CHAR(s.{date_row[0]}, 'YYYY-MM-DD')" if date_row else "NULL"

        cur.execute(f"""
            SELECT
                s.supplier_id,
                s.supplier_name,
                s.contact_person,
                s.supplier_contact,
                s.supplier_email,
                s.supplier_address,
                st.status_name AS supplier_status,
                st.status_code,
                pm.status_name AS payment_terms,
                {date_col}     AS date_added
            FROM supplier s
            LEFT JOIN static_status st ON s.supplier_status_id = st.status_id
            LEFT JOIN static_status pm ON s.payment_terms = pm.status_id
                                      AND pm.status_scope = 'PAYMENT_METHOD'
            WHERE st.status_scope = 'SUPPLIER_STATUS'
            ORDER BY s.supplier_id DESC
        """)
        rows = cur.fetchall()
    except Exception as e:
        print("Supplier GET error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

    suppliers = [
        {
            "supplier_id":     r[0],
            "supplier_name":   r[1],
            "contact_person":  r[2],
            "supplier_contact":r[3],
            "supplier_email":  r[4],
            "supplier_address":r[5],
            "status":          r[6],
            "is_archived":     r[7] == 'INACTIVE',
            "created_at":      None,
            "paymentTerms":    r[8] or "—",
            "date_added":      r[9] if len(r) > 9 else None,
        }
        for r in rows
    ]

    return jsonify(suppliers)

  # ===================== CREATE SUPPLIER =====================
@supplier_bp.route("", methods=["POST"])
def create_supplier():
    data = request.get_json()

    supplier_name = data.get("supplierName")
    address = data.get("address")
    contact_person = data.get("contactPerson")
    contact_number = data.get("contactNumber")
    email = data.get("email")
    payment_terms_label = data.get("paymentTerms")

    if not supplier_name:
        return jsonify({"error": "Supplier name is required."}), 400

    payment_terms_map = {
        "Cash on Delivery": 26,
        "Cash":             26,
        "Bank Transaction": 28,
        "Card":             28,
    }
    payment_terms_id = payment_terms_map.get(payment_terms_label, 26)

    # Pass None for empty email to avoid check constraint
    email_val = email.strip() if email and email.strip() else None

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT status_id FROM static_status 
            WHERE status_scope = 'SUPPLIER_STATUS' AND status_code = 'ACTIVE'
        """)
        status_row = cur.fetchone()
        if not status_row:
            return jsonify({"error": "Active status not found."}), 500
        active_status_id = status_row[0]

        cur.execute("""
            INSERT INTO supplier 
                (supplier_name, supplier_address, contact_person, supplier_contact, supplier_email, payment_terms, supplier_status_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (supplier_name, address, contact_person, contact_number, email_val, payment_terms_id, active_status_id))

        conn.commit()
        return jsonify({"message": "Supplier created successfully!"}), 201

    except Exception as e:
        conn.rollback()
        print("Error creating supplier:", e)
        msg, code = _friendly_error(e)
        return jsonify({"error": msg}), code
    finally:
        cur.close()
        conn.close()

        # ===================== EDIT SUPPLIER =====================
@supplier_bp.route("/<string:supplier_id>", methods=["PUT"])
def update_supplier(supplier_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        data = request.get_json()
        email_val = data.get("email", "").strip() or None
        payment_terms_map = {
            "Cash on Delivery": 26,
            "Cash":             26,
            "Bank Transaction": 28,
            "Card":             28,
        }
        payment_terms_label = data.get("paymentTerms", "")
        payment_terms_id = payment_terms_map.get(payment_terms_label)

        update_fields = """
            UPDATE supplier SET
                supplier_name = %s,
                supplier_address = %s,
                contact_person = %s,
                supplier_contact = %s,
                supplier_email = %s
        """
        params = [
            data.get("supplierName"),
            data.get("address"),
            data.get("contactPerson"),
            data.get("contactNumber"),
            email_val,
        ]
        if payment_terms_id:
            update_fields += ", payment_terms = %s"
            params.append(payment_terms_id)
        update_fields += " WHERE supplier_id = %s"
        params.append(supplier_id)

        cur.execute(update_fields, params)

        conn.commit()
        return jsonify({"message": "Supplier updated successfully!"}), 200

    except Exception as e:
        conn.rollback()
        print("Update Error:", str(e))
        msg, code = _friendly_error(e)
        return jsonify({"error": msg}), code
    finally:
        cur.close()
        conn.close()
# ===================== SUPPLIER ITEMS =====================
@supplier_bp.route("/<string:supplier_id>/items", methods=["GET"])
def get_supplier_items(supplier_id):
    conn = get_connection()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT
                i.item_name,
                COALESCE(b.brand_name, 'Generic') AS brand_name,
                COALESCE(ib.item_sku, '—')         AS sku,
                i.inventory_id
            FROM inventory_brand_supplier ibs
            JOIN inventory_brand ib ON ib.inventory_brand_id = ibs.inventory_brand_id
            JOIN inventory       i  ON i.inventory_id        = ib.inventory_id
            LEFT JOIN brand      b  ON b.brand_id            = ib.brand_id
            WHERE ibs.supplier_id = %s
            ORDER BY i.item_name, b.brand_name
        """, (supplier_id,))
        rows = cur.fetchall()
        return jsonify([
            {"item_name": r[0], "brand_name": r[1], "sku": r[2], "inventory_id": r[3]}
            for r in rows
        ]), 200
    except Exception as e:
        print("Supplier items error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ===================== TOGGLE ARCHIVE =====================
@supplier_bp.route("/archive/<string:supplier_id>", methods=["PUT", "OPTIONS"])
def toggle_supplier_archive(supplier_id):
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS OK"}), 200

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT ss.status_code
            FROM supplier s
            JOIN static_status ss ON s.supplier_status_id = ss.status_id
            WHERE s.supplier_id = %s
        """, (supplier_id,))

        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Supplier not found."}), 404

        current_status = row[0]

        if current_status == 'INACTIVE':
            cur.execute("""
                SELECT status_id FROM static_status 
                WHERE status_scope = 'SUPPLIER_STATUS' AND status_code = 'ACTIVE'
            """)
            is_archived = False
            action_msg = "Restored from Archive"
        else:
            cur.execute("""
                SELECT status_id FROM static_status 
                WHERE status_scope = 'SUPPLIER_STATUS' AND status_code = 'INACTIVE'
            """)
            is_archived = True
            action_msg = "Moved to Archive"

        res = cur.fetchone()
        if not res:
            return jsonify({"error": "Target status not found in static_status."}), 404

        new_status_id = res[0]

        cur.execute("""
            UPDATE supplier SET supplier_status_id = %s WHERE supplier_id = %s
        """, (new_status_id, supplier_id))

        conn.commit()

        return jsonify({
            "message": action_msg,
            "is_archived": is_archived
        }), 200

    except Exception as e:
        conn.rollback()
        print("Error toggling supplier archive:", e)
        msg, code = _friendly_error(e)
        return jsonify({"error": msg}), code
    finally:
        cur.close()
        conn.close()