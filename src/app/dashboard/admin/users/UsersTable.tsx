"use client";

import { useState } from "react";
import { toggleBlockUser, deleteUser } from "./actions";

interface Subscription {
  id: string;
  tier: string;
  status: string;
  mt5AccountNumber: string | null;
}

interface UserData {
  id: string;
  email: string;
  role: string;
  isBlocked: boolean;
  isDeleted: boolean;
  createdAt: Date;
  subscriptions: Subscription[];
}

export default function UsersTable({ users, currentUserId }: { users: UserData[], currentUserId: string }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleToggleBlock(userId: string, currentStatus: boolean) {
    if (userId === currentUserId) return alert("You cannot block yourself.");
    
    setLoadingId(userId);
    try {
      await toggleBlockUser(userId, currentStatus);
    } catch (e: any) {
      alert(e.message || "Failed to update block status");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(userId: string) {
    if (userId === currentUserId) return alert("You cannot delete yourself.");
    if (!confirm("Are you sure you want to permanently delete this user? Their orders and subscriptions will also be removed.")) return;
    
    setLoadingId(userId);
    try {
      await deleteUser(userId);
    } catch (e: any) {
      alert(e.message || "Failed to delete user");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="glass-panel" style={{ overflowX: 'auto' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Platform Users</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
            <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Email</th>
            <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Role</th>
            <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Active Licenses</th>
            <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Joined</th>
            <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Access</th>
            <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No users found.
              </td>
            </tr>
          )}
          {users.map(user => {
            const activeSubs = user.subscriptions.filter(s => s.status === 'ACTIVE').length;
            const isLoading = loadingId === user.id;
            const isSelf = user.id === currentUserId;

            return (
              <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: user.isBlocked ? 'rgba(255, 0, 0, 0.05)' : 'transparent' }}>
                <td style={{ padding: '1.5rem 1rem' }}>
                  {user.email}
                  {user.isDeleted && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', backgroundColor: '#6b7280', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>DELETED</span>}
                  {user.isBlocked && !user.isDeleted && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', backgroundColor: '#ef4444', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>BLOCKED</span>}
                </td>
                <td style={{ padding: '1.5rem 1rem', opacity: user.isDeleted ? 0.5 : 1 }}>{user.role}</td>
                <td style={{ padding: '1.5rem 1rem', opacity: user.isDeleted ? 0.5 : 1 }}>{user.isDeleted ? 0 : activeSubs}</td>
                <td style={{ padding: '1.5rem 1rem', fontSize: '0.9rem', color: 'var(--text-secondary)', opacity: user.isDeleted ? 0.5 : 1 }}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '1.5rem 1rem' }}>
                  <span style={{ color: user.isDeleted ? '#9ca3af' : user.isBlocked ? '#fca5a5' : 'var(--accent-accent)' }}>
                    {user.isDeleted ? 'Deleted' : user.isBlocked ? 'Restricted' : 'Granted'}
                  </span>
                </td>
                <td style={{ padding: '1.5rem 1rem', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    {!isSelf && !user.isDeleted && (
                      <button
                        onClick={() => handleToggleBlock(user.id, user.isBlocked)}
                        disabled={isLoading}
                        style={{
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.8rem',
                          backgroundColor: user.isBlocked ? '#10B981' : '#F59E0B',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          opacity: isLoading ? 0.7 : 1
                        }}
                      >
                        {user.isBlocked ? 'Unblock' : 'Block'}
                      </button>
                    )}
                    {!isSelf && !user.isDeleted && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={isLoading}
                        style={{
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.8rem',
                          backgroundColor: '#EF4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          opacity: isLoading ? 0.7 : 1
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
