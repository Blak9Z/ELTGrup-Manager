"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ProductivityChart({ data }: { data: { name: string; ore: number }[] }) {
  return (
    <div className="w-full min-w-0">
      <ResponsiveContainer width="100%" height={280} minWidth={0}>
        <AreaChart data={data} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="oreGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#6a93c6" stopOpacity={0.46} />
              <stop offset="95%" stopColor="#6a93c6" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#2f4154" strokeDasharray="4 4" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#9baec4" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#9baec4" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: "#151f2a",
              border: "1px solid #33465a",
              color: "#ecf2fb",
              borderRadius: "10px",
            }}
            labelStyle={{ color: "#ecf2fb", fontWeight: 600 }}
          />
          <Area type="monotone" dataKey="ore" stroke="#6a93c6" fill="url(#oreGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
