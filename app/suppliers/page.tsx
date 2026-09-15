"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  is_active: boolean;
};

export default function SuppliersPage() {
  const supabase = createClient();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    payment_terms: "",
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Please login first.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        setMessage("Tenant information not found.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("suppliers")
        .select(
          "id,name,contact_person,phone,email,address,payment_terms,is_active"
        )
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setSuppliers(data || []);
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error ? error.message : "Failed to load suppliers."
      );
    } finally {
      setLoading(false);
    }
  }

  async function addSupplier(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      setMessage("Supplier name is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Please login first.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        setMessage("Tenant information not found.");
        return;
      }

      const { error } = await supabase.from("suppliers").insert({
        tenant_id: profile.tenant_id,
        name: form.name.trim(),
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        payment_terms: form.payment_terms.trim() || null,
        is_active: true,
      });

      if (error) {
        throw error;
      }

      setForm({
        name: "",
        contact_person: "",
        phone: "",
        email: "",
        address: "",
        payment_terms: "",
      });

      setMessage("Supplier added successfully.");
      await loadSuppliers();
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error ? error.message : "Failed to add supplier."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deactivateSupplier(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to deactivate this supplier?"
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("suppliers")
        .update({ is_active: false })
        .eq("id", id);

      if (error) {
        throw error;
      }

      setMessage("Supplier deactivated successfully.");
      await loadSuppliers();
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to deactivate supplier."
      );
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    outline: "none",
    fontSize: "14px",
    boxSizing: "border-box",
    background: "#ffffff",
    color: "#0f172a",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "7px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#334155",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: "24px",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            padding: "24px",
            marginBottom: "20px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 15px rgba(15,23,42,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#6366f1",
                  marginBottom: "5px",
                }}
              >
                RETAILPILOT AI
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: "30px",
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                Suppliers
              </h1>

              <p
                style={{
                  margin: "7px 0 0",
                  color: "#64748b",
                  fontSize: "14px",
                }}
              >
                Manage suppliers, contacts and payment terms.
              </p>
            </div>

            <button
              onClick={loadSuppliers}
              style={{
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                padding: "10px 16px",
                borderRadius: "10px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            style={{
              background: message.includes("success")
                ? "#ecfdf5"
                : "#fff7ed",
              color: message.includes("success") ? "#047857" : "#c2410c",
              border: `1px solid ${
                message.includes("success") ? "#a7f3d0" : "#fed7aa"
              }`,
              padding: "13px 16px",
              borderRadius: "10px",
              marginBottom: "20px",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {message}
          </div>
        )}

        {/* Add Supplier */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "18px",
            padding: "24px",
            marginBottom: "20px",
            boxShadow: "0 4px 15px rgba(15,23,42,0.05)",
          }}
        >
          <h2
            style={{
              margin: "0 0 20px",
              fontSize: "20px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Add New Supplier
          </h2>

          <form onSubmit={addSupplier}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              <div>
                <label style={labelStyle}>Supplier Name *</label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="Enter supplier name"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Contact Person</label>
                <input
                  value={form.contact_person}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contact_person: e.target.value,
                    })
                  }
                  placeholder="Contact person"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  placeholder="Phone number"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  placeholder="supplier@email.com"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Payment Terms</label>
                <input
                  value={form.payment_terms}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      payment_terms: e.target.value,
                    })
                  }
                  placeholder="Example: 30 days"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Address</label>
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="Supplier address"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: "20px" }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: saving ? "#94a3b8" : "#4f46e5",
                  color: "#ffffff",
                  border: "none",
                  padding: "12px 20px",
                  borderRadius: "10px",
                  fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving..." : "Add Supplier"}
              </button>
            </div>
          </form>
        </section>

        {/* Supplier List */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "18px",
            overflow: "hidden",
            boxShadow: "0 4px 15px rgba(15,23,42,0.05)",
          }}
        >
          <div
            style={{
              padding: "22px 24px",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              Supplier List
            </h2>

            <p
              style={{
                margin: "5px 0 0",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              {suppliers.length} supplier
              {suppliers.length === 1 ? "" : "s"} found
            </p>
          </div>

          {loading ? (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              Loading suppliers...
            </div>
          ) : suppliers.length === 0 ? (
            <div
              style={{
                padding: "50px 20px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "40px",
                  marginBottom: "10px",
                }}
              >
                🏢
              </div>

              <h3
                style={{
                  margin: 0,
                  color: "#0f172a",
                  fontSize: "18px",
                }}
              >
                No suppliers yet
              </h3>

              <p
                style={{
                  margin: "7px 0 0",
                  color: "#64748b",
                }}
              >
                Add your first supplier using the form above.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "850px",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        background: "#f8fafc",
                        color: "#334155",
                        fontSize: "13px",
                        fontWeight: 800,
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      Supplier
                    </th>

                    <th
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        background: "#f8fafc",
                        color: "#334155",
                        fontSize: "13px",
                        fontWeight: 800,
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      Contact
                    </th>

                    <th
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        background: "#f8fafc",
                        color: "#334155",
                        fontSize: "13px",
                        fontWeight: 800,
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      Phone
                    </th>

                    <th
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        background: "#f8fafc",
                        color: "#334155",
                        fontSize: "13px",
                        fontWeight: 800,
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      Email
                    </th>

                    <th
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        background: "#f8fafc",
                        color: "#334155",
                        fontSize: "13px",
                        fontWeight: 800,
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      Payment Terms
                    </th>

                    <th
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        background: "#f8fafc",
                        color: "#334155",
                        fontSize: "13px",
                        fontWeight: 800,
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      Status
                    </th>

                    <th
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        background: "#f8fafc",
                        color: "#334155",
                        fontSize: "13px",
                        fontWeight: 800,
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td
                        style={{
                          padding: "16px",
                          color: "#0f172a",
                          fontWeight: 700,
                          borderBottom: "1px solid #e2e8f0",
                          background: "#ffffff",
                        }}
                      >
                        {supplier.name}
                        {supplier.address && (
                          <div
                            style={{
                              marginTop: "4px",
                              fontSize: "12px",
                              color: "#64748b",
                              fontWeight: 400,
                            }}
                          >
                            {supplier.address}
                          </div>
                        )}
                      </td>

                      <td
                        style={{
                          padding: "16px",
                          color: "#334155",
                          borderBottom: "1px solid #e2e8f0",
                          background: "#ffffff",
                        }}
                      >
                        {supplier.contact_person || "—"}
                      </td>

                      <td
                        style={{
                          padding: "16px",
                          color: "#334155",
                          borderBottom: "1px solid #e2e8f0",
                          background: "#ffffff",
                        }}
                      >
                        {supplier.phone || "—"}
                      </td>

                      <td
                        style={{
                          padding: "16px",
                          color: "#334155",
                          borderBottom: "1px solid #e2e8f0",
                          background: "#ffffff",
                        }}
                      >
                        {supplier.email || "—"}
                      </td>

                      <td
                        style={{
                          padding: "16px",
                          color: "#334155",
                          borderBottom: "1px solid #e2e8f0",
                          background: "#ffffff",
                        }}
                      >
                        {supplier.payment_terms || "—"}
                      </td>

                      <td
                        style={{
                          padding: "16px",
                          borderBottom: "1px solid #e2e8f0",
                          background: "#ffffff",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            padding: "5px 10px",
                            borderRadius: "999px",
                            background: supplier.is_active
                              ? "#dcfce7"
                              : "#fee2e2",
                            color: supplier.is_active
                              ? "#166534"
                              : "#991b1b",
                            fontSize: "12px",
                            fontWeight: 800,
                          }}
                        >
                          {supplier.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td
                        style={{
                          padding: "16px",
                          borderBottom: "1px solid #e2e8f0",
                          background: "#ffffff",
                        }}
                      >
                        {supplier.is_active && (
                          <button
                            onClick={() =>
                              deactivateSupplier(supplier.id)
                            }
                            style={{
                              background: "#fff1f2",
                              color: "#be123c",
                              border: "1px solid #fecdd3",
                              padding: "8px 12px",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}