"use client";

import { useState } from "react";
import { MemberBadge } from "./MemberBadge";
import { formatEther, parseEther } from "viem";

interface User {
  address: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface ExpenseParticipant {
  userAddress: string;
  user: User;
}

interface ExpenseData {
  id: number;
  amount: string;
  description: string;
  createdAt: string;
  payer: User;
  participants: ExpenseParticipant[];
}

interface ExpenseCardProps {
  expense: ExpenseData;
  currentUserAddress?: string;
  onDeleted?: () => void;
  onEdited?: () => void;
}

export function ExpenseCard({ expense, currentUserAddress, onDeleted, onEdited }: ExpenseCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editDescription, setEditDescription] = useState(expense.description);
  const [editAmount, setEditAmount] = useState(formatEther(BigInt(expense.amount)));
  const [isSaving, setIsSaving] = useState(false);

  const amount = BigInt(expense.amount);
  const sharePerPerson = amount / BigInt(expense.participants.length);
  const date = new Date(expense.createdAt);

  // Check if user can edit/delete (payer or participant)
  const isPayer = expense.payer.address.toLowerCase() === currentUserAddress?.toLowerCase();
  const isParticipant = expense.participants.some(
    p => p.userAddress.toLowerCase() === currentUserAddress?.toLowerCase(),
  );
  const canModify = isPayer || isParticipant;

  const handleDelete = async () => {
    if (!currentUserAddress) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/expenses?id=${expense.id}&user=${currentUserAddress}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onDeleted?.();
      } else {
        const data = await res.json();
        console.error("Failed to delete expense:", data.error);
      }
    } catch (error) {
      console.error("Error deleting expense:", error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!currentUserAddress || !editDescription.trim() || !editAmount) return;

    setIsSaving(true);
    try {
      const amountWei = parseEther(editAmount);

      const res = await fetch("/api/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseId: expense.id,
          userAddress: currentUserAddress,
          amount: amountWei.toString(),
          description: editDescription.trim(),
        }),
      });

      if (res.ok) {
        setIsEditing(false);
        onEdited?.();
      } else {
        const data = await res.json();
        console.error("Failed to edit expense:", data.error);
      }
    } catch (error) {
      console.error("Error editing expense:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Format amount for display
  const amountEthRaw = formatEther(amount);
  const amountEth = parseFloat(amountEthRaw)
    .toFixed(6)
    .replace(/\.?0+$/, "");
  const shareEthRaw = formatEther(sharePerPerson);
  const shareEth = parseFloat(shareEthRaw)
    .toFixed(6)
    .replace(/\.?0+$/, "");

  return (
    <>
      <div className="card bg-base-200 shadow-lg hover:shadow-xl transition-shadow relative">
        {/* Edit/Delete buttons */}
        {canModify && !isEditing && (
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={() => setIsEditing(true)}
              className="btn btn-ghost btn-xs opacity-50 hover:opacity-100"
              title="Edit"
            >
              ✏️
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn btn-ghost btn-xs text-error opacity-50 hover:opacity-100"
              title="Delete"
            >
              🗑️
            </button>
          </div>
        )}

        <div className="card-body p-4">
          {isEditing ? (
            /* Edit Mode */
            <div className="space-y-3">
              <input
                type="text"
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                className="input input-bordered input-sm w-full"
                placeholder="Description"
              />
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  step="0.000001"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="input input-bordered input-sm w-32"
                  placeholder="Amount"
                />
                <span className="text-sm opacity-70">ETH</span>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditDescription(expense.description);
                    setEditAmount(formatEther(BigInt(expense.amount)));
                  }}
                  className="btn btn-ghost btn-sm"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="btn btn-primary btn-sm"
                  disabled={isSaving || !editDescription.trim() || !editAmount}
                >
                  {isSaving ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* View Mode */
            <>
              {/* Header */}
              <div className="flex justify-between items-start pr-16">
                <div>
                  <h3 className="card-title text-lg">{expense.description}</h3>
                  <p className="text-xs opacity-60">
                    {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">{amountEth} ETH</p>
                  <p className="text-xs opacity-60">{shareEth} each</p>
                </div>
              </div>

              {/* Payer */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm opacity-70">Paid by:</span>
                <MemberBadge address={expense.payer.address} isCurrentUser={isPayer} size="sm" />
              </div>

              {/* Participants */}
              <div className="mt-2">
                <p className="text-xs opacity-70 mb-1">Split between {expense.participants.length} people:</p>
                <div className="flex flex-wrap gap-1">
                  {expense.participants.map(p => (
                    <MemberBadge
                      key={p.userAddress}
                      address={p.userAddress}
                      isCurrentUser={p.userAddress.toLowerCase() === currentUserAddress?.toLowerCase()}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error">⚠️ Delete Expense</h3>
            <p className="py-4">
              Are you sure you want to delete <strong>{expense.description}</strong>?
            </p>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                Cancel
              </button>
              <button className="btn btn-error" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/50" onClick={() => !isDeleting && setShowDeleteConfirm(false)}></div>
        </div>
      )}
    </>
  );
}
