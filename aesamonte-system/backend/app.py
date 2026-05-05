import os
from flask import Flask, jsonify
from flask_cors import CORS
from routes.auth import auth_bp
from routes.inventory import inventory_bp
from routes.orders import orders_bp
from routes.sales import sales_bp
from routes.supplier import supplier_bp
from routes.audit_log import audit_log_bp
from routes.users import users_bp
from routes.reports import reports_bp
from routes.export_requests import export_requests_bp
from routes.roles import roles_bp
from routes.backup import backup_bp
from routes.dashboard import dashboard_bp
from routes.notifications import notifications_bp
from routes.purchases import purchases_bp

def _ensure_schema():
    from database.db_config import get_connection
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            ALTER TABLE purchase_order_item
            ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12,2)
        """)
        conn.commit()
    finally:
        cur.close()
        conn.close()

_ensure_schema()

app = Flask(__name__)
CORS(app, origins=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    os.environ.get("FRONTEND_URL", ""),
], supports_credentials=True)

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(inventory_bp)
app.register_blueprint(orders_bp)
app.register_blueprint(sales_bp)
app.register_blueprint(supplier_bp)
app.register_blueprint(audit_log_bp)
app.register_blueprint(users_bp, url_prefix="/api")
app.register_blueprint(reports_bp)
app.register_blueprint(export_requests_bp)
app.register_blueprint(roles_bp, url_prefix="/api")
app.register_blueprint(backup_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(notifications_bp)
app.register_blueprint(purchases_bp)


@app.errorhandler(Exception)
def handle_exception(e):
    import traceback
    traceback.print_exc()
    return jsonify({"error": str(e)}), 500

@app.errorhandler(404)
def handle_404(e):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(405)
def handle_405(e):
    return jsonify({"error": "Method not allowed"}), 405


if __name__ == "__main__":
    app.run(debug=True)
