package handlers

import (
	"net/http"

	"github.com/hillside2026/wallet-api/pkg/mpc"
	"github.com/spf13/viper"
)

type ClusterHandler struct {
	mpcClient *mpc.Client
}

func NewClusterHandler(mpcClient *mpc.Client) *ClusterHandler {
	return &ClusterHandler{mpcClient: mpcClient}
}

type clusterResponse struct {
	Nodes     []nodeInfo `json:"nodes"`
	Threshold int        `json:"threshold"`
	Total     int        `json:"total"`
	Healthy   bool       `json:"healthy"`
}

type nodeInfo struct {
	Name   string `json:"name"`
	Status string `json:"status"` // "online" | "unknown"
}

func (h *ClusterHandler) Status(w http.ResponseWriter, r *http.Request) {
	health := h.mpcClient.Health()

	threshold := viper.GetInt("mpc.threshold")
	if threshold == 0 {
		threshold = 2
	}

	// Node names come from peers config if set, otherwise use defaults.
	peerNames := viper.GetStringSlice("mpc.peer_names")
	if len(peerNames) == 0 {
		peerNames = []string{"node0", "node1", "node2"}
	}

	status := "unknown"
	if health.Connected {
		status = "online"
	}

	nodes := make([]nodeInfo, len(peerNames))
	for i, name := range peerNames {
		nodes[i] = nodeInfo{Name: name, Status: status}
	}

	writeJSON(w, http.StatusOK, clusterResponse{
		Nodes:     nodes,
		Threshold: threshold,
		Total:     len(peerNames),
		Healthy:   health.Connected,
	})
}
