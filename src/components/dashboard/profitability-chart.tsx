"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card } from "@/src/components/ui/card";

type ProfitData = {
  name: string;
  revenue: number;
  costs: number;
  profit: number;
};

export function ProfitabilityChart({ data }: { data: ProfitData[] }) {
  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Analiză Profitabilitate pe Proiect</h3>
          <p className="text-sm text-[var(--muted)]">Compararea veniturilor cu cheltuielile reale</p>
        </div>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            barGap={8}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke="var(--muted-strong)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="var(--muted-strong)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value.toLocaleString()} RON`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 24, 34, 0.95)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--foreground)",
              }}
              itemStyle={{ fontSize: "12px" }}
            />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: "20px" }} />
            <Bar 
              dataKey="revenue" 
              name="Venituri" 
              fill="#74a2d4" 
              radius={[4, 4, 0, 0]} 
              barSize={32}
            />
            <Bar 
              dataKey="costs" 
              name="Cheltuieli" 
              fill="#e11d48" 
              radius={[4, 4, 0, 0]} 
              barSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
