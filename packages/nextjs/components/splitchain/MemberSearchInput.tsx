"use client";

import { useEffect, useRef, useState } from "react";

interface User {
  address: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface SearchResult {
  users: User[];
  isValidAddress: boolean;
  addressUser: User | null;
  rawAddress: string | null;
}

interface MemberSearchInputProps {
  onSelect: (address: string, user?: User) => void;
  excludeAddresses?: string[];
  placeholder?: string;
}

export function MemberSearchInput({
  onSelect,
  excludeAddresses = [],
  placeholder = "Search by name or paste address...",
}: MemberSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const excludeSet = new Set(excludeAddresses.map(a => a.toLowerCase()));

  // Search API call
  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
        setIsOpen(true);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300); // Debounce

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (address: string, user?: User) => {
    onSelect(address, user);
    setQuery("");
    setResults(null);
    setIsOpen(false);
  };

  // Filter out excluded addresses
  const filteredUsers = results?.users.filter(u => !excludeSet.has(u.address.toLowerCase())) || [];
  const canAddRawAddress =
    results?.isValidAddress && results?.rawAddress && !excludeSet.has(results.rawAddress) && !results.addressUser;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results && setIsOpen(true)}
          placeholder={placeholder}
          className="input input-bordered w-full"
        />
        {isLoading && <span className="loading loading-spinner loading-sm absolute right-3"></span>}
      </div>

      {/* Dropdown */}
      {isOpen && (filteredUsers.length > 0 || canAddRawAddress || results?.addressUser) && (
        <div className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {/* Existing users from search */}
          {filteredUsers.map(user => (
            <button
              key={user.address}
              onClick={() => handleSelect(user.address, user)}
              className="flex items-center gap-3 w-full p-3 hover:bg-base-200 transition-colors text-left"
            >
              <div className="avatar placeholder">
                <div className="bg-neutral text-neutral-content rounded-full w-8">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.displayName} />
                  ) : (
                    <span className="text-xs">{user.displayName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
              </div>
              <div>
                <p className="font-medium">{user.displayName}</p>
                <p className="text-xs opacity-60 font-mono">
                  {user.address.slice(0, 6)}...{user.address.slice(-4)}
                </p>
              </div>
              <span className="ml-auto text-success">✓</span>
            </button>
          ))}

          {/* Address exists in DB */}
          {results?.addressUser && !excludeSet.has(results.addressUser.address.toLowerCase()) && (
            <button
              onClick={() => handleSelect(results.addressUser!.address, results.addressUser!)}
              className="flex items-center gap-3 w-full p-3 hover:bg-base-200 transition-colors text-left border-t border-base-300"
            >
              <div className="avatar placeholder">
                <div className="bg-primary text-primary-content rounded-full w-8">
                  <span className="text-xs">{results.addressUser.displayName.charAt(0).toUpperCase()}</span>
                </div>
              </div>
              <div>
                <p className="font-medium">{results.addressUser.displayName}</p>
                <p className="text-xs opacity-60 font-mono">{query}</p>
              </div>
              <span className="ml-auto text-success">✓</span>
            </button>
          )}

          {/* Add as new raw address */}
          {canAddRawAddress && (
            <button
              onClick={() => handleSelect(results.rawAddress!)}
              className="flex items-center gap-3 w-full p-3 hover:bg-base-200 transition-colors text-left border-t border-base-300"
            >
              <div className="avatar placeholder">
                <div className="bg-warning text-warning-content rounded-full w-8">
                  <span className="text-lg">+</span>
                </div>
              </div>
              <div>
                <p className="font-medium text-warning">Add as new wallet</p>
                <p className="text-xs opacity-60 font-mono">
                  {results.rawAddress!.slice(0, 10)}...{results.rawAddress!.slice(-8)}
                </p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* No results message */}
      {isOpen &&
        query.length >= 2 &&
        !isLoading &&
        filteredUsers.length === 0 &&
        !canAddRawAddress &&
        !results?.addressUser && (
          <div className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg p-3 text-center opacity-60">
            <p className="text-sm">No users found. Enter a valid 0x address to add.</p>
          </div>
        )}
    </div>
  );
}
