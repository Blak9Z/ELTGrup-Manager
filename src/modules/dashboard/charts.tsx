"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ProductivityChart({ data }: { data: { name: string; ore: number }[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="oreGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#1b8a52" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#1b8a52" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e4ece7" strokeDasharray="4 4" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#5e7063" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#5e7063" }} axisLine={false} tickLine={false} />
          <Tooltip />
          <Area type="monotone" dataKey="ore" stroke="#1b8a52" fill="url(#oreGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
