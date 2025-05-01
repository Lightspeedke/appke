"use server"

import { cookies } from "next/headers"
import { ethers } from "ethers"
import { airdropContractABI, AIRDROP_CONTRACT_ADDRESS, RPC_ENDPOINTS } from "@/lib/airdropContractABI"

type VerifyTransactionInput = {
  transactionId: string
  userAddress: string
  reference?: string
}

export async function verifyTransaction({
  transactionId,
  userAddress,
  reference,
}: VerifyTransactionInput) {
  try {
    if (!transactionId) {
      return {
        success: false,
        error: "Missing transaction ID",
      }
    }

    console.log(`Verifying transaction: ${transactionId} for user: ${userAddress}`)

    const cookieStore = cookies()
    const paymentNonce = cookieStore.get("payment-nonce")?.value

    if (!paymentNonce) {
      return {
        success: false,
        error: "Payment verification failed: Missing payment reference",
      }
    }

    let lastError = null
    let transactionVerified = false

    for (const rpcUrl of RPC_ENDPOINTS) {
      try {
        console.log(`Trying to verify transaction using RPC: ${rpcUrl}`)
        const provider = new ethers.JsonRpcProvider(rpcUrl)

        const receipt = await provider.getTransactionReceipt(transactionId)

        if (!receipt) {
          console.log(`Transaction receipt not found on ${rpcUrl}, trying next RPC`)
          continue
        }

        if (receipt.status === 0) {
          return {
            success: false,
            error: "Transaction failed on-chain",
          }
        }

        console.log(`Transaction verified on ${rpcUrl}: ${receipt.hash}`)
        transactionVerified = true

        const contract = new ethers.Contract(AIRDROP_CONTRACT_ADDRESS, airdropContractABI, provider)

        const lastClaimedTimestamp = await contract.lastClaimed(userAddress)
        const claimCooldown = await contract.claimCooldown()
        const currentTime = Math.floor(Date.now() / 1000)

        if (lastClaimedTimestamp.toString() !== "0") {
          const nextClaimTime = Number(lastClaimedTimestamp) + Number(claimCooldown)
          if (currentTime < nextClaimTime) {
            const timeLeft = nextClaimTime - currentTime
            return {
              success: false,
              error: "Claim cooldown period not over yet",
              timeLeft,
              nextClaimTime,
            }
          }
        }

        break
      } catch (error) {
        console.error(`Error verifying transaction with RPC ${rpcUrl}:`, error)
        lastError = error
      }
    }

    if (!transactionVerified) {
      return {
        success: false,
        error: "Failed to verify transaction on any RPC endpoint",
        details: lastError instanceof Error ? lastError.message : "Unknown error",
      }
    }

    return {
      success: true,
      message: "Transaction verified successfully",
      transactionId,
    }
  } catch (error) {
    console.error("Error processing payment confirmation:", error)
    return {
      success: false,
      error: "Failed to process payment confirmation",
      details: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Optional utility to check claim status separately
export async function canUserClaim(userAddress: string) {
  try {
    if (!userAddress) {
      return {
        success: false,
        error: "Missing user address",
      }
    }

    console.log(`Checking if user can claim: ${userAddress}`)
    let lastError = null

    for (const rpcUrl of RPC_ENDPOINTS) {
      try {
        console.log(`Trying RPC endpoint: ${rpcUrl}`)
        const provider = new ethers.JsonRpcProvider(rpcUrl)

        const code = await provider.getCode(AIRDROP_CONTRACT_ADDRESS)
        if (code === "0x") continue

        const contract = new ethers.Contract(AIRDROP_CONTRACT_ADDRESS, airdropContractABI, provider)
        const lastClaimedTimestamp = await contract.lastClaimed(userAddress)
        const claimCooldown = await contract.claimCooldown()
        const claimAmount = await contract.claimAmount()
        const currentTime = Math.floor(Date.now() / 1000)

        let canClaim = true
        let nextClaimTime = 0
        let timeLeft = 0

        if (lastClaimedTimestamp.toString() !== "0") {
          nextClaimTime = Number(lastClaimedTimestamp) + Number(claimCooldown)
          if (currentTime < nextClaimTime) {
            canClaim = false
            timeLeft = nextClaimTime - currentTime
          }
        }

        const formattedClaimAmount = ethers.formatUnits(claimAmount, 18)

        return {
          success: true,
          address: userAddress,
          lastClaimed: Number(lastClaimedTimestamp),
          canClaim,
          nextClaimTime,
          timeLeft,
          claimAmount: formattedClaimAmount,
          rpcUsed: rpcUrl,
        }
      } catch (error) {
        console.error(`RPC ${rpcUrl} failed:`, error)
        lastError = error
      }
    }

    return {
      success: false,
      error: "All RPC endpoints failed",
      details: lastError instanceof Error ? lastError.message : "Unknown error",
    }
  } catch (error) {
    console.error("Error checking claim status:", error)
    return {
      success: false,
      error: "Unexpected error",
      details: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
