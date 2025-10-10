// src/components/CustomerImportPage.js - CSV Import for Customer PII
import React, { useState } from "react";

const CustomerImportPage = ({ customers, updateCustomers }) => {
  const [importStatus, setImportStatus] = useState("");
  const [importedCount, setImportedCount] = useState(0);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split("\n").filter((line) => line.trim());

        if (lines.length === 0) {
          setImportStatus("error");
          alert("Empty CSV file");
          return;
        }

        // Parse header
        const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const customerIdIndex =
          header.indexOf("customer_id") !== -1
            ? header.indexOf("customer_id")
            : header.indexOf("customerid");
        const nameIndex = header.indexOf("name");
        const phoneIndex = header.indexOf("phone");

        if (customerIdIndex === -1 || nameIndex === -1 || phoneIndex === -1) {
          setImportStatus("error");
          alert(
            "CSV must contain columns: customer_id (or customerid), name, phone"
          );
          return;
        }

        // Parse data
        const newCustomers = { ...customers };
        let count = 0;

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map((v) => v.trim());

          if (values.length < 3) continue;

          const customerId = values[customerIdIndex];
          const name = values[nameIndex];
          const phone = values[phoneIndex];

          if (customerId && name && phone) {
            newCustomers[customerId] = {
              name: name,
              phone: phone,
            };
            count++;
          }
        }

        updateCustomers(newCustomers);
        setImportedCount(count);
        setImportStatus("success");
      } catch (error) {
        console.error("Error parsing CSV:", error);
        setImportStatus("error");
        alert("Failed to parse CSV file: " + error.message);
      }
    };

    reader.onerror = () => {
      setImportStatus("error");
      alert("Failed to read file");
    };

    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const template =
      "customer_id,name,phone\n12345,John Doe,555-123-4567\n67890,Jane Smith,555-987-6543";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customer_import_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearCustomers = () => {
    if (
      window.confirm(
        "Are you sure you want to clear all customer data? This cannot be undone."
      )
    ) {
      updateCustomers({});
      setImportStatus("");
      setImportedCount(0);
    }
  };

  return (
    <div className="customer-import-page">
      <div className="page-header">
        <h2>📋 Import Customer Data</h2>
        <p className="page-description">
          Import customer information (name and phone) from a CSV file. This
          data will be stored locally in your browser.
        </p>
      </div>

      <div className="import-section">
        <div className="import-card">
          <h3>🔒 Privacy & Security Notice</h3>
          <div className="security-notice">
            <p>
              ⚠️ <strong>Important:</strong> Customer data is stored locally in
              your browser only. It is NOT sent to any server.
            </p>
            <p>
              ✓ Data persists between sessions using localStorage
              <br />
              ✓ Only accessible to authenticated users
              <br />✓ Cleared when browser data is cleared
            </p>
          </div>
        </div>

        <div className="import-card">
          <h3>📥 Upload Customer CSV</h3>

          <div className="csv-requirements">
            <h4>CSV Format Requirements:</h4>
            <ul>
              <li>
                <strong>customer_id</strong> (or customerid): Unique customer
                identifier (must match RO customer IDs)
              </li>
              <li>
                <strong>name</strong>: Customer full name
              </li>
              <li>
                <strong>phone</strong>: Customer phone number
              </li>
            </ul>
          </div>

          <div className="import-actions">
            <button className="template-btn" onClick={handleDownloadTemplate}>
              📄 Download Template CSV
            </button>

            <div className="file-upload-wrapper">
              <label className="file-upload-label">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="file-upload-input"
                />
                <span className="file-upload-button">📂 Choose CSV File</span>
              </label>
            </div>
          </div>

          {importStatus === "success" && (
            <div className="import-status success">
              ✅ Successfully imported {importedCount} customers!
            </div>
          )}

          {importStatus === "error" && (
            <div className="import-status error">
              ❌ Import failed. Please check your CSV format.
            </div>
          )}
        </div>

        <div className="import-card">
          <h3>📊 Current Customer Data</h3>

          <div className="customer-stats">
            <div className="stat-box">
              <div className="stat-value">{Object.keys(customers).length}</div>
              <div className="stat-label">Total Customers</div>
            </div>
          </div>

          {Object.keys(customers).length > 0 && (
            <>
              <div className="customer-preview">
                <h4>Sample Records:</h4>
                <table className="customer-table">
                  <thead>
                    <tr>
                      <th>Customer ID</th>
                      <th>Name</th>
                      <th>Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(customers)
                      .slice(0, 10)
                      .map(([id, customer]) => (
                        <tr key={id}>
                          <td>{id}</td>
                          <td>{customer.name}</td>
                          <td>{customer.phone}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {Object.keys(customers).length > 10 && (
                  <p className="preview-note">
                    Showing 10 of {Object.keys(customers).length} customers
                  </p>
                )}
              </div>

              <button
                className="clear-btn danger-btn"
                onClick={handleClearCustomers}
              >
                🗑️ Clear All Customer Data
              </button>
            </>
          )}

          {Object.keys(customers).length === 0 && (
            <div className="empty-state">
              <p>No customer data imported yet.</p>
              <p>Upload a CSV file to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerImportPage;
