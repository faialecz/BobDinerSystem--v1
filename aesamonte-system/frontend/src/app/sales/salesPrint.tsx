/* =====================================================
   salesPrint.tsx
   Place this in the same folder as your sales page.tsx
   (or wherever your utils folder is)
   ===================================================== */

const COMPANY_HEADER = `
  <h1>AE SAMONTE MERCHANDISE</h1>
  <p>ALAIN E. SAMONTE - Prop.</p>
  <p>VAT Reg. TIN : 263-884-036-00000</p>
  <p>1457 A. Leon Guinto St., Zone 73 Barangay 676,</p>
  <p>1000 Ermita NCR, City of Manila, First District, Philippines</p>
`

// 3-column footer matching the physical invoice layout:
//   LEFT   — booklet & BIR info
//   CENTER — Regencia Printing Services
//   RIGHT  — Accreditation details
const PRINTER_FOOTER = `
  <div class="footer-col">
    <div>20 Bkts. (50x3) 4251 - 5250</div>
    <div>BIR Authority to Print No.: OCN033AU20250000004322</div>
    <div>Date of ATP: OCTOBER 10, 2025</div>
  </div>
  <div class="footer-col center">
    <div>REGENCIA PRINTING SERVICES | Ramil P. Regencia - Prop.</div>
    <div>Lot 3 to 7, Raq&apos;s Hope Ville, Navarro 4107 City of General Trias,</div>
    <div>Cavite, Philippines &bull; VAT Reg. TIN: 245-821-996-00000</div>
  </div>
  <div class="footer-col right">
    <div>Printer&apos;s Accreditation No.: 54BMP20250000000023</div>
    <div>Date of ATP: OCT. 09, 2025</div>
    <div>Expiry Date: OCT. 08, 2030</div>
  </div>
`

