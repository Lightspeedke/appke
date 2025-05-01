import { NextRequest, NextResponse } from "next/server"
import { verifyTransaction } from "@/app/actions/verify-transaction"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { transactionId, reference, userAddress } = body

    if (!transactionId || typeof transactionId !== "string" || !transactionId.startsWith("0x")) {
      return NextResponse.json({ success: false, message: "Invalid transactionId" }, { status: 400 })
    }

    if (!userAddress || typeof userAddress !== "string") {
      return NextResponse.json({ success: false, message: "Invalid userAddress" }, { status: 400 })
    }

    const result = await verifyTransaction({
      transactionId,
      reference,
      userAddress,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error("POST /api/confirm-payment error:", err)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}
