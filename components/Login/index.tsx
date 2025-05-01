import { MiniKit, WalletAuthInput } from "@worldcoin/minikit-js";
import { Button } from "@worldcoin/mini-apps-ui-kit-react";
import { useCallback, useEffect, useState } from "react";

const walletAuthInput = (nonce: string): WalletAuthInput => {
    return {
        nonce,
        requestId: "0",
        expirationTime: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
        notBefore: new Date(new Date().getTime() - 24 * 60 * 60 * 1000),
        statement: "Welcome to AstraCoin",
    };
};

type LoginProps = {
    onLoginSuccess?: (user: any) => void;  
};

const Login = ({ onLoginSuccess }: LoginProps) => {
    const [loading, setLoading] = useState(false);

    const refreshUserData = useCallback(async () => {
        try {
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                const data = await response.json();
    
                // Only run onLoginSuccess if a valid user exists
                if (data.user && data.user.id) {
                    if (onLoginSuccess) {
                        onLoginSuccess(data.user);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    }, [onLoginSuccess]);
    
    useEffect(() => {
        refreshUserData();
    }, [refreshUserData]); 
    const handleLogin = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/nonce`);
            const { nonce } = await res.json();
            const { finalPayload } = await MiniKit.commandsAsync.walletAuth(walletAuthInput(nonce));
            if (finalPayload.status === 'error') {
                setLoading(false);
                return;
            } else {
                const response = await fetch('/api/auth/login', {
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
                    const userData = await response.json();
                    const userInfo = userData.user || MiniKit.user;
                    if (onLoginSuccess) {
                        onLoginSuccess(userInfo);
                    }
                }
                setLoading(false);
            }
        } catch (error) {
            console.error("Login error:", error);
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center">
            <Button 
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3 transition-all duration-200 hover:opacity-90"
            >
                {loading ? (
                    <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Connecting...
                    </div>
                ) : "CLAIM"}
            </Button>
        </div>
    );
};

export default Login;