// All invoice styles inlined — no external CSS file needed
const INVOICE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: Arial, sans-serif;
    font-size: 11px;
    color: #000;
    padding: 20px 24px;
    background: #fff;
  }

  /* ── HEADER ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  .company h1 {
    font-size: 24px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 3px;
  }
  .company p { font-size: 10px; line-height: 1.65; }

  .invoice-block { text-align: right; }
  .invoice-label {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .invoice-title {
    font-size: 20px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .invoice-no {
    font-size: 20px;
    font-weight: 900;
    color: #c0392b;
    letter-spacing: 1px;
    margin-top: 4px;
    line-height: 1;
    display: flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 4px;
  }
  .invoice-no .no-label {
    font-size: 13px;
    font-weight: 700;
    color: #000;
  }
  .invoice-no .no-sup {
    font-size: 9px;
    vertical-align: super;
    color: #000;
    font-weight: 700;
  }
  .invoice-no .no-number {
    font-size: 20px;
    font-weight: 900;
    color: #c0392b;
  }

  /* ── CHECKBOX + DATE ROW ── */
  .controls-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    margin-top: 4px;
  }
  .checkbox-group {
    display: flex;
    gap: 20px;
  }
  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    cursor: default;
  }
  .cb-box {
    width: 13px;
    height: 13px;
    border: 1.5px solid #000;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 900;
    flex-shrink: 0;
  }
  .date-field {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    border: 1px solid #000;
    padding: 3px 8px;
  }
  .date-value { font-weight: 400; min-width: 90px; }

  /* ── SOLD TO SECTION ── */
  .sold-section {
    border: 1.5px solid #000;
    padding: 5px 8px 6px;
    margin-bottom: 8px;
    font-size: 11px;
  }
  .sold-title {
    font-weight: 700;
    font-size: 11px;
    margin-bottom: 4px;
  }
  .sold-row {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    margin-bottom: 3px;
  }
  .sold-label {
    font-weight: 600;
    white-space: nowrap;
    font-size: 10.5px;
  }
  .sold-line {
    border-bottom: 1px solid #000;
    flex: 1;
    min-height: 15px;
    padding: 0 3px 1px;
    font-size: 11px;
  }
  .sold-inline {
    display: flex;
    gap: 12px;
    margin-bottom: 3px;
  }
  .sold-inline .sold-row { flex: 1; }

  /* ── ITEMS TABLE ── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    font-size: 11px;
  }
  thead th {
    border: 1.5px solid #000;
    padding: 5px 6px;
    font-weight: 700;
    text-align: center;
    background: #d8d8d8;
    font-size: 11px;
  }
  tbody td {
    border: 1px solid #000;
    padding: 2px 6px;
    height: 19px;
    text-align: center;
    font-size: 11px;
  }
  tbody td.desc { text-align: left; }

  /* ── BOTTOM SECTION ── */
  .bottom-section {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  /* Left box */
  .left-box {
    flex: 1;
    font-size: 10px;
    align-self: flex-start;
    vertical-align: top;
  }
  .vat-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
  }
  .vat-table td {
    border: 1px solid #000;
    padding: 3px 6px;
    font-size: 10px;
    height: 18px;
    text-align: left;
  }
  .vat-table td:first-child { width: 60%; }
  .vat-table td:last-child  { width: 40%; border-left: 1px solid #000; }

  .sc-box {
    border: 1px solid #000;
    padding: 4px 6px;
    font-size: 9.5px;
    margin-bottom: 6px;
    line-height: 1.7;
    text-align: left;
  }
  .sc-inner-row {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    margin-top: 2px;
  }
  .sc-inner-row span { white-space: nowrap; font-size: 9.5px; }
  .sc-inner-line {
    border-bottom: 1px solid #000;
    flex: 1;
    min-height: 13px;
  }

  .received-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    margin-top: 6px;
    text-align: left;
  }
  .received-amount-line {
    border-bottom: 1px solid #000;
    flex: 1;
    height: 16px;
  }
  .cashier-area { margin-top: 28px; text-align: left; }
  .sig-underline {
    border-top: 1px solid #000;
    width: 160px;
    text-align: center;
    padding-top: 2px;
    font-size: 9px;
  }

  /* Right totals box */
  .right-box { width: 290px; }
  .totals-table {
    width: 100%;
    border-collapse: collapse;
  }
  .totals-table tr td {
    border: 1px solid #000;
    padding: 4px 7px;
    font-size: 10.5px;
    text-align: left;
  }
  .totals-table tr td:first-child { width: 65%; text-align: left; }
  .totals-table tr td:last-child  { text-align: right; white-space: nowrap; }
  .totals-table tr.total-row td {
    font-weight: 700;
    font-size: 12px;
    background: #e8e8e8;
  }

  .received-goods {
    font-size: 10px;
    text-align: right;
    margin-top: 8px;
    margin-bottom: 20px;
  }
  .by-row {
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    gap: 5px;
    margin-bottom: 3px;
    font-size: 10px;
  }
  .by-line {
    border-bottom: 1px solid #000;
    width: 160px;
    height: 16px;
  }
  .auth-sig {
    border-top: 1px solid #000;
    width: 180px;
    margin-left: auto;
    text-align: center;
    padding-top: 2px;
    font-size: 9px;
  }

  /* ── PRINT FOOTER (3-column) ── */
  .print-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: 10px;
    font-size: 8px;
    color: #333;
    line-height: 1.55;
    gap: 8px;
  }
  .footer-col { flex: 1; }
  .footer-col.center { text-align: center; }
  .footer-col.right  { text-align: right; }

  @media print {
    body { padding: 8px 12px; }
    @page { margin: 0.35in; size: letter; }
  }
