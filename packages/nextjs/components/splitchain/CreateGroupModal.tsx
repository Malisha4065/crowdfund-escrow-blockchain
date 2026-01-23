"use client";

import { useState } from "react";
import { MemberSearchInput } from "./MemberSearchInput";
import { useAccount } from "wagmi";

interface User {
  address: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface SelectedMember {
  address: string;
  displayName?: string;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (groupId: number) => void;
}

export function CreateGroupModal({ isOpen, onClose, onSuccess }: CreateGroupModalProps) {
  const { address } = useAccount();
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<SelectedMember[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const handleAddMember = (memberAddress: string, user?: User) => {
    const newMember: SelectedMember = {
      address: memberAddress,
      displayName: user?.displayName,
    };
    setMembers([...members, newMember]);
    setError("");
  };

  const removeMember = (addr: string) => {
    setMembers(members.filter(m => m.address !== addr));
  };

  const handleCreate = async () => {
    if (!address || !groupName) return;

    setIsCreating(true);
    setError("");

    try {
      // Ensure creator has a profile
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          displayName: `User ${address.slice(0, 6)}`,
        }),
      });

      // Create group via API
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName,
          creatorAddress: address,
          memberAddresses: members.map(m => m.address),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create group");
      }

      const group = await res.json();

      // Reset and close
      setGroupName("");
      setMembers([]);
      onClose();
      onSuccess?.(group.id);
    } catch (err: unknown) {
      console.error("Failed to create group:", err);
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  const excludeAddresses = [address || "", ...members.map(m => m.address)];

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
          ✕
        </button>

        <h3 className="font-bold text-xl mb-6">
          <span className="text-2xl mr-2">👥</span>
          Create New Group
        </h3>

        {/* Group Name */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">Group Name</span>
          </label>
          <input
            type="text"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="e.g., Beach Trip 2026, Roommates..."
            className="input input-bordered"
          />
        </div>

        {/* Add Members */}
        <div className="form-control mt-4">
          <label className="label">
            <span className="label-text">Add Members</span>
          </label>
          <MemberSearchInput
            onSelect={handleAddMember}
            excludeAddresses={excludeAddresses}
            placeholder="Search by name or paste address..."
          />
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error mt-2 py-2">
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Members List */}
        <div className="mt-4">
          <p className="text-sm opacity-70 mb-2">Members ({members.length + 1}):</p>
          <div className="flex flex-wrap gap-2">
            {/* Current user */}
            <span className="badge badge-primary badge-lg">
              {address?.slice(0, 6)}...{address?.slice(-4)} (you)
            </span>

            {/* Added members */}
            {members.map(m => (
              <span key={m.address} className="badge badge-outline badge-lg gap-1">
                {m.displayName || `${m.address.slice(0, 6)}...${m.address.slice(-4)}`}
                <button
                  type="button"
                  onClick={() => removeMember(m.address)}
                  className="text-error hover:text-error-focus"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="modal-action">
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button onClick={handleCreate} className="btn btn-primary gap-2" disabled={isCreating || !groupName}>
            {isCreating ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Creating...
              </>
            ) : (
              <>
                <span>🚀</span>
                Create Group
              </>
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose}></div>
    </div>
  );
}
