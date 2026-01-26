"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { CreateGroupModal } from "~~/components/splitchain";

interface User {
  address: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface GroupMember {
  userAddress: string;
  user: User;
}

interface Group {
  id: number;
  name: string;
  createdAt: string;
  creator: User;
  members: GroupMember[];
  _count: {
    expenses: number;
  };
}

const GroupsPage: NextPage = () => {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  const handleDeleteGroup = async (groupId: number, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation();

    if (!address) return;

    setDeletingGroupId(groupId);
    try {
      const res = await fetch(`/api/groups?id=${groupId}&user=${address}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setGroups(groups.filter(g => g.id !== groupId));
      } else {
        const data = await res.json();
        console.error("Failed to delete group:", data.error);
      }
    } catch (error) {
      console.error("Error deleting group:", error);
    } finally {
      setDeletingGroupId(null);
      setShowDeleteConfirm(null);
    }
  };

  // Fetch user's groups
  useEffect(() => {
    if (!address) {
      setIsLoading(false);
      return;
    }

    const fetchGroups = async () => {
      try {
        const res = await fetch(`/api/groups?user=${address}`);
        if (res.ok) {
          const data = await res.json();
          setGroups(data);
        }
      } catch (error) {
        console.error("Failed to fetch groups:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, [address]);

  const handleGroupCreated = (groupId: number) => {
    router.push(`/groups/${groupId}`);
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">👋 Welcome to SplitChain</h1>
        <p className="text-xl opacity-70 mb-8">Connect your wallet to view and manage your expense groups</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="text-4xl">👥</span>
            Your Groups
          </h1>
          <p className="opacity-70 mt-2">Manage your expense splitting groups</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary gap-2">
          <span>➕</span> New Group
        </button>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : groups.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16 bg-base-200 rounded-2xl">
          <span className="text-6xl mb-4 block">📝</span>
          <h2 className="text-2xl font-bold mb-2">No groups yet</h2>
          <p className="opacity-70 mb-6">Create your first group and start splitting expenses with friends!</p>
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
            Create Your First Group
          </button>
        </div>
      ) : (
        /* Groups grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map(group => {
            const isCreator = group.creator?.address?.toLowerCase() === address?.toLowerCase();
            return (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <div className="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer shadow-lg hover:shadow-xl relative">
                  {/* Delete button for creator */}
                  {isCreator && (
                    <button
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowDeleteConfirm(group.id);
                      }}
                      className="absolute top-2 right-2 btn btn-ghost btn-sm btn-circle text-error opacity-50 hover:opacity-100"
                      title="Delete Group"
                    >
                      {deletingGroupId === group.id ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        "🗑️"
                      )}
                    </button>
                  )}
                  <div className="card-body">
                    <h2 className="card-title">
                      <span className="text-2xl">👥</span>
                      {group.name}
                    </h2>
                    <p className="text-sm opacity-70">
                      {group.members.length} members · {group._count.expenses} expenses
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {group.members.slice(0, 3).map(m => (
                        <span key={m.userAddress} className="badge badge-sm badge-outline">
                          {m.user.displayName || m.userAddress.slice(0, 8)}
                        </span>
                      ))}
                      {group.members.length > 3 && (
                        <span className="badge badge-sm badge-ghost">+{group.members.length - 3}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error">⚠️ Delete Group</h3>
            <p className="py-4">
              Are you sure you want to delete <strong>{groups.find(g => g.id === showDeleteConfirm)?.name}</strong>?
              <br />
              <span className="text-sm opacity-70">
                This will permanently delete all expenses, settlements, and member data.
              </span>
            </p>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowDeleteConfirm(null)} disabled={deletingGroupId !== null}>
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={e => handleDeleteGroup(showDeleteConfirm, e)}
                disabled={deletingGroupId !== null}
              >
                {deletingGroupId === showDeleteConfirm ? (
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
          <div
            className="modal-backdrop bg-black/50"
            onClick={() => deletingGroupId === null && setShowDeleteConfirm(null)}
          ></div>
        </div>
      )}

      {/* Create Group Modal */}
      <CreateGroupModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleGroupCreated} />
    </div>
  );
};

export default GroupsPage;