`

export interface PrintTransactionItem {
  description: string
  qty: number
  unit: string
  unitCost: number
  amount: number
}

export interface PrintTransaction {
  no: string
  name: string
  address: string
  date: string
  amount: number
  paymentMethod: string
  tin?: string
  poNo?: string
  terms?: string
  registeredName?: string
  items?: PrintTransactionItem[]
}

/* ── Print Sales Invoice ── */
export function printSalesInvoice(tx: PrintTransaction): void {
  const pw = window.open('', '_blank')
  if (!pw) return

  const vatRate    = 0.12
  const totalSales = tx.amount
  const lessVat    = totalSales - totalSales / (1 + vatRate)
  const netOfVat   = totalSales / (1 + vatRate)

  const items     = tx.items || []
  const totalRows = Math.max(14, items.length)
  const rows = Array.from({ length: totalRows }, (_, i) => {
    const item = items[i]
    return item
      ? `<tr>
          <td class="desc">${item.description}</td>
          <td>${item.qty}</td>
          <td>&#8369; ${item.unitCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
          <td>&#8369; ${item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
         </tr>`
      : `<tr><td class="desc">&nbsp;</td><td></td><td></td><td></td></tr>`
  }).join('')

  const invoiceNo = tx.no.replace(/\D/g, '').replace(/^0+/, '') || tx.no

  pw.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Sales Invoice - ${tx.no}</title>
  <style>${INVOICE_CSS}</style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <div class="company">${COMPANY_HEADER}</div>
    <div class="invoice-block">
      <div class="invoice-label">SALES</div>
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-no">
        <span class="no-label">N<span class="no-sup">o</span></span>
        <span class="no-number">${invoiceNo}</span>
      </div>
    </div>
  </div>

  <!-- CHARGE / CASH + DATE — always unchecked, user fills manually -->
  <div class="controls-row">
    <div class="checkbox-group">
      <label>
        <span class="cb-box">&nbsp;</span>
        CHARGE SALES
      </label>
      <label>
        <span class="cb-box">&nbsp;</span>
        CASH SALES
      </label>
    </div>
    <div class="date-field">
      <strong>Date:</strong>
      <span class="date-value">${tx.date}</span>
    </div>
  </div>

  <!-- SOLD TO -->
  <div class="sold-section">
    <div class="sold-title">SOLD TO:</div>
    <div class="sold-row">
      <span class="sold-label">Registered Name :</span>
      <span class="sold-line">${tx.registeredName || tx.name}</span>
    </div>
    <div class="sold-inline">
      <div class="sold-row">
        <span class="sold-label">TIN :</span>
        <span class="sold-line">${tx.tin || ''}</span>
      </div>
      <div class="sold-row">
        <span class="sold-label">P.O. No.:</span>
        <span class="sold-line">${tx.poNo || ''}</span>
      </div>
      <div class="sold-row">
        <span class="sold-label">Terms:</span>
        <span class="sold-line">${tx.terms || ''}</span>
      </div>
    </div>
    <div class="sold-row">
      <span class="sold-label">Business Address :</span>
      <span class="sold-line">${tx.address}</span>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <table>
    <thead>
      <tr>
        <th class="desc" style="width:52%">ITEM DESCRIPTION</th>
        <th style="width:9%">QTY.</th>
        <th style="width:19%">UNIT COST</th>
        <th style="width:20%">AMOUNT</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- BOTTOM SECTION -->
  <div class="bottom-section">

    <!-- LEFT -->
    <div class="left-box">
      <table class="vat-table">
        <tr><td>VATable Sales</td><td></td></tr>
        <tr><td>VAT-Exempt Sales</td><td></td></tr>
        <tr><td>Zero-Rated Sales</td><td></td></tr>
        <tr><td>VAT Amount</td><td></td></tr>
      </table>

      <div class="sc-box">
        <div>SC/PWD/NAAC/MOV/</div>
        <div class="sc-inner-row">
          <span>Solo Parent ID No.:</span>
          <div class="sc-inner-line"></div>
        </div>
        <div class="sc-inner-row">
          <span>SC/PWD/NAAC/MOV/Signature:</span>
          <div class="sc-inner-line"></div>
        </div>
      </div>

      <div class="received-row">
        <span class="cb-box">&nbsp;</span>
        <strong>Received the amount of:</strong>
        <div class="received-amount-line"></div>
      </div>

      <div class="cashier-area">
        <div class="sig-underline">Cashier</div>
      </div>
    </div>

    <!-- RIGHT TOTALS -->
    <div class="right-box">
      <table class="totals-table">
        <tr>
          <td>Total Sales (VAT Inclusive)</td>
          <td>&#8369; ${totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td>Less: VAT</td>
          <td>&#8369; ${lessVat.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Amount Net of VAT</td>
          <td>&#8369; ${netOfVat.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Less: Discount (SC/PWD/NAAC/MOV/SP)</td>
          <td></td>
        </tr>
        <tr>
          <td>Add: VAT</td>
          <td>&#8369; ${lessVat.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Less: Withholding Tax</td>
          <td></td>
        </tr>
        <tr class="total-row">
          <td>TOTAL AMOUNT DUE</td>
          <td>&#8369; ${totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
        </tr>
      </table>

      <div class="received-goods">
        Received the above goods in good order and condition.
      </div>
      <div class="by-row">
        <span>By:</span>
        <div class="by-line"></div>
      </div>
      <div class="auth-sig">Authorized Signature</div>
    </div>

  </div>

  <!-- PRINTER FOOTER (3 columns) -->
  <div class="print-footer">${PRINTER_FOOTER}</div>

</body>
</html>`)

  pw.document.close()
  pw.focus()
  pw.print()
  pw.close()
}

