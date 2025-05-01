"use client"
import type React from "react"
import { useState, useEffect } from "react"
import "./ClaimCoin.css"
import DEXABI from "@/components/abi/DEX.json"
import { MiniKit } from "@worldcoin/minikit-js"
import Cookies from "js-cookie"
import { verifyTransaction } from "@/app/actions/verify-transaction"

// Types
type ClaimCoinProps = {
  userAddress: string
}

type TabType = "claim" | "tasks"
type SocialPlatform = "telegram" | "twitter" | "YouTube"

const socialPlatforms: Record<
  SocialPlatform,
  {
    name: string
    color: string
    url: string
    icon: React.ReactNode
  }
> = {
  telegram: {
    name: "Telegram",
    color: "#0088cc",
    url: "https://t.me/+YmayGroQuJoxNjlk",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white">
        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
      </svg>
    ),
  },
  twitter: {
    name: "Twitter",
    color: "#1DA1F2",
    url: "https://x.com/Astracoinwld",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  YouTube: {
    name: "YouTube",
    color: "#FF0000",
    url: "https://youtube.com/@astracoin?si=tfj5D-3U52lN6GAJ",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white">
        <path d="M19.615 3.184C20.403 3.4 21.055 4.053 21.27 4.84c.388 1.451.388 4.476.388 4.476s0 3.024-.388 4.475c-.215.787-.867 1.44-1.655 1.656-1.456.388-7.227.388-7.227.388s-5.771 0-7.227-.388C3.402 15.23 2.75 14.577 2.535 13.79 2.147 12.34 2.147 9.316 2.147 9.316s0-3.025.388-4.476C2.75 4.053 3.403 3.4 4.19 3.184 5.646 2.796 11.417 2.796 11.417 2.796s5.771 0 7.227.388zM9.816 14.047l6.016-3.65-6.016-3.65v7.3z" />
      </svg>
    ),
  },
}

const testTokens = {
  worldchain: {
    ASTRACOIN: "0x5EFA7f371c256c7548539ca54632D7dab68852b1",
  },
}

const DEX_CONTRACT_ADDRESS = "0x1F53330Bc66d9e38e4fE4561D515A73eD59787b6"

// Analytics tracking function
const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  console.log(`[Analytics] ${eventName}`, properties)
  // Replace with your analytics implementation
  // Example: mixpanel.track(eventName, properties);
}

// Global storage key for claim timer
const getClaimTimerKey = () => "astra_next_claim_time"

