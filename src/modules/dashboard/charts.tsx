"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ProductivityChart({ data }: { data: { name: string; ore: number }[] }) {
  return (
    <div className="w-full min-w-0">
      <ResponsiveContainer width="100%" height={280} minWidth={0}>
        <AreaChart data={data} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="oreGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#4e8dff" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#4e8dff" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#273852" strokeDasharray="4 4" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#9db1ce" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#9db1ce" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: "#0f1a2f",
              border: "1px solid #2a4167",
              color: "#e7eefb",
              borderRadius: "12px",
            }}
            labelStyle={{ color: "#e7eefb", fontWeight: 600 }}
          />
          <Area type="monotone" dataKey="ore" stroke="#4e8dff" fill="url(#oreGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