/* ── Print Delivery Receipt ── */
export function printDeliveryReceipt(tx: PrintTransaction): void {
  const pw = window.open('', '_blank')
  if (!pw) return

  const items     = tx.items || []
  const totalRows = Math.max(25, items.length)
  const rows = Array.from({ length: totalRows }, (_, i) => {
    const item = items[i]
    return item
      ? `<tr><td>${i + 1}</td><td>${item.qty}</td><td>${item.unit || 'PCS'}</td><td class="part">${item.description}</td></tr>`
      : `<tr><td>${i + 1}</td><td></td><td></td><td></td></tr>`
  }).join('')

  pw.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Delivery Receipt - ${tx.no}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size:11px; color:#000; padding:24px 28px; }
    .top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
    .company h1 { font-size:26px; font-weight:900; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
    .company p  { font-size:10px; line-height:1.65; }
    .receipt-block { text-align:right; }
    .receipt-title { font-size:13px; font-weight:700; letter-spacing:1px; margin-bottom:4px; }
    .receipt-no    { font-size:24px; font-weight:900; color:#c0392b; letter-spacing:2px; }
    .receipt-no span { font-size:13px; font-weight:700; color:#000; }
    .meta-row { display:flex; justify-content:flex-end; align-items:flex-end; gap:4px; margin-top:4px; font-size:10px; }
    .meta-label { font-weight:600; white-space:nowrap; }
    .meta-value { border-bottom:1px solid #000; min-width:120px; padding:0 4px; }
    .deliver-section { font-size:10px; margin-bottom:6px; }
    .deliver-row { display:flex; align-items:flex-end; gap:6px; margin-bottom:4px; }
    .deliver-label { font-weight:700; font-size:11px; white-space:nowrap; }
    .deliver-line  { border-bottom:1px solid #000; flex:1; min-height:14px; padding:0 4px; font-size:11px; }
    table { width:100%; border-collapse:collapse; margin-top:8px; font-size:10px; }
    thead th { border:1px solid #000; padding:5px 6px; font-weight:700; text-align:center; font-size:11px; }
    thead th.art { font-size:12px; letter-spacing:1px; }
    tbody td { border:1px solid #000; padding:2px 6px; text-align:center; height:19px; }
    tbody td.part { text-align:left; }
    .print-footer { display:flex; justify-content:space-between; align-items:flex-end; margin-top:12px; }
    .footer-left  { max-width:46%; font-size:9px; line-height:1.65; color:#333; }
    .footer-right { font-size:10px; text-align:right; }
    .received-text { margin-bottom:30px; }
    .by-line { display:flex; align-items:flex-end; justify-content:flex-end; gap:6px; margin-bottom:4px; }
    .by-underline { border-bottom:1px solid #000; width:160px; height:16px; }
    .sig-line { border-top:1px solid #000; width:180px; margin-left:auto; text-align:center; padding-top:2px; font-size:9px; }
    .not-valid { font-style:italic; font-weight:700; font-size:9px; text-decoration:underline; text-align:center; margin-top:8px; }
    @media print { body { padding:10px 14px; } @page { margin:0.4in; size:letter; } }
  </style>
</head>
<body>
  <div class="top">
    <div class="company">${COMPANY_HEADER}</div>
    <div class="receipt-block">
      <div class="receipt-title">DELIVERY RECEIPT</div>
      <div class="receipt-no"><span>N<sup>o</sup></span> ${tx.no.replace(/\D/g, '').replace(/^0+/, '') || tx.no}</div>
      <div class="meta-row"><span class="meta-label">Date:</span><span class="meta-value">${tx.date}</span></div>
      <div class="meta-row"><span class="meta-label">P.O. No.:</span><span class="meta-value">${tx.poNo || '&nbsp;'}</span></div>
      <div class="meta-row"><span class="meta-label">RFQ No.:</span><span class="meta-value">&nbsp;</span></div>
      <div class="meta-row"><span class="meta-label">TIN No.:</span><span class="meta-value">${tx.tin || '&nbsp;'}</span></div>
    </div>
  </div>

  <div class="deliver-section">
    <div class="deliver-row"><span class="deliver-label">DELIVERED TO:</span><span class="deliver-line">${tx.registeredName || tx.name}</span></div>
    <div class="deliver-row"><span class="deliver-label">Address:</span><span class="deliver-line">${tx.address}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:6%">ITEM</th>
        <th style="width:8%">QTY</th>
        <th style="width:10%">UNIT</th>
        <th class="art">ARTICLES / PARTICULARS</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="print-footer">
    <div class="footer-left">${PRINTER_FOOTER}</div>
    <div class="footer-right">
      <div class="received-text">Received the above goods in good order and condition.</div>
      <div class="by-line"><span>By:</span><div class="by-underline"></div></div>
      <div class="sig-line">Authorized Signature</div>
      <div class="not-valid">"THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX"</div>
    </div>
  </div>
</body>
</html>`)

  pw.document.close()
  pw.focus()
  pw.print()
  pw.close()
}