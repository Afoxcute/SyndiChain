import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text input is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            recipient: { 
              type: SchemaType.STRING,
              description: "Ethereum address starting with 0x"
            },
            amount: { 
              type: SchemaType.STRING,
              description: "Amount in ETH as a decimal string (e.g., '0.5', '1.25')"
            },
            duration: { 
              type: SchemaType.NUMBER,
              description: "Numeric duration value"
            },
            durationUnit: { 
              type: SchemaType.STRING,
              format: "enum", // Required for enum fields
              enum: ["seconds", "minutes", "hours", "days"],
              description: "Time unit for duration"
            },
            streamType: {
              type: SchemaType.STRING,
              format: "enum", // Required for enum fields
              enum: ["work", "subscription", "gaming"],
              description: "Type of payment stream"
            },
            description: { 
              type: SchemaType.STRING,
              description: "Brief description of the stream purpose"
            }
          },
          required: ["recipient", "amount", "duration", "durationUnit"]
        }
      }
    });
    
    const prompt = `You are a blockchain payment stream parser. Extract transaction details from natural language.

Rules:
- recipient: Must be a valid Ethereum address (0x followed by 40 hex characters). If not provided or invalid, return "0x0000000000000000000000000000000000000000"
- amount: Extract numeric value in ETH (e.g., "1.5", "0.01")
- duration: Extract the numeric duration value
- durationUnit: Must be one of: seconds, minutes, hours, days
- streamType: Classify as "work", "subscription", or "gaming" based on context. Default to "work"
- description: Brief summary of purpose (max 50 words)

Examples:
"Send 0.5 ETH to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb for 2 hours for freelance work" 
→ {recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", amount: "0.5", duration: 2, durationUnit: "hours", streamType: "work", description: "freelance work"}

"Stream 1 ETH to 0xABC...123 for 30 days subscription" 
→ {recipient: "0xABC...123", amount: "1", duration: 30, durationUnit: "days", streamType: "subscription", description: "subscription payment"}

Parse this: "${text}"`;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse and validate the JSON response
    const parsed = JSON.parse(responseText);
    
    // Basic validation
    if (!parsed.recipient || !parsed.amount || !parsed.duration || !parsed.durationUnit) {
      return NextResponse.json(
        { error: 'Failed to extract required fields from input' },
        { status: 400 }
      );
    }

    // Validate address format (basic check)
    if (!parsed.recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address format detected' },
        { status: 400 }
      );
    }

    return NextResponse.json(parsed);
    
  } catch (error) {
    console.error('Gemini API Error:', error);
    return NextResponse.json(
      { error: 'Failed to parse stream details. Please try manual entry.' },
      { status: 500 }
    );
  }
}
