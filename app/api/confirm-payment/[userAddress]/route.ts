import { NextRequest, NextResponse } from "next/server"
import { ethers } from "ethers"
import { airdropContractABI, AIRDROP_CONTRACT_ADDRESS, RPC_ENDPOINTS } from "@/lib/airdropContractABI"

export async function GET(
  request: NextRequest,
  context: { params: { userAddress: string } },
) {
  try {
    const { userAddress } = context.params

    if (!userAddress || !ethers.isAddress(userAddress)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or missing user address",
        },
        { status: 400 },
      )
    }

    console.log(`Fetching claim status for user: ${userAddress}`)

    let lastError = null

    for (const rpcUrl of RPC_ENDPOINTS) {
      try {
        console.log(`Trying RPC endpoint: ${rpcUrl}`)

        const provider = new ethers.JsonRpcProvider(rpcUrl)

        const code = await provider.getCode(AIRDROP_CONTRACT_ADDRESS)
        if (code === "0x") {
          console.log(`Contract not found at ${AIRDROP_CONTRACT_ADDRESS} using RPC ${rpcUrl}`)
          continue
        }

        console.log(`Contract found at ${AIRDROP_CONTRACT_ADDRESS} using RPC ${rpcUrl}`)

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

        let tokenBalance = "0"
        try {
          const tokenAddress = await contract.astraToken()
          const tokenContract = new ethers.Contract(
            tokenAddress,
            [
              {
                constant: true,
                inputs: [{ name: "_owner", type: "address" }],
                name: "balanceOf",
                outputs: [{ name: "balance", type: "uint256" }],
                type: "function",
              },
            ],
            provider,
          )

          const balance = await tokenContract.balanceOf(userAddress)
          tokenBalance = ethers.formatUnits(balance, 18)
        } catch (error) {
          console.error("Error fetching token balance:", error)
        }

        return NextResponse.json({
          success: true,
          address: userAddress,
          lastClaimed: Number(lastClaimedTimestamp),
          canClaim,
          nextClaimTime,
          timeLeft,
          claimAmount: formattedClaimAmount,
          balance: tokenBalance,
          rpcUsed: rpcUrl,
        })
      } catch (error) {
        console.error(`Error with RPC ${rpcUrl}:`, error)
        lastError = error
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch user claim status from any RPC endpoint",
        details: lastError instanceof Error ? lastError.message : "Unknown error",
      },
      { status: 500 },
    )
  } catch (error) {
    console.error("Error fetching user claim status:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch user claim status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
