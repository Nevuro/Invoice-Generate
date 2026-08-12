import os
import sqlite3
import csv
import io
import json
from flask import Flask, render_template, request, jsonify, Response
from flask_cors import CORS
from config import Config
from database import init_db, get_db_connection

app = Flask(__name__)

# Allow requests ONLY from your production Vercel deployment and local dev server
# CORS(app, origins=[
#     "https://your-app-name.vercel.app",
#     "http://localhost:3000"
# ])


def validate_invoice_payload(data):
    if not data or not isinstance(data, dict):
        return False, "Invalid JSON payload"

    if not data.get('invoiceNumber'):
        return False, "Invoice number is required"

    try:
        # Ensure rates and totals are valid numbers
        subtotal = float(data.get('subtotal', 0))
        tax_rate = float(data.get('taxRate', 0))
        discount_rate = float(data.get('discountRate', 0))
        grand_total = float(data.get('grandTotal', 0))

        if any(val < 0 for val in [subtotal, tax_rate, discount_rate, grand_total]):
            return False, "Financial values cannot be negative"

    except (ValueError, TypeError):
        return False, "Invalid numeric format in payload"

    # Validate items list
    items = data.get('items', [])
    if not isinstance(items, list):
        return False, "Items must be a list"

    for item in items:
        try:
            qty = float(item.get('qty', 0))
            price = float(item.get('price', 0))
            if qty < 0 or price < 0:
                return False, "Item quantity and price must be non-negative"
        except (ValueError, TypeError):
            return False, "Invalid item quantity or price"

    return True, None


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/config', methods=['GET'])
def get_config():
    return jsonify(Config.to_dict())


@app.route('/api/save-invoice', methods=['POST'])
def save_invoice():
    data = request.get_json()

    # 1. Validate incoming JSON payload
    is_valid, error_message = validate_invoice_payload(data)
    if not is_valid:
        return jsonify({"message": error_message}), 400

    inv_id = data.get('invoiceNumber')
    is_update = data.get('isUpdate', False)

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Enable foreign key support on SQLite connection
        cursor.execute("PRAGMA foreign_keys = ON;")

        # 2. Clear existing line items for this invoice ID
        cursor.execute("DELETE FROM invoice_items WHERE invoice_id = ?", (inv_id,))

        # 3. Update existing or insert new header record
        if is_update:
            cursor.execute('''
                UPDATE invoices SET
                    inv_date = ?, due_date = ?, billed_from = ?, billed_to = ?,
                    payment_terms = ?, payment_methods = ?, bank_details = ?, notes = ?,
                    subtotal = ?, tax_rate = ?, tax_reason = ?, discount_rate = ?, discount_reason = ?, grand_total = ?
                WHERE id = ?
            ''', (
                data.get('date'), data.get('dueDate'), data.get('billedFrom'), data.get('billedTo'),
                data.get('paymentTerms'), data.get('paymentMethods'), data.get('bankDetails'), data.get('notes'),
                data.get('subtotal'), data.get('taxRate'), data.get('taxReason'), data.get('discountRate'), data.get('discountReason'), data.get('grandTotal'),
                inv_id
            ))
        else:
            cursor.execute('''
                INSERT INTO invoices (
                    id, inv_date, due_date, billed_from, billed_to,
                    payment_terms, payment_methods, bank_details, notes,
                    subtotal, tax_rate, tax_reason, discount_rate, discount_reason, grand_total
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                inv_id, data.get('date'), data.get('dueDate'), data.get('billedFrom'), data.get('billedTo'),
                data.get('paymentTerms'), data.get('paymentMethods'), data.get('bankDetails'), data.get('notes'),
                data.get('subtotal'), data.get('taxRate'), data.get('taxReason'), data.get('discountRate'), data.get('discountReason'), data.get('grandTotal')
            ))

        # 4. Batch re-insert line items
        items_data = [
            (inv_id, item.get('description'), item.get('qty', 1), item.get('price', 0.0))
            for item in data.get('items', [])
        ]

        if items_data:
            cursor.executemany('''
                INSERT INTO invoice_items (invoice_id, description, qty, price)
                VALUES (?, ?, ?, ?)
            ''', items_data)

        conn.commit()
        return jsonify({'message': f'Invoice {inv_id} saved successfully!'}), 200

    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'message': f'Database error: {str(e)}'}), 500
    finally:
        conn.close()


@app.route('/api/invoices', methods=['GET'])
def get_invoices():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT id, inv_date, due_date, billed_to, grand_total FROM invoices WHERE 1=1"
    params = []

    if start_date:
        query += " AND inv_date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND inv_date <= ?"
        params.append(end_date)

    query += " ORDER BY inv_date DESC LIMIT 100"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    invoices = [dict(row) for row in rows]
    return jsonify(invoices)


@app.route('/api/invoice/<inv_id>', methods=['GET'])
def get_invoice_details(inv_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM invoices WHERE id = ?", (inv_id,))
    inv = cursor.fetchone()

    if not inv:
        conn.close()
        return jsonify({'message': 'Invoice not found'}), 404

    cursor.execute("SELECT description, qty, price FROM invoice_items WHERE invoice_id = ?", (inv_id,))
    items = cursor.fetchall()
    conn.close()

    result = dict(inv)
    result['items'] = [dict(item) for item in items]
    return jsonify(result)


@app.route('/api/invoice/<inv_id>', methods=['DELETE'])
def delete_invoice(inv_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("DELETE FROM invoices WHERE id = ?", (inv_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': f'Invoice {inv_id} deleted.'})


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5090, debug=True, threaded=True)
