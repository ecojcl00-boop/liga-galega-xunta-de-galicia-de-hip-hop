import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import RankingSummary from "../components/dashboard/RankingSummary";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69a9455298e1637191017e64/1d94c95e1_ChatGPTImage6mar202611_37_50.png";

export default function Dashboard() {
  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Logo hero */}
      <div className="rounded-2xl overflow-hidden shadow-xl">
        <img
          src={LOGO_URL}
          alt="HipHop Galician Dance Tour"
          className="w-full h-auto object-contain"
        />
      </div>

      {/* Rankings compactos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" /> Ranking Global de Liga
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RankingSummary />
        </CardContent>
      </Card>
    </div>
  );
}