// Per-chain gradient and label config, inspired by BlueWallet's LinearGradient cards.
export type ChainTheme = {
  from: string
  via?: string
  to: string
  label: string
}

const themes: Record<string, ChainTheme> = {
  ethereum: { from: '#0f5cc0', via: '#1a6fd4', to: '#007aff', label: 'Ethereum'  },
  polygon:  { from: '#6f3de8', via: '#8247e5', to: '#a855f7', label: 'Polygon'   },
  arbitrum: { from: '#1B4ADD', via: '#2558f0', to: '#2D6FFF', label: 'Arbitrum'  },
  base:     { from: '#0052FF', via: '#0f65ff', to: '#1A6FFF', label: 'Base'       },
  optimism: { from: '#E4002B', via: '#f01040', to: '#FF3B5C', label: 'Optimism'  },
  solana:   { from: '#9945FF', via: '#6dc6a8', to: '#14F195', label: 'Solana'    },
}

export function chainTheme(chain: string): ChainTheme {
  return themes[chain.toLowerCase()] ?? themes.ethereum
}

// Inline style for gradient (Tailwind JIT can't handle dynamic values)
export function gradientStyle(theme: ChainTheme): React.CSSProperties {
  return {
    background: theme.via
      ? `linear-gradient(135deg, ${theme.from} 0%, ${theme.via} 50%, ${theme.to} 100%)`
      : `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)`,
  }
}
