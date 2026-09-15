"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Payment = {
  id: string;
  sale_id: string;
  payment_method: string;
  amount: number;
  payment_status: string;
  transaction_reference: string | null;
  paid_at: string | null;
  created_at: string;
};

type Sale = {
  id: string;
  invoice_number: string;
  total_amount: number;
};

export default function PaymentsPage() {
  const [tenantId, setTenantId] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [saleId, setSaleId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amount, setAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [transactionReference, setTransactionReference] = useState("");

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

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

      setTenantId(profile.tenant_id);

      const { data: paymentData, error: paymentError } = await supabase
        .from("payments")
        .select(
          "id, sale_id, payment_method, amount, payment_status, transaction_reference, paid_at, created_at"
        )
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (paymentError) {
        throw paymentError;
      }

      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("id, invoice_number, total_amount")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (salesError) {
        throw salesError;
      }

      setPayments((paymentData || []) as Payment[]);
      setSales((salesData || []) as Sale[]);
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || "Failed to load payments.");
    } finally {
      setLoading(false);
    }
  }

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!saleId || !amount) {
      setMessage("Please select a sale and enter amount.");
      return;
    }

    const numericAmount = Number(amount);

    if (numericAmount <= 0) {
      setMessage("Amount must be greater than 0.");
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase.from("payments").insert({
        tenant_id: tenantId,
        sale_id: saleId,
        payment_method: paymentMethod,
        amount: numericAmount,
        payment_status: paymentStatus,
        transaction_reference:
          transactionReference.trim() || null,
        paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
      });

      if (error) {
        throw error;
      }

      setMessage("Payment added successfully.");

      setSaleId("");
      setPaymentMethod("cash");
      setAmount("");
      setPaymentStatus("paid");
      setTransactionReference("");

      await loadPayments();
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || "Failed to add payment.");
    }
  }

  function getInvoiceNumber(saleId: string) {
    const sale = sales.find((item) => item.id === saleId);
    return sale?.invoice_number || saleId.slice(0, 8);
  }

  const totalPaid = payments
    .filter((payment) => payment.payment_status === "paid")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const pendingAmount = payments
    .filter((payment) => payment.payment_status !== "paid")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Payments
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage customer payments and payment records.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            {message}
          </div>
        )}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Paid</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              ₹{totalPaid.toFixed(2)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Pending</p>
            <p className="mt-2 text-2xl font-bold text-orange-600">
              ₹{pendingAmount.toFixed(2)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Payment Records</p>
            <p className="mt-2 text-2xl font-bold">
              {payments.length}
            </p>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-5 text-xl font-semibold">
            Add Payment
          </h2>

          <form
            onSubmit={addPayment}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            <div>
              <label className="mb-1 block text-sm font-medium">
                Sale / Invoice
              </label>

              <select
                value={saleId}
                onChange={(e) => {
                  setSaleId(e.target.value);

                  const selectedSale = sales.find(
                    (sale) => sale.id === e.target.value
                  );

                  if (selectedSale) {
                    setAmount(String(selectedSale.total_amount));
                  }
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">Select sale</option>

                {sales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    {sale.invoice_number} — ₹
                    {Number(sale.total_amount).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Payment Method
              </label>

              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank_transfer">
                  Bank Transfer
                </option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Amount
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Payment Status
              </label>

              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Transaction Reference
              </label>

              <input
                type="text"
                value={transactionReference}
                onChange={(e) =>
                  setTransactionReference(e.target.value)
                }
                placeholder="UPI / transaction ID"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white transition hover:bg-slate-800"
              >
                Add Payment
              </button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-semibold">
              Payment History
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">
              Loading payments...
            </div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No payment records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-semibold">
                      Invoice
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Method
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Amount
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Status
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Reference
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Paid At
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 font-medium">
                        {getInvoiceNumber(payment.sale_id)}
                      </td>

                      <td className="px-5 py-4 capitalize">
                        {payment.payment_method.replace(
                          "_",
                          " "
                        )}
                      </td>

                      <td className="px-5 py-4 font-semibold">
                        ₹{Number(payment.amount).toFixed(2)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            payment.payment_status === "paid"
                              ? "bg-emerald-100 text-emerald-700"
                              : payment.payment_status ===
                                "pending"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {payment.payment_status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-500">
                        {payment.transaction_reference || "—"}
                      </td>

                      <td className="px-5 py-4 text-slate-500">
                        {payment.paid_at
                          ? new Date(
                              payment.paid_at
                            ).toLocaleString()
                          : "—"}
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