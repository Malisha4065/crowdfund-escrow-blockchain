"use client";

import { useState } from "react";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

interface User {
  address: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface BalanceCardProps {
  groupId: number;
  creditor: string;
  creditorUser?: User;
  amount: string; // Wei as string
  onSettled?: () => void;
}

export function BalanceCard({ groupId, creditor, creditorUser, amount, onSettled }: BalanceCardProps) {
  const { address } = useAccount();
  const [isSettling, setIsSettling] = useState(false);

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "SplitChain" });

  const isCreditor = creditor.toLowerCase() === address?.toLowerCase();
  const amountBigInt = BigInt(amount);
  const amountEth = formatEther(amountBigInt);

  const handleSettle = async () => {
    if (!address || isCreditor) return;

    setIsSettling(true);
    try {
      // Call blockchain contract
      const tx = await writeContractAsync({
        functionName: "settle",
        args: [creditor, BigInt(groupId)],
        value: amountBigInt,
      });

      // Record settlement in database
      await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          fromAddress: address,
          toAddress: creditor,
          amount: amount,
          txHash: tx,
        }),
      });

      onSettled?.();
    } catch (error) {
      console.error("Settlement failed:", error);
    } finally {
      setIsSettling(false);
    }
  };

  const displayName = creditorUser?.displayName || `${creditor.slice(0, 6)}...${creditor.slice(-4)}`;

  return (
    <div
      className={`card ${isCreditor ? "bg-success/10 border-success" : "bg-error/10 border-error"} border shadow-md`}
    >
      <div className="card-body p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            {isCreditor ? (
              <>
                <span className="text-2xl">💰</span>
                <div>
                  <p className="text-sm opacity-70">You are owed</p>
                  <p className="text-xl font-bold text-success">+{amountEth} ETH</p>
                </div>
              </>
            ) : (
              <>
                <span className="text-2xl">💸</span>
                <div>
                  <p className="text-sm opacity-70">You owe {displayName}</p>
                  <p className="text-xl font-bold text-error">-{amountEth} ETH</p>
                </div>
              </>
            )}
          </div>

          {!isCreditor && (
            <button onClick={handleSettle} className="btn btn-primary btn-sm gap-2" disabled={isSettling}>
              {isSettling ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Settling...
                </>
              ) : (
                <>
                  <span>⚡</span>
                  Settle Now
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
