from flask import Blueprint, jsonify
from database.db_config import get_connection
from datetime import date, timedelta

sales_bp = Blueprint("sales", __name__, url_prefix="/api/sales")


# ===================== SUMMARY =====================
@sales_bp.route("/summary", methods=["GET"])
def sales_summary():
    conn = get_connection()
    cur = conn.cursor()

    today = date.today()
    week_ago = today - timedelta(days=7)
    month_ago = today.replace(day=1)
    year_ago = today.replace(month=1, day=1)

    # TOTAL SALES (PAID)
    cur.execute("""
        SELECT COALESCE(SUM(st.sales_id * 100), 0)  -- placeholder amount
        FROM sales_transaction st
        WHERE st.sales_status = 'PAID'
    """)
    total_sales = cur.fetchone()[0]

    # WEEKLY SALES
    cur.execute("""
        SELECT COALESCE(SUM(st.sales_id * 100), 0)
        FROM sales_transaction st
        WHERE st.sales_status = 'PAID'
        AND st.sales_date >= %s
    """, (week_ago,))
    weekly_sales = cur.fetchone()[0]

    # MONTHLY SALES
    cur.execute("""
        SELECT COALESCE(SUM(st.sales_id * 100), 0)
        FROM sales_transaction st
        WHERE st.sales_status = 'PAID'
        AND st.sales_date >= %s
    """, (month_ago,))
    monthly_sales = cur.fetchone()[0]

    # YEARLY SALES
    cur.execute("""
        SELECT COALESCE(SUM(st.sales_id * 100), 0)
        FROM sales_transaction st
        WHERE st.sales_status = 'PAID'
        AND st.sales_date >= %s
    """, (year_ago,))
    yearly_sales = cur.fetchone()[0]

    # TOP CLIENT
    cur.execute("""
        SELECT c.customer_name, COUNT(*) AS sales_count
        FROM sales_transaction st
        JOIN order_transaction ot ON st.order_id = ot.order_id
        JOIN customer c ON ot.customer_id = c.customer_id
        WHERE st.sales_status = 'PAID'
        GROUP BY c.customer_name
        ORDER BY sales_count DESC
        LIMIT 1
    """)
    top_client = cur.fetchone()

    cur.close()
    conn.close()

    return jsonify({
        "totalSales": total_sales,
        "totalSalesChange": 5.2,  # placeholder growth
        "weeklySales": weekly_sales,
        "monthlySales": monthly_sales,
        "yearlySales": yearly_sales,
        "topClientName": top_client[0] if top_client else "None",
        "topClientSales": top_client[1] if top_client else 0,
        "topClientChange": 3.8
    })

# ===================== TRANSACTIONS =====================
@sales_bp.route("/transactions", methods=["GET"])
def sales_transactions():
    conn = get_connection()
    cur = conn.cursor()

    query = """
        SELECT
            ot.order_id AS sales_id,
            c.customer_name,
            c.customer_address,
            ot.order_date AS sales_date,
            (SELECT COUNT(*) FROM order_details od WHERE od.order_id = ot.order_id) as qty,
            (SELECT COALESCE(SUM(od.order_total), 0) FROM order_details od WHERE od.order_id = ot.order_id) as amount,
            'PAID' as sales_status 
        FROM order_transaction ot
        JOIN customer c ON ot.customer_id = c.customer_id
        JOIN status_like sl ON ot.order_status_id = sl.status_id
        WHERE sl.status_scope = 'ORDER_STATUS'
          AND sl.status_code = 'RECEIVED'
        ORDER BY ot.order_date DESC
    """
    
    cur.execute(query)
    rows = cur.fetchall()
    
    cur.close()
    conn.close()

    transactions = []
    for r in rows:
        transactions.append({
            "no": r[0],               # Using order_id as the sales No.
            "name": r[1],             # customer_name
            "address": r[2],          # customer_address
            "date": r[3].strftime("%m/%d/%y"), # order_date
            "qty": r[4],              # Count of items
            "amount": float(r[5]),    # Total Amount
            "status": r[6]            # Hardcoded 'PAID' for Received orders
        })

    return jsonify(transactions)