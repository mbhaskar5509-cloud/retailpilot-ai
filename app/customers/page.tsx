"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  loyalty_points: number;
  created_at: string;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      setLoading(true);
      setMessage("");

      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setMessage("Please log in to view customers.");
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

      setTenantId(profile.tenant_id);

      const { data, error } = await supabase
        .from("customers")
        .select(
          "id, name, phone, email, loyalty_points, created_at"
        )
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setCustomers(data ?? []);
    } catch (error) {
      console.error("Customers loading error:", error);
      setMessage("Unable to load customers.");
    } finally {
      setLoading(false);
    }
  }

  async function addCustomer(event: React.FormEvent) {
    event.preventDefault();

    if (!tenantId) {
      setMessage("Tenant information is missing.");
      return;
    }

    if (!form.name.trim()) {
      setMessage("Customer name is required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const supabase = createClient();

      const { error } = await supabase.from("customers").insert({
        tenant_id: tenantId,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        loyalty_points: 0,
      });

      if (error) {
        throw error;
      }

      setForm({
        name: "",
        phone: "",
        email: "",
      });

      setMessage("Customer added successfully.");
      await loadCustomers();
    } catch (error) {
      console.error("Customer insert error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to add customer."
      );
    } finally {
      setSaving(false);
    }
  }

  const totalCustomers = customers.length;

  const totalLoyaltyPoints = customers.reduce(
    (sum, customer) => sum + Number(customer.loyalty_points ?? 0),
    0
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse">
            <div className="h-10 w-64 rounded-lg bg-slate-800" />
            <div className="mt-3 h-5 w-96 rounded bg-slate-800" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-400">
            RetailPilot AI
          </p>

          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Customers
          </h1>

          <p className="mt-2 text-slate-400">
            Manage customer profiles and loyalty information.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">
            {message}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total Customers</p>
            <p className="mt-2 text-3xl font-bold">
              {totalCustomers}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Loyalty Points
            </p>
            <p className="mt-2 text-3xl font-bold">
              {totalLoyaltyPoints}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">Add Customer</h2>

            <form
              onSubmit={addCustomer}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Customer Name *
                </label>

                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                  placeholder="Enter customer name"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Phone
                </label>

                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      phone: event.target.value,
                    })
                  }
                  placeholder="9876543210"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Email
                </label>

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      email: event.target.value,
                    })
                  }
                  placeholder="customer@email.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Adding..." : "Add Customer"}
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-6 py-5">
              <h2 className="text-xl font-bold">
                Customer List
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                {customers.length} customer
                {customers.length === 1 ? "" : "s"} found
              </p>
            </div>

            {customers.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-400">
                No customers found. Add your first customer.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-sm text-slate-400">
                      <th className="px-6 py-4 font-medium">
                        Customer
                      </th>
                      <th className="px-6 py-4 font-medium">
                        Phone
                      </th>
                      <th className="px-6 py-4 font-medium">
                        Email
                      </th>
                      <th className="px-6 py-4 font-medium">
                        Loyalty
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {customers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-b border-slate-800/70 transition hover:bg-slate-800/40"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold">
                            {customer.name}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            Added{" "}
                            {new Date(
                              customer.created_at
                            ).toLocaleDateString("en-IN")}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-slate-300">
                          {customer.phone || "—"}
                        </td>

                        <td className="px-6 py-4 text-slate-300">
                          {customer.email || "—"}
                        </td>

                        <td className="px-6 py-4">
                          <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
                            {customer.loyalty_points ?? 0} pts
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}