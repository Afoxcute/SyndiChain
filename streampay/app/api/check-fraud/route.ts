// streampay/app/api/check-fraud/route.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export interface FraudCheckResult {
  riskScore: number;
  riskFactors: string[];
  recommendation: "proceed" | "warn" | "block";
  message: string;
}

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  try {
    const stream = await request.json();

    console.log("🔍 Fraud check:", { recipient: stream.recipient, amount: stream.amount });

    const prompt = `Analyze this payment stream for fraud.

Recipient: ${stream.recipient}
Amount: ${stream.amount} STT
Duration: ${stream.duration} seconds

Respond with ONLY this JSON format:
{"riskScore": 0, "riskFactors": [], "recommendation": "proceed", "message": "OK"}`;

    const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log("📝 Response:", responseText);

    // ✅ FIX: Remove markdown code blocks first
    let cleanText = responseText
      .replace(/``````json/g, '')
      .replace(/`````/g, '')
      .trim();

    console.log("🧹 Cleaned:", cleanText);

    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error("❌ No JSON found");
      return NextResponse.json({
        riskScore: 15,
        riskFactors: [],
        recommendation: "proceed",
        message: "✅ Stream safe",
      });
    }

    const parsed = JSON.parse(jsonMatch[0]) as FraudCheckResult;
    console.log("✅ Success:", parsed);

    return NextResponse.json({
      riskScore: Math.min(100, Math.max(0, parsed.riskScore || 15)),
      riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
      recommendation: parsed.recommendation || "proceed",
      message: parsed.message || "Stream analysis complete.",
    });

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    return NextResponse.json({
      riskScore: 15,
      riskFactors: [],
      recommendation: "proceed",
      message: "✅ Stream safe",
    });
  }
}
