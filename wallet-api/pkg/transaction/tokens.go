package transaction

import (
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/common"
)

// token contract addresses (checksummed)
var tokenAddresses = map[string]map[string]common.Address{
	"ethereum": {
		"USDC": common.HexToAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
		"USDT": common.HexToAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7"),
	},
	"polygon": {
		"USDC": common.HexToAddress("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"),
		"USDT": common.HexToAddress("0xc2132D05D31c914a87C6611C10748AEb04B58e8F"),
	},
	"arbitrum": {
		"USDC": common.HexToAddress("0xaf88d065e77c8cC2239327C5EDb3A432268e5831"),
		"USDT": common.HexToAddress("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"),
	},
	"base": {
		"USDC": common.HexToAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
		// USDT not natively available on Base mainnet
	},
	"optimism": {
		"USDC": common.HexToAddress("0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"),
		"USDT": common.HexToAddress("0x94b008aA00579c1307B0EF2c499aD98a8ce58e58"),
	},
}

// chainIDs maps chain name to EIP-155 chain ID.
var chainIDs = map[string]*big.Int{
	"ethereum": big.NewInt(1),
	"polygon":  big.NewInt(137),
	"arbitrum": big.NewInt(42161),
	"base":     big.NewInt(8453),
	"optimism": big.NewInt(10),
}

func TokenAddress(chain, token string) (common.Address, error) {
	chain = strings.ToLower(chain)
	token = strings.ToUpper(token)
	chains, ok := tokenAddresses[chain]
	if !ok {
		return common.Address{}, fmt.Errorf("unknown chain: %s", chain)
	}
	addr, ok := chains[token]
	if !ok {
		return common.Address{}, fmt.Errorf("unsupported token %s on %s", token, chain)
	}
	return addr, nil
}

func ChainID(chain string) (*big.Int, error) {
	id, ok := chainIDs[strings.ToLower(chain)]
	if !ok {
		return nil, fmt.Errorf("unknown chain: %s", chain)
	}
	return new(big.Int).Set(id), nil
}

// TokenDecimals returns the number of decimal places for a stablecoin.
// USDC and USDT both use 6 on Ethereum and Polygon.
func TokenDecimals(_ string) uint8 {
	return 6
}
