export type Chain = 'ethereum' | 'polygon' | 'arbitrum' | 'base' | 'optimism' | 'solana'
export type Token = 'USDC' | 'USDT'

export type Wallet = {
  id: string
  user_id: string
  mpc_wallet_id: string
  chain: Chain
  address: string
  derivation_path: string
  created_at: string
}

export type WalletWithBalance = {
  wallet: Wallet
  balances: { USDC: string; USDT: string }
}

export type TxStatus =
  | 'draft'
  | 'policy_check'
  | 'signing'
  | 'signed'
  | 'broadcast'
  | 'confirmed'
  | 'failed'

export type Tx = {
  id: string
  wallet_id: string
  tx_id: string
  chain: string
  token: Token
  to_address: string
  amount_raw: string
  status: TxStatus
  tx_hash?: string
  block_number?: number
  created_at: string
}

export type PolicyRules = {
  max_single_tx?: string
  daily_limit?: string
  velocity_per_hour?: string
  dest_whitelist?: string // JSON-encoded string[]
}

export type AuthTokens = {
  access_token: string
  refresh_token: string
  expires_in: number
}

export type ApiError = {
  error: string
}
