from flask import Flask
from flask_cors import CORS
from routes.inventory import inventory_bp
from routes.orders import orders_bp

app = Flask(__name__)
CORS(app)

app.register_blueprint(inventory_bp)
app.register_blueprint(orders_bp)

if __name__ == "__main__":
    app.run(debug=True)
