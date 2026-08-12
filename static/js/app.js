let appConfig = null;
let subtotalValue = 0;
let grandTotalValue = 0;
let isEditingExisting = false;
let isDirty = false;
let calcTimeout = null;

/* ==========================================================================
   Toast Notification System
   ========================================================================== */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ==========================================================================
   Custom Confirmation Modal Promise
   ========================================================================== */
function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    if (!modal) {
      resolve(confirm(`${title}\n\n${message}`));
      return;
    }

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;

    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');

    modal.style.display = 'flex';

    const onConfirm = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };

    function cleanup() {
      modal.style.display = 'none';
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
    }

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
  });
}

/* ==========================================================================
   Tab Navigation
   ========================================================================== */
function switchTab(tabName) {
  const formView = document.getElementById('invoiceFormView');
  const listView = document.getElementById('invoiceListView');
  const formBtn = document.getElementById('tabFormBtn');
  const listBtn = document.getElementById('tabListBtn');

  if (tabName === 'form') {
    formView.style.display = 'block';
    listView.style.display = 'none';
    formBtn.classList.add('active');
    listBtn.classList.remove('active');
  } else {
    formView.style.display = 'none';
    listView.style.display = 'block';
    formBtn.classList.remove('active');
    listBtn.classList.add('active');
    loadHistory();
  }
}

/* ==========================================================================
   Configuration & Default Setup
   ========================================================================== */
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    appConfig = await res.json();
    applyConfigToUI();
  } catch (err) {
    console.error('Error loading config:', err);
  }
}

function applyConfigToUI() {
  if (!appConfig) return;

  const billedFrom = document.getElementById('billedFrom');
  if (billedFrom) {
    const name = appConfig.company_name || '';
    const address = appConfig.company_address || '';
    const phone = appConfig.company_phone ? `Phone: ${appConfig.company_phone}` : '';
    const email = appConfig.company_email ? `Email: ${appConfig.company_email}` : '';
    const taxId = appConfig.company_tax_id ? `Tax ID: ${appConfig.company_tax_id}` : '';

    billedFrom.value = [name, address, phone, email, taxId].filter(Boolean).join('\n');
  }

  document.getElementById('paymentTerms').value = appConfig.default_payment_terms || '';
  document.getElementById('paymentMethods').value = appConfig.default_payment_methods || '';
  document.getElementById('bankDetails').value = appConfig.default_bank_details || '';
  document.getElementById('notes').value = appConfig.default_notes || '';
  
  document.getElementById('taxRate').value = appConfig.default_tax_rate || 0;
  document.getElementById('taxReason').value = appConfig.default_tax_reason || '';
  document.getElementById('discountRate').value = 0;
  document.getElementById('discountReason').value = '';

  document.querySelectorAll('.currency-symbol').forEach(el => {
    el.textContent = appConfig.currency_symbol || '$';
  });

  calculateTotals();
}

function formatCurrency(amount) {
  const symbol = (appConfig && appConfig.currency_symbol) ? appConfig.currency_symbol : '$';
  const val = parseFloat(amount) || 0;
  return `${symbol}${val.toFixed(2)}`;
}

/* ==========================================================================
   Line Items & Calculations
   ========================================================================== */
function addRow(description = '', qty = 1, price = 0) {
  const tbody = document.getElementById('itemsTableBody');
  const tr = document.createElement('tr');
  tr.className = 'item-row';
  tr.innerHTML = `
    <td><input type="text" class="item-desc" value="${description}" placeholder="Item or service description" /></td>
    <td><input type="number" class="item-qty" value="${qty}" min="1" step="1" /></td>
    <td><input type="number" class="item-price" value="${price}" min="0" step="0.01" /></td>
    <td class="col-total item-total">$0.00</td>
    <td class="col-action"><button type="button" class="btn btn-danger btn-delete-row" title="Delete Row">✕</button></td>
  `;
  tbody.appendChild(tr);
  debouncedCalculateTotals();
}

