"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(222 47% 9%)",
    border: "1px solid hsl(217 33% 20%)",
    borderRadius: "8px",
    fontSize: "12px",
  },
  labelStyle: { color: "hsl(210 40% 96%)" },
};

interface ThreatTrendChartProps {
  data: { time: string; level: number; incidents?: number }[];
}

export function ThreatTrendChart({ data }: ThreatTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="threatGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" opacity={0.3} />
        <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
        <YAxis stroke="#64748b" fontSize={11} />
        <Tooltip {...chartTooltipStyle} />
        <Area
          type="monotone"
          dataKey="level"
          stroke="#06b6d4"
          fill="url(#threatGradient)"
          strokeWidth={2}
          name="Threat Level"
        />
        {data[0]?.incidents !== undefined && (
          <Line
            type="monotone"
            dataKey="incidents"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ fill: "#ef4444", r: 3 }}
            name="Incidents"
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface RiskDistributionChartProps {
  data: { name: string; value: number; color: string }[];
}

export function RiskDistributionChart({ data }: RiskDistributionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip {...chartTooltipStyle} />
        <Legend
          wrapperStyle={{ fontSize: "11px" }}
          formatter={(value) => <span className="text-muted-foreground">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface ThreatBreakdownChartProps {
  data: { type: string; count: number; color: string }[];
}

export function ThreatBreakdownChart({ data }: ThreatBreakdownChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" opacity={0.3} />
        <XAxis type="number" stroke="#64748b" fontSize={11} />
        <YAxis
          type="category"
          dataKey="type"
          stroke="#64748b"
          fontSize={10}
          width={120}
        />
        <Tooltip {...chartTooltipStyle} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface WeeklyTrendChartProps {
  data: { day: string; threats: number; resolved: number }[];
}

export function WeeklyTrendChart({ data }: WeeklyTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" opacity={0.3} />
        <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
        <YAxis stroke="#64748b" fontSize={11} />
        <Tooltip {...chartTooltipStyle} />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
        <Line
          type="monotone"
          dataKey="threats"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ fill: "#ef4444", r: 4 }}
          name="Threats"
        />
        <Line
          type="monotone"
          dataKey="resolved"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ fill: "#22c55e", r: 4 }}
          name="Resolved"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
