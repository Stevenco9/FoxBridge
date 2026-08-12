-- Sprint 22.5 closeout — fix Linked redeem regression
-- Root cause: migration 013 wrote audit action 'linked_desktop_rejoined'
-- which was not allowed by desk_device_audit_action_check (from 012).
-- Rejoin after revoke/expiry failed the RPC transaction; UI often hid the error.

ALTER TABLE desk_device_audit
  DROP CONSTRAINT IF EXISTS desk_device_audit_action_check;

ALTER TABLE desk_device_audit
  ADD CONSTRAINT desk_device_audit_action_check CHECK (
    action IN (
      'principal_claimed',
      'principal_transferred',
      'principal_revoked',
      'join_code_issued',
      'join_code_redeemed',
      'linked_desktop_created',
      'linked_desktop_revoked',
      'linked_desktop_rejoined'
    )
  );

COMMENT ON TABLE desk_device_audit IS
  'Desk trust audit (Principal + Linked, including rejoin). Never store registration API keys, raw join codes, or raw desk tokens.';
