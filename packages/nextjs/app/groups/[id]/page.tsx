"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { NextPage } from "next";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { AddExpenseForm, BalanceCard, ExpenseCard, MemberBadge } from "~~/components/splitchain";

interface User {
  address: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface GroupMember {
  userAddress: string;
  user: User;
}

interface ExpenseParticipant {
  userAddress: string;
  share: string;
  user: User;
}

interface Expense {
  id: number;
  amount: string;
  description: string;
  createdAt: string;
  payer: User;
  participants: ExpenseParticipant[];
}

interface Group {
  id: number;
  name: string;
  creator: User;
  members: GroupMember[];
  expenses: Expense[];
}

interface Debt {
  from: string;
  to: string;
  amount: string;
}

interface BalanceData {
  balances: Record<string, string>;
  debts: Debt[];
}

const GroupDetailPage: NextPage = () => {
  const params = useParams();
  const router = useRouter();
  const groupId = parseInt(params.id as string);
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<"expenses" | "balances">("expenses");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isCreator = group?.creator?.address?.toLowerCase() === address?.toLowerCase();

  const handleDeleteGroup = async () => {
    if (!address || !isCreator) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/groups?id=${groupId}&user=${address}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/groups");
      } else {
        const data = await res.json();
        console.error("Failed to delete group:", data.error);
      }
    } catch (error) {
      console.error("Error deleting group:", error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const fetchGroup = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      if (res.ok) {
        const data = await res.json();
        setGroup(data);
      }
    } catch (error) {
      console.error("Failed to fetch group:", error);
    }
  }, [groupId]);

  const fetchBalances = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/balances?group=${groupId}&user=${address}`);
      if (res.ok) {
        const data = await res.json();
        setBalanceData(data);
      }
    } catch (error) {
      console.error("Failed to fetch balances:", error);
    }
  }, [groupId, address]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([fetchGroup(), fetchBalances()]);
      setIsLoading(false);
    };
    fetchData();
  }, [fetchGroup, fetchBalances]);

  const refreshData = () => {
    fetchGroup();
    fetchBalances();
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">👋 Connect Your Wallet</h1>
        <p className="text-xl opacity-70">Connect your wallet to view this group</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">Group Not Found</h1>
        <Link href="/groups" className="btn btn-primary">
          Back to Groups
        </Link>
      </div>
    );
  }

  const userBalance = balanceData?.balances[address?.toLowerCase() || ""] || "0";
  const balanceNum = parseInt(userBalance);
  const myDebts = balanceData?.debts.filter(d => d.from.toLowerCase() === address?.toLowerCase()) || [];
  const owedToMe = balanceData?.debts.filter(d => d.to.toLowerCase() === address?.toLowerCase()) || [];

  // Get user lookup map
  const userMap = new Map(group.members.map(m => [m.user.address.toLowerCase(), m.user]));
  const getUser = (addr: string) => userMap.get(addr.toLowerCase());

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back link */}
      <Link href="/groups" className="btn btn-ghost btn-sm mb-4">
        ← Back to Groups
      </Link>

      {/* Header */}
      <div className="bg-gradient-to-r from-primary/20 via-secondary/10 to-accent/20 rounded-2xl p-6 mb-8">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <span className="text-4xl">👥</span>
              {group.name}
              {isCreator && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn btn-ghost btn-sm text-error opacity-60 hover:opacity-100 gap-1"
                  title="Delete Group"
                >
                  🗑️ Delete Group
                </button>
              )}
            </h1>
            <p className="opacity-70 mt-1">
              {group.members.length} members · {group.expenses.length} expenses
            </p>
          </div>

          {/* Balance summary */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body p-4">
              <p className="text-sm opacity-70">Your Net Balance</p>
              <p
                className={`text-2xl font-bold ${
                  balanceNum > 0 ? "text-success" : balanceNum < 0 ? "text-error" : "text-base-content"
                }`}
              >
                {balanceNum > 0 && "+"}
                {formatEther(BigInt(Math.abs(balanceNum)))} ETH
              </p>
            </div>
          </div>
        </div>

        {/* Members */}
        <div className="mt-6">
          <p className="text-sm opacity-70 mb-2">Members:</p>
          <div className="flex flex-wrap gap-2">
            {group.members.map(m => (
              <MemberBadge
                key={m.userAddress}
                address={m.userAddress}
                isCurrentUser={m.userAddress.toLowerCase() === address?.toLowerCase()}
                showEdit={m.userAddress.toLowerCase() === address?.toLowerCase()}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs tabs-boxed mb-6 bg-base-200 p-1 w-fit">
        <button
          className={`tab ${activeTab === "expenses" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("expenses")}
        >
          💳 Expenses
        </button>
        <button
          className={`tab ${activeTab === "balances" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("balances")}
        >
          💰 Balances
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "expenses" && (
        <div className="space-y-6">
          {/* Add expense button/form */}
          {!showAddExpense ? (
            <button onClick={() => setShowAddExpense(true)} className="btn btn-primary btn-outline gap-2 w-full">
              <span>➕</span> Add New Expense
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowAddExpense(false)}
                className="btn btn-ghost btn-sm absolute top-2 right-2 z-10"
              >
                ✕
              </button>
              <AddExpenseForm
                groupId={group.id}
                members={group.members}
                onSuccess={() => {
                  setShowAddExpense(false);
                  refreshData();
                }}
              />
            </div>
          )}

          {/* Expenses list */}
          {group.expenses.length === 0 ? (
            <div className="text-center py-12 bg-base-200 rounded-lg">
              <span className="text-4xl block mb-2">📝</span>
              <p className="opacity-70">No expenses yet. Add your first expense above!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {group.expenses.map(expense => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  currentUserAddress={address}
                  onDeleted={refreshData}
                  onEdited={refreshData}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "balances" && (
        <div className="space-y-6">
          {/* Debts I owe */}
          {myDebts.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span>💸</span> You Owe
              </h3>
              <div className="grid gap-3">
                {myDebts.map((debt, idx) => (
                  <BalanceCard
                    key={idx}
                    groupId={group.id}
                    creditor={debt.to}
                    creditorUser={getUser(debt.to)}
                    amount={debt.amount}
                    onSettled={refreshData}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Money owed to me */}
          {owedToMe.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span>💰</span> Owed to You
              </h3>
              <div className="grid gap-3">
                {owedToMe.map((debt, idx) => (
                  <BalanceCard
                    key={idx}
                    groupId={group.id}
                    creditor={address!}
                    creditorUser={getUser(address!)}
                    debtorUser={getUser(debt.from)}
                    amount={debt.amount}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All settled */}
          {myDebts.length === 0 && owedToMe.length === 0 && (
            <div className="text-center py-12 bg-base-200 rounded-lg">
              <span className="text-4xl block mb-2">✨</span>
              <p className="font-bold text-lg">All Settled!</p>
              <p className="opacity-70">No outstanding debts in this group.</p>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error">⚠️ Delete Group</h3>
            <p className="py-4">
              Are you sure you want to delete <strong>{group.name}</strong>?
              <br />
              <span className="text-sm opacity-70">
                This will permanently delete all expenses, settlements, and member data.
              </span>
            </p>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                Cancel
              </button>
              <button className="btn btn-error" onClick={handleDeleteGroup} disabled={isDeleting}>
                {isDeleting ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Deleting...
                  </>
                ) : (
                  "Delete Group"
                )}
              </button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/50" onClick={() => !isDeleting && setShowDeleteConfirm(false)}></div>
        </div>
      )}
    </div>
  );
};

export default GroupDetailPage;
