from flask import Flask
from flask_cors import CORS
from routes.auth import auth_bp
from routes.inventory import inventory_bp
from routes.orders import orders_bp
from routes.sales import sales_bp
from routes.supplier import supplier_bp

app = Flask(__name__)
CORS(app) # Crucial for connecting your Frontend to this Backend

# Register your modules
app.register_blueprint(auth_bp, url_prefix='/api/auth')

# Register group modules
app.register_blueprint(inventory_bp)
app.register_blueprint(orders_bp)
app.register_blueprint(sales_bp)
app.register_blueprint(supplier_bp)

if __name__ == '__main__':
    app.run(debug=True, port=5000)