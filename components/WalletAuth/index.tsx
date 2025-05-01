"use client";
import { MiniKit, WalletAuthInput } from "@worldcoin/minikit-js";
import { Button } from "@worldcoin/mini-apps-ui-kit-react";
import Image from 'next/image';
import { useCallback, useState } from "react";

const walletAuthInput = (nonce: string): WalletAuthInput => {
    return {
        nonce,
        requestId: "0",
        expirationTime: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        notBefore: new Date(new Date().getTime() - 24 * 60 * 60 * 1000), // 24 hours ago
        statement: "This is my statement and here is a link https://worldcoin.com/apps",
    };
};

type User = {
    walletAddress: string;
    username: string | null;
    profilePictureUrl: string | null;
};

export const WalletAuth = () => {
    const [user, setUser] = useState<User | null>(null);

    const handleWalletAuth = async () => {
        if (!MiniKit.isInstalled()) {
            console.warn('Tried to invoke "walletAuth", but MiniKit is not installed.');
            return;
        }

        const res = await fetch(`/api/nonce`);
        const { nonce } = await res.json();

        const { finalPayload } = await MiniKit.commandsAsync.walletAuth(walletAuthInput(nonce));

        if (finalPayload.status === 'error') {
            return;
        } else {
            const response = await fetch('/api/complete-siwe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    payload: finalPayload,
                    nonce,
                }),
            });

            if (response.status === 200) {
                // Fetch user information after successful wallet auth
                const userData = await response.json();
                
                // Set user data
                setUser({
                    walletAddress: userData.walletAddress,
                    username: userData.username || null,
                    profilePictureUrl: userData.profilePictureUrl || null,
                });
            }
        }
    };

    const handleSignOut = useCallback(() => {
        setUser(null);
    }, []);

    return (
        <div className="flex flex-col items-center">
            {!user ? (
                <Button onClick={handleWalletAuth}>Wallet Auth</Button>
            ) : (
                <div className="flex flex-col items-center space-y-2">
                    <div className="text-green-600 font-medium">✓ Connected</div>
                    <div className="flex items-center space-x-2">
                        {user?.profilePictureUrl && (
                            <Image
                                src={user.profilePictureUrl}
                                alt={user.username || 'Profile'}
                                className="w-8 h-8 rounded-full"
                                width={32}
                                height={32}
                            />
                        )}
                        <span className="font-medium">
                            {user?.username || user?.walletAddress.slice(0, 6) + '...' + user?.walletAddress.slice(-4)}
                        </span>
                    </div>
                    <Button
                        onClick={handleSignOut}
                        variant="secondary"
                        size="md"
                    >
                        Sign Out
                    </Button>
                </div>
            )}
        </div>
    );
};
