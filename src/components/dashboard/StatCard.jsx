import React from "react";

export default function StatCard({ title, value, icon: Icon, color = "bg-primary" }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card border p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
        </div>
        <div className={`${color} rounded-xl p-3`}>
          <Icon className="w-5 h-5 text-primary-foreground" />
        </div>
      </div>
      <div className={`absolute -bottom-4 -right-4 w-24 h-24 ${color} rounded-full opacity-5`} />
    </div>
  );
}