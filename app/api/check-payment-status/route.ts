import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export async function POST(req: NextRequest) {
  try {
    const { transactionId, reference } = await req.json();
    
    if (!transactionId || !reference) {
      console.error("Missing transaction ID or reference in request");
      return NextResponse.json({ 
        success: false, 
        message: "Missing transaction ID or reference" 
      });
    }
    
    console.log("Checking payment status for transaction:", transactionId);
    console.log("With reference:", reference);
    
    // Get the stored reference from cookies
    const cookieStore = cookies();
    const storedReference = cookieStore.get("payment-nonce")?.value;
    
    if (!storedReference) {
      console.error("No payment reference found in cookies");
      return NextResponse.json({ 
        success: false, 
        message: "No payment reference found in cookies" 
      });
    }
    
    console.log("Stored reference from cookies:", storedReference);
    
    // Verify the reference matches
    if (reference !== storedReference) {
      console.error(`Reference mismatch: Request reference ${reference} does not match stored reference ${storedReference}`);
      return NextResponse.json({ 
        success: false, 
        message: "Reference mismatch" 
      });
    }
    
    // Check the transaction status from the World ID API
    const url = `https://developer.worldcoin.org/api/v2/minikit/transaction/${transactionId}?app_id=${process.env.APP_ID}`;
    console.log("Requesting transaction status from:", url);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.DEV_PORTAL_API_KEY}`,
      },
    });
    
    console.log("API response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch transaction status:", response.statusText);
      console.error("Error details:", errorText);
      
      return NextResponse.json({ 
        success: false, 
        message: "Failed to fetch transaction status",
        status: response.status,
        error: response.statusText
      });
    }
    
    const transaction = await response.json();
    console.log("Transaction data:", transaction);
    
    // Check if the transaction is successful
    if (transaction.reference === reference && transaction.status !== "failed") {
      console.log("Transaction confirmed successfully");
      return NextResponse.json({
        success: true,
        data: {
          transaction_id: transactionId,
          reference: reference,
          status: transaction.status,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      console.error("Transaction failed or reference mismatch in API response");
      console.error("Transaction status:", transaction.status);
      console.error("Transaction reference:", transaction.reference);
      
      return NextResponse.json({ 
        success: false, 
        message: "Transaction failed or reference mismatch",
        status: transaction.status,
        apiReference: transaction.reference,
        requestReference: reference
      });
    }
  } catch (error) {
    console.error("Error checking payment status:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Internal server error",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
