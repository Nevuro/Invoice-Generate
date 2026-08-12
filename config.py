import os

class Config:
    # Flask Settings
    SECRET_KEY = os.environ.get('SECRET_KEY', 'default-dev-key-change-in-production')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///backy.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Default Business Information
    COMPANY_NAME = "Your Company Name"
    COMPANY_ADDRESS = "123 Business Rd, Suite 100\nCity, State 12345"
    COMPANY_PHONE = "+1 (550) 000-0000"
    COMPANY_EMAIL = "billing@company.com"
    COMPANY_TAX_ID = "US123456789"

    # Default Invoice Terms & Formatting
    CURRENCY_SYMBOL = "Eg"
    DEFAULT_PAYMENT_TERMS = "Net 30"
    DEFAULT_PAYMENT_METHODS = "Bank Transfer, Credit Card"
    DEFAULT_BANK_DETAILS = "Bank: Global Bank\nAccount: 123456789\nRouting: 987654321"
    DEFAULT_NOTES = "Thank you for your business!"
    
    # Default Tax Settings
    DEFAULT_TAX_RATE = 0.0
    DEFAULT_TAX_REASON = "Standard Sales Tax"

    @classmethod
    def to_dict(cls):
        """Helper method to pass configurations cleanly to the API endpoint."""
        return {
            "company_name": cls.COMPANY_NAME,
            "company_address": cls.COMPANY_ADDRESS,
            "company_phone": cls.COMPANY_PHONE,
            "company_email": cls.COMPANY_EMAIL,
            "company_tax_id": cls.COMPANY_TAX_ID,
            "currency_symbol": cls.CURRENCY_SYMBOL,
            "default_payment_terms": cls.DEFAULT_PAYMENT_TERMS,
            "default_payment_methods": cls.DEFAULT_PAYMENT_METHODS,
            "default_bank_details": cls.DEFAULT_BANK_DETAILS,
            "default_notes": cls.DEFAULT_NOTES,
            "default_tax_rate": cls.DEFAULT_TAX_RATE,
            "default_tax_reason": cls.DEFAULT_TAX_REASON,
        }
