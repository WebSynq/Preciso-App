import type { ActorType } from '@preciso/types';

import { createAdminClient } from '../lib/supabase';

interface AuditEntry {
  actorId: string;
  actorType: ActorType;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Writes an entry to the audit_logs table.
 * Uses admin client (service role) to bypass RLS.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from('audit_logs').insert({
    actor_id: entry.actorId,
    actor_type: entry.actorType,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId,
    ip_address: entry.ipAddress || null,
    user_agent: entry.userAgent || null,
  });

  if (error) {
    console.error('[AuditLog] Failed to write audit entry', {
      error: error.message,
      entry,
    });
  }
}