function debouncedCalculateTotals() {
  clearTimeout(calcTimeout);
  calcTimeout = setTimeout(calculateTotals, 150);
}

function calculateTotals() {
  let subtotal = 0;
  document.querySelectorAll('.item-row').forEach(row => {
    const qty = Math.max(0, parseFloat(row.querySelector('.item-qty').value) || 0);
    const price = Math.max(0, parseFloat(row.querySelector('.item-price').value) || 0);
    const lineTotal = qty * price;
    row.querySelector('.item-total').textContent = formatCurrency(lineTotal);
    subtotal += lineTotal;
  });

  const taxRate = Math.max(0, parseFloat(document.getElementById('taxRate').value) || 0);
  const discountRate = Math.max(0, parseFloat(document.getElementById('discountRate').value) || 0);

  const discountAmount = subtotal * (discountRate / 100);
  const taxableSubtotal = subtotal - discountAmount;
  const taxAmount = taxableSubtotal * (taxRate / 100);
  const grandTotal = taxableSubtotal + taxAmount;

  subtotalValue = subtotal;
  grandTotalValue = grandTotal;

  document.getElementById('subtotalDisplay').textContent = formatCurrency(subtotal);
  document.getElementById('grandTotalDisplay').textContent = formatCurrency(grandTotal);
}

/* ==========================================================================
   Form Actions
   ========================================================================== */
async function clearFormPrompt() {
  if (isDirty) {
    const confirmClear = await showConfirmModal('Clear Form', 'You have unsaved changes. Are you sure you want to reset this form?');
    if (!confirmClear) return;
  }
  clearForm();
  showToast('Form reset successfully.', 'info');
}

function clearForm() {
  isEditingExisting = false;

  document.getElementById('invoiceNumber').value = 'INV-' + Math.floor(1000 + Math.random() * 9000);
  document.getElementById('date').valueAsDate = new Date();
  document.getElementById('dueDate').value = '';
  document.getElementById('billedTo').value = '';
  
  document.getElementById('itemsTableBody').innerHTML = '';
  addRow('', 1, 0);

  if (appConfig) {
    applyConfigToUI();
  } else {
    document.getElementById('billedFrom').value = '';
    document.getElementById('paymentTerms').value = '';
    document.getElementById('paymentMethods').value = '';
    document.getElementById('bankDetails').value = '';
    document.getElementById('notes').value = '';
    document.getElementById('taxRate').value = 0;
    document.getElementById('taxReason').value = '';
    document.getElementById('discountRate').value = 0;
    document.getElementById('discountReason').value = '';
    calculateTotals();
  }
  
  isDirty = false;
}

/* ==========================================================================
   Data Persistence (Save & Load)
   ========================================================================== */
async function saveInvoiceData() {
  const saveBtn = document.querySelector('.actions .btn-primary');
  const printBtn = document.querySelector('.actions .btn-secondary');
  
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
  if (printBtn) { printBtn.disabled = true; }

  const items = [];
  document.querySelectorAll('.item-row').forEach(row => {
    items.push({
      description: row.querySelector('.item-desc').value.trim(),
      qty: Math.max(0, parseFloat(row.querySelector('.item-qty').value) || 0),
      price: Math.max(0, parseFloat(row.querySelector('.item-price').value) || 0)
    });
  });

  const payload = {
    invoiceNumber: document.getElementById('invoiceNumber').value.trim(),
    isUpdate: isEditingExisting,
    date: document.getElementById('date').value,
    dueDate: document.getElementById('dueDate').value,
    billedFrom: document.getElementById('billedFrom').value,
    billedTo: document.getElementById('billedTo').value,
    paymentTerms: document.getElementById('paymentTerms').value,
    paymentMethods: document.getElementById('paymentMethods').value,
    bankDetails: document.getElementById('bankDetails').value,
    notes: document.getElementById('notes').value,
    subtotal: subtotalValue,
    taxRate: Math.max(0, parseFloat(document.getElementById('taxRate').value) || 0),
    taxReason: document.getElementById('taxReason').value,
    discountRate: Math.max(0, parseFloat(document.getElementById('discountRate').value) || 0),
    discountReason: document.getElementById('discountReason').value,
    grandTotal: grandTotalValue,
    items: items
  };

  try {
    const res = await fetch('/api/save-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
      isEditingExisting = true;
      isDirty = false;
      showToast(data.message || 'Invoice saved successfully!', 'success');
      return true;
    } else {
      showToast(data.message || 'Failed to save invoice.', 'error');
      return false;
    }
  } catch (err) {
    showToast('Network error while saving invoice.', 'error');
    return false;
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Invoice'; }
    if (printBtn) { printBtn.disabled = false; }
  }
}

