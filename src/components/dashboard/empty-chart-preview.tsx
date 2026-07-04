"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const emptySeries = [
  { name: "Lun", total: 0 },
  { name: "Mar", total: 0 },
  { name: "Mie", total: 0 },
  { name: "Jue", total: 0 },
  { name: "Vie", total: 0 },
  { name: "Sab", total: 0 },
];

export function EmptyChartPreview() {
  return (
    <div className="mt-5 h-64 w-full rounded-md border border-dashed border-black/15 bg-smoke/70 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={emptySeries} margin={{ left: -20, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d7d0c6" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(184, 138, 68, 0.08)" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.12)",
              boxShadow: "0 12px 32px rgba(23,23,23,0.12)",
            }}
          />
          <Bar dataKey="total" fill="#b88a44" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
