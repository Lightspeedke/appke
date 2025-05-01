"use client"

import { useEffect, useState } from "react"
import { MiniKit } from "@worldcoin/minikit-js"
import Login from "@/components/Login"
import Image from "next/image"
import { ClaimCoin } from "@/components/ClaimCoin"

interface User {
  walletAddress: string
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loginError, setLoginError] = useState("")
  const [balance, setBalance] = useState<number | null>(null)
  const [splashProgress, setSplashProgress] = useState(0)
  const [showSplash, setShowSplash] = useState(true)

  const truncateAddress = (address: string) => {
    if (!address) return ""
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  useEffect(() => {
    // Simulate splash screen progress
    const splashInterval = setInterval(() => {
      setSplashProgress((prev) => {
        if (prev >= 100) {
          clearInterval(splashInterval)
          return 100
        }
        return prev + 5
      })
    }, 100)

    const checkMiniKit = async () => {
      try {
        const isInstalled = MiniKit.isInstalled()
        if (isInstalled) {
          // Wait for splash animation to complete
          setTimeout(() => {
            setShowSplash(false)
            setIsLoading(false)
          }, 2500)

          // Check if user is already logged in
          try {
            const response = await fetch("/api/auth/me")
            if (response.ok) {
              const data = await response.json()
              if (data.user) {
                setUser(data.user)
                setIsLoggedIn(true)
                if (data.user.walletAddress) {
                  fetchBalance(data.user.walletAddress)
                }
              }
            }
          } catch (error) {
            console.error("Error checking auth status:", error)
            setLoginError("Failed to check auth status")
            setIsLoading(false)
          }
        } else {
          setTimeout(checkMiniKit, 500)
        }
      } catch (error) {
        console.error("Error checking MiniKit:", error)
        setIsLoading(false)
        setLoginError("Failed to initialize MiniKit")
      }
    }

    checkMiniKit()

    return () => {
      clearInterval(splashInterval)
    }
  }, [])

  // Fetch user balance
  const fetchBalance = async (walletAddress: string) => {
    if (!walletAddress) return

    try {
      const response = await fetch(`/api/confirm-payment/${walletAddress}`)
      if (response.ok) {
        console.log("Claim me")
        const data = await response.json()
        setBalance(data.balance)
      } else {
        console.error("Failed to fetch balance:", await response.text())
      }
    } catch (error) {
      console.error("Error fetching balance:", error)
    }
  }

  const handleLoginSuccess = (userData: User) => {
    setUser(userData)
    setIsLoggedIn(true)
    setLoginError("")
    if (userData.walletAddress) {
      fetchBalance(userData.walletAddress)
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      })
      if (response.ok) {
        setIsLoggedIn(false)
        setUser(null)
        setBalance(null)
      }
    } catch (error) {
      console.error("Logout error:", error)
      setLoginError("Logout failed")
    }
  }

  // MiniKit Splash Screen
  if (showSplash) {
    return (
      <div className="minikit-splash">
        <div className="minikit-splash-content">
          <div className="minikit-logo">
            <Image src="/logo.png" width={60} height={60} alt="AstraCoin Logo" />
          </div>
          <h1>Welcome to AstraCoin</h1>
          <p>Initializing MiniKit Wallet...</p>
          <div className="minikit-progress">
            <div className="minikit-progress-bar" style={{ width: `${splashProgress}%` }}></div>
          </div>
          <p className="minikit-status">
            {splashProgress < 30
              ? "Connecting..."
              : splashProgress < 60
                ? "Loading wallet..."
                : splashProgress < 90
                  ? "Almost ready..."
                  : "Ready!"}
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-blue-50">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="relative w-16 h-16">
            <svg
              className="animate-spin h-16 w-16 text-indigo-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
          <p className="mt-6 text-lg font-medium text-indigo-900">Loading MiniKit...</p>
          <p className="mt-2 text-sm text-indigo-600">Please wait while we initialize the application</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="w-full max-w-md mx-auto space-y-8 py-8">
        <div className="text-center mb-12">
          <div className="inline-block rounded-full shadow-lg mb-4">
            <Image src="/logo.png" width={40} height={40} className="h-10 w-10 text-white" alt="Logo" />
          </div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">
            Astracoin
          </h1>
          <p className="mt-2 text-gray-600">The future of decentralized currency</p>
        </div>

        {isLoggedIn && user ? (
          <>
            <section className="bg-white rounded-2xl shadow-xl p-8 transition-all hover:shadow-2xl border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">Claim Astracoin</h2>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-indigo-600 transition-colors flex items-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Logout
                </button>
              </div>
              <div className="bg-indigo-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-indigo-800 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 2a8 8 0 11-8 8 8 8 0 018-8zm0 14a6 6 0 100-12 6 6 0 000 12z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Wallet Address: <span className="font-semibold">{truncateAddress(user.walletAddress)}</span>
                </p>
                {balance !== null && (
                  <p className="text-sm text-indigo-800 mt-2">
                    Balance: <span className="font-semibold">{balance}</span> Astracoin
                  </p>
                )}
              </div>
            </section>
            {user.walletAddress && <ClaimCoin userAddress={user.walletAddress} />}
          </>
        ) : (
          <>
            <Login onLoginSuccess={handleLoginSuccess} />
            {loginError && <p className="text-red-500 text-center mt-4">{loginError}</p>}
          </>
        )}
      </div>
    </main>
  )
}