export function ClaimCoin({ userAddress }: ClaimCoinProps) {
  // State
  const [activeTab, setActiveTab] = useState<TabType>("claim")
  const [isClaiming, setIsClaiming] = useState(false)
  const [claimSuccess, setClaimSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [socialFollowed, setSocialFollowed] = useState<Record<SocialPlatform, boolean>>({
    telegram: false,
    twitter: false,
    YouTube: false,
  })
  const [followingPlatform, setFollowingPlatform] = useState<SocialPlatform | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const MAX_RETRIES = 3

  // Countdown timer state
  const [nextClaimTime, setNextClaimTime] = useState<number | null>(null)

  // Load next claim time from localStorage - using a global key instead of user-specific
  useEffect(() => {
    const loadClaimTimer = () => {
      try {
        const storedNextClaimTime = localStorage.getItem(getClaimTimerKey())
        if (storedNextClaimTime) {
          const parsedTime = Number.parseInt(storedNextClaimTime, 10)
          if (!isNaN(parsedTime) && parsedTime > Date.now()) {
            console.log(`Loaded claim timer: ${new Date(parsedTime).toLocaleString()}`)
            setNextClaimTime(parsedTime)
          } else {
            // Clear expired timer
            console.log("Claim timer expired, clearing")
            localStorage.removeItem(getClaimTimerKey())
          }
        }
      } catch (error) {
        console.error("Error loading claim timer:", error)
      }
    }

    loadClaimTimer()

    // Check for timer updates every second (in case it was updated in another tab)
    const checkTimerInterval = setInterval(loadClaimTimer, 1000)

    return () => clearInterval(checkTimerInterval)
  }, [])

  // Update countdown timer every second
  useEffect(() => {
    if (!nextClaimTime) return

    const interval = setInterval(() => {
      const now = Date.now()
      if (nextClaimTime <= now) {
        setNextClaimTime(null)
        localStorage.removeItem(getClaimTimerKey())
        console.log("Timer expired, cleared from localStorage")
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [nextClaimTime])

  // Replace the localStorage-based balance initialization
  const [balance, setBalance] = useState<number>(1) // Default to 5000 initially

  // Add a useEffect to fetch the balance from API when component mounts or userAddress changes
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        console.log(`Fetching balance for address: ${userAddress}`)

        // Fetch balance from API
        const response = await fetch(`/api/confirm-payment/${userAddress}`)

        if (response.ok) {
          const data = await response.json()
          console.log(`Balance data received:`, data)
          setBalance(data.balance)
        } else {
          console.warn(`Failed to fetch balance, status: ${response.status}`)
        }
      } catch (error) {
        console.error("Error fetching balance:", error)
      }
    }

    if (userAddress) {
      fetchBalance()
    }
  }, [userAddress]) // Re-fetch when userAddress changes

  // Reset retry count when user changes
  useEffect(() => {
    setRetryCount(0)
  }, [userAddress])

  // Load social status from localStorage
  useEffect(() => {
    const loadSocialStatus = () => {
      const platforms: SocialPlatform[] = ["telegram", "twitter", "YouTube"]
      const status: Record<SocialPlatform, boolean> = {
        telegram: false,
        twitter: false,
        YouTube: false,
      }
      platforms.forEach((platform) => {
        status[platform] = localStorage.getItem(`${platform}_followed_${userAddress}`) === "true"
      })
      setSocialFollowed(status)
    }

    loadSocialStatus()
  }, [userAddress])

  const handleInstallMiniKit = () => {
    trackEvent("install_minikit_clicked", { userAddress })
    window.open("https://www.worldcoin.org/minikit", "_blank")
  }

  const handleSocialFollow = async (platform: SocialPlatform) => {
    try {
      trackEvent("social_follow_started", { userAddress, platform })
      setFollowingPlatform(platform)
      window.open(socialPlatforms[platform].url, "_blank")

      // Add a small delay to simulate the follow action
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setSocialFollowed((prev) => ({
        ...prev,
        [platform]: true,
      }))
      localStorage.setItem(`${platform}_followed_${userAddress}`, "true")
      trackEvent("social_follow_completed", { userAddress, platform })
    } catch (error) {
      console.error(`Error following ${platform}:`, error)
      trackEvent("social_follow_error", { userAddress, platform, error })
    } finally {
      setFollowingPlatform(null)
    }
  }

  const extractTransactionId = (result: any): string => {
    console.log("Attempting to extract transaction ID from result:", JSON.stringify(result, null, 2))

    if (!result) {
      console.error("Result is null or undefined")
      return ""
    }
    if (result.transaction_id && typeof result.transaction_id === "string") {
      console.log("Found transaction_id in standard response format:", result.transaction_id)
      return result.transaction_id
    }

    // If result is a string, it might be the transaction ID directly
    if (typeof result === "string") {
      if (result.startsWith("0x")) {
        console.log("Result is a hex string, using directly:", result)
        return result
      } else if (/^[0-9a-fA-F]+$/.test(result)) {
        // If it's a hex string without 0x prefix, add it
        const withPrefix = `0x${result}`
        console.log("Added 0x prefix to hex string:", withPrefix)
        return withPrefix
      }
    }

    // Log all top-level keys to help diagnose
    if (typeof result === "object") {
      console.log("Available keys in result:", Object.keys(result))
    }

    const possibleHashProps = ["transactionHash", "txHash", "hash", "id", "transaction", "tx", "txId", "transactionId"]

    for (const prop of possibleHashProps) {
      if (result[prop] && typeof result[prop] === "string") {
        if (result[prop].startsWith("0x")) {
          console.log(`Found transaction ID in property '${prop}':`, result[prop])
          return result[prop]
        } else if (/^[0-9a-fA-F]+$/.test(result[prop])) {
          // If it's a hex string without 0x prefix, add it
          const withPrefix = `0x${result[prop]}`
          console.log(`Added 0x prefix to hex string from '${prop}':`, withPrefix)
          return withPrefix
        }
      }
    }

    if (Array.isArray(result) && result.length > 0) {
      console.log("Result is an array, checking first item")
      const firstItem = result[0]
      if (typeof firstItem === "string") {
        if (firstItem.startsWith("0x")) {
          return firstItem
        } else if (/^[0-9a-fA-F]+$/.test(firstItem)) {
          return `0x${firstItem}`
        }
      }
      return extractTransactionId(firstItem)
    }

    for (const key in result) {
      if (result[key] && typeof result[key] === "object") {
        console.log(`Checking nested object '${key}'`)
        const nestedId = extractTransactionId(result[key])
        if (nestedId) return nestedId
      }
    }

    // If we still don't have a transaction ID, log the entire result for debugging
    console.error("Could not find transaction ID in result. Full result:", JSON.stringify(result, null, 2))
    return ""
  }

  const executeMiniKitTransaction = async () => {
    try {
      if (!MiniKit.isInstalled()) {
        throw new Error("MiniKit wallet is not installed")
      }

      console.log("MiniKit is installed, preparing transaction...")

      const reference = `claim-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
      console.log("Generated reference:", reference)

      Cookies.set("payment-nonce", reference, { expires: 100 })

      // Use the correct contract address
      const contractAddress = DEX_CONTRACT_ADDRESS
      console.log("Contract address:", contractAddress)
      console.log("User address:", userAddress)

      // Check if the ABI contains the claim function
      const claimFunction = DEXABI.find((item) => item.type === "function" && item.name === "claim")

      if (!claimFunction) {
        console.warn(
          "Warning: 'claim' function not found in ABI. Available functions:",
          DEXABI.filter((item) => item.type === "function")
            .map((f) => f.name)
            .join(", "),
        )
      } else {
        console.log("Claim function found in ABI:", claimFunction)
      }

      let transactionId = ""
      let result

      // Approach 1: Use the documented MiniKit format
      try {
        console.log("Trying documented MiniKit transaction format...")

        const transactionPayload = {
          transaction: [
            {
              address: contractAddress,
              abi: [
                claimFunction || {
                  type: "function",
                  name: "claim",
                  inputs: [],
                  outputs: [],
                  stateMutability: "nonpayable",
                },
              ],
              functionName: "claim",
              args: [],
            },
          ],
        }

        console.log("Transaction payload:", JSON.stringify(transactionPayload, null, 2))

        const { commandPayload, finalPayload } = await MiniKit.commandsAsync.sendTransaction(transactionPayload)
        console.log("Transaction sent successfully with documented format")
        console.log("Command payload:", commandPayload)
        console.log("Final payload:", finalPayload)

        result = finalPayload

        // Try to extract transaction ID from the result
        if (
            finalPayload &&
            typeof finalPayload === 'object' &&
            'transaction_id' in finalPayload
          ) {
            transactionId = (finalPayload as any).transaction_id;
            console.log("Found transaction_id in finalPayload:", transactionId);
          } else {
            transactionId = extractTransactionId(finalPayload);
          }
          
          if (transactionId) {
            console.log("Successfully extracted transaction ID:", transactionId);
            return { result, transactionId, reference };
          }
          
      } catch (docError) {
        console.error("Error with documented format:", docError)
      }

      // Approach 2: Try with a simplified transaction format
      if (!transactionId) {
        try {
          console.log("Trying simplified transaction format...")

          const simplePayload = {
            transaction: [
              {
                address: contractAddress,
                abi: [
                  {
                    type: "function",
                    name: "claim",
                    inputs: [],
                    outputs: [],
                    stateMutability: "nonpayable",
                  },
                ],
                functionName: "claim",
                args: [],
              },
            ],
          }

          console.log("Simple payload:", JSON.stringify(simplePayload, null, 2))

          const simpleResult = await MiniKit.commandsAsync.sendTransaction(simplePayload)
          console.log("Transaction sent successfully with simplified format:", simpleResult)

          result = simpleResult

          // Try to extract transaction ID
          transactionId = extractTransactionId(simpleResult)

          if (transactionId) {
            console.log("Successfully extracted transaction ID from simplified format:", transactionId)
            return { result, transactionId, reference }
          }
        } catch (simpleError) {
          console.error("Error with simplified format:", simpleError)
        }
      }

     // Approach 3: Try with direct function selector
     if (!transactionId) {
      try {
        console.log("Trying with callback-based API...");
    
        const callbackResult = await MiniKit.commandsAsync.sendTransaction({
          transactions: [{
            recipient: contractAddress,
            calldata: "0x379607f5", // Function selector for "claim()"
            amount: "0x0"
          }]
        });
  
      if (!transactionId) {
        try {
          console.log("Trying with MiniKit...");
      
          const callbackResult = await MiniKit.commandsAsync.sendTransaction({
            transactions: [{
              recipient: contractAddress,
              calldata: "0x379607f5", // claim()
              amount: "0x0"
            }]
          });
        console.log("Transaction sent successfully with callback API:", callbackResult);
      
      
          result = callbackResult;
          transactionId = extractTransactionId(callbackResult);
      
          if (transactionId) {
            console.log("Successfully extracted transaction ID from callback format:", transactionId);
            return { result, transactionId, reference };
          }
        } catch (err) {
          console.error("Callback API transaction failed:", err);
          throw err;
        }
      }
      if (!transactionId) {
        try {
          console.log("Trying with callback-based API...");
      
          const callbackResult = await MiniKit.commandsAsync.sendTransaction({
            transactions: [{
              recipient: contractAddress,
              calldata: "0x379607f5", // Function selector for "claim()"
              amount: "0x0"
            }]
          });
      
          console.log("Transaction sent successfully with callback API:", callbackResult);
      
          result = callbackResult;
          transactionId = extractTransactionId(callbackResult);
      
          if (transactionId) {
            console.log("Successfully extracted transaction ID from callback format:", transactionId);
            return { result, transactionId, reference };
          }
        } catch (err) {
          console.error("Callback API transaction failed:", err);
          throw err;
        }
      }
            
    } catch (selectorError) {
      console.error("Error with function selector format:", selectorError)
    }
  }
  
  // Approach 4: Try with callback-based API
  if (!transactionId) {
    try {
      console.log("Trying with callback-based API...");
  
      const callbackResult = await MiniKit.commandsAsync.sendTransaction({
        transactions: [{
          recipient: contractAddress,
          calldata: "0x379607f5", // Function selector for "claim()"
          amount: "0x0"
        }]
      });
  
      console.log("Transaction sent successfully with callback API:", callbackResult);
  
      result = callbackResult;
  
      transactionId = extractTransactionId(callbackResult);
  
      if (transactionId) {
        console.log("Successfully extracted transaction ID from callback API:", transactionId);
        return { result, transactionId, reference };
      }
    } catch (callbackError) {
      console.error("Error with callback API:", callbackError);
    }
  }
  

      // If we've tried all approaches and still don't have a transaction ID
      if (!transactionId) {
        throw new Error(
          "Could not obtain a valid transaction ID after multiple attempts. Please try again or contact support.",
        )
      }

      return { result, transactionId, reference }
    } catch (error) {
      console.error("MiniKit transaction error:", error)
      throw error
    }
  }

  // Update the handleClaim function to better handle the transaction result
  const handleClaim = async () => {
    try {
      trackEvent("claim_started", { userAddress })
      setIsClaiming(true)
      setError(null)
      console.log("Starting claim process for address:", userAddress)

      if (!allSocialFollowed) {
        throw new Error("Please follow all social channels before claiming")
      }

      // Check if MiniKit is installed
      if (!MiniKit.isInstalled()) {
        throw new Error("MiniKit wallet is not installed. Please install it first.")
      }

      // Check if user can claim with improved error handling
      console.log(`Checking claim eligibility for ${userAddress}...`)
      let canClaimCheck

      try {
        const response = await fetch(`/api/confirm-payment/${userAddress}`)
        console.log(`Eligibility API response status: ${response.status}`)

        if (!response.ok) {
          console.error(`API returned error status: ${response.status}`)
          throw new Error(`API error: ${response.status}`)
        }

        canClaimCheck = await response.json()
        console.log("Eligibility check result:", canClaimCheck)
      } catch (fetchError) {
        console.error("Error fetching claim eligibility:", fetchError)

        // If the API fails, we'll proceed with the claim anyway
        console.log("Proceeding with claim despite API error")
        canClaimCheck = { success: true, canClaim: true }
      }

      if (!canClaimCheck.success || !canClaimCheck.canClaim) {
        // Show the specific reason why the user can't claim
        if (canClaimCheck.reason) {
          throw new Error(canClaimCheck.reason)
        } else {
          throw new Error("You are not eligible to claim at this time")
        }
      }

      // Execute the MiniKit transaction
      console.log("Executing MiniKit transaction...")
      try {
        const txResult = await executeMiniKitTransaction()
        console.log("Transaction result:", txResult)

        const { transactionId, reference } = txResult

        if (!transactionId) {
          throw new Error("Failed to get a valid transaction ID. Please try again.")
        }

        console.log("Transaction sent successfully, ID:", transactionId)

        // Verify the transaction with the backend
        try {
          console.log("Verifying transaction with backend...")
          console.log("Verification params:", { transactionId, reference, userAddress })

          const verificationResult = await verifyTransaction({
            transactionId,
            reference,
            userAddress,
          })

          console.log("Verification result:", verificationResult)

          if (!verificationResult.success) {
            console.warn("Transaction verification warning:", verificationResult.message)
            // We'll continue anyway since the transaction was sent
          }
        } catch (verifyError) {
          console.error("Error during verification:", verifyError)
          // Continue anyway since the transaction was sent
        }

        console.log("Claim process completed")

        // Update local state to reflect successful claim
        setClaimSuccess(true)

        // Set the next claim time to 24 hours from now
        const nextClaimTimeValue = Date.now() + 24 * 60 * 60 * 1000
        setNextClaimTime(nextClaimTimeValue)

        // Store the next claim time in localStorage with a global key
        localStorage.setItem(getClaimTimerKey(), nextClaimTimeValue.toString())
        console.log(`Set next claim time to: ${new Date(nextClaimTimeValue).toLocaleString()}`)

        // Update the balance
        setBalance((prev) => prev + 1) // Add 1 ASTRA to the balance

        trackEvent("claim_success", { userAddress, transactionId })
      } catch (txError) {
        console.error("Transaction error:", txError)
        throw txError // Re-throw to be caught by the outer catch
      }
    } catch (err) {
      console.error("Claim error:", err)
      setError(err.message || "Failed to claim tokens. Please try again.")
      trackEvent("claim_error", { userAddress, error: err.message })
    } finally {
      setIsClaiming(false)
    }
  }

  const allSocialFollowed = Object.values(socialFollowed).every(Boolean)

  // Format time for countdown display
  const formatCountdown = () => {
    if (!nextClaimTime) return { hours: 0, minutes: 0, seconds: 0 }

    const timeLeft = Math.max(0, nextClaimTime - Date.now())
    const hours = Math.floor(timeLeft / (1000 * 60 * 60))
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000)

    return { hours, minutes, seconds }
  }

  const countdown = formatCountdown()

  // Render countdown timer
  const renderCountdown = () => {
    return (
      <div className="countdown-container">
        <div className="countdown-item">
          <div className="countdown-value">{countdown.hours.toString().padStart(2, "0")}</div>
          <div className="countdown-label">Hours</div>
        </div>
        <div className="countdown-item">
          <div className="countdown-value">{countdown.minutes.toString().padStart(2, "0")}</div>
          <div className="countdown-label">Minutes</div>
        </div>
        <div className="countdown-item">
          <div className="countdown-value">{countdown.seconds.toString().padStart(2, "0")}</div>
          <div className="countdown-label">Seconds</div>
        </div>
      </div>
    )
  }

  // Component rendering functions
  const renderSocialButtons = (platform: SocialPlatform) => {
    const { name, color, icon } = socialPlatforms[platform]
    const isFollowed = socialFollowed[platform]
    return (
      <div className="social-button" key={platform}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div className="social-icon" style={{ backgroundColor: color }}>
            {icon}
          </div>
          <span>{name}</span>
        </div>
        <button
          onClick={() => handleSocialFollow(platform)}
          disabled={isFollowed || followingPlatform === platform}
          className={`follow-btn ${isFollowed ? "followed-btn" : ""}`}
          aria-label={`Follow ${name}`}
        >
          {followingPlatform === platform ? (
            <span className="loading-spinner">
              <svg className="spinner" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </span>
          ) : isFollowed ? (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: "4px" }}
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Followed
            </>
          ) : (
            "Follow"
          )}
        </button>
      </div>
    )
  }

  const renderSocialBadge = (platform: SocialPlatform) => {
    const { name, color, icon } = socialPlatforms[platform]
    const isComplete = socialFollowed[platform]
    return (
      <div
        key={platform}
        className={`social-badge ${isComplete ? "completed" : ""}`}
        onClick={() => !isComplete && handleSocialFollow(platform)}
        style={{ cursor: isComplete ? "default" : "pointer" }}
      >
        <div className="badge-icon" style={{ backgroundColor: color }}>
          {icon}
        </div>
        <div className="badge-label">{name}</div>
        {isComplete && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4CAF50"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginLeft: "auto" }}
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </div>
    )
  }

  if (claimSuccess) {
    return (
      <div className="success-container">
        <div className="success-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            fill="none"
            viewBox="0 0 24 24"
            stroke="#4CAF50"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3>Claim Successful!</h3>
        <p style={{ color: "white", marginBottom: "15px" }}>1 ASTRA has been added to your wallet.</p>
        <div
          className="reward-amount"
          style={{
            background: "white",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontSize: "2rem",
          }}
        >
          {balance.toLocaleString()} ASTRA
        </div>

        {nextClaimTime !== null && (
          <div className="next-claim-container">
            <h4 style={{ color: "white", marginBottom: "10px" }}>Next claim available in:</h4>
            {renderCountdown()}
          </div>
        )}

        <button
          onClick={() => setClaimSuccess(false)}
          className="claim-button"
          style={{ marginTop: "20px" }}
          disabled={nextClaimTime !== null}
        >
          {nextClaimTime !== null ? "Claim Available in 24h" : "Return to Dashboard"}
        </button>
      </div>
    )
  }

  return (
    <div className="claim-coin-container">
      <h1 className="text-blue-800">Daily Astra Claim</h1>
      <p>Claim your daily rewards and earn Astra tokens</p>

      <div className="tab-container">
        <button
          onClick={() => setActiveTab("claim")}
          className={`tab-button ${activeTab === "claim" ? "active" : ""}`}
          aria-label="View Claim Tab"
        >
          Claim Tokens
        </button>
        <button
          onClick={() => setActiveTab("tasks")}
          className={`tab-button ${activeTab === "tasks" ? "active" : ""}`}
          aria-label="View Tasks Tab"
        >
          Tasks
        </button>
      </div>
      {activeTab === "claim" && (
        <div className="claim-section">
          <div className="reward-card">
            <h2>Daily Reward</h2>
            <div className="reward-amount">
              <span>1 ASTRA</span>
            </div>
            <div className="claim-status">
              <span className={nextClaimTime !== null ? "claimed" : "available"}>
                {nextClaimTime !== null ? "Claimed Today" : "Available Now"}
              </span>
            </div>

            {nextClaimTime !== null && renderCountdown()}

            {error && (
              <div className="error-message" role="alert">
                <div className="error-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                </div>
                <div className="error-text">{error}</div>
                {retryCount < MAX_RETRIES && (
                  <button
                    onClick={() => {
                      setError(null)
                      setRetryCount((prev) => prev + 1)
                      // Add a small delay before retrying
                      setTimeout(() => {
                        handleClaim()
                      }, 500)
                    }}
                    className="retry-button"
                  >
                    Try Again
                  </button>
                )}
              </div>
            )}

            <button
              onClick={!MiniKit.isInstalled() ? handleInstallMiniKit : handleClaim}
              disabled={
                isClaiming ||
                !allSocialFollowed ||
                (MiniKit.isInstalled() && !allSocialFollowed) ||
                nextClaimTime !== null
              }
              className="claim-button"
              aria-label="Claim rewards"
            >
              {!MiniKit.isInstalled() ? (
                "Install MiniKit Wallet"
              ) : isClaiming ? (
                <>
                  <svg className="spinner" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Processing...
                </>
              ) : nextClaimTime !== null ? (
                "Already Claimed Today"
              ) : !allSocialFollowed ? (
                "Follow All Channels to Claim"
              ) : (
                "Claim 1 ASTRA Now"
              )}
            </button>
            {!MiniKit.isInstalled() && (
              <div className="warning-message">You need to install MiniKit wallet to claim your tokens</div>
            )}
          </div>
          <div className="follow-card">
            <h2 className="text-blue-800">Follow Requirements</h2>
            <p>Follow our official channels to claim</p>
            <div className="social-grid">
              {Object.keys(socialPlatforms).map((platform) => renderSocialButtons(platform as SocialPlatform))}
            </div>
          </div>
        </div>
      )}
      {activeTab === "tasks" && (
        <div className="tasks-container">
          <div className="task-card">
            <div className="task-status">
              <h3>Social Media Status</h3>
              <div className="task-badge">{Object.values(socialFollowed).filter(Boolean).length}</div>
            </div>
            <div
              className="progress-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={(Object.values(socialFollowed).filter(Boolean).length / 4) * 100}
            >
              <div
                className="progress-fill"
                style={{ width: `${(Object.values(socialFollowed).filter(Boolean).length / 4) * 100}%` }}
              />
            </div>
            <div className="social-grid-tasks">
              {Object.keys(socialPlatforms).map((platform) => renderSocialBadge(platform as SocialPlatform))}
            </div>
          </div>
          <div className="task-card">
            <h3>Follow Benefits</h3>
            <div className="benefit-list">
              <div className="benefit-item">
                <div className="benefit-icon" style={{ backgroundColor: "#1976D2" }}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="white"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h4 style={{ color: "blue" }}>Stay Updated</h4>
                  <p>Get the latest news and updates about AstraCoin</p>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-icon" style={{ backgroundColor: "#9C27B0" }}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="white"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                    />
                  </svg>
                </div>
                <div>
                  <h4 style={{ color: "blue" }}>Exclusive Content</h4>
                  <p>Access to exclusive content and announcements</p>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-icon" style={{ backgroundColor: "#4CAF50" }}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="white"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 011-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h4 style={{ color: "blue" }}>Community Access</h4>
                  <p>Join our community and connect with other AstraCoin users</p>
                </div>
              </div>
            </div>
          </div>
          <div className="coming-soon-section">
            <h1 style={{ marginBottom: "15px", fontWeight: "bold", color: "black" }}>Coming Soon</h1>
            <div className="coming-soon-item">
              <div style={{ display: "flex", alignItems: "center" }}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#6e8efb"
                  strokeWidth="2"
                  style={{ marginRight: "8px" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
                <span style={{ color: "blue" }}>Global Staking</span>
              </div>
              <span className="coming-soon-badge">Soon</span>
            </div>
            <div className="coming-soon-item">
              <div style={{ display: "flex", alignItems: "center" }}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#a777e3"
                  strokeWidth="2"
                  style={{ marginRight: "8px" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  />
                </svg>
                <span style={{ color: "blue" }}>NFT Rewards</span>
              </div>
              <span className="coming-soon-badge">Soon</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
