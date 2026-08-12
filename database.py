import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(BASE_DIR, "invoice_database.db")

def get_db_connection():
    # Pass timeout=10.0 to prevent thread lock delays
    conn = sqlite3.connect(DB_NAME, timeout=10.0)
    conn.row_factory = sqlite3.Row
    # Fast WAL mode PRAGMAs per connection
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode = WAL;")
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY UNIQUE,
            inv_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            billed_from TEXT,
            billed_to TEXT,
            payment_terms TEXT,
            payment_methods TEXT,
            bank_details TEXT,
            notes TEXT,
            authorized_signature TEXT,
            subtotal REAL DEFAULT 0.0,
            tax_rate REAL DEFAULT 0.0,
            tax_reason TEXT,
            discount_rate REAL DEFAULT 0.0,
            discount_reason TEXT,
            grand_total REAL DEFAULT 0.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS invoice_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id TEXT NOT NULL,
            description TEXT,
            qty REAL DEFAULT 1,
            price REAL DEFAULT 0.0,
            FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
        )
    ''')

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(inv_date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_items_invoice ON invoice_items(invoice_id);")
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
