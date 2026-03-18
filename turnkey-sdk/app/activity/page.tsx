"use client";

import { useState, useEffect, useCallback } from "react";
import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";

type Activity = {
  id: string;
  type: string;
  status: string;
  createdAt: { seconds: string; nanos: string };
};

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

type SortCol = "type" | "status" | "createdAt";
type SortDir = "asc" | "desc" | null;

function SortIcon({
  col,
  sortCol,
  sortDir,
}: {
  col: SortCol;
  sortCol: SortCol | null;
  sortDir: SortDir;
}) {
  const active = col === sortCol && sortDir;
  return (
    <span className="inline-flex flex-col ml-1.5 gap-[1px] align-middle translate-y-[-1px]">
      <svg
        width="8"
        height="5"
        viewBox="0 0 8 5"
        fill="none"
        className={
          active && sortDir === "asc" ? "text-zinc-100" : "text-zinc-600"
        }
      >
        <path d="M4 0L7.46 4.5H0.54L4 0Z" fill="currentColor" />
      </svg>
      <svg
        width="8"
        height="5"
        viewBox="0 0 8 5"
        fill="none"
        className={
          active && sortDir === "desc" ? "text-zinc-100" : "text-zinc-600"
        }
      >
        <path d="M4 5L0.54 0.5H7.46L4 5Z" fill="currentColor" />
      </svg>
    </span>
  );
}

function formatActivityType(type: string) {
  return type
    .replace("ACTIVITY_TYPE_", "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  const isComplete = status.includes("COMPLETED");
  const isFailed = status.includes("FAILED");
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        isComplete
          ? "bg-emerald-500/15 text-emerald-400"
          : isFailed
            ? "bg-red-500/15 text-red-400"
            : "bg-zinc-700 text-zinc-400"
      }`}
    >
      {status.replace("ACTIVITY_STATUS_", "").toLowerCase()}
    </span>
  );
}

export default function ActivityPage() {
  const { authState, handleLogin, httpClient } = useTurnkey();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const fetchActivities = useCallback(async () => {
    if (!httpClient) return;
    setLoading(true);
    setError(null);
    try {
      const res = await httpClient.getActivities({
        paginationOptions: { limit: "100" },
      });
      setActivities((res?.activities ?? []) as Activity[]);
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load activities");
    } finally {
      setLoading(false);
    }
  }, [httpClient]);

  useEffect(() => {
    if (authState === AuthState.Authenticated) fetchActivities();
  }, [authState, fetchActivities]);

  if (authState !== AuthState.Authenticated) {
    return (
      <div className="min-h-screen bg-zinc-800 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 text-center">
          <p className="text-zinc-400 text-sm">You need to be signed in.</p>
          <button
            onClick={() => handleLogin()}
            className="rounded-lg bg-[#335bf9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a4dd4] transition-colors"
          >
            Log in
          </button>
        </div>
      </div>
    );
  }

  const toggleSort = (col: SortCol) => {
    if (col !== sortCol) {
      setSortCol(col);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortCol(null);
      setSortDir(null);
    }
    setPage(1);
  };

  const sorted =
    sortCol && sortDir
      ? [...activities].sort((a, b) => {
          let cmp = 0;
          if (sortCol === "type") cmp = a.type.localeCompare(b.type);
          else if (sortCol === "status") cmp = a.status.localeCompare(b.status);
          else
            cmp = parseInt(a.createdAt.seconds) - parseInt(b.createdAt.seconds);
          return sortDir === "asc" ? cmp : -cmp;
        })
      : activities;

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="min-h-screen bg-zinc-800 p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Activity</h1>
            <p className="text-zinc-500 text-xs mt-0.5">
              All signing and wallet operations for your sub-org, pulled via{" "}
              <code className="text-zinc-400">httpClient.getActivities()</code>
            </p>
          </div>
          <button
            onClick={fetchActivities}
            disabled={loading}
            className="text-xs text-zinc-400 hover:text-zinc-100 border border-zinc-700 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Table */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/90 overflow-hidden">
          {loading && activities.length === 0 ? (
            <p className="text-zinc-500 text-sm p-6">Loading activities…</p>
          ) : activities.length === 0 ? (
            <p className="text-zinc-500 text-sm p-6">No activities yet.</p>
          ) : (
            <>
              <div className="overflow-y-auto max-h-[480px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="sticky top-0 bg-zinc-900 border-b border-zinc-700 text-zinc-500 text-xs uppercase tracking-wide">
                      {(["type", "status", "createdAt"] as SortCol[]).map(
                        (col) => (
                          <th
                            key={col}
                            onClick={() => toggleSort(col)}
                            className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-zinc-300 transition-colors"
                          >
                            {col === "createdAt" ? "Time" : col}
                            <SortIcon
                              col={col}
                              sortCol={sortCol}
                              sortDir={sortDir}
                            />
                          </th>
                        )
                      )}
                      <th className="text-left px-5 py-3 font-medium">ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((a, i) => (
                      <tr
                        key={a.id}
                        className={`${
                          i !== paginated.length - 1
                            ? "border-b border-zinc-800"
                            : ""
                        } hover:bg-zinc-800/50 transition-colors`}
                      >
                        <td className="px-5 py-3 text-zinc-100 font-medium">
                          {formatActivityType(a.type)}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="px-5 py-3 text-zinc-400 text-xs">
                          {new Date(
                            parseInt(a.createdAt.seconds) * 1000
                          ).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-zinc-500 font-mono text-xs truncate max-w-[120px]">
                          {a.id.slice(0, 8)}…
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer */}
              <div className="flex items-center justify-between border-t border-zinc-700 px-5 py-3">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>Rows per page:</span>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setPageSize(size);
                        setPage(1);
                      }}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        pageSize === size
                          ? "bg-zinc-700 text-zinc-100"
                          : "hover:text-zinc-300"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>
                    {(page - 1) * pageSize + 1}–
                    {Math.min(page * pageSize, sorted.length)} of{" "}
                    {sorted.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
