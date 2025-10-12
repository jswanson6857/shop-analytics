// src/components/CustomerImportPage.js - FIXED: Accepts ANY CSV format, deletable rows
import React, { useState } from "react";

const CustomerImportPage = ({ customers, updateCustomers }) => {
  const [importStatus, setImportStatus] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

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

        const header = lines[0]
          .split(",")
          .map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

        console.log("📋 CSV Headers found:", header);

        // FLEXIBLE: Find customer ID column (try multiple variations)
        const customerIdIndex = header.findIndex(
          (h) => h.includes("customer") || h.includes("client") || h === "id"
        );

        // FLEXIBLE: Find first name column
        const firstNameIndex = header.findIndex(
          (h) => h.includes("first") || h === "fname"
        );

        // FLEXIBLE: Find last name column
        const lastNameIndex = header.findIndex(
          (h) => h.includes("last") || h === "lname" || h.includes("surname")
        );

        // FLEXIBLE: Find full name column
        const fullNameIndex = header.findIndex(
          (h) =>
            h.includes("name") && !h.includes("first") && !h.includes("last")
        );

        // FLEXIBLE: Find phone column
        const phoneIndex = header.findIndex(
          (h) =>
            h.includes("phone") ||
            h.includes("mobile") ||
            h.includes("cell") ||
            h.includes("tel")
        );

        console.log("🔍 Column mapping:", {
          customerIdIndex,
          firstNameIndex,
          lastNameIndex,
          fullNameIndex,
          phoneIndex,
          headers: header,
        });

        // Only require customer ID - everything else is optional
        if (customerIdIndex === -1) {
          setImportStatus("error");
          alert(
            "⚠️ Could not find Customer ID column.\n\n" +
              "I'm looking for ANY column with: 'customer', 'client', or 'id'\n\n" +
              "Your CSV columns are:\n" +
              header.join(", ") +
              "\n\n" +
              "Please make sure you have a customer ID column!"
          );
          return;
        }

        const newCustomers = { ...customers };
        let count = 0;
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
          const values =
            lines[i]
              .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
              ?.map((v) => v.replace(/^"|"$/g, "").trim()) || [];

          if (values.length < 2) continue;

          const customerId = values[customerIdIndex]?.trim();
          if (!customerId) {
            errors.push(`Row ${i + 1}: Missing customer ID`);
            continue;
          }

          let name = "";
          if (firstNameIndex !== -1 && lastNameIndex !== -1) {
            const firstName = values[firstNameIndex]?.trim() || "";
            const lastName = values[lastNameIndex]?.trim() || "";
            name = `${firstName} ${lastName}`.trim();
          } else if (fullNameIndex !== -1) {
            name = values[fullNameIndex]?.trim() || "";
          }

          if (!name) {
            name = `Customer ${customerId}`;
          }

          const phone =
            phoneIndex !== -1 ? values[phoneIndex]?.trim() || "N/A" : "N/A";

          newCustomers[customerId] = {
            name: name,
            phone: phone,
            importedAt: new Date().toISOString(),
          };
          count++;
        }

        if (errors.length > 0 && errors.length < 10) {
          console.warn("⚠️ Import warnings:", errors);
        }

        updateCustomers(newCustomers);
        setImportedCount(count);
        setImportStatus("success");

        console.log(`✅ Successfully imported ${count} customers`);
      } catch (error) {
        console.error("Error parsing CSV:", error);
        setImportStatus("error");
        alert(
          "Failed to parse CSV file. Please ensure it's a valid CSV format.\n\n" +
            error.message
        );
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
      "customer_id,first_name,last_name,phone\n12345,John,Doe,555-123-4567\n67890,Jane,Smith,555-987-6543";
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

  const handleDeleteCustomer = (customerId) => {
    if (
      window.confirm(
        `Delete customer ${customers[customerId]?.name || customerId}?`
      )
    ) {
      const updated = { ...customers };
      delete updated[customerId];
      updateCustomers(updated);
    }
  };

  const handleClearAll = () => {
    if (
      window.confirm(
        "Are you sure you want to delete ALL customer data?\n\n" +
          `This will remove ${
            Object.keys(customers).length
          } customers and cannot be undone.`
      )
    ) {
      updateCustomers({});
      setImportStatus("");
      setImportedCount(0);
    }
  };

  const filteredCustomers = Object.entries(customers).filter(
    ([id, customer]) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        id.includes(search) ||
        customer.name?.toLowerCase().includes(search) ||
        customer.phone?.toLowerCase().includes(search)
      );
    }
  );

  return (
    <div className="customer-import-page">
      <div className="page-header">
        <h2>📋 Import Customer Data</h2>
        <p className="page-description">
          Import customer information from ANY CSV file format. The system will
          automatically detect customer ID, name, and phone columns.
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
            <h4>✨ Flexible Format - Accepts ANY CSV!</h4>
            <p style={{ marginBottom: "1rem" }}>
              The system will automatically detect columns. Your CSV should
              have:
            </p>
            <ul>
              <li>
                <strong>Customer ID column</strong> - Any of: customer_id,
                customerid, customer number, id
              </li>
              <li>
                <strong>Name columns</strong> - Either:
                <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
                  <li>first_name + last_name (preferred)</li>
                  <li>OR name / full_name / customer_name</li>
                </ul>
              </li>
              <li>
                <strong>Phone column</strong> - Any of: phone, mobile, cell,
                telephone, contact
              </li>
              <li>
                <strong>Extra columns are OK</strong> - They'll be ignored
                automatically
              </li>
            </ul>
            <p
              style={{
                marginTop: "1rem",
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
              }}
            >
              💡 <strong>Tip:</strong> Export directly from your shop management
              system - no need to format!
            </p>
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
              ❌ Import failed. Check browser console for details.
            </div>
          )}
        </div>

        <div className="import-card">
          <h3>📊 Customer Data Management</h3>

          <div className="customer-stats">
            <div className="stat-box">
              <div className="stat-value">{Object.keys(customers).length}</div>
              <div className="stat-label">Total Customers</div>
            </div>
          </div>

          {Object.keys(customers).length > 0 && (
            <>
              <div className="search-box" style={{ marginBottom: "1rem" }}>
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search customers by ID, name, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="customer-preview">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <h4>All Customers ({filteredCustomers.length})</h4>
                  <button
                    className="clear-btn danger-btn"
                    onClick={handleClearAll}
                    style={{ marginTop: 0 }}
                  >
                    🗑️ Delete All
                  </button>
                </div>

                <div className="customer-table-wrapper">
                  <table className="customer-table">
                    <thead>
                      <tr>
                        <th>Customer ID</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th style={{ width: "100px", textAlign: "center" }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map(([id, customer]) => (
                        <tr key={id}>
                          <td style={{ fontWeight: 600 }}>{id}</td>
                          <td>{customer.name}</td>
                          <td>{customer.phone}</td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              className="delete-customer-btn"
                              onClick={() => handleDeleteCustomer(id)}
                              title="Delete this customer"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredCustomers.length === 0 && searchTerm && (
                  <div className="empty-state" style={{ padding: "2rem" }}>
                    <p>No customers found matching "{searchTerm}"</p>
                  </div>
                )}
              </div>
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
