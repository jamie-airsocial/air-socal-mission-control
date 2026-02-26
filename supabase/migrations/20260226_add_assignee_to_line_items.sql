-- Add assignee_id column to contract_line_items table
ALTER TABLE contract_line_items
ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES app_users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contract_line_items_assignee_id
  ON contract_line_items(assignee_id);

COMMENT ON COLUMN contract_line_items.assignee_id IS 'Delivery person responsible for this billing item';
