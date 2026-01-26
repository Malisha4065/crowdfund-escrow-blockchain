"use client";

import { useState } from "react";
import { formatEther } from "viem";
import { useAccount, usePublicClient } from "wagmi";
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
  debtorUser?: User; // For showing who owes you
  amount: string; // Wei as string
  onSettled?: () => void;
}

export function BalanceCard({ groupId, creditor, creditorUser, debtorUser, amount, onSettled }: BalanceCardProps) {
  const { address } = useAccount();
  const [isSettling, setIsSettling] = useState(false);

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "SplitChain" });
  const publicClient = usePublicClient();

  const isCreditor = creditor.toLowerCase() === address?.toLowerCase();
  const amountBigInt = BigInt(amount);
  const amountEthRaw = formatEther(amountBigInt);
  // Round to 6 decimal places for cleaner display
  const amountEth = parseFloat(amountEthRaw)
    .toFixed(6)
    .replace(/\.?0+$/, "");

  const handleSettle = async () => {
    if (!address || isCreditor || !publicClient) return;

    setIsSettling(true);
    try {
      console.log(`Settling ${amountEth} ETH to ${creditor}`);

      // 1. Call blockchain contract
      const txHash = await writeContractAsync({
        functionName: "settle",
        args: [creditor, BigInt(groupId)],
        value: amountBigInt,
      });

      console.log("Tx sent:", txHash);

      if (!txHash) {
        console.error("Tx hash missing");
        return;
      }

      // 2. Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log("Tx confirmed");

      // 3. Record in DB
      const res = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          fromAddress: address,
          toAddress: creditor,
          amount: amount,
          txHash: txHash,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to record settlement");
      }

      onSettled?.();
    } catch (error) {
      console.error("Settlement failed:", error);
      // TODO: Show toast error
    } finally {
      setIsSettling(false);
    }
  };

  // Display name for creditor (who you owe) or debtor (who owes you)
  const creditorDisplayName = creditorUser?.displayName || `${creditor.slice(0, 6)}...${creditor.slice(-4)}`;
  const debtorDisplayName =
    debtorUser?.displayName ||
    (debtorUser ? `${debtorUser.address.slice(0, 6)}...${debtorUser.address.slice(-4)}` : "Someone");

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
                  <p className="text-sm opacity-70">{debtorDisplayName} owes you</p>
                  <p className="text-xl font-bold text-success">+{amountEth} ETH</p>
                </div>
              </>
            ) : (
              <>
                <span className="text-2xl">💸</span>
                <div>
                  <p className="text-sm opacity-70">You owe {creditorDisplayName}</p>
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
