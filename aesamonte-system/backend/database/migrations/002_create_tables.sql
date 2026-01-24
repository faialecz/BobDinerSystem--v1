CREATE TABLE payment_method (
  payment_method_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_method_name VARCHAR(20),
  payment_status_name VARCHAR(20) NOT NULL
);

CREATE TABLE inventory_action (
  suggestion_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inventory_id INT NOT NULL,
  suggestion_date DATE NOT NULL,
  reorder_qty INT,
  stockout_predict BOOLEAN NOT NULL,
  stockout_date DATE,

  CONSTRAINT fk_inventory_action_inventory
    FOREIGN KEY (inventory_id)
    REFERENCES inventory(inventory_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE order_details (
  order_item_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inventory_id INT NOT NULL,
  order_quantity INT,
  unit_price DECIMAL(10,2),
  order_total DECIMAL(10,2),

  CONSTRAINT fk_order_details_inventory
    FOREIGN KEY (inventory_id)
    REFERENCES inventory(inventory_id)
);

CREATE TABLE order_transaction (
  order_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id INT NOT NULL,
  orderitem_id INT NOT NULL,
  payment_method_id INT NOT NULL,
  order_date DATE,

  FOREIGN KEY (customer_id) REFERENCES customer(customer_id),
  FOREIGN KEY (orderitem_id) REFERENCES order_details(order_item_id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_method(payment_method_id)
);

CREATE TABLE order_archives (
  order_archive_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id INT NOT NULL,
  employee_id INT,
  is_archived BOOLEAN NOT NULL,
  archive_date DATE NOT NULL,

  FOREIGN KEY (order_id) REFERENCES order_transaction(order_id),
  FOREIGN KEY (employee_id) REFERENCES employee(employee_id)
);

CREATE TABLE order_master_list (
  order_audit_log_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id INT,
  order_id INT,
  order_audit_log_type VARCHAR(20) NOT NULL,
  order_audit_log_date DATE NOT NULL,

  FOREIGN KEY (employee_id) REFERENCES employee(employee_id),
  FOREIGN KEY (order_id) REFERENCES order_transaction(order_id)
);
