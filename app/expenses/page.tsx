"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  store_id: string | null;
};

type Store = {
  id: string;
  name: string;
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [storeId, setStoreId] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.tenant_id) {
        setLoading(false);
        return;
      }

      const tenantId = profile.tenant_id;

      const [expensesResult, storesResult] = await Promise.all([
        supabase
          .from("expenses")
          .select(
            "id, category, description, amount, expense_date, store_id"
          )
          .eq("tenant_id", tenantId)
          .order("expense_date", { ascending: false }),

        supabase
          .from("stores")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (expensesResult.error) {
        console.error(expensesResult.error);
      }

      if (storesResult.error) {
        console.error(storesResult.error);
      }

      setExpenses(expensesResult.data ?? []);
      setStores(storesResult.data ?? []);
    } catch (error) {
      console.error("Expenses loading error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();

    if (!category.trim() || !amount || Number(amount) <= 0) {
      alert("Please enter category and valid amount.");
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Please login first.");
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.tenant_id) {
        alert("Tenant profile not found.");
        return;
      }

      const { error } = await supabase.from("expenses").insert({
        tenant_id: profile.tenant_id,
        store_id: storeId || null,
        category: category.trim(),
        description: description.trim() || null,
        amount: Number(amount),
        expense_date: expenseDate,
      });

      if (error) {
        console.error(error);
        alert(error.message);
        return;
      }

      setCategory("");
      setDescription("");
      setAmount("");
      setStoreId("");
      setExpenseDate(new Date().toISOString().split("T")[0]);

      await loadData();
    } catch (error) {
      console.error("Add expense error:", error);
      alert("Unable to add expense.");
    } finally {
      setSaving(false);
    }
  }

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  function getStoreName(storeId: string | null) {
    if (!storeId) return "All Stores";

    return stores.find((store) => store.id === storeId)?.name ?? "Unknown";
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-400">
              RetailPilot AI
            </p>

            <h1 className="mt-1 text-3xl font-bold">Expenses</h1>

            <p className="mt-1 text-sm text-slate-400">
              Track and manage business expenses
            </p>
          </div>

          <button
            onClick={loadData}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
          >
            ↻ Refresh
          </button>
        </div>

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-slate-400">Total Expenses</p>

          <p className="mt-2 text-3xl font-bold text-red-400">
            ₹{totalExpenses.toFixed(2)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {expenses.length} expense record
            {expenses.length === 1 ? "" : "s"}
          </p>
        </section>

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-4 text-lg font-bold">Add Expense</h2>

          <form
            onSubmit={addExpense}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />

            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />

            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />

            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />

            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
            >
              <option value="">All Stores</option>

              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add Expense"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4">
            <h2 className="text-lg font-bold">Expense History</h2>
            <p className="text-sm text-slate-400">
              Recent business expenses
            </p>
          </div>

          {loading ? (
            <div className="py-10 text-center text-slate-400">
              Loading expenses...
            </div>
          ) : expenses.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              No expenses recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Description</th>
                    <th className="px-3 py-3">Store</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {expenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-b border-white/5 text-slate-200"
                    >
                      <td className="px-3 py-3">
                        {expense.expense_date}
                      </td>

                      <td className="px-3 py-3 font-medium">
                        {expense.category}
                      </td>

                      <td className="px-3 py-3 text-slate-400">
                        {expense.description || "—"}
                      </td>

                      <td className="px-3 py-3 text-slate-400">
                        {getStoreName(expense.store_id)}
                      </td>

                      <td className="px-3 py-3 text-right font-semibold text-red-400">
                        ₹{Number(expense.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-8 border-t border-white/10 pt-5 text-center text-xs text-slate-600">
          RetailPilot AI · Expense Management
        </footer>
      </div>
    </main>
  );
}