async function saveInvoice() {
  const success = await saveInvoiceData();
  if (success) {
    switchTab('list');
  }
}

/* ==========================================================================
   Single-Page PDF Generation Engine
   ========================================================================== */
async function printAndSaveInvoice() {
  const invoiceElement = document.getElementById('invoiceFormView');
  const invoiceNum = document.getElementById('invoiceNumber').value.trim() || 'invoice';

  // 1. Hide optional empty fields & interactive controls
  const taxReasonGroup = document.getElementById('taxReasonGroup');
  const discountReasonGroup = document.getElementById('discountReasonGroup');
  
  if (taxReasonGroup && !document.getElementById('taxReason').value.trim()) {
    taxReasonGroup.classList.add('is-empty-print');
  }
  if (discountReasonGroup && !document.getElementById('discountReason').value.trim()) {
    discountReasonGroup.classList.add('is-empty-print');
  }

  // 2. Enable compact single-page mode
  invoiceElement.classList.add('pdf-single-page');

  // Dynamically scale down rendering if item height exceeds standard A4 threshold
  const elementHeight = invoiceElement.scrollHeight;
  const targetHeight = 1120;
  let dynamicScale = 2;
  
  if (elementHeight > targetHeight) {
    dynamicScale = Math.max(1.2, (targetHeight / elementHeight) * 2);
  }

  // 3. Configure html2pdf for single-page export
  const opt = {
    margin:       [4, 4, 4, 4],
    filename:     `${invoiceNum}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { 
      scale: dynamicScale, 
      useCORS: true, 
      logging: false,
      scrollY: 0
    },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak:    { mode: 'avoid-all' }
  };

  try {
    showToast('Exporting single-page PDF...', 'info');
    
    if (typeof html2pdf !== 'undefined') {
      await html2pdf().set(opt).from(invoiceElement).save();
    } else {
      window.print();
    }

    await saveInvoiceData();
  } catch (err) {
    console.error('PDF Generation Error:', err);
    showToast('Error generating PDF. Falling back to browser print.', 'error');
    window.print();
  } finally {
    // 4. Restore UI
    invoiceElement.classList.remove('pdf-single-page');
    if (taxReasonGroup) taxReasonGroup.classList.remove('is-empty-print');
    if (discountReasonGroup) discountReasonGroup.classList.remove('is-empty-print');
  }
}

/* ==========================================================================
   History & Invoice Management
   ========================================================================== */
async function loadHistory() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  const startDate = document.getElementById('filterStartDate')?.value || '';
  const endDate = document.getElementById('filterEndDate')?.value || '';

  let url = '/api/invoices';
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if ([...params].length > 0) url += '?' + params.toString();

  try {
    const res = await fetch(url);
    const invoices = await res.json();

    const countEl = document.getElementById('invoiceCount');
    if (countEl) countEl.textContent = invoices.length;

    if (invoices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No saved invoices found.</td></tr>';
      return;
    }

    tbody.innerHTML = invoices.map(inv => `
      <tr>
        <td style="font-weight: 600; color: var(--accent-primary);">${inv.id}</td>
        <td>${inv.inv_date || '-'}</td>
        <td>${(inv.billed_to || 'N/A').split('\n')[0]}</td>
        <td style="text-align: right; font-weight: 600;">${formatCurrency(inv.grand_total)}</td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center;">
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 12px;" onclick="editInvoice('${inv.id}')">Edit</button>
            <button class="btn btn-danger" style="padding: 4px 10px; font-size: 12px;" onclick="deleteInvoicePrompt('${inv.id}')">✕</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger-color); padding: 24px;">Error loading invoices.</td></tr>';
  }
}

