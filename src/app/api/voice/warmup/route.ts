import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ warmed: true, timestamp: new Date().toISOString() });
}
