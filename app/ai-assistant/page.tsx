"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const quickQuestions = [
  {
    title: "Current Profit",
    question: "What is my current profit?",
    icon: "₹",
  },
  {
    title: "Low Stock",
    question: "Show me low stock products",
    icon: "📦",
  },
  {
    title: "Business Summary",
    question: "Give me today's business summary",
    icon: "📊",
  },
  {
    title: "Supplier Outstanding",
    question: "Do I have supplier outstanding?",
    icon: "🏢",
  },
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm RetailPilot AI. I can help you understand your business performance, inventory, sales and supplier data using your live business information.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function askAssistant(question?: string) {
    const userQuestion = (question ?? input).trim();

    if (!userQuestion || loading) return;

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: userQuestion,
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userQuestion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Something went wrong."
        );
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            data.answer ||
            "I couldn't generate an answer from the available business data.",
        },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong.";

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Sorry, I couldn't process that request. ${errorMessage}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    askAssistant();
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-xl text-white shadow-lg shadow-indigo-200">
              ✦
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-tight">
                RetailPilot AI
              </h1>
              <p className="text-xs text-slate-500">
                Intelligent Business Assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">
              Live Data
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
        {/* Left Panel */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                  AI Workspace
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  Business Copilot
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Get instant insights from your live RetailPilot business
                  data.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-xl bg-indigo-50 px-3 py-3">
                  <span className="text-lg">✦</span>
                  <span className="text-sm font-semibold text-indigo-700">
                    AI Assistant
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-slate-500">
                  <span>📊</span>
                  <span className="text-sm">Business Insights</span>
                </div>

                <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-slate-500">
                  <span>📦</span>
                  <span className="text-sm">Inventory Intelligence</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 p-5 text-white shadow-lg">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                ✨
              </div>

              <h3 className="font-semibold">AI-Powered Decisions</h3>

              <p className="mt-2 text-xs leading-5 text-slate-300">
                Ask questions about profit, inventory, suppliers and overall
                business performance.
              </p>
            </div>
          </div>
        </aside>

        {/* Main Area */}
        <section className="min-w-0">
          {/* Hero */}
          <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 p-6 text-white shadow-xl shadow-indigo-100 sm:p-8">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur">
                <span>✦</span>
                AI Business Intelligence
              </div>

              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Ask your business anything.
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">
                Get intelligent answers using your live sales, inventory,
                supplier and financial data.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Quick insights
              </h3>

              <span className="text-xs text-slate-400">
                Ask instantly
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {quickQuestions.map((item) => (
                <button
                  key={item.question}
                  type="button"
                  onClick={() => askAssistant(item.question)}
                  disabled={loading}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-lg transition group-hover:bg-indigo-100">
                    {item.icon}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">
                      {item.title}
                    </p>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      {item.question}
                    </p>
                  </div>

                  <span className="ml-auto text-slate-300 transition group-hover:text-indigo-500">
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Card */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                  ✦
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                </div>

                <div>
                  <h3 className="text-sm font-bold">
                    RetailPilot AI
                  </h3>

                  <p className="text-xs text-emerald-600">
                    Online • Connected to live data
                  </p>
                </div>
              </div>

              <div className="hidden rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 sm:block">
                Gemini AI
              </div>
            </div>

            {/* Messages */}
            <div className="min-h-[430px] max-h-[550px] space-y-5 overflow-y-auto bg-[#fafbfe] p-4 sm:p-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white">
                      ✦
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                      message.role === "user"
                        ? "rounded-br-md bg-indigo-600 text-white"
                        : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white">
                    ✦
                  </div>

                  <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-5 py-4 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-slate-100 bg-white p-4">
              <form
                onSubmit={handleSubmit}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about your business..."
                  disabled={loading}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />

                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="flex h-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="hidden sm:inline">
                    Ask AI
                  </span>
                  <span className="sm:hidden">→</span>
                </button>
              </form>

              <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <span>🔒</span>
                <span>
                  AI-generated recommendation • Based on live business data
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}