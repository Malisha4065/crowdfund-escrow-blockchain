"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useAccount } from "wagmi";

interface User {
  address: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface AddExpenseFormProps {
  groupId: number;
  members: Array<{ user: User }>;
  onSuccess?: () => void;
}

export function AddExpenseForm({ groupId, members, onSuccess }: AddExpenseFormProps) {
  const { address } = useAccount();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectAll, setSelectAll] = useState(true);

  // Initialize with all members selected
  useState(() => {
    setSelectedParticipants(members.map(m => m.user.address));
  });

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(members.map(m => m.user.address));
    }
    setSelectAll(!selectAll);
  };

  const toggleParticipant = (addr: string) => {
    if (selectedParticipants.includes(addr)) {
      setSelectedParticipants(selectedParticipants.filter(p => p !== addr));
    } else {
      setSelectedParticipants([...selectedParticipants, addr]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !description || !amount || selectedParticipants.length === 0) return;

    setIsSubmitting(true);
    try {
      const amountWei = parseEther(amount);

      // Call API to create expense
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          payerAddress: address,
          amount: amountWei.toString(),
          description,
          participantAddresses: selectedParticipants,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to add expense");
      }

      // Reset form
      setDescription("");
      setAmount("");
      setSelectedParticipants(members.map(m => m.user.address));
      setSelectAll(true);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to add expense:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sharePerPerson =
    amount && selectedParticipants.length > 0 ? (parseFloat(amount) / selectedParticipants.length).toFixed(6) : "0";

  return (
    <form onSubmit={handleSubmit} className="card bg-base-200 shadow-lg">
      <div className="card-body">
        <h2 className="card-title text-xl mb-4">
          <span className="text-2xl">➕</span> Add New Expense
        </h2>

        {/* Description */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">What was this expense for?</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g., Dinner at restaurant, Hotel booking..."
            className="input input-bordered"
            required
          />
        </div>

        {/* Amount */}
        <div className="form-control mt-4">
          <label className="label">
            <span className="label-text">Amount (in ETH)</span>
          </label>
          <input
            type="number"
            step="0.000001"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.05"
            className="input input-bordered"
            required
          />
        </div>

        {/* Split Preview */}
        {amount && selectedParticipants.length > 0 && (
          <div className="alert alert-info mt-4">
            <span className="text-lg">📊</span>
            <span>
              Split <strong>{amount} ETH</strong> equally between <strong>{selectedParticipants.length}</strong> people
              = <strong>{sharePerPerson} ETH</strong> each
            </span>
          </div>
        )}

        {/* Participants */}
        <div className="form-control mt-4">
          <label className="label">
            <span className="label-text">Who should split this expense?</span>
            <button type="button" onClick={handleSelectAll} className="btn btn-ghost btn-xs">
              {selectAll ? "Deselect All" : "Select All"}
            </button>
          </label>
          <div className="flex flex-wrap gap-2">
            {members.map(({ user }) => (
              <label
                key={user.address}
                className={`cursor-pointer badge badge-lg ${
                  selectedParticipants.includes(user.address) ? "badge-primary" : "badge-outline"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={selectedParticipants.includes(user.address)}
                  onChange={() => toggleParticipant(user.address)}
                />
                {user.displayName}
                {user.address.toLowerCase() === address?.toLowerCase() && " (you)"}
              </label>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="card-actions justify-end mt-6">
          <button
            type="submit"
            className="btn btn-primary gap-2"
            disabled={isSubmitting || !description || !amount || selectedParticipants.length === 0}
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Adding...
              </>
            ) : (
              <>
                <span>💳</span>
                Add Expense
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