function clearFilters() {
  const start = document.getElementById('filterStartDate');
  const end = document.getElementById('filterEndDate');
  if (start) start.value = '';
  if (end) end.value = '';
  loadHistory();
}

async function editInvoice(invId) {
  if (isDirty) {
    const confirmLeave = await showConfirmModal('Unsaved Changes', 'Discard current form edits to edit this invoice?');
    if (!confirmLeave) return;
  }

  try {
    const res = await fetch(`/api/invoice/${invId}`);
    if (!res.ok) throw new Error('Invoice not found');

    const inv = await res.json();

    document.getElementById('invoiceNumber').value = inv.id;
    document.getElementById('date').value = inv.inv_date || '';
    document.getElementById('dueDate').value = inv.due_date || '';
    document.getElementById('billedFrom').value = inv.billed_from || '';
    document.getElementById('billedTo').value = inv.billed_to || '';
    document.getElementById('paymentTerms').value = inv.payment_terms || '';
    document.getElementById('paymentMethods').value = inv.payment_methods || '';
    document.getElementById('bankDetails').value = inv.bank_details || '';
    document.getElementById('notes').value = inv.notes || '';
    document.getElementById('taxRate').value = inv.tax_rate || 0;
    document.getElementById('taxReason').value = inv.tax_reason || '';
    document.getElementById('discountRate').value = inv.discount_rate || 0;
    document.getElementById('discountReason').value = inv.discount_reason || '';

    const tbody = document.getElementById('itemsTableBody');
    tbody.innerHTML = '';
    if (inv.items && inv.items.length > 0) {
      inv.items.forEach(item => {
        addRow(item.description, item.qty, item.price);
      });
    } else {
      addRow('', 1, 0);
    }

    isEditingExisting = true;
    isDirty = false;
    calculateTotals();
    switchTab('form');
  } catch (err) {
    showToast('Failed to load invoice details.', 'error');
  }
}

async function deleteInvoicePrompt(invId) {
  const confirmed = await showConfirmModal('Delete Invoice', `Are you sure you want to delete invoice ${invId}?`);
  if (!confirmed) return;

  try {
    await fetch(`/api/invoice/${invId}`, { method: 'DELETE' });
    showToast(`Invoice ${invId} deleted.`, 'info');
    loadHistory();
  } catch (err) {
    showToast('Failed to delete invoice.', 'error');
  }
}

/* ==========================================================================
   Initialization & Event Binding
   ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  clearForm();
  loadHistory();

  // Event Delegation for items table
  const tbody = document.getElementById('itemsTableBody');
  if (tbody) {
    tbody.addEventListener('input', (e) => {
      if (e.target.classList.contains('item-qty') || e.target.classList.contains('item-price')) {
        debouncedCalculateTotals();
      }
      isDirty = true;
    });

    tbody.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete-row')) {
        e.target.closest('tr').remove();
        debouncedCalculateTotals();
        isDirty = true;
      }
    });
  }

  // Dirty flag tracking for form inputs
  ['taxRate', 'discountRate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        debouncedCalculateTotals();
        isDirty = true;
      });
    }
  });

  const formView = document.getElementById('invoiceFormView');
  if (formView) {
    formView.addEventListener('input', (e) => {
      if (!e.target.classList.contains('item-qty') && !e.target.classList.contains('item-price')) {
        isDirty = true;
      }
    });
  }

  // Warn before navigating away if changes are unsaved
  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
});
