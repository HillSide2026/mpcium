package middleware

import (
	"net/http"
)

const serviceTokenHeader = "X-Granville-Service-Token"

// ServiceToken authenticates backend-to-backend calls from Granville.
// The token is a shared secret configured in both services.
// SECURITY: always use HTTPS in production so this token is not exposed in transit.
func ServiceToken(expectedToken string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if expectedToken == "" {
				// Service token not configured — reject all service route calls.
				http.Error(w, `{"error":"service auth not configured"}`, http.StatusServiceUnavailable)
				return
			}
			token := r.Header.Get(serviceTokenHeader)
			if token != expectedToken {
				http.Error(w, `{"error":"invalid service token"}`, http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
