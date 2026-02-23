from flask import Blueprint, jsonify, request
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

    # Function to calculate sales total
    def sum_sales(since=None):
        query = """
            SELECT COALESCE(SUM(od.order_total), 0)
            FROM sales_transaction st
            JOIN order_details od ON st.order_id = od.order_id
            JOIN static_status ss ON st.sales_status_id = ss.status_id
            WHERE ss.status_code = 'PAID'
        """
        params = []
        if since:
            query += " AND st.sales_date >= %s"
            params.append(since)
        cur.execute(query, params)
        return float(cur.fetchone()[0] or 0)

    total_sales = sum_sales()
    weekly_sales = sum_sales(week_ago)
    monthly_sales = sum_sales(month_ago)
    yearly_sales = sum_sales(year_ago)

    # TOP CLIENT (highest total sales)
    cur.execute("""
        SELECT c.customer_name, COALESCE(SUM(od.order_total), 0) AS total_sales
        FROM sales_transaction st
        JOIN order_transaction ot ON st.order_id = ot.order_id
        JOIN customer c ON ot.customer_id = c.customer_id
        JOIN order_details od ON ot.order_id = od.order_id
        JOIN static_status ss ON st.sales_status_id = ss.status_id
        WHERE ss.status_code = 'PAID'
        GROUP BY c.customer_name
        ORDER BY total_sales DESC
        LIMIT 1
    """)
    top_client = cur.fetchone()

    cur.close()
    conn.close()

    return jsonify({
        "totalSales": total_sales,
        "totalSalesChange": 5.2,  # Placeholder growth
        "weeklySales": weekly_sales,
        "monthlySales": monthly_sales,
        "yearlySales": yearly_sales,
        "topClientName": top_client[0] if top_client else "None",
        "topClientSales": float(top_client[1]) if top_client else 0,
        "topClientChange": 3.8  # Placeholder growth
    })


# ===================== TRANSACTIONS =====================
@sales_bp.route("/transactions", methods=["GET"])
def sales_transactions():
    conn = get_connection()
    cur = conn.cursor()

    query = """
        SELECT
            st.sales_id,
            c.customer_name,
            c.customer_address,
            st.sales_date,
            COALESCE(SUM(od.order_quantity), 0) AS qty,
            COALESCE(SUM(od.order_total), 0) AS amount,
            ss.status_code AS status
        FROM sales_transaction st
        JOIN static_status ss ON st.sales_status_id = ss.status_id
        JOIN order_transaction ot ON st.order_id = ot.order_id
        JOIN customer c ON ot.customer_id = c.customer_id
        JOIN order_details od ON ot.order_id = od.order_id
        GROUP BY st.sales_id, c.customer_name, c.customer_address, st.sales_date, ss.status_code
        ORDER BY st.sales_date DESC
    """

    cur.execute(query)
    rows = cur.fetchall()
    
    cur.close()
    conn.close()

    transactions = []
    for r in rows:
        transactions.append({
            "no": r[0],
            "name": r[1] or "Unknown",
            "address": r[2] or "Unknown",
            "date": r[3].strftime("%m/%d/%y") if r[3] else None,
            "qty": int(r[4] or 0),
            "amount": float(r[5] or 0),
            "status": r[6] or "PENDING"
        })

    return jsonify(transactions